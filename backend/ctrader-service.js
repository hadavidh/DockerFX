'use strict'

const tls      = require('tls')
const protobuf = require('protobufjs')
const axios    = require('axios')
const fs       = require('fs')
const path     = require('path')

const TOKEN_FILE = path.join(process.env.DATA_DIR || '/app/data', 'tokens.json')

// ══════════════════════════════════════════════════════════════════
// SYMBOL MAP HARDCODÉ — Les symbol IDs varient selon le broker.
// Ce map est le fallback. Si la résolution API échoue (comme ici
// avec FTMO qui ne supporte pas ProtoOASymbolsListReq), on utilise
// ces IDs. Si ton broker a des IDs différents, les mettre à jour.
// ══════════════════════════════════════════════════════════════════
const SYMBOL_ID_MAP = {
  EURUSD:1,  GBPUSD:2,  USDJPY:3,  USDCHF:4,  EURJPY:5,
  EURGBP:6,  EURCHF:7,  AUDUSD:8,  NZDUSD:9,  USDCAD:10,
  AUDCAD:11, AUDCHF:12, AUDJPY:13, AUDNZD:14, CADCHF:15,
  CADJPY:16, CHFJPY:17, EURNZD:18, EURAUD:19, EURCAD:20,
  GBPAUD:21, GBPCAD:22, GBPCHF:23, GBPJPY:24, GBPNZD:25,
  NZDCAD:26, NZDCHF:27, NZDJPY:28,
}

// Erreurs à ignorer silencieusement (bruit cTrader)
const SILENT_ERRORS = new Set([
  'INVALID_REQUEST',       // unsubscribe empty spots list
  'UNSUPPORTED_MESSAGE',   // SymbolsList non supporté sur certains comptes
])

// ── Schéma Protobuf ───────────────────────────────────────────────
const root = protobuf.Root.fromJSON({
  nested: {
    ProtoMessage: { fields: {
      payloadType: { id:1, type:'uint32', rule:'required' },
      payload:     { id:2, type:'bytes',  rule:'optional' },
      clientMsgId: { id:3, type:'string', rule:'optional' },
    }},
    ProtoOAApplicationAuthReq:  { fields: { clientId:{id:2,type:'string',rule:'required'}, clientSecret:{id:3,type:'string',rule:'required'} } },
    ProtoOAApplicationAuthRes:  { fields: { ctidOAApplicationType:{id:2,type:'uint32',rule:'optional'} } },
    ProtoOAAccountAuthReq:      { fields: { ctidTraderAccountId:{id:2,type:'int64',rule:'required'}, accessToken:{id:3,type:'string',rule:'required'} } },
    ProtoOAAccountAuthRes:      { fields: { ctidTraderAccountId:{id:2,type:'int64',rule:'required'} } },
    ProtoOAGetAccountListByAccessTokenReq: { fields: { accessToken:{id:2,type:'string',rule:'required'} } },
    ProtoOAGetAccountListByAccessTokenRes: { fields: {
      ctidTraderAccount:     { id:4, type:'ProtoOACtidTraderAccount', rule:'repeated' },
      ctidOAApplicationType: { id:3, type:'uint32', rule:'optional' },
    }},
    ProtoOACtidTraderAccount: { fields: { ctidTraderAccountId:{id:1,type:'int64',rule:'required'}, isLive:{id:2,type:'bool',rule:'optional'} } },
    ProtoOATraderReq: { fields: { ctidTraderAccountId:{id:2,type:'int64',rule:'required'} } },
    ProtoOATraderRes: { fields: {
      ctidTraderAccountId:{id:2,type:'int64',rule:'required'},
      trader:{id:3,type:'ProtoOATrader',rule:'optional'},
    }},
    ProtoOATrader: { fields: {
      ctidTraderAccountId:{id:1,type:'int64',rule:'required'},
      balance:{id:3,type:'int64',rule:'optional'},
      currency:{id:18,type:'string',rule:'optional'},
    }},
    ProtoOAReconcileReq: { fields: { ctidTraderAccountId:{id:2,type:'int64',rule:'required'} } },
    ProtoOAReconcileRes: { fields: {
      ctidTraderAccountId:{id:2,type:'int64',rule:'required'},
      position:{id:3,type:'ProtoOAPosition',rule:'repeated'},
    }},
    ProtoOAPosition: { fields: {
      positionId:            {id:1, type:'int64',          rule:'required'},
      tradeData:             {id:2, type:'ProtoOATradeData',rule:'required'},
      positionStatus:        {id:3, type:'uint32',         rule:'required'},
      swap:                  {id:4, type:'int64',          rule:'required'},
      price:                 {id:5, type:'double',         rule:'optional'},
      stopLoss:              {id:7, type:'double',         rule:'optional'},
      takeProfit:            {id:8, type:'double',         rule:'optional'},
      utcLastUpdateTimestamp:{id:9, type:'int64',          rule:'optional'},
      commission:            {id:10,type:'int64',          rule:'optional'},
    }},
    ProtoOATradeData: { fields: {
      symbolId:      {id:1,type:'int64', rule:'required'},
      volume:        {id:2,type:'int64', rule:'required'},
      tradeSide:     {id:3,type:'uint32',rule:'required'},
      openTimestamp: {id:4,type:'int64', rule:'optional'},
      comment:       {id:7,type:'string',rule:'optional'},
    }},
    ProtoOANewOrderReq: { fields: {
      ctidTraderAccountId:{id:2, type:'int64', rule:'required'},
      symbolId:           {id:3, type:'int64', rule:'required'},
      orderType:          {id:4, type:'uint32',rule:'required'},
      tradeSide:          {id:5, type:'uint32',rule:'required'},
      volume:             {id:12,type:'int64', rule:'required'},
      stopLoss:           {id:15,type:'double',rule:'optional'},
      takeProfit:         {id:16,type:'double',rule:'optional'},
      comment:            {id:20,type:'string',rule:'optional'},
    }},
    ProtoOADeal: { fields: {
      dealId:        {id:1,type:'int64', rule:'required'},
      executionPrice:{id:5,type:'double',rule:'optional'},
    }},
    ProtoOAExecutionEvent: { fields: {
      ctidTraderAccountId:{id:2,type:'int64',          rule:'required'},
      executionType:      {id:3,type:'uint32',         rule:'required'},
      position:           {id:4,type:'ProtoOAPosition',rule:'optional'},
      deal:               {id:5,type:'ProtoOADeal',    rule:'optional'},
    }},
    // ── SymbolsList — peut être non supporté sur certains comptes ──
    ProtoOASymbolsListReq: { fields: { ctidTraderAccountId:{id:2,type:'int64',rule:'required'} } },
    ProtoOASymbolsListRes: { fields: {
      ctidTraderAccountId:{id:2,type:'int64',           rule:'required'},
      symbol:             {id:3,type:'ProtoOALightSymbol',rule:'repeated'},
    }},
    ProtoOALightSymbol: { fields: { symbolId:{id:1,type:'int64',rule:'required'}, symbolName:{id:2,type:'string',rule:'optional'} } },
    ProtoOAErrorRes:     { fields: { errorCode:{id:3,type:'string',rule:'optional'}, description:{id:4,type:'string',rule:'optional'} } },
    ProtoHeartbeatEvent: { fields: {} },
  }
})

const TYPES = {
  HEARTBEAT    :51,
  APP_AUTH_REQ :2100, APP_AUTH_RES :2101,
  ACC_AUTH_REQ :2102, ACC_AUTH_RES :2103,
  NEW_ORDER_REQ:2106, EXECUTION_EVENT:2126,
  ERROR_RES    :2142,
  SYMBOLS_REQ  :2115, SYMBOLS_RES  :2116,
  ACCOUNTS_REQ :2149, ACCOUNTS_RES :2150,
  TRADER_REQ   :2129, TRADER_RES   :2130,
  RECONCILE_REQ:2124, RECONCILE_RES:2125,
}

const PAYLOAD_MAP = {
  [TYPES.APP_AUTH_REQ]   :'ProtoOAApplicationAuthReq',
  [TYPES.APP_AUTH_RES]   :'ProtoOAApplicationAuthRes',
  [TYPES.ACC_AUTH_REQ]   :'ProtoOAAccountAuthReq',
  [TYPES.ACC_AUTH_RES]   :'ProtoOAAccountAuthRes',
  [TYPES.ACCOUNTS_REQ]   :'ProtoOAGetAccountListByAccessTokenReq',
  [TYPES.ACCOUNTS_RES]   :'ProtoOAGetAccountListByAccessTokenRes',
  [TYPES.NEW_ORDER_REQ]  :'ProtoOANewOrderReq',
  [TYPES.EXECUTION_EVENT]:'ProtoOAExecutionEvent',
  [TYPES.SYMBOLS_REQ]    :'ProtoOASymbolsListReq',
  [TYPES.SYMBOLS_RES]    :'ProtoOASymbolsListRes',
  [TYPES.ERROR_RES]      :'ProtoOAErrorRes',
  [TYPES.HEARTBEAT]      :'ProtoHeartbeatEvent',
  [TYPES.TRADER_REQ]     :'ProtoOATraderReq',
  [TYPES.TRADER_RES]     :'ProtoOATraderRes',
  [TYPES.RECONCILE_REQ]  :'ProtoOAReconcileReq',
  [TYPES.RECONCILE_RES]  :'ProtoOAReconcileRes',
}

const ProtoMessage = root.lookupType('ProtoMessage')

function encode(payloadType, data, clientMsgId) {
  const TypeClass = root.lookupType(PAYLOAD_MAP[payloadType])
  const payload   = TypeClass.encode(TypeClass.create(data)).finish()
  const msg       = ProtoMessage.encode(ProtoMessage.create({
    payloadType, payload, clientMsgId: String(clientMsgId || ''),
  })).finish()
  const frame = Buffer.allocUnsafe(4 + msg.length)
  frame.writeUInt32BE(msg.length, 0)
  frame.set(msg, 4)
  return frame
}

function decodeFrame(buf) {
  const msg      = ProtoMessage.decode(buf)
  const typeName = PAYLOAD_MAP[msg.payloadType]
  if (!typeName) return { payloadType: msg.payloadType, payload: {} }
  const TypeClass = root.lookupType(typeName)
  const payload   = TypeClass.decode(msg.payload || Buffer.alloc(0))
  return { payloadType: msg.payloadType, payload: TypeClass.toObject(payload, { longs: Number }) }
}

// ════════════════════════════════════════════════════════════════
class CTraderService {
  constructor(cfg) {
    this.clientId          = cfg.clientId
    this.clientSecret      = cfg.clientSecret
    this.accessToken       = cfg.accessToken
    this.refreshToken      = cfg.refreshToken || null
    this.accountId         = cfg.accountId ? parseInt(cfg.accountId) : null
    this.host              = cfg.host || process.env.CTRADER_HOST || 'live.ctraderapi.com'
    this.log               = cfg.log || console.log
    this.socket            = null
    this.connected         = false
    this.appAuthed         = false
    this.acctAuthed        = false
    this.msgId             = 1
    this.symbolCache       = new Map(Object.entries(SYMBOL_ID_MAP))
    this.symbolNameMap     = new Map(Object.entries(SYMBOL_ID_MAP).map(([k,v])=>[v,k]))
    this._symbolsFetched   = false
    this._listeners        = []
    this._heartbeat        = null
    this._reconnTimer      = null
    this._refreshTimer     = null
    this._buf              = Buffer.alloc(0)
    this._balanceCache     = null
    this._balanceCacheTime = 0
    this._positionsCache   = []
    this._positionsCacheTime = 0
    this.tokenExpiresAt    = null

    this._loadTokens()
  }

  // ── Token persistance ─────────────────────────────────────────
  _loadTokens() {
    try {
      if (fs.existsSync(TOKEN_FILE)) {
        const data = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'))
        if (data.accessToken)  this.accessToken  = data.accessToken
        if (data.refreshToken) this.refreshToken = data.refreshToken
        if (data.expiresAt)    this.tokenExpiresAt = new Date(data.expiresAt)
        this.log(`[cTrader] Tokens chargés (expire: ${this.tokenExpiresAt?.toLocaleDateString()||'?'})`)
      }
    } catch {}
  }

  _saveTokens() {
    try {
      const dir = path.dirname(TOKEN_FILE)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(TOKEN_FILE, JSON.stringify({
        accessToken : this.accessToken,
        refreshToken: this.refreshToken,
        expiresAt   : this.tokenExpiresAt?.toISOString(),
        savedAt     : new Date().toISOString(),
      }, null, 2))
    } catch {}
  }

  // ── Refresh token ─────────────────────────────────────────────
  async refreshAccessToken() {
    if (!this.refreshToken) return false
    try {
      this.log('[cTrader] Refresh token OAuth2...')
      const url = `https://openapi.ctrader.com/apps/token` +
        `?grant_type=refresh_token&refresh_token=${encodeURIComponent(this.refreshToken)}` +
        `&client_id=${encodeURIComponent(this.clientId)}&client_secret=${encodeURIComponent(this.clientSecret)}`
      const res  = await axios.post(url, null, { headers:{'Accept':'application/json'}, timeout:10000 })
      const data = res.data
      if (data.errorCode) { this.log(`[cTrader] Refresh err: ${data.errorCode}`); return false }
      this.accessToken    = data.accessToken
      this.refreshToken   = data.refreshToken
      this.tokenExpiresAt = new Date(Date.now() + data.expiresIn * 1000)
      this._saveTokens()
      this.log(`[cTrader] Token refreshé ✅ — expire dans ${Math.round(data.expiresIn/86400)} jours`)
      if (this.connected) { this.disconnect(); setTimeout(()=>this.connect().catch(()=>{}), 2000) }
      return true
    } catch(e) { this.log(`[cTrader] Refresh err: ${e.message}`); return false }
  }

  _scheduleTokenRefresh() {
    if (this._refreshTimer) clearTimeout(this._refreshTimer)
    if (!this.tokenExpiresAt) return
    const delay = Math.max(0, this.tokenExpiresAt.getTime() - Date.now() - 2*86400000)
    this._refreshTimer = setTimeout(()=>this.refreshAccessToken(), delay)
    this.log(`[cTrader] Prochain refresh token dans ~${Math.round(delay/86400000)} jours`)
  }

  // ── Connexion ─────────────────────────────────────────────────
  connect() {
    return new Promise((resolve, reject) => {
      this.log(`[cTrader] Connexion → ${this.host}:5035`)
      this.socket = tls.connect({ host: this.host, port: 5035 }, async () => {
        this.connected = true
        this.log('[cTrader] TCP/TLS connecté')
        this._startHeartbeat()
        try {
          await this._authenticate()
          this._scheduleTokenRefresh()
          resolve()
        } catch(e) { reject(e) }
      })

      this.socket.on('data', (chunk) => {
        this._buf = Buffer.concat([this._buf, chunk])
        while (this._buf.length >= 4) {
          const len = this._buf.readUInt32BE(0)
          if (this._buf.length < 4 + len) break
          const frame = this._buf.slice(4, 4 + len)
          this._buf   = this._buf.slice(4 + len)
          try {
            const msg = decodeFrame(frame)
            if (msg.payloadType === TYPES.ERROR_RES) {
              const code = msg.payload.errorCode || '?'
              const desc = msg.payload.description || ''

              if (SILENT_ERRORS.has(code)) {
                this.log(`[cTrader] ⚠️ Ignoré [${code}] ${desc}`)
              } else {
                this.log(`[cTrader] ❌ [${code}] ${desc}`)
              }

              if (code === 'CH_ACCESS_TOKEN_INVALID' || code === 'OA_AUTH_TOKEN_EXPIRED') {
                this.refreshAccessToken()
              }
            }
            this._listeners
              .filter(l => l.type === msg.payloadType)
              .forEach(l => l.cb(msg.payload))
          } catch(e) { this.log(`[cTrader] Decode err: ${e.message}`) }
        }
      })

      this.socket.on('close', () => {
        this.connected = this.appAuthed = this.acctAuthed = false
        this._balanceCache = null
        this._positionsCache = []
        this._stopHeartbeat()
        this.log('[cTrader] Déconnecté — reconnexion dans 15s')
        this._reconnTimer = setTimeout(()=>this.connect().catch(()=>{}), 15000)
      })

      this.socket.on('error', (e) => { this.log(`[cTrader] Socket err: ${e.message}`); reject(e) })
    })
  }

  disconnect() {
    if (this._reconnTimer) clearTimeout(this._reconnTimer)
    if (this._refreshTimer) clearTimeout(this._refreshTimer)
    this._stopHeartbeat()
    this.socket?.destroy()
    this.connected = this.appAuthed = this.acctAuthed = false
  }

  get isReady() { return this.connected && this.appAuthed && this.acctAuthed }

  async _authenticate() {
    this._send(TYPES.APP_AUTH_REQ, { clientId: this.clientId, clientSecret: this.clientSecret })
    await this._waitFor(TYPES.APP_AUTH_RES)
    this.appAuthed = true
    this.log('[cTrader] App authentifiée ✅')

    if (!this.accountId) {
      this._send(TYPES.ACCOUNTS_REQ, { accessToken: this.accessToken })
      const res = await this._waitFor(TYPES.ACCOUNTS_RES)
      if (res.ctidTraderAccount?.length > 0) {
        const acc = res.ctidTraderAccount.find(a => !a.isLive) || res.ctidTraderAccount[0]
        this.accountId = acc.ctidTraderAccountId
        this.log(`[cTrader] AccountId: ${this.accountId}`)
      }
    }

    this._send(TYPES.ACC_AUTH_REQ, { ctidTraderAccountId: this.accountId, accessToken: this.accessToken })
    await this._waitFor(TYPES.ACC_AUTH_RES)
    this.acctAuthed = true
    this.log('[cTrader] Compte authentifié ✅ — Prêt à trader')

    this._tryFetchSymbols()
  }

  async _tryFetchSymbols() {
    if (this._symbolsFetched) return
    try {
      this._send(TYPES.SYMBOLS_REQ, { ctidTraderAccountId: this.accountId })
      const res = await Promise.race([
        this._waitForOnce(TYPES.SYMBOLS_RES),
        new Promise((_,rej) => setTimeout(()=>rej(new Error('timeout')), 5000)),
      ])
      if (res.symbol?.length > 0) {
        for (const s of res.symbol) {
          if (s.symbolName) {
            const name = s.symbolName.toUpperCase().replace(/[^A-Z]/g,'')
            this.symbolCache.set(name, s.symbolId)
            this.symbolNameMap.set(s.symbolId, name)
          }
        }
        this._symbolsFetched = true
        this.log(`[cTrader] SymbolsList reçue — ${res.symbol.length} symboles`)
      }
    } catch {
      this.log('[cTrader] SymbolsList non disponible — utilisation de la map hardcodée (28 paires Forex OK)')
      this._symbolsFetched = true
    }
  }

  // ── Balance ───────────────────────────────────────────────────
  async getAccountBalance() {
    const now = Date.now()
    if (this._balanceCache && (now - this._balanceCacheTime) < 5*60*1000) return this._balanceCache
    if (!this.isReady) throw new Error('cTrader non prêt')
    this._send(TYPES.TRADER_REQ, { ctidTraderAccountId: this.accountId })
    const res     = await this._waitFor(TYPES.TRADER_RES, 8000)
    const balance = (res.trader?.balance || 0) / 100
    this._balanceCache     = balance
    this._balanceCacheTime = now
    return balance
  }

  // ── Positions ouvertes ────────────────────────────────────────
  async getOpenPositions(forceRefresh = false) {
    const now = Date.now()
    if (!forceRefresh && this._positionsCache?.length && (now - this._positionsCacheTime) < 10000) {
      return this._positionsCache
    }
    if (!this.isReady) return []
    try {
      this._send(TYPES.RECONCILE_REQ, { ctidTraderAccountId: this.accountId })
      const res = await this._waitFor(TYPES.RECONCILE_RES, 8000)

      this._positionsCache = (res.position || []).map(pos => {
        const side  = pos.tradeData?.tradeSide === 1 ? 'BUY' : 'SELL'
        const lots  = (pos.tradeData?.volume || 0) / 100000
        const symId = pos.tradeData?.symbolId
        const symbol = this.symbolNameMap.get(symId) || `ID_${symId}`
        return {
          positionId : pos.positionId,
          symbol,
          side,
          lots       : Math.round(lots * 100) / 100,
          openPrice  : pos.price     || 0,
          stopLoss   : pos.stopLoss  || null,
          takeProfit : pos.takeProfit|| null,
          openTime   : pos.tradeData?.openTimestamp ? new Date(pos.tradeData.openTimestamp).toISOString() : null,
          commission : (pos.commission || 0) / 100,
          swap       : (pos.swap || 0) / 100,
        }
      })
      this._positionsCacheTime = now
      return this._positionsCache
    } catch(e) {
      this.log(`[cTrader] getOpenPositions err: ${e.message}`)
      return this._positionsCache || []
    }
  }

  async getOpenPositionCount() {
    return (await this.getOpenPositions()).length
  }

  async getCurrencyExposure() {
    const positions = await this.getOpenPositions()
    const exposure  = {}
    for (const pos of positions) {
      const sym  = pos.symbol.replace(/^[A-Z]+:/,'').toUpperCase()
      const base = sym.slice(0,3), quote = sym.slice(3,6)
      const isL  = pos.side === 'BUY'
      if (!exposure[base])  exposure[base]  = { long:0, short:0 }
      if (!exposure[quote]) exposure[quote] = { long:0, short:0 }
      if (isL) { exposure[base].long++;  exposure[quote].short++ }
      else     { exposure[base].short++; exposure[quote].long++  }
    }
    return exposure
  }

  // ── Résolution symbole → ID ───────────────────────────────────
  _getSymbolId(sym) {
    const name = sym.replace(/^[A-Z]+:/,'').toUpperCase().replace(/[^A-Z]/g,'')
    const id = this.symbolCache.get(name)
    if (!id) {
      this.log(`[cTrader] ⚠️ Symbole non trouvé: ${name} — vérifier SYMBOL_ID_MAP`)
    }
    return id || null
  }

  // ══════════════════════════════════════════════════════════════
  // placeOrder — FIX : validation volume avant envoi protobuf
  // ══════════════════════════════════════════════════════════════
  // PROBLÈME : cTrader API retourne "Message missing required
  // fields: volume" si le champ volume est 0 ou NaN. Protobuf
  // considère 0 comme "non fourni" pour un champ int64 required.
  //
  // SOLUTION : valider et logger volumeUnits avant d'envoyer.
  // Si le volume est invalide, on throw une erreur explicite
  // plutôt que laisser cTrader répondre avec un message cryptique.
  // ══════════════════════════════════════════════════════════════
  async placeOrder({ symbol, side, volume, stopLoss, takeProfit, comment }) {
    if (!this.isReady) throw new Error('cTrader non prêt')

    const symbolId = this._getSymbolId(symbol)
    if (!symbolId)  throw new Error(`Symbole inconnu: ${symbol} — pas dans la map hardcodée`)

    // ✅ FIX — Conversion lots → unités avec validation explicite
    const volumeUnits = Math.round(parseFloat(volume) * 100000)
    if (!volumeUnits || volumeUnits <= 0 || isNaN(volumeUnits)) {
      throw new Error(`Volume invalide: ${volume} lots → ${volumeUnits} unités. Vérifier calcLotsDynamic().`)
    }

    const payload = {
      ctidTraderAccountId: this.accountId,
      symbolId,
      orderType: 1,
      tradeSide: side === 'BUY' ? 1 : 2,
      volume   : volumeUnits,
      comment  : comment || `ICT ${side} ${symbol}`,
    }
    if (stopLoss   && parseFloat(stopLoss)   > 0) payload.stopLoss   = parseFloat(stopLoss)
    if (takeProfit && parseFloat(takeProfit) > 0) payload.takeProfit = parseFloat(takeProfit)

    this.log(`[cTrader] NewOrderReq: ${side} ${volume}L (${volumeUnits} units) ${symbol} (symbolId=${symbolId})`)
    this._send(TYPES.NEW_ORDER_REQ, payload)

    return new Promise((resolve, reject) => {
      const timer  = setTimeout(()=>{ off(); offErr(); reject(new Error('Timeout ordre 15s')) }, 15000)
      const off    = this._on(TYPES.EXECUTION_EVENT, p => {
        clearTimeout(timer); off(); offErr()
        this._positionsCache     = []
        this._positionsCacheTime = 0
        resolve({ ok:true, positionId:p.position?.positionId||p.deal?.dealId, symbol, side, volume, price:p.deal?.executionPrice })
      })
      const offErr = this._on(TYPES.ERROR_RES, p => {
        clearTimeout(timer); off(); offErr()
        reject(new Error(p.description || p.errorCode || 'cTrader error'))
      })
    })
  }

  // ── Helpers ───────────────────────────────────────────────────
  _send(payloadType, data = {}) {
    if (!this.socket || !this.connected) return
    try   { this.socket.write(encode(payloadType, data, this.msgId++)) }
    catch (e) { this.log(`[cTrader] Send err: ${e.message}`) }
  }

  _on(type, cb) {
    const e = { type, cb }
    this._listeners.push(e)
    return () => { this._listeners = this._listeners.filter(l => l !== e) }
  }

  _waitFor(type, timeout = 12000) {
    return new Promise((resolve, reject) => {
      const timer  = setTimeout(()=>{ off(); offErr(); reject(new Error(`Timeout payloadType=${type}`)) }, timeout)
      const off    = this._on(type, p => { clearTimeout(timer); off(); offErr(); resolve(p) })
      const offErr = this._on(TYPES.ERROR_RES, p => {
        const code = p.errorCode || '?'
        if (SILENT_ERRORS.has(code)) return
        clearTimeout(timer); off(); offErr()
        reject(new Error(`[${code}] ${p.description||'API error'}`))
      })
    })
  }

  _waitForOnce(type) {
    return new Promise((resolve, reject) => {
      const off = this._on(type, p => { off(); resolve(p) })
      const offErr = this._on(TYPES.ERROR_RES, p => { off(); offErr(); reject(new Error(p.errorCode)) })
    })
  }

  _startHeartbeat() { this._heartbeat = setInterval(()=>this._send(TYPES.HEARTBEAT,{}), 25000) }
  _stopHeartbeat()  { if (this._heartbeat) clearInterval(this._heartbeat) }
}

module.exports = CTraderService