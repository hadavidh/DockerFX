'use strict'
const express   = require('express')
const http      = require('http')
const WebSocket = require('ws')
const cors      = require('cors')
const axios     = require('axios')
const CTrader   = require('./ctrader-service')
const { loginRoute, requireAuth } = require('./auth')

const app    = express()
const server = http.createServer(app)
const wss    = new WebSocket.Server({ server, path: '/ws' })

app.use(cors())
app.use(express.json())

// ── Auth middleware (protège toutes les routes sauf /webhook et /health) ──
app.use(requireAuth)
app.post('/auth/login', loginRoute)

const PORT              = process.env.PORT                   || 3001
const TELEGRAM_TOKEN    = process.env.TELEGRAM_TOKEN         || ''
const TELEGRAM_CHATID   = process.env.TELEGRAM_CHATID        || ''
const CTRADER_CLIENT_ID = process.env.CTRADER_CLIENT_ID      || ''
const CTRADER_SECRET    = process.env.CTRADER_CLIENT_SECRET  || ''
const CTRADER_TOKEN     = process.env.CTRADER_ACCESS_TOKEN   || ''
const CTRADER_ACCOUNT   = process.env.CTRADER_ACCOUNT_ID     || ''

const log = {
  info : (...a) => console.log(new Date().toISOString(), '[INFO]',  ...a),
  error: (...a) => console.error(new Date().toISOString(), '[ERROR]', ...a),
  warn : (...a) => console.warn(new Date().toISOString(),  '[WARN]',  ...a),
}

const PAIRS = [
  'EURUSD','GBPUSD','USDJPY','USDCHF','AUDUSD','USDCAD','NZDUSD',
  'EURGBP','EURJPY','EURCHF','EURAUD','EURCAD','EURNZD',
  'GBPJPY','GBPCHF','GBPAUD','GBPCAD','GBPNZD',
  'AUDJPY','AUDCHF','AUDCAD','AUDNZD',
  'CADJPY','CADCHF','CHFJPY','NZDJPY','NZDCHF','NZDCAD',
]

// ── État par paire : htf + ltf séparés ───────────────────────────
function emptySignal(pair) {
  return {
    htf: null,   // signal 4H (ou EMA200 rejection)
    ltf: null,   // signal TRÈS FORT 15min
    pair,
    hasSignal: false,
  }
}
const pairStates = {}
PAIRS.forEach(p => { pairStates[p] = emptySignal(p) })
const signalHistory = []

// ── cTrader ───────────────────────────────────────────────────────
let ctrader = null
if (CTRADER_CLIENT_ID && CTRADER_SECRET && CTRADER_TOKEN) {
  ctrader = new CTrader({
    clientId: CTRADER_CLIENT_ID, clientSecret: CTRADER_SECRET,
    accessToken: CTRADER_TOKEN,  accountId: CTRADER_ACCOUNT, log: log.info,
  })
  ctrader.connect()
    .then(() => log.info('[cTrader] Prêt ✅'))
    .catch(e  => log.error('[cTrader] Erreur:', e.message))
} else {
  log.warn('[cTrader] Variables manquantes — mode SIMULATION')
}

// ── Telegram ──────────────────────────────────────────────────────
async function sendTelegram(d, isLtf = false) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHATID) return
  const isEma = d.signal === 'EMA200_REJECTION'
  const isTF  = isLtf || d.signal === 'SIGNAL_TRES_FORT_15M'
  const s     = d.action === 'BUY' ? '🟢' : '🔴'
  const hdr   = isTF  ? `⚡ *SIGNAL TRÈS FORT 15M*` :
                isEma ? `📊 *EMA 200 REJECTION*`    : `${s} *Signal ICT ${d.tf}H*`
  const type  = d.entry_type ? `\n📌 Type     : \`${d.entry_type}\`` : ''
  const txt   = `${hdr} — *${d.pair}*\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `▶️  Action  : \`${d.action}\`\n` +
    `💲 Entry   : \`${d.price}\`\n` +
    `🛑 SL      : \`${d.sl}\`\n` +
    `🎯 TP      : \`${d.tp}\`\n` +
    `📈 Prob    : \`${d.prob}%\` — ${d.quality}${type}`
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
      { chat_id: TELEGRAM_CHATID, text: txt, parse_mode: 'Markdown', disable_web_page_preview: true },
      { timeout: 8000 })
    log.info(`[Telegram] ✅ ${d.action} ${d.pair} ${isTF ? '⚡15M' : ''}`)
  } catch (e) { log.error(`[Telegram] ❌ ${e.message}`) }
}

async function sendTelegramRaw(text) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHATID) return
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
      { chat_id: TELEGRAM_CHATID, text, parse_mode: 'Markdown', disable_web_page_preview: true },
      { timeout: 8000 })
  } catch (e) { log.error('[Telegram raw]', e.message) }
}

// ── WebSocket broadcast ───────────────────────────────────────────
function broadcast(data) {
  const msg = JSON.stringify(data)
  wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(msg) })
}
wss.on('connection', (ws, req) => {
  log.info(`[WS] Client connecté (${wss.clients.size})`)
  ws.send(JSON.stringify({ type: 'init', states: pairStates, history: signalHistory.slice(0, 20) }))
  ws.on('close', () => log.info(`[WS] Client déconnecté (${wss.clients.size})`))
})

// ── WEBHOOK TradingView ───────────────────────────────────────────
app.post('/webhook', async (req, res) => {
  const d    = req.body
  const pair = (d.pair || '').replace(/^[A-Z]+:/, '').toUpperCase().trim()
  if (!pair || !d.action) return res.status(400).json({ error: 'pair et action requis' })

  const prob   = parseInt(d.prob, 10) || 0
  const isLtf  = d.signal === 'SIGNAL_TRES_FORT_15M'
  const isEma  = d.signal === 'EMA200_REJECTION'

  const entry = {
    pair, action: d.action.toUpperCase(),
    price: d.price || null, sl: d.sl || null, tp: d.tp || null,
    prob, quality: d.quality || 'BON',
    signal: d.signal || 'ICT_CONVERGENCE',
    tf: d.tf || '240',
    entry_type: d.entry_type || null,
    bias4H: d.bias4H || null,
    receivedAt: new Date().toISOString(),
  }

  if (!pairStates[pair]) pairStates[pair] = emptySignal(pair)

  if (isLtf) {
    // Signal 15min → mise à jour LTF uniquement, HTF conservé
    pairStates[pair].ltf      = entry
    pairStates[pair].hasSignal = true
    log.info(`[Webhook] ⚡ TRÈS FORT 15M ${entry.action} ${pair} | ${prob}% | ${entry.entry_type}`)
  } else {
    // Signal 4H / EMA200 → mise à jour HTF, reset LTF si direction opposée
    const prevHtf = pairStates[pair].htf
    if (prevHtf && prevHtf.action !== entry.action) {
      pairStates[pair].ltf = null   // reset 15min si bias change de direction
    }
    pairStates[pair].htf       = entry
    pairStates[pair].hasSignal = true
    log.info(`[Webhook] ${entry.action} ${pair} | ${prob}% | ${entry.quality} | ${entry.signal}`)
  }

  signalHistory.unshift(entry)
  if (signalHistory.length > 100) signalHistory.length = 100

  broadcast({ type: 'signal', state: pairStates[pair] })
  await sendTelegram(entry, isLtf)

  res.json({ ok: true, pair, action: entry.action, level: isLtf ? 'ltf' : 'htf' })
})

// ── ORDRE → cTrader ───────────────────────────────────────────────
app.post('/api/order', async (req, res) => {
  const { symbol, action, lots, sl, tp, comment } = req.body
  if (!symbol || !action || !lots) return res.status(400).json({ error: 'symbol, action, lots requis' })
  const order = {
    symbol: symbol.replace(/^[A-Z]+:/, '').toUpperCase(), side: action.toUpperCase(),
    volume: parseFloat(lots), stopLoss: sl ? String(sl) : '0', takeProfit: tp ? String(tp) : '0',
    comment: comment || `ICT Dashboard ${action} ${symbol}`,
  }
  log.info(`[Order] ${order.side} ${order.volume}L ${order.symbol} SL=${order.stopLoss} TP=${order.takeProfit}`)
  if (!ctrader || !ctrader.isReady) {
    log.warn('[Order] Mode simulation')
    const simId = Math.floor(Math.random() * 900000) + 100000
    await sendTelegramRaw(`🧪 *SIMULATION* — ${order.side} ${order.symbol}\n📦 \`${order.volume}L\` | 🎫 \`${simId}\`\n⚠️ _cTrader non connecté_`)
    return res.json({ ok: true, positionId: simId, symbol: order.symbol, side: order.side, volume: order.volume, price: 'SIMULATION', simulated: true })
  }
  try {
    const result = await ctrader.placeOrder(order)
    log.info(`[Order] ✅ positionId=${result.positionId}`)
    await sendTelegramRaw(`✅ *ORDRE EXÉCUTÉ* — ${order.side} ${order.symbol}\n📦 \`${order.volume}L\` | 🎫 \`${result.positionId}\`\n💲 \`${result.price}\``)
    res.json(result)
  } catch (e) { log.error(`[Order] ❌ ${e.message}`); res.status(500).json({ error: e.message }) }
})

// ── GET API ───────────────────────────────────────────────────────
app.get('/api/states',   (_, res) => res.json(pairStates))
app.get('/api/history',  (_, res) => res.json(signalHistory))
app.get('/api/ctrader',  (_, res) => res.json({ ready: ctrader?.isReady || false, connected: ctrader?.connected || false, appAuthed: ctrader?.appAuthed || false, acctAuthed: ctrader?.acctAuthed || false, accountId: ctrader?.accountId || null, simMode: !ctrader }))

app.get('/api/test', async (_, res) => {
  const tests = [
    { pair:'EURUSD', action:'BUY',  price:'1.08450', sl:'1.07800', tp:'1.10100', prob:'82', quality:'EXCELLENT',           tf:'240', signal:'ICT_CONVERGENCE'    },
    { pair:'GBPUSD', action:'SELL', price:'1.27350', sl:'1.28100', tp:'1.25600', prob:'76', quality:'BON',                 tf:'240', signal:'ICT_CONVERGENCE'    },
    { pair:'USDJPY', action:'BUY',  price:'149.520', sl:'148.800', tp:'151.200', prob:'75', quality:'EMA200_REJECTION',    tf:'240', signal:'EMA200_REJECTION'    },
    { pair:'EURUSD', action:'BUY',  price:'1.08350', sl:'1.08200', tp:'1.09500', prob:'95', quality:'SIGNAL_TRES_FORT_15M', tf:'15', signal:'SIGNAL_TRES_FORT_15M', entry_type:'E1-Pullback', bias4H:'BUY' },
  ]
  for (const t of tests) {
    const pair  = t.pair
    const isLtf = t.signal === 'SIGNAL_TRES_FORT_15M'
    if (!pairStates[pair]) pairStates[pair] = emptySignal(pair)
    const entry = { ...t, receivedAt: new Date().toISOString() }
    if (isLtf) { pairStates[pair].ltf = entry }
    else        { pairStates[pair].htf = entry; pairStates[pair].ltf = null }
    pairStates[pair].hasSignal = true
    signalHistory.unshift(entry)
    broadcast({ type: 'signal', state: pairStates[pair] })
  }
  res.json({ ok: true, injected: tests.length })
})

app.post('/api/reset/:pair', (req, res) => {
  const pair = req.params.pair.toUpperCase()
  if (!pairStates[pair]) return res.status(404).json({ error: 'Paire inconnue' })
  pairStates[pair] = emptySignal(pair)
  broadcast({ type: 'signal', state: pairStates[pair] })
  res.json({ ok: true, pair })
})

app.get('/health', (_, res) => res.json({ ok: true, uptime: process.uptime(), pairs: PAIRS.length, signals: signalHistory.length, ctrader: ctrader?.isReady || false }))

server.listen(PORT, () => {
  console.log(`
🚀 ICT Trading Backend — port ${PORT}
   POST /webhook      ← TradingView (HTF + LTF séparés)
   POST /api/order    ← Ordres cTrader/FTMO
   GET  /api/states   ← 28 paires (htf + ltf)
   GET  /api/ctrader  ← Statut cTrader
   GET  /api/test     ← Signaux de test
   WS   /ws           ← WebSocket temps réel
${!TELEGRAM_TOKEN ? '⚠️  TELEGRAM_TOKEN manquant' : '✅  Telegram OK'}
${!CTRADER_CLIENT_ID ? '⚠️  CTRADER_* manquants (simulation)' : '✅  cTrader configuré'}
`)
})
module.exports = { app, server }