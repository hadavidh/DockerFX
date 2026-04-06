'use strict'

const express         = require('express')
const http            = require('http')
const WebSocket       = require('ws')
const cors            = require('cors')
const axios           = require('axios')
const CTrader         = require('./ctrader-service')
const StrategyManager = require('./strategy-manager')
const { loginRoute, requireAuth } = require('./auth')

const app    = express()
const server = http.createServer(app)
const wss    = new WebSocket.Server({ server, path: '/ws' })

app.use(cors())
app.use(express.json())
app.use(requireAuth)
app.post('/auth/login', loginRoute)

// ── Variables d'environnement ─────────────────────────────────────
const PORT                 = process.env.PORT                    || 3001
const TELEGRAM_TOKEN       = process.env.TELEGRAM_TOKEN          || ''
const TELEGRAM_CHATID      = process.env.TELEGRAM_CHATID         || ''
const CTRADER_ID           = process.env.CTRADER_CLIENT_ID       || ''
const CTRADER_SECRET       = process.env.CTRADER_CLIENT_SECRET   || ''
const CTRADER_TOKEN        = process.env.CTRADER_ACCESS_TOKEN    || ''
const CTRADER_ACCOUNT      = process.env.CTRADER_ACCOUNT_ID      || ''
const CTRADER_ACCOUNT_DEMO = process.env.CTRADER_ACCOUNT_DEMO    || ''
const CTRADER_ACCOUNT_LIVE = process.env.CTRADER_ACCOUNT_LIVE    || ''
const RISK_PERCENT         = parseFloat(process.env.RISK_PERCENT     || '1')
const FALLBACK_BALANCE     = parseFloat(process.env.FALLBACK_BALANCE || '10000')

const log = {
  info : (...a) => console.log(new Date().toISOString(),  '[INFO]',  ...a),
  error: (...a) => console.error(new Date().toISOString(), '[ERROR]', ...a),
  warn : (...a) => console.warn(new Date().toISOString(),  '[WARN]',  ...a),
}

const SM = new StrategyManager()
log.info(`[Strategy] ${SM.getStrategies().length} strategies chargees`)

// ── AUTO MODE ─────────────────────────────────────────────────────
let autoMode = true

// ── Pip values ────────────────────────────────────────────────────
const PIP_VALUE = {
  USDJPY:9.1,EURJPY:9.1,GBPJPY:9.1,AUDJPY:9.1,NZDJPY:9.1,CADJPY:9.1,CHFJPY:9.1,
  AUDUSD:10,NZDUSD:10,EURUSD:10,GBPUSD:10,
  USDCHF:11,EURCHF:11,GBPCHF:11,AUDCHF:11,CADCHF:11,NZDCHF:11,
  USDCAD:7.4,EURCAD:7.4,GBPCAD:7.4,AUDCAD:7.4,NZDCAD:7.4,
  EURGBP:12.5,GBPAUD:6.5,GBPNZD:5.9,EURNZD:5.9,AUDNZD:5.9,
}

// ── Calcul lots dynamique ─────────────────────────────────────────
async function calcLotsDynamic(entry, sl, pair) {
  let balance = FALLBACK_BALANCE
  try {
    if (ctrader?.isReady) balance = await ctrader.getAccountBalance()
  } catch (e) {
    log.warn(`[Lots] Fallback $${balance} — ${e.message}`)
  }
  const riskUSD = balance * (RISK_PERCENT / 100)
  const diff    = Math.abs(parseFloat(entry) - parseFloat(sl))
  if (!diff || isNaN(diff)) return 0.01
  const pipSize = (pair || '').includes('JPY') ? 0.01 : 0.0001
  const pips    = diff / pipSize
  const pipVal  = PIP_VALUE[pair] || 10
  const lots    = riskUSD / (pips * pipVal)
  const rounded = Math.max(0.01, Math.round(lots * 100) / 100)
  log.info(`[Lots] Balance=$${balance.toFixed(0)} | Risk=${RISK_PERCENT}%=$${riskUSD.toFixed(0)} | Pips=${pips.toFixed(1)} | Lots=${rounded}`)
  return rounded
}

// ── cTrader ───────────────────────────────────────────────────────
let ctrader = null

function createCTrader(host, accountId) {
  return new CTrader({
    clientId    : CTRADER_ID,
    clientSecret: CTRADER_SECRET,
    accessToken : CTRADER_TOKEN,
    accountId   : accountId || CTRADER_ACCOUNT,
    host,
    log         : log.info,
  })
}

if (CTRADER_ID && CTRADER_SECRET && CTRADER_TOKEN) {
  const initHost    = process.env.CTRADER_HOST || 'live.ctraderapi.com'
  const initAccount = initHost.includes('demo')
    ? (CTRADER_ACCOUNT_DEMO || CTRADER_ACCOUNT)
    : (CTRADER_ACCOUNT_LIVE || CTRADER_ACCOUNT)
  ctrader = createCTrader(initHost, initAccount)
  ctrader.connect()
    .then(() => log.info('[cTrader] Pret ✅'))
    .catch(e  => log.error('[cTrader]', e.message))
} else {
  log.warn('[cTrader] Variables manquantes — SIMULATION')
}

// ── Telegram ──────────────────────────────────────────────────────
async function sendTelegram(d, stratName) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHATID) return
  const s      = d.action === 'BUY' ? '🟢' : '🔴'
  const isNexus = d.signal?.startsWith('NEXUS')
  const hdr    = isNexus ? `${s} *NEXUS Pro*` : `${s} *Signal*`
  const auto   = d.auto_ok === true  ? '\n✅ AUTO OK' :
                 d.auto_ok === false ? '\n⛔ BLOQUE' : ''
  const rr     = d.rr_reel    ? `\n📊 R:R : \`1:${d.rr_reel}\`` : ''
  const score  = d.score      ? ` · Score \`${d.score}/100\`` : ''
  const modeStr= autoMode ? '' : '\n⚠️ _AutoMode OFF_'
  const txt    = `${hdr} — *${d.pair}* [${stratName||d.strategy||'?'}]\n` +
    `━━━━━━━━━━━━━━━\n▶️ \`${d.action}\` | 💲 \`${d.price}\`\n` +
    `🛑 \`${d.sl}\` | 🎯 \`${d.tp_reel||d.tp}\`\n` +
    `📈 \`${d.prob}%\`${score}${rr}${auto}${modeStr}`
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
      { chat_id:TELEGRAM_CHATID, text:txt, parse_mode:'Markdown', disable_web_page_preview:true },
      { timeout:8000 })
  } catch (e) { log.error('[Telegram]', e.message) }
}

async function sendTelegramRaw(text) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHATID) return
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
      { chat_id:TELEGRAM_CHATID, text, parse_mode:'Markdown', disable_web_page_preview:true },
      { timeout:8000 })
  } catch (e) { log.error('[Telegram raw]', e.message) }
}

// ── WebSocket ─────────────────────────────────────────────────────
function broadcast(data) {
  const msg = JSON.stringify(data)
  wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(msg) })
}

wss.on('connection', (ws) => {
  log.info(`[WS] Client connecte (${wss.clients.size})`)
  const active = SM.getActiveStrategy()
  ws.send(JSON.stringify({
    type       : 'init',
    states     : SM.getPairStates(active.id),
    history    : SM.getHistory(active.id, 20),
    strategies : SM.getStrategies(),
    activeStrat: active,
    autoMode,
  }))
  ws.on('close', () => log.info(`[WS] Deconnecte (${wss.clients.size})`))
})

// ══════════════════════════════════════════════════════════════════
// HELPER — Envoi ordre auto (commun ICT + NEXUS)
// ══════════════════════════════════════════════════════════════════
async function placeAutoOrder(entry, d, stratId) {
  const lots = await calcLotsDynamic(entry.price, entry.sl, entry.pair)
  const tp   = entry.tp_reel || entry.tp

  log.info(`[AutoBot][${stratId}] ${entry.action} ${entry.pair} ${lots}L | SL:${entry.sl} TP:${tp}`)

  if (!ctrader || !ctrader.isReady) {
    const simId = Math.floor(Math.random() * 900000) + 100000
    log.warn(`[AutoBot] SIMULATION → ticket ${simId}`)
    await sendTelegramRaw(
      `🤖 *AUTOBOT SIMULATION* — ${entry.action} ${entry.pair}\n` +
      `📦 \`${lots}L\` | 🎫 \`${simId}\`\n` +
      `🛑 \`${entry.sl}\` | 🎯 \`${tp}\`\n` +
      `📊 Score \`${d.score}/100\` | R:R \`1:${d.rr_reel}\`\n` +
      `📌 \`${d.entry_type||'?'}\` | ⚠️ _cTrader non connecte_`
    )
    broadcast({ type:'auto_order', simulated:true, positionId:simId,
                pair:entry.pair, action:entry.action, lots, stratId })
    return { simulated: true, positionId: simId }
  }

  try {
    const r = await ctrader.placeOrder({
      symbol    : entry.pair,
      side      : entry.action,
      volume    : lots,
      stopLoss  : entry.sl,
      takeProfit: tp,
      comment   : `AutoBot ${stratId} ${entry.pair} S${d.score}`,
    })
    log.info(`[AutoBot] ✅ positionId=${r.positionId} price=${r.price}`)
    await sendTelegramRaw(
      `🤖 *AUTOBOT EXECUTE* — ${entry.action} ${entry.pair}\n` +
      `📦 \`${lots}L\` | 🎫 \`${r.positionId}\`\n` +
      `💲 Prix : \`${r.price}\`\n` +
      `🛑 SL : \`${entry.sl}\` | 🎯 TP : \`${tp}\`\n` +
      `📊 Score \`${d.score}/100\` | R:R \`1:${d.rr_reel}\`\n` +
      `💰 Risque : ${RISK_PERCENT}% du capital | Strat: ${stratId}`
    )
    broadcast({ type:'auto_order', simulated:false, positionId:r.positionId,
                pair:entry.pair, action:entry.action, lots, price:r.price, stratId })
    return r
  } catch (e) {
    log.error(`[AutoBot] ❌ ${e.message}`)
    await sendTelegramRaw(`❌ *AUTOBOT ERREUR* — ${entry.pair}\n\`${e.message}\``)
    throw e
  }
}

// ══════════════════════════════════════════════════════════════════
// WEBHOOK
// ══════════════════════════════════════════════════════════════════
app.post('/webhook', async (req, res) => {
  const d = req.body
  if (!d.pair || !d.action) return res.status(400).json({ error: 'pair et action requis' })

  const result = SM.receiveSignal(d)
  if (!result) return res.status(400).json({ error: 'Signal invalide' })
  const { entry, stratId, isLtf } = result
  const strat = SM.getStrategy(stratId)

  log.info(`[Webhook][${stratId}] ${entry.action} ${entry.pair} | auto_ok:${d.auto_ok} | score:${d.score} | autoMode:${autoMode}`)

  const active = SM.getActiveStrategy()
  if (stratId === active.id) {
    broadcast({ type:'signal', state:SM.getPairStates(stratId)[entry.pair], stratId })
  }
  broadcast({ type:'new_signal', entry, stratId })
  await sendTelegram(entry, strat?.name)

  // ── Conditions AUTO-ORDER ─────────────────────────────────────
  const isAutoOk = d.auto_ok === true

  // ICT AutoBot v1
  const isICT        = stratId === 'ICT_AutoBot_v1'
  const isIctSignal  = entry.signal === 'SIGNAL_TRES_FORT_15M'

  // NEXUS Pro v1
  const isNEXUS      = stratId === 'NEXUS_Pro_v1'
  const isNexusSignal= entry.signal === 'NEXUS_TREND_BULL' || entry.signal === 'NEXUS_TREND_BEAR'

  const shouldTrade = ((isICT && isIctSignal) || (isNEXUS && isNexusSignal)) && isAutoOk

  if (shouldTrade) {
    if (!autoMode) {
      log.warn(`[AutoBot] 🔴 AutoMode OFF — ordre ignore (${entry.action} ${entry.pair})`)
      await sendTelegramRaw(
        `🔴 *AUTOMODE OFF* — Ordre ignore\n${entry.action} ${entry.pair} | Score \`${d.score}/100\``
      )
      broadcast({ type:'auto_order_skipped', pair:entry.pair, action:entry.action, reason:'autoMode_off', stratId })
      return res.json({ ok:true, pair:entry.pair, action:entry.action, stratId, autoOrder:false, reason:'autoMode_off' })
    }
    await placeAutoOrder(entry, d, stratId)
  }

  res.json({
    ok        : true,
    pair      : entry.pair,
    action    : entry.action,
    stratId,
    level     : isLtf ? 'ltf' : 'htf',
    autoOrder : shouldTrade && autoMode,
  })
})

// ══════════════════════════════════════════════════════════════════
// API STRATEGIES
// ══════════════════════════════════════════════════════════════════
app.get('/api/strategies',        (_, res)   => res.json(SM.getStrategies()))
app.post('/api/strategies',       (req, res) => res.json(SM.createStrategy(req.body)))
app.put('/api/strategies/:id',    (req, res) => res.json(SM.updateStrategy(req.params.id, req.body)))
app.delete('/api/strategies/:id', (req, res) => res.json(SM.deleteStrategy(req.params.id)))

app.post('/api/strategies/:id/activate', (req, res) => {
  const strat = SM.setActiveStrategy(req.params.id)
  if (strat.error) return res.status(404).json(strat)
  broadcast({ type:'strategy_changed', stratId:req.params.id, strategies:SM.getStrategies() })
  res.json({ ok:true, active:strat })
})

app.post('/api/strategies/:id/reset', (req, res) => {
  SM.resetStrategyPairs(req.params.id)
  broadcast({ type:'pairs_reset', stratId:req.params.id })
  res.json({ ok:true })
})

// ══════════════════════════════════════════════════════════════════
// API AUTO MODE
// ══════════════════════════════════════════════════════════════════
app.get('/api/automode', (_, res) => res.json({ autoMode, riskPercent: RISK_PERCENT }))

app.post('/api/automode', (req, res) => {
  const { enabled } = req.body
  if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled doit etre boolean' })
  autoMode = enabled
  log.info(`[AutoMode] ${autoMode ? '🟢 ACTIVE' : '🔴 DESACTIVE'}`)
  broadcast({ type:'automode_changed', autoMode })
  sendTelegramRaw(
    `${autoMode ? '🟢' : '🔴'} *AutoMode ${autoMode ? 'ACTIVE' : 'DESACTIVE'}*\n` +
    `Ordres automatiques ${autoMode ? 'actifs ✅' : 'suspendus ⛔'}`
  )
  res.json({ ok:true, autoMode })
})

// ── Balance ───────────────────────────────────────────────────────
app.get('/api/balance', async (_, res) => {
  try {
    if (!ctrader?.isReady) return res.json({ balance:null, simMode:true, riskPercent:RISK_PERCENT, riskUSD:null })
    const balance = await ctrader.getAccountBalance()
    const riskUSD = Math.round(balance * (RISK_PERCENT / 100) * 100) / 100
    res.json({ balance, riskPercent:RISK_PERCENT, riskUSD })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ══════════════════════════════════════════════════════════════════
// API DONNEES
// ══════════════════════════════════════════════════════════════════
app.get('/api/states',  (req, res) =>
  res.json(SM.getPairStates(req.query.strategy || SM.getActiveStrategy().id)))

app.get('/api/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 100
  res.json(req.query.strategy ? SM.getHistory(req.query.strategy, limit) : SM.getAllHistory(limit))
})

app.get('/api/stats/:id', (req, res) => res.json(SM.getStats(req.params.id)))

// ── cTrader status ────────────────────────────────────────────────
app.get('/api/ctrader', (_, res) => {
  const host = ctrader?.host || process.env.CTRADER_HOST || 'live.ctraderapi.com'
  res.json({
    ready     : ctrader?.isReady    || false,
    connected : ctrader?.connected  || false,
    appAuthed : ctrader?.appAuthed  || false,
    acctAuthed: ctrader?.acctAuthed || false,
    accountId : ctrader?.accountId  || null,
    simMode   : !ctrader,
    mode      : host.includes('demo') ? 'demo' : 'live',
    host, autoMode,
  })
})

app.post('/api/ctrader/switch', async (req, res) => {
  const { mode } = req.body
  if (!['demo','live'].includes(mode)) return res.status(400).json({ error: 'mode: demo ou live' })
  const host      = mode === 'demo' ? 'demo.ctraderapi.com' : 'live.ctraderapi.com'
  const accountId = mode === 'demo'
    ? (CTRADER_ACCOUNT_DEMO || CTRADER_ACCOUNT)
    : (CTRADER_ACCOUNT_LIVE || CTRADER_ACCOUNT)
  if (!CTRADER_ID || !CTRADER_SECRET || !CTRADER_TOKEN)
    return res.json({ ok:true, mode, host, simMode:true })
  if (ctrader) ctrader.disconnect()
  ctrader = createCTrader(host, accountId)
  try {
    await ctrader.connect()
    broadcast({ type:'ctrader_mode', mode, host, accountId:ctrader.accountId })
    res.json({ ok:true, mode, host, accountId:ctrader.accountId })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/ctrader/mode', (_, res) => {
  const host = ctrader?.host || process.env.CTRADER_HOST || 'live.ctraderapi.com'
  res.json({ mode:host.includes('demo')?'demo':'live', host, ready:ctrader?.isReady||false,
             accountId:ctrader?.accountId||null, simMode:!ctrader })
})

// ── Ordre manuel ──────────────────────────────────────────────────
app.post('/api/order', async (req, res) => {
  const { symbol, action, lots, sl, tp, comment } = req.body
  if (!symbol || !action || !lots) return res.status(400).json({ error:'symbol, action, lots requis' })
  const order = {
    symbol    : symbol.replace(/^[A-Z]+:/,'').toUpperCase(),
    side      : action.toUpperCase(),
    volume    : parseFloat(lots),
    stopLoss  : sl ? String(sl) : '0',
    takeProfit: tp ? String(tp) : '0',
    comment   : comment || `Dashboard ${action} ${symbol}`,
  }
  if (!ctrader || !ctrader.isReady) {
    const simId = Math.floor(Math.random()*900000)+100000
    await sendTelegramRaw(`🧪 *SIMULATION* — ${order.side} ${order.symbol}\n📦 \`${order.volume}L\` | 🎫 \`${simId}\``)
    return res.json({ ok:true, positionId:simId, symbol:order.symbol, side:order.side, volume:order.volume, price:'SIMULATION', simulated:true })
  }
  try {
    const result = await ctrader.placeOrder(order)
    await sendTelegramRaw(`✅ *ORDRE MANUEL* — ${order.side} ${order.symbol}\n📦 \`${order.volume}L\` | 🎫 \`${result.positionId}\`\n💲 \`${result.price}\``)
    res.json(result)
  } catch (e) { log.error('[Order]', e.message); res.status(500).json({ error: e.message }) }
})

// ── Test ──────────────────────────────────────────────────────────
app.get('/api/test', async (req, res) => {
  const stratId = req.query.strategy || SM.getActiveStrategy().id
  const tests = [
    { pair:'EURUSD', action:'BUY',  price:'1.08450', sl:'1.07800', tp:'1.09500', tp_reel:'1.09400',
      prob:'82', quality:'EXCELLENT', tf:'240', signal:'NEXUS_TREND_BULL',
      strategy:stratId, auto_ok:true, rr_reel:'2.1', score:82, entry_type:'SuperTrend_Flip' },
    { pair:'GBPUSD', action:'SELL', price:'1.27350', sl:'1.28100', tp:'1.25600', tp_reel:'1.25600',
      prob:'75', quality:'BON',       tf:'240', signal:'NEXUS_TREND_BEAR',
      strategy:stratId, auto_ok:true, rr_reel:'1.9', score:71, entry_type:'SuperTrend_Flip' },
    { pair:'USDJPY', action:'BUY',  price:'149.520', sl:'148.800', tp:'151.200', tp_reel:'151.200',
      prob:'68', quality:'BON',       tf:'240', signal:'NEXUS_TREND_BULL',
      strategy:stratId, auto_ok:false, rr_reel:'1.3', score:58, entry_type:'SuperTrend_Flip' },
  ]
  for (const t of tests) SM.receiveSignal(t)
  const active = SM.getActiveStrategy()
  broadcast({ type:'init', states:SM.getPairStates(active.id), history:SM.getHistory(active.id,20),
              strategies:SM.getStrategies(), activeStrat:active, autoMode })
  res.json({ ok:true, injected:tests.length, stratId })
})

app.post('/api/reset/:pair', (req, res) => {
  const stratId = req.query.strategy || SM.getActiveStrategy().id
  const pair    = req.params.pair.toUpperCase()
  const states  = SM.getPairStates(stratId)
  if (states[pair]) {
    states[pair] = { pair, htf:null, ltf:null, hasSignal:false }
    broadcast({ type:'signal', state:states[pair], stratId })
  }
  res.json({ ok:true, pair })
})

app.get('/health', (_, res) => res.json({
  ok:true, uptime:process.uptime(),
  strategies:SM.getStrategies().length,
  ctrader:ctrader?.isReady||false,
  mode:(ctrader?.host||'live').includes('demo')?'demo':'live',
  autoMode, riskPercent:RISK_PERCENT,
}))

server.listen(PORT, () => {
  const host = process.env.CTRADER_HOST || 'live.ctraderapi.com'
  console.log(`
🚀 ICT Trading Dashboard v3 — port ${PORT}
${!TELEGRAM_TOKEN ? '⚠️  TELEGRAM manquant'             : '✅  Telegram OK'}
${!CTRADER_ID     ? '⚠️  CTRADER manquant (simulation)' : `✅  cTrader → ${host}`}
💰  Risque : ${RISK_PERCENT}% | Fallback $${FALLBACK_BALANCE}
🤖  AutoMode : ${autoMode ? '🟢 ON' : '🔴 OFF'}
🔷  Strategies actives : ICT_AutoBot_v1 + NEXUS_Pro_v1
`)
})

module.exports = { app, server }