'use strict'

const express         = require('express')
const http            = require('http')
const WebSocket       = require('ws')
const cors            = require('cors')
const axios           = require('axios')
const multer          = require('multer')
const CTrader         = require('./ctrader-service')
const StrategyManager = require('./strategy-manager')
const JournalManager  = require('./journal-manager')
const AccountManager  = require('./account-manager')
const DrawdownMonitor = require('./drawdown-monitor')
const TelegramBot     = require('./telegram-bot')
const { loginRoute, requireAuth } = require('./auth')

const app    = express()
const server = http.createServer(app)
const wss    = new WebSocket.Server({ server, path: '/ws' })
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

app.use(cors())
app.use(express.json())
app.post('/api/auth/login', loginRoute)
app.use(requireAuth)

// ── Variables d'environnement ─────────────────────────────────────
const PORT             = process.env.PORT                    || 3001
const TELEGRAM_TOKEN   = process.env.TELEGRAM_TOKEN          || ''
const TELEGRAM_CHATID  = process.env.TELEGRAM_CHATID         || ''
const RISK_PERCENT     = parseFloat(process.env.RISK_PERCENT     || '1')
const FALLBACK_BALANCE = parseFloat(process.env.FALLBACK_BALANCE || '10000')
const MAX_OPEN_TRADES  = parseInt(process.env.MAX_OPEN_TRADES    || '5')
const MAX_CORR_EXPOSURE= parseInt(process.env.MAX_CORR_EXPOSURE  || '2')

const log = {
  info : (...a) => console.log(new Date().toISOString(),  '[INFO]',  ...a),
  error: (...a) => console.error(new Date().toISOString(), '[ERROR]', ...a),
  warn : (...a) => console.warn(new Date().toISOString(),  '[WARN]',  ...a),
}

// ── Managers ──────────────────────────────────────────────────────
const SM = new StrategyManager()
const JM = new JournalManager()
const AM = new AccountManager()
log.info(`[Boot] ${SM.getStrategies().length} stratégies | ${JM.entries.length} trades journal | ${AM.getAll().length} comptes`)

// ══════════════════════════════════════════════════════════════════
// AUTOMODE PAR STRATÉGIE
// ══════════════════════════════════════════════════════════════════
// Map stratId → { enabled: bool, reason: string }
const strategyAutoModes = new Map()

function getStratAutoMode(stratId) {
  if (!strategyAutoModes.has(stratId)) {
    strategyAutoModes.set(stratId, { enabled: true, reason: null })
  }
  return strategyAutoModes.get(stratId)
}

function setStratAutoMode(stratId, enabled, reason = null) {
  strategyAutoModes.set(stratId, { enabled, reason })
  broadcast({ type: 'strat_automode_changed', stratId, enabled, reason })
  log.info(`[StratAutoMode] ${stratId}: ${enabled ? '🟢 ON' : '🔴 OFF'}${reason ? ` (${reason})` : ''}`)
}

// AutoMode global (fallback)
let globalAutoMode = true

// ══════════════════════════════════════════════════════════════════
// MULTI-COMPTE cTrader
// ══════════════════════════════════════════════════════════════════
const ctraderInstances = new Map()   // accountId → CTraderService instance
let activeCtrader = null             // instance active

function createCTraderForAccount(acc) {
  return new CTrader({
    clientId    : acc.clientId,
    clientSecret: acc.secret,
    accessToken : acc.token,
    refreshToken: acc.refresh,
    accountId   : acc.accountId,
    host        : acc.host,
    log         : log.info,
  })
}

async function connectAccount(accId) {
  const acc = AM.getRaw(accId)
  if (!acc || !acc.clientId || !acc.token) return null

  // Déconnecter l'ancienne instance si existe
  if (ctraderInstances.has(accId)) {
    ctraderInstances.get(accId).disconnect()
  }

  const instance = createCTraderForAccount(acc)
  ctraderInstances.set(accId, instance)

  // Hook refresh token → sauvegarder dans AccountManager
  const origRefresh = instance.refreshAccessToken.bind(instance)
  instance.refreshAccessToken = async function() {
    const ok = await origRefresh()
    if (ok) {
      AM.updateTokens(accId, {
        accessToken : instance.accessToken,
        refreshToken: instance.refreshToken,
        expiresAt   : instance.tokenExpiresAt?.toISOString(),
      })
    }
    return ok
  }

  try {
    await instance.connect()
    log.info(`[MultiAccount] Compte ${acc.name} connecté ✅`)
    return instance
  } catch (e) {
    log.error(`[MultiAccount] Erreur connexion ${acc.name}: ${e.message}`)
    return null
  }
}

// Connecter tous les comptes au démarrage
;(async () => {
  for (const acc of AM.accounts) {
    if (!acc.clientId || !acc.token) continue
    const instance = await connectAccount(acc.id)
    if (instance && acc.active) activeCtrader = instance
  }
  if (!activeCtrader) log.warn('[MultiAccount] Aucun compte actif — mode SIMULATION')
})()

function getActiveInstance() { return activeCtrader }

// ══════════════════════════════════════════════════════════════════
// DRAWDOWN MONITOR
// ══════════════════════════════════════════════════════════════════
const ddMonitor = new DrawdownMonitor({
  log,
  onAlert: async (type, msg, data) => {
    await tgBot.send(msg)
    broadcast({ type: 'drawdown_alert', alertType: type, ...data })

    if (type === 'daily_stop') {
      // Arrêt forcé de TOUS les AutoModes
      globalAutoMode = false
      for (const strat of SM.getStrategies()) {
        setStratAutoMode(strat.id, false, 'Drawdown journalier max atteint')
      }
      broadcast({ type: 'automode_changed', autoMode: false, reason: 'drawdown_stop' })
      log.warn('[Drawdown] 🚨 AutoMode désactivé sur tous les comptes')
    }
  },
})

// Vérification drawdown toutes les 5 minutes
setInterval(async () => {
  const ct = getActiveInstance()
  if (!ct?.isReady) return
  try {
    const balance = await ct.getAccountBalance()
    const result  = await ddMonitor.check(balance, AM.getActive()?.id)
    broadcast({ type: 'drawdown_update', ...result })
  } catch {}
}, 5 * 60 * 1000)

// ══════════════════════════════════════════════════════════════════
// TELEGRAM BOT BIDIRECTIONNEL
// ══════════════════════════════════════════════════════════════════
const tgBot = new TelegramBot({
  token  : TELEGRAM_TOKEN,
  chatId : TELEGRAM_CHATID,
  log    : log.info,

  onPause: async () => {
    globalAutoMode = false
    SM.getStrategies().forEach(s => setStratAutoMode(s.id, false, 'Commande Telegram /pause'))
    broadcast({ type: 'automode_changed', autoMode: false, reason: 'telegram' })
    return '🔴 *AutoMode DÉSACTIVÉ*\nTous les ordres automatiques sont suspendus.'
  },

  onResume: async () => {
    globalAutoMode = true
    SM.getStrategies().forEach(s => setStratAutoMode(s.id, true, null))
    broadcast({ type: 'automode_changed', autoMode: true, reason: 'telegram' })
    return '🟢 *AutoMode ACTIVÉ*\nLes ordres automatiques sont actifs.'
  },

  onStatus: async () => {
    const ct       = getActiveInstance()
    const acc      = AM.getActive()
    const ddStatus = ddMonitor.getStatus()
    const strats   = SM.getStrategies().map(s => {
      const am = getStratAutoMode(s.id)
      return `  ${am.enabled ? '🟢' : '🔴'} ${s.name}`
    }).join('\n')

    return `📊 *Status ICT Trading Dashboard*\n\n` +
      `*Compte actif :* ${acc?.name || 'Inconnu'}\n` +
      `*cTrader :* ${ct?.isReady ? '✅ Connecté' : '❌ Déconnecté'}\n` +
      `*AutoMode global :* ${globalAutoMode ? '🟢 ON' : '🔴 OFF'}\n\n` +
      `*Stratégies :*\n${strats}\n\n` +
      `*Drawdown journalier :* ${ddStatus.history?.slice(-1)[0]?.dailyDD || 0}% / max ${ddStatus.hardStopDD}%\n` +
      `*Max open trades :* ${MAX_OPEN_TRADES}`
  },

  onBalance: async () => {
    const ct = getActiveInstance()
    if (!ct?.isReady) return '⚠️ cTrader non connecté'
    try {
      const balance = await ct.getAccountBalance()
      const ddResult = await ddMonitor.check(balance)
      return `💰 *Balance FTMO*\n\n` +
        `Solde actuel : \`$${balance.toFixed(2)}\`\n` +
        `Risque/trade : \`${RISK_PERCENT}% = $${(balance * RISK_PERCENT / 100).toFixed(2)}\`\n\n` +
        `📉 Drawdown journalier : \`${ddResult.dailyDD}%\` / max \`${ddMonitor.hardStopDD}%\`\n` +
        `📉 Drawdown total      : \`${ddResult.totalDD}%\` / max \`${ddMonitor.maxTotalDD}%\``
    } catch (e) { return `❌ Erreur: ${e.message}` }
  },

  onPositions: async () => {
    const ct = getActiveInstance()
    if (!ct?.isReady) return '⚠️ cTrader non connecté'
    try {
      const positions = await ct.getOpenPositions(true)
      if (!positions.length) return '📊 *Aucune position ouverte*'
      const lines = positions.map(p =>
        `  ${p.side === 'BUY' ? '🟢' : '🔴'} *${p.symbol}* ${p.side} ${p.lots}L @ \`${p.openPrice?.toFixed(5)}\``
      ).join('\n')
      return `📊 *${positions.length} position(s) ouverte(s)*\n\n${lines}`
    } catch (e) { return `❌ Erreur: ${e.message}` }
  },
})

if (TELEGRAM_TOKEN) {
  tgBot.startPolling(3000)
  log.info('[TelegramBot] Polling démarré — commandes /pause /resume /status /balance /positions /help')
}

// ── Helpers Telegram simples ──────────────────────────────────────
async function sendTelegramRaw(text) { await tgBot.send(text) }
async function sendTelegram(d, stratName) {
  if (!TELEGRAM_TOKEN) return
  const s     = d.action === 'BUY' ? '🟢' : '🔴'
  const isNex = d.signal?.startsWith('NEXUS')
  const hdr   = isNex ? `${s} *NEXUS Pro*` : `${s} *Signal*`
  const auto  = d.auto_ok===true?'\n✅ AUTO OK':d.auto_ok===false?'\n⛔ BLOQUÉ':''
  const rr    = d.rr_reel?`\n📊 R:R : \`1:${d.rr_reel}\``:''
  const score = d.score?` · Score \`${d.score}/100\``:''
  await sendTelegramRaw(
    `${hdr} — *${d.pair}* [${stratName||d.strategy||'?'}]\n` +
    `━━━━━━━━━━━━━━━\n▶️ \`${d.action}\` | 💲 \`${d.price}\`\n` +
    `🛑 \`${d.sl}\` | 🎯 \`${d.tp_reel||d.tp}\`\n📈 \`${d.prob}%\`${score}${rr}${auto}`
  )
}

// ── PIP values ────────────────────────────────────────────────────
const PIP_VALUE = {
  USDJPY:9.1,EURJPY:9.1,GBPJPY:9.1,AUDJPY:9.1,NZDJPY:9.1,CADJPY:9.1,CHFJPY:9.1,
  AUDUSD:10,NZDUSD:10,EURUSD:10,GBPUSD:10,
  USDCHF:11,EURCHF:11,GBPCHF:11,AUDCHF:11,CADCHF:11,NZDCHF:11,
  USDCAD:7.4,EURCAD:7.4,GBPCAD:7.4,AUDCAD:7.4,NZDCAD:7.4,
  EURGBP:12.5,GBPAUD:6.5,GBPNZD:5.9,EURNZD:5.9,AUDNZD:5.9,
}

async function calcLotsDynamic(entry, sl, pair) {
  const ct = getActiveInstance()
  let balance = FALLBACK_BALANCE
  try { if (ct?.isReady) balance = await ct.getAccountBalance() } catch {}
  const riskUSD = balance * (RISK_PERCENT / 100)
  const diff    = Math.abs(parseFloat(entry) - parseFloat(sl))
  if (!diff || isNaN(diff)) return 0.01
  const pipSize = (pair||'').includes('JPY') ? 0.01 : 0.0001
  const lots    = riskUSD / ((diff / pipSize) * (PIP_VALUE[pair] || 10))
  return Math.max(0.01, Math.round(lots * 100) / 100)
}

// ── Anti-corrélation ──────────────────────────────────────────────
async function checkCorrelationFilter(pair, action) {
  const ct = getActiveInstance()
  if (!ct?.isReady) return { ok: true }
  try {
    const exp   = await ct.getCurrencyExposure()
    const sym   = pair.replace(/^[A-Z]+:/,'').toUpperCase()
    const base  = sym.slice(0,3), quote = sym.slice(3,6)
    const isBuy = action === 'BUY'
    const bL = (exp[base]?.long||0)  + (isBuy?1:0)
    const qS = (exp[quote]?.short||0)+ (isBuy?1:0)
    const bS = (exp[base]?.short||0) + (!isBuy?1:0)
    const qL = (exp[quote]?.long||0) + (!isBuy?1:0)
    if (isBuy) {
      if (bL>MAX_CORR_EXPOSURE) return {ok:false,reason:`LONG ${base}: ${bL}/${MAX_CORR_EXPOSURE}`}
      if (qS>MAX_CORR_EXPOSURE) return {ok:false,reason:`SHORT ${quote}: ${qS}/${MAX_CORR_EXPOSURE}`}
    } else {
      if (bS>MAX_CORR_EXPOSURE) return {ok:false,reason:`SHORT ${base}: ${bS}/${MAX_CORR_EXPOSURE}`}
      if (qL>MAX_CORR_EXPOSURE) return {ok:false,reason:`LONG ${quote}: ${qL}/${MAX_CORR_EXPOSURE}`}
    }
    return { ok: true }
  } catch { return { ok: true } }
}

async function checkMaxTrades() {
  const ct = getActiveInstance()
  if (!ct?.isReady) return { ok: true, count: 0 }
  try {
    const count = await ct.getOpenPositionCount()
    return count >= MAX_OPEN_TRADES
      ? { ok:false, count, reason:`Max trades: ${count}/${MAX_OPEN_TRADES}` }
      : { ok:true, count }
  } catch { return { ok: true, count: 0 } }
}

// ── WebSocket ─────────────────────────────────────────────────────
function broadcast(data) {
  const msg = JSON.stringify(data)
  wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(msg) })
}

wss.on('connection', (ws) => {
  const active = SM.getActiveStrategy()
  const stratModes = {}
  SM.getStrategies().forEach(s => { stratModes[s.id] = getStratAutoMode(s.id) })
  ws.send(JSON.stringify({
    type:'init',
    states:SM.getPairStates(active.id), history:SM.getHistory(active.id,20),
    strategies:SM.getStrategies(), activeStrat:active,
    autoMode:globalAutoMode, strategyAutoModes:stratModes,
    accounts:AM.getAll(), activeAccount:AM.getActive()?.id,
    config:{ maxOpenTrades:MAX_OPEN_TRADES, maxCorrExposure:MAX_CORR_EXPOSURE, riskPercent:RISK_PERCENT },
  }))
  ws.on('close', () => {})
})

setInterval(async () => {
  const ct = getActiveInstance()
  if (!ct?.isReady) return
  try { broadcast({ type:'positions_update', positions: await ct.getOpenPositions() }) } catch {}
}, 15000)

// ══════════════════════════════════════════════════════════════════
// placeAutoOrder
// ══════════════════════════════════════════════════════════════════
async function placeAutoOrder(entry, d, stratId) {
  const pair = entry.pair, action = entry.action, ct = getActiveInstance()

  const maxCheck  = await checkMaxTrades()
  if (!maxCheck.ok) {
    await sendTelegramRaw(`🚫 *BLOQUÉ Max trades* — ${action} ${pair}\n${maxCheck.reason}`)
    broadcast({ type:'auto_order_blocked', reason:'max_trades', detail:maxCheck.reason, pair, action, stratId })
    return null
  }

  const corrCheck = await checkCorrelationFilter(pair, action)
  if (!corrCheck.ok) {
    await sendTelegramRaw(`⚡ *BLOQUÉ Corrélation* — ${action} ${pair}\n${corrCheck.reason}`)
    broadcast({ type:'auto_order_blocked', reason:'correlation', detail:corrCheck.reason, pair, action, stratId })
    return null
  }

  const lots = await calcLotsDynamic(entry.price, entry.sl, pair)
  const tp   = entry.tp_reel || entry.tp
  const acc  = AM.getActive()

  if (!ct || !ct.isReady) {
    const simId = Math.floor(Math.random()*900000)+100000
    JM.addTrade({ ...d, ...entry, lots, positionId:simId, simulated:true, stratId })
    await sendTelegramRaw(`🤖 *SIMULATION* [${acc?.name||'?'}] — ${action} ${pair}\n📦 \`${lots}L\` | 🎫 \`${simId}\`\n🛑 \`${entry.sl}\` | 🎯 \`${tp}\``)
    broadcast({ type:'auto_order', simulated:true, positionId:simId, pair, action, lots, stratId, account:acc?.name })
    return { simulated:true, positionId:simId }
  }

  try {
    const r = await ct.placeOrder({ symbol:pair, side:action, volume:lots, stopLoss:entry.sl, takeProfit:tp, comment:`AutoBot ${stratId} S${d.score}` })
    JM.addTrade({ ...d, ...entry, lots, positionId:r.positionId, price:r.price, simulated:false, stratId, account:acc?.name })
    await sendTelegramRaw(
      `🤖 *EXECUTÉ* [${acc?.name||'?'}] — ${action} ${pair}\n` +
      `📦 \`${lots}L\` | 🎫 \`${r.positionId}\`\n` +
      `💲 \`${r.price}\` | 🛑 \`${entry.sl}\` | 🎯 \`${tp}\`\n` +
      `📊 Score \`${d.score}/100\` | ${maxCheck.count+1}/${MAX_OPEN_TRADES} trades`
    )
    broadcast({ type:'auto_order', simulated:false, positionId:r.positionId, pair, action, lots, price:r.price, stratId, account:acc?.name })
    return r
  } catch(e) {
    await sendTelegramRaw(`❌ *ERREUR* — ${pair}\n\`${e.message}\``)
    throw e
  }
}

// ══════════════════════════════════════════════════════════════════
// WEBHOOK
// ══════════════════════════════════════════════════════════════════
app.post('/webhook', async (req, res) => {
  const d = req.body
  if (!d.pair || !d.action) return res.status(400).json({ error:'pair et action requis' })
  const result = SM.receiveSignal(d)
  if (!result) return res.status(400).json({ error:'Signal invalide' })
  const { entry, stratId } = result
  const strat = SM.getStrategy(stratId)

  const active = SM.getActiveStrategy()
  if (stratId === active.id) broadcast({ type:'signal', state:SM.getPairStates(stratId)[entry.pair], stratId })
  broadcast({ type:'new_signal', entry, stratId })
  await sendTelegram(entry, strat?.name)

  const isAutoOk = d.auto_ok === true
  const isICT    = stratId==='ICT_AutoBot_v1' && entry.signal==='SIGNAL_TRES_FORT_15M'
  const isNEXUS  = stratId==='NEXUS_Pro_v1'   && (entry.signal==='NEXUS_TREND_BULL'||entry.signal==='NEXUS_TREND_BEAR')

  if ((isICT||isNEXUS) && isAutoOk) {
    const stratAM = getStratAutoMode(stratId)
    // Vérification AutoMode : global ET par stratégie
    if (!globalAutoMode || !stratAM.enabled) {
      const reason = !globalAutoMode ? 'AutoMode global OFF' : `${stratId} AutoMode OFF`
      log.warn(`[AutoBot] Ordre ignoré — ${reason} (${entry.action} ${entry.pair})`)
      await sendTelegramRaw(`🔴 *ORDRE IGNORÉ* — ${reason}\n${entry.action} ${entry.pair}`)
      return res.json({ ok:true, autoOrder:false, reason })
    }
    await placeAutoOrder(entry, d, stratId)
  }

  res.json({ ok:true, pair:entry.pair, action:entry.action, stratId })
})

// ══════════════════════════════════════════════════════════════════
// API AUTOMODE (global + par stratégie)
// ══════════════════════════════════════════════════════════════════
app.get('/api/automode', (_, res) => {
  const stratModes = {}
  SM.getStrategies().forEach(s => { stratModes[s.id] = getStratAutoMode(s.id) })
  res.json({ autoMode:globalAutoMode, strategyModes:stratModes, riskPercent:RISK_PERCENT, maxOpenTrades:MAX_OPEN_TRADES })
})

// Toggle global
app.post('/api/automode', (req, res) => {
  const { enabled } = req.body
  if (typeof enabled !== 'boolean') return res.status(400).json({ error:'enabled boolean requis' })
  globalAutoMode = enabled
  broadcast({ type:'automode_changed', autoMode:globalAutoMode })
  sendTelegramRaw(`${globalAutoMode?'🟢':'🔴'} *AutoMode global ${globalAutoMode?'ACTIVÉ':'DÉSACTIVÉ'}*`)
  res.json({ ok:true, autoMode:globalAutoMode })
})

// Toggle par stratégie
app.post('/api/automode/:stratId', (req, res) => {
  const { stratId } = req.params
  const { enabled, reason } = req.body
  if (typeof enabled !== 'boolean') return res.status(400).json({ error:'enabled boolean requis' })
  if (!SM.getStrategy(stratId)) return res.status(404).json({ error:'Stratégie introuvable' })
  setStratAutoMode(stratId, enabled, reason || null)
  sendTelegramRaw(`${enabled?'🟢':'🔴'} *${SM.getStrategy(stratId).name}* AutoMode ${enabled?'ON':'OFF'}`)
  res.json({ ok:true, stratId, enabled })
})

app.get('/api/automode/:stratId', (req, res) => {
  res.json({ stratId:req.params.stratId, ...getStratAutoMode(req.params.stratId) })
})

// ══════════════════════════════════════════════════════════════════
// API COMPTES (multi-account)
// ══════════════════════════════════════════════════════════════════
app.get('/api/accounts', (_, res) => {
  const accounts = AM.getAll().map(acc => ({
    ...acc,
    connected: ctraderInstances.get(acc.id)?.isReady || false,
  }))
  res.json({ accounts, activeId: AM.getActive()?.id })
})

app.post('/api/accounts', (req, res) => {
  res.json(AM.add(req.body))
})

app.put('/api/accounts/:id', (req, res) => {
  const result = AM.update(req.params.id, req.body)
  if (result.error) return res.status(404).json(result)
  res.json(result)
})

app.delete('/api/accounts/:id', (req, res) => {
  res.json(AM.remove(req.params.id))
})

app.post('/api/accounts/:id/activate', async (req, res) => {
  const acc = AM.getRaw(req.params.id)
  if (!acc) return res.status(404).json({ error:'Compte introuvable' })

  // Connecter si pas déjà connecté
  if (!ctraderInstances.get(acc.id)?.isReady) {
    const instance = await connectAccount(acc.id)
    if (!instance) return res.status(500).json({ error:'Connexion échouée' })
  }

  AM.setActive(acc.id)
  activeCtrader = ctraderInstances.get(acc.id)

  broadcast({ type:'account_changed', accountId:acc.id, accountName:acc.name })
  sendTelegramRaw(`🔄 *Compte actif changé*\n${acc.name} (${acc.type === 'live' ? 'LIVE 🔴' : 'Demo'})`)
  res.json({ ok:true, accountId:acc.id, connected:activeCtrader?.isReady||false })
})

app.post('/api/accounts/:id/connect', async (req, res) => {
  const instance = await connectAccount(req.params.id)
  if (!instance) return res.status(500).json({ error:'Connexion échouée' })
  const acc = AM.getById(req.params.id)
  res.json({ ok:true, accountId:req.params.id, name:acc?.name, connected:instance.isReady })
})

// ══════════════════════════════════════════════════════════════════
// API DRAWDOWN
// ══════════════════════════════════════════════════════════════════
app.get('/api/drawdown', async (_, res) => {
  const ct = getActiveInstance()
  try {
    if (!ct?.isReady) return res.json({ ...ddMonitor.getStatus(), currentBalance:null, dailyDD:null, totalDD:null })
    const balance = await ct.getAccountBalance()
    const result  = await ddMonitor.check(balance)
    res.json(result)
  } catch(e) { res.status(500).json({ error:e.message }) }
})

// ══════════════════════════════════════════════════════════════════
// API BACKTESTING — Import résultats TradingView
// ══════════════════════════════════════════════════════════════════
// TradingView Strategy Tester peut exporter en CSV ou JSON
// On parse les colonnes clés : Date, Profit, Drawdown, etc.

app.post('/api/backtest/import', upload.single('file'), (req, res) => {
  try {
    const content = req.file?.buffer?.toString('utf8') || ''
    if (!content) return res.status(400).json({ error:'Fichier vide ou manquant' })

    const ext = req.file?.originalname?.split('.').pop()?.toLowerCase()

    let parsed
    if (ext === 'json') {
      parsed = parseBacktestJSON(content)
    } else {
      parsed = parseBacktestCSV(content)
    }

    res.json(parsed)
  } catch(e) {
    res.status(400).json({ error:`Erreur parsing: ${e.message}` })
  }
})

function parseBacktestCSV(csv) {
  const lines   = csv.split('\n').filter(l => l.trim())
  const headers = lines[0].split(',').map(h => h.trim().replace(/['"]/g,'').toLowerCase())

  const rows = lines.slice(1).map(line => {
    const cells = line.split(',').map(c => c.trim().replace(/['"]/g,''))
    const obj   = {}
    headers.forEach((h, i) => { obj[h] = cells[i] || '' })
    return obj
  }).filter(r => r['trade #'] || r['date/time'] || r['profit'])

  return buildBacktestResult(rows, headers)
}

function parseBacktestJSON(json) {
  const data = JSON.parse(json)
  // Support format TradingView export JSON
  if (data.trades) return buildBacktestResult(data.trades, Object.keys(data.trades[0] || {}))
  return data
}

function buildBacktestResult(rows) {
  // Colonnes TradingView Strategy Tester
  const tradeList = rows.map(r => ({
    date      : r['date/time'] || r['date'] || '',
    type      : r['type']      || '',
    price     : parseFloat(r['price'] || r['entry price'] || '0') || 0,
    contracts : parseFloat(r['contracts'] || r['quantity'] || '1') || 1,
    profit    : parseFloat(r['profit']    || r['net profit'] || '0') || 0,
    cumProfit : parseFloat(r['cumulative profit'] || '0') || 0,
    drawdown  : parseFloat(r['drawdown'] || r['max drawdown'] || '0') || 0,
    runup     : parseFloat(r['run-up']   || '0') || 0,
  })).filter(t => t.date)

  // Calcul des métriques
  const profits = tradeList.map(t => t.profit)
  const wins    = profits.filter(p => p > 0)
  const losses  = profits.filter(p => p < 0)
  const total   = profits.reduce((s, p) => s + p, 0)
  const grossP  = wins.reduce((s, p) => s + p, 0)
  const grossL  = Math.abs(losses.reduce((s, p) => s + p, 0))

  // Courbe d'équité
  let equity = 0
  const equityCurve = tradeList.map(t => {
    equity += t.profit
    return { date: t.date.slice(0, 10), equity: Math.round(equity * 100) / 100, trade: t.profit }
  })

  // Drawdown max
  let peak = 0, maxDD = 0
  for (const p of equityCurve) {
    if (p.equity > peak) peak = p.equity
    const dd = peak > 0 ? ((peak - p.equity) / peak) * 100 : 0
    if (dd > maxDD) maxDD = dd
  }

  return {
    summary: {
      totalTrades  : tradeList.length,
      winTrades    : wins.length,
      lossTrades   : losses.length,
      winRate      : tradeList.length > 0 ? Math.round(wins.length / tradeList.length * 100) : 0,
      netProfit    : Math.round(total * 100) / 100,
      grossProfit  : Math.round(grossP * 100) / 100,
      grossLoss    : Math.round(grossL * 100) / 100,
      profitFactor : grossL > 0 ? Math.round((grossP / grossL) * 100) / 100 : 0,
      maxDrawdown  : Math.round(maxDD * 100) / 100,
      avgWin       : wins.length > 0 ? Math.round(grossP / wins.length * 100) / 100 : 0,
      avgLoss      : losses.length > 0 ? Math.round(grossL / losses.length * 100) / 100 : 0,
      expectancy   : tradeList.length > 0 ? Math.round(total / tradeList.length * 100) / 100 : 0,
    },
    equityCurve,
    trades: tradeList.slice(0, 500),
  }
}

// ══════════════════════════════════════════════════════════════════
// API STRATÉGIES
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
// API POSITIONS + BALANCE + TOKEN + DATA
// ══════════════════════════════════════════════════════════════════
app.get('/api/positions', async (_, res) => {
  const ct = getActiveInstance()
  try {
    if (!ct?.isReady) return res.json({ positions:[], simMode:true })
    const positions = await ct.getOpenPositions()
    const exposure  = await ct.getCurrencyExposure()
    res.json({ positions, count:positions.length, maxTrades:MAX_OPEN_TRADES, exposure })
  } catch(e) { res.status(500).json({ error:e.message, positions:[] }) }
})

app.post('/api/positions/refresh', async (_, res) => {
  const ct = getActiveInstance()
  try {
    if (!ct?.isReady) return res.json({ positions:[], simMode:true })
    const positions = await ct.getOpenPositions(true)
    broadcast({ type:'positions_update', positions })
    res.json({ positions, count:positions.length })
  } catch(e) { res.status(500).json({ error:e.message }) }
})

app.get('/api/balance', async (_, res) => {
  const ct = getActiveInstance()
  try {
    if (!ct?.isReady) return res.json({ balance:null, simMode:true, riskPercent:RISK_PERCENT })
    const balance   = await ct.getAccountBalance()
    const riskUSD   = Math.round(balance*(RISK_PERCENT/100)*100)/100
    const positions = await ct.getOpenPositions()
    const ddStatus  = await ddMonitor.check(balance)
    res.json({ balance, riskPercent:RISK_PERCENT, riskUSD, openTrades:positions.length,
               maxOpenTrades:MAX_OPEN_TRADES, tradesLeft:Math.max(0,MAX_OPEN_TRADES-positions.length),
               dailyDD:ddStatus.dailyDD, totalDD:ddStatus.totalDD,
               account:AM.getActive()?.name })
  } catch(e) { res.status(500).json({ error:e.message }) }
})

app.get('/api/ctrader', (_, res) => {
  const ct  = getActiveInstance()
  const acc = AM.getActive()
  const host = ct?.host || process.env.CTRADER_HOST || 'live.ctraderapi.com'
  res.json({ ready:ct?.isReady||false, connected:ct?.connected||false,
             accountId:ct?.accountId||null, simMode:!ct, mode:host.includes('demo')?'demo':'live',
             host, autoMode:globalAutoMode, accountName:acc?.name })
})

app.post('/api/token/refresh', async (_, res) => {
  const ct = getActiveInstance()
  if (!ct) return res.status(400).json({ error:'Aucune instance active' })
  const ok = await ct.refreshAccessToken()
  res.json(ok ? { ok:true, expiresAt:ct.tokenExpiresAt } : { ok:false })
})

app.get('/api/token/status', (_, res) => {
  const ct = getActiveInstance()
  if (!ct) return res.json({ available:false })
  const msLeft = ct.tokenExpiresAt ? ct.tokenExpiresAt.getTime()-Date.now() : null
  res.json({ available:true, hasRefresh:!!ct.refreshToken, expiresAt:ct.tokenExpiresAt?.toISOString()||null,
             daysLeft:msLeft?Math.round(msLeft/86400000):null, needsRefresh:msLeft?msLeft<5*86400000:false })
})

app.get('/api/states',    (req, res) => res.json(SM.getPairStates(req.query.strategy||SM.getActiveStrategy().id)))
app.get('/api/history',   (req, res) => {
  const limit=parseInt(req.query.limit)||100
  res.json(req.query.strategy?SM.getHistory(req.query.strategy,limit):SM.getAllHistory(limit))
})
app.get('/api/stats/:id', (req, res) => res.json(SM.getStats(req.params.id)))

// ── Analytics ─────────────────────────────────────────────────────
app.get('/api/analytics', (req, res) => {
  const all     = SM.getAllHistory(5000)
  const days    = parseInt(req.query.days)||30
  const cutoff  = new Date(Date.now()-days*86400000).toISOString()
  const filtered= all.filter(h=>h.receivedAt>cutoff)
  const byDay={}, rrBuckets={'0-1':0,'1-1.5':0,'1.5-2':0,'2-2.5':0,'2.5-3':0,'3+':0}
  const scoreBuckets=Array(10).fill(0).map((_,i)=>({range:`${i*10}-${i*10+9}`,count:0}))
  const hourData=Array(24).fill(0).map((_,h)=>({hour:h,count:0,avgScore:0,totalScore:0}))
  const byPair={}

  for (const h of filtered) {
    const day=h.receivedAt.slice(0,10)
    if(!byDay[day])byDay[day]={date:day,total:0,autoOk:0,buy:0,sell:0}
    byDay[day].total++; if(h.auto_ok)byDay[day].autoOk++
    if(h.action==='BUY')byDay[day].buy++; else byDay[day].sell++
    const rr=parseFloat(h.rr_reel)
    if(!isNaN(rr)){if(rr<1)rrBuckets['0-1']++;else if(rr<1.5)rrBuckets['1-1.5']++;else if(rr<2)rrBuckets['1.5-2']++;else if(rr<2.5)rrBuckets['2-2.5']++;else if(rr<3)rrBuckets['2.5-3']++;else rrBuckets['3+']++}
    if(h.score!=null){const idx=Math.min(9,Math.floor(h.score/10));scoreBuckets[idx].count++}
    const hr=new Date(h.receivedAt).getUTCHours();hourData[hr].count++;hourData[hr].totalScore+=(h.score||0)
    if(!byPair[h.pair])byPair[h.pair]={pair:h.pair,total:0,autoOk:0,avgScore:0,totalScore:0}
    byPair[h.pair].total++;if(h.auto_ok)byPair[h.pair].autoOk++;byPair[h.pair].totalScore+=(h.score||0)
  }
  for(const hd of hourData)hd.avgScore=hd.count>0?Math.round(hd.totalScore/hd.count):0
  for(const p of Object.values(byPair))p.avgScore=Math.round(p.totalScore/p.total)

  let equity=FALLBACK_BALANCE
  const autoSigs=all.filter(h=>h.auto_ok===true&&h.rr_reel).sort((a,b)=>a.receivedAt.localeCompare(b.receivedAt))
  const equityCurve=autoSigs.map(sig=>{
    const rr=(parseFloat(sig.rr_reel)||1.5),isWin=(sig.score||60)>=70
    equity+=isWin?equity*(RISK_PERCENT/100)*rr:-equity*(RISK_PERCENT/100)
    return{date:sig.receivedAt.slice(0,10),equity:Math.round(equity),win:isWin}
  })

  res.json({
    totalSignals:filtered.length,
    autoOkTotal:filtered.filter(h=>h.auto_ok).length,
    autoOkRate:filtered.length>0?Math.round(filtered.filter(h=>h.auto_ok).length/filtered.length*100):0,
    signalsByDay:Object.values(byDay).sort((a,b)=>a.date.localeCompare(b.date)),
    scoreBuckets,
    rrDistribution:Object.entries(rrBuckets).map(([range,count])=>({range,count})),
    hourData,
    topPairs:Object.values(byPair).sort((a,b)=>b.total-a.total).slice(0,14),
    equityCurve:equityCurve.slice(-60),
    days,
  })
})

// ── Journal ───────────────────────────────────────────────────────
app.get('/api/journal', (req, res) => { const l=parseInt(req.query.limit)||200; res.json({entries:JM.getEntries(l,{pair:req.query.pair,strategy:req.query.strategy}),stats:JM.getStats()}) })
app.put('/api/journal/:id', (req, res) => { const r=JM.updateTrade(req.params.id,req.body); if(r.error)return res.status(404).json(r); broadcast({type:'journal_updated',entry:r}); res.json(r) })
app.delete('/api/journal/:id', (req, res) => res.json(JM.deleteTrade(req.params.id)))
app.get('/api/journal/export/csv', (_, res) => { res.setHeader('Content-Type','text/csv; charset=utf-8'); res.setHeader('Content-Disposition',`attachment; filename="journal_${new Date().toISOString().slice(0,10)}.csv"`); res.send('\uFEFF'+JM.exportCSV()) })

// ── Pause config ──────────────────────────────────────────────────
let pauseConfig = { weekendPause:false, nfpPause:false, customSchedules:[] }
app.get('/api/pause-config',  (_, res)      => res.json(pauseConfig))
app.post('/api/pause-config', (req, res) => {
  if(req.body.weekendPause!==undefined)pauseConfig.weekendPause=Boolean(req.body.weekendPause)
  if(req.body.nfpPause!==undefined)    pauseConfig.nfpPause    =Boolean(req.body.nfpPause)
  if(Array.isArray(req.body.customSchedules))pauseConfig.customSchedules=req.body.customSchedules
  broadcast({ type:'pause_config_changed', pauseConfig })
  res.json({ ok:true, pauseConfig })
})

app.post('/api/order', async (req, res) => {
  const { symbol, action, lots, sl, tp, comment } = req.body
  if(!symbol||!action||!lots)return res.status(400).json({error:'symbol, action, lots requis'})
  const ct=getActiveInstance()
  if(!ct||!ct.isReady){const simId=Math.floor(Math.random()*900000)+100000;return res.json({ok:true,positionId:simId,simulated:true,price:'SIMULATION'})}
  try { res.json(await ct.placeOrder({symbol:symbol.replace(/^[A-Z]+:/,'').toUpperCase(),side:action.toUpperCase(),volume:parseFloat(lots),stopLoss:sl?String(sl):'0',takeProfit:tp?String(tp):'0',comment})) }
  catch(e){res.status(500).json({error:e.message})}
})

app.get('/api/test', async (req, res) => {
  const s=req.query.strategy||SM.getActiveStrategy().id
  for(const t of [{pair:'EURUSD',action:'BUY',price:'1.08450',sl:'1.07920',tp:'1.09180',tp_reel:'1.09180',prob:'82',quality:'EXCELLENT',tf:'60',signal:'NEXUS_TREND_BULL',strategy:s,auto_ok:true,rr_reel:'2.1',score:82}])SM.receiveSignal(t)
  const a=SM.getActiveStrategy();broadcast({type:'init',states:SM.getPairStates(a.id),history:SM.getHistory(a.id,20),strategies:SM.getStrategies(),activeStrat:a,autoMode:globalAutoMode})
  res.json({ok:true})
})

app.get('/health', (_, res) => {
  const ct=getActiveInstance()
  res.json({ ok:true, uptime:process.uptime(), strategies:SM.getStrategies().length,
             ctrader:ct?.isReady||false, autoMode:globalAutoMode,
             accounts:AM.getAll().length, journalEntries:JM.entries.length })
})

server.listen(PORT, () => {
  console.log(`
🚀 ICT Trading Dashboard v4.0 — port ${PORT}
${!TELEGRAM_TOKEN?'⚠️  TELEGRAM manquant':'✅  Telegram + Bot bidirectionnel (/pause /resume /status /balance /positions)'}
${AM.getAll().length} compte(s) configuré(s)
💰  Risk: ${RISK_PERCENT}% | MaxTrades: ${MAX_OPEN_TRADES} | MaxCorr: ${MAX_CORR_EXPOSURE}
📉  Drawdown: alert ${ddMonitor.maxDailyDD}% / stop ${ddMonitor.hardStopDD}%
`)
})

module.exports = { app, server }