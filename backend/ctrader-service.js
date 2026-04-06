'use strict'

const tls      = require('tls')
const protobuf = require('protobufjs')

const root = protobuf.Root.fromJSON({
  nested: {
    ProtoMessage: {
      fields: {
        payloadType: { id:1, type:'uint32', rule:'required' },
        payload:     { id:2, type:'bytes',  rule:'optional' },
        clientMsgId: { id:3, type:'string', rule:'optional' },
      }
    },
    ProtoOAApplicationAuthReq: {
      fields: {
        clientId:     { id:2, type:'string', rule:'required' },
        clientSecret: { id:3, type:'string', rule:'required' },
      }
    },
    ProtoOAApplicationAuthRes: {
      fields: {
        ctidOAApplicationType: { id:2, type:'uint32', rule:'optional' },
      }
    },
    ProtoOAAccountAuthReq: {
      fields: {
        ctidTraderAccountId: { id:2, type:'int64',  rule:'required' },
        accessToken:         { id:3, type:'string', rule:'required' },
      }
    },
    ProtoOAAccountAuthRes: {
      fields: {
        ctidTraderAccountId: { id:2, type:'int64', rule:'required' },
      }
    },
    ProtoOAGetAccountListByAccessTokenReq: {
      fields: {
        accessToken: { id:2, type:'string', rule:'required' },
      }
    },
    ProtoOAGetAccountListByAccessTokenRes: {
      fields: {
        ctidTraderAccount:     { id:4, type:'ProtoOACtidTraderAccount', rule:'repeated' },
        ctidOAApplicationType: { id:3, type:'uint32',                   rule:'optional' },
      }
    },
    ProtoOACtidTraderAccount: {
      fields: {
        ctidTraderAccountId: { id:1, type:'int64', rule:'required' },
        isLive:              { id:2, type:'bool',  rule:'optional' },
      }
    },
    // ── Trader info (balance) ─────────────────────────────────────
    ProtoOATraderReq: {
      fields: {
        ctidTraderAccountId: { id:2, type:'int64', rule:'required' },
      }
    },
    ProtoOATraderRes: {
      fields: {
        ctidTraderAccountId: { id:2, type:'int64',         rule:'required' },
        trader:              { id:3, type:'ProtoOATrader', rule:'optional' },
      }
    },
    ProtoOATrader: {
      fields: {
        ctidTraderAccountId: { id:1,  type:'int64',  rule:'required' },
        balance:             { id:3,  type:'int64',  rule:'optional' }, // centimes
        leverageInCents:     { id:8,  type:'int64',  rule:'optional' },
        currency:            { id:18, type:'string', rule:'optional' },
      }
    },
    ProtoOANewOrderReq: {
      fields: {
        ctidTraderAccountId: { id:2,  type:'int64',  rule:'required' },
        symbolId:            { id:3,  type:'int64',  rule:'required' },
        orderType:           { id:4,  type:'uint32', rule:'required' },
        tradeSide:           { id:5,  type:'uint32', rule:'required' },
        volume:              { id:12, type:'int64',  rule:'required' },
        stopLoss:            { id:15, type:'double', rule:'optional' },
        takeProfit:          { id:16, type:'double', rule:'optional' },
        comment:             { id:20, type:'string', rule:'optional' },
      }
    },
    ProtoOAPosition: {
      fields: {
        positionId: { id:1, type:'int64', rule:'required' },
      }
    },
    ProtoOADeal: {
      fields: {
        dealId:         { id:1, type:'int64',  rule:'required' },
        executionPrice: { id:5, type:'double', rule:'optional' },
      }
    },
    ProtoOAExecutionEvent: {
      fields: {
        ctidTraderAccountId: { id:2, type:'int64',           rule:'required' },
        executionType:       { id:3, type:'uint32',          rule:'required' },
        position:            { id:4, type:'ProtoOAPosition', rule:'optional' },
        deal:                { id:5, type:'ProtoOADeal',     rule:'optional' },
      }
    },
    ProtoOASymbolsListReq: {
      fields: {
        ctidTraderAccountId: { id:2, type:'int64', rule:'required' },
      }
    },
    ProtoOASymbolsListRes: {
      fields: {
        ctidTraderAccountId: { id:2, type:'int64',              rule:'required' },
        symbol:              { id:3, type:'ProtoOALightSymbol', rule:'repeated' },
      }
    },
    ProtoOALightSymbol: {
      fields: {
        symbolId:   { id:1, type:'int64',  rule:'required' },
        symbolName: { id:2, type:'string', rule:'optional' },
      }
    },
    ProtoOAErrorRes: {
      fields: {
        errorCode:   { id:3, type:'string', rule:'optional' },
        description: { id:4, type:'string', rule:'optional' },
      }
    },
    ProtoHeartbeatEvent: { fields: {} },
  }
})

const TYPES = {
  HEARTBEAT       : 51,
  APP_AUTH_REQ    : 2100, APP_AUTH_RES    : 2101,
  ACC_AUTH_REQ    : 2102, ACC_AUTH_RES    : 2103,
  NEW_ORDER_REQ   : 2106, EXECUTION_EVENT : 2126,
  ERROR_RES       : 2142,
  SYMBOLS_REQ     : 2115, SYMBOLS_RES     : 2116,
  ACCOUNTS_REQ    : 2149, ACCOUNTS_RES    : 2150,
  TRADER_REQ      : 2129, TRADER_RES      : 2130,
}

const PAYLOAD_MAP = {
  [TYPES.APP_AUTH_REQ]     : 'ProtoOAApplicationAuthReq',
  [TYPES.APP_AUTH_RES]     : 'ProtoOAApplicationAuthRes',
  [TYPES.ACC_AUTH_REQ]     : 'ProtoOAAccountAuthReq',
  [TYPES.ACC_AUTH_RES]     : 'ProtoOAAccountAuthRes',
  [TYPES.ACCOUNTS_REQ]     : 'ProtoOAGetAccountListByAccessTokenReq',
  [TYPES.ACCOUNTS_RES]     : 'ProtoOAGetAccountListByAccessTokenRes',
  [TYPES.NEW_ORDER_REQ]    : 'ProtoOANewOrderReq',
  [TYPES.EXECUTION_EVENT]  : 'ProtoOAExecutionEvent',
  [TYPES.SYMBOLS_REQ]      : 'ProtoOASymbolsListReq',
  [TYPES.SYMBOLS_RES]      : 'ProtoOASymbolsListRes',
  [TYPES.ERROR_RES]        : 'ProtoOAErrorRes',
  [TYPES.HEARTBEAT]        : 'ProtoHeartbeatEvent',
  [TYPES.TRADER_REQ]       : 'ProtoOATraderReq',
  [TYPES.TRADER_RES]       : 'ProtoOATraderRes',
}

const ProtoMessage = root.lookupType('ProtoMessage')

function encode(payloadType, data, clientMsgId) {
  const TypeClass = root.lookupType(PAYLOAD_MAP[payloadType])
  const payload   = TypeClass.encode(TypeClass.create(data)).finish()
  const msg       = ProtoMessage.encode(ProtoMessage.create({
    payloadType,
    payload,
    clientMsgId: String(clientMsgId || ''),
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
  return {
    payloadType: msg.payloadType,
    payload: TypeClass.toObject(payload, { longs: Number }),
  }
}

// ── CTraderService ────────────────────────────────────────────────
class CTraderService {
  constructor(cfg) {
    this.clientId          = cfg.clientId
    this.clientSecret      = cfg.clientSecret
    this.accessToken       = cfg.accessToken
    this.accountId         = cfg.accountId ? parseInt(cfg.accountId) : null
    this.host              = cfg.host || process.env.CTRADER_HOST || 'live.ctraderapi.com'
    this.log               = cfg.log || console.log
    this.socket            = null
    this.connected         = false
    this.appAuthed         = false
    this.acctAuthed        = false
    this.msgId             = 1
    this.symbolCache       = new Map()
    this._listeners        = []
    this._heartbeat        = null
    this._reconnTimer      = null
    this._buf              = Buffer.alloc(0)
    this._balanceCache     = null
    this._balanceCacheTime = 0
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.log(`[cTrader] Connexion → ${this.host}:5035`)
      this.socket = tls.connect({ host: this.host, port: 5035 }, async () => {
        this.connected = true
        this.log('[cTrader] TCP/TLS connecté')
        this._startHeartbeat()
        try   { await this._authenticate(); resolve() }
        catch (e) { reject(e) }
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
              this.log(`[cTrader] ❌ [${msg.payload.errorCode || '?'}] ${msg.payload.description || ''}`)
            }
            this._listeners
              .filter(l => l.type === msg.payloadType)
              .forEach(l => l.cb(msg.payload))
          } catch (e) {
            this.log(`[cTrader] Decode err: ${e.message}`)
          }
        }
      })

      this.socket.on('close', () => {
        this.connected = this.appAuthed = this.acctAuthed = false
        this._balanceCache = null
        this._stopHeartbeat()
        this.log('[cTrader] Connexion fermée — reconnexion dans 15s')
        this._reconnTimer = setTimeout(() => this.connect().catch(() => {}), 15000)
      })

      this.socket.on('error', (e) => {
        this.log(`[cTrader] Socket erreur: ${e.message}`)
        reject(e)
      })
    })
  }

  disconnect() {
    if (this._reconnTimer) clearTimeout(this._reconnTimer)
    this._stopHeartbeat()
    this.socket?.destroy()
    this.connected = this.appAuthed = this.acctAuthed = false
  }

  get isReady() { return this.connected && this.appAuthed && this.acctAuthed }

  async _authenticate() {
    this.log(`[cTrader] ApplicationAuth (clientId: ${this.clientId})`)
    this._send(TYPES.APP_AUTH_REQ, {
      clientId:     this.clientId,
      clientSecret: this.clientSecret,
    })
    await this._waitFor(TYPES.APP_AUTH_RES)
    this.appAuthed = true
    this.log('[cTrader] App authentifiée ✅')

    if (!this.accountId) {
      this.log('[cTrader] Récupération des comptes...')
      this._send(TYPES.ACCOUNTS_REQ, { accessToken: this.accessToken })
      const res = await this._waitFor(TYPES.ACCOUNTS_RES)
      this.log(`[cTrader] Comptes: ${JSON.stringify(res.ctidTraderAccount)}`)
      if (res.ctidTraderAccount?.length > 0) {
        const ftmo = res.ctidTraderAccount.find(a => !a.isLive) || res.ctidTraderAccount[0]
        this.accountId = ftmo.ctidTraderAccountId
        this.log(`[cTrader] AccountId sélectionné: ${this.accountId}`)
      }
    }

    this.log(`[cTrader] AccountAuth (accountId: ${this.accountId})...`)
    this._send(TYPES.ACC_AUTH_REQ, {
      ctidTraderAccountId: this.accountId,
      accessToken:         this.accessToken,
    })
    await this._waitFor(TYPES.ACC_AUTH_RES)
    this.acctAuthed = true
    this.log('[cTrader] Compte authentifié ✅ — Prêt à trader')
  }

  // ── Balance réelle (cache 5 min) ──────────────────────────────
  async getAccountBalance() {
    const now = Date.now()
    if (this._balanceCache && (now - this._balanceCacheTime) < 5 * 60 * 1000) {
      return this._balanceCache
    }
    if (!this.isReady) throw new Error('cTrader non prêt')
    this._send(TYPES.TRADER_REQ, { ctidTraderAccountId: this.accountId })
    const res     = await this._waitFor(TYPES.TRADER_RES, 8000)
    const balance = (res.trader?.balance || 0) / 100   // centimes → dollars
    this._balanceCache     = balance
    this._balanceCacheTime = now
    this.log(`[cTrader] Balance: $${balance.toFixed(2)}`)
    return balance
  }

  async placeOrder({ symbol, side, volume, stopLoss, takeProfit, comment }) {
    if (!this.isReady) throw new Error('cTrader non prêt')
    const symbolId = await this._getSymbolId(symbol)
    if (!symbolId)  throw new Error(`Symbole inconnu: ${symbol}`)

    const payload = {
      ctidTraderAccountId: this.accountId,
      symbolId,
      orderType: 1,
      tradeSide: side === 'BUY' ? 1 : 2,
      volume:    Math.round(parseFloat(volume) * 100000),
      comment:   comment || `ICT ${side} ${symbol}`,
    }
    if (stopLoss   && parseFloat(stopLoss)   > 0) payload.stopLoss   = parseFloat(stopLoss)
    if (takeProfit && parseFloat(takeProfit) > 0) payload.takeProfit = parseFloat(takeProfit)

    this.log(`[cTrader] NewOrderReq: ${side} ${volume}L ${symbol}`)
    this._send(TYPES.NEW_ORDER_REQ, payload)

    return new Promise((resolve, reject) => {
      const timer  = setTimeout(() => { off(); offErr(); reject(new Error('Timeout ordre 15s')) }, 15000)
      const off    = this._on(TYPES.EXECUTION_EVENT, (p) => {
        clearTimeout(timer); off(); offErr()
        resolve({
          ok         : true,
          positionId : p.position?.positionId || p.deal?.dealId,
          symbol, side, volume,
          price      : p.deal?.executionPrice,
        })
      })
      const offErr = this._on(TYPES.ERROR_RES, (p) => {
        clearTimeout(timer); off(); offErr()
        reject(new Error(p.description || p.errorCode || 'cTrader error'))
      })
    })
  }

  async _getSymbolId(sym) {
    const name = sym.replace(/^[A-Z]+:/, '').toUpperCase()
    if (this.symbolCache.has(name)) return this.symbolCache.get(name)
    this._send(TYPES.SYMBOLS_REQ, { ctidTraderAccountId: this.accountId })
    const res = await this._waitFor(TYPES.SYMBOLS_RES)
    for (const s of (res.symbol || [])) {
      this.symbolCache.set(s.symbolName.toUpperCase(), s.symbolId)
    }
    return this.symbolCache.get(name) || null
  }

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
      const timer  = setTimeout(() => { off(); offErr(); reject(new Error(`Timeout payloadType=${type}`)) }, timeout)
      const off    = this._on(type, (p) => { clearTimeout(timer); off(); offErr(); resolve(p) })
      const offErr = this._on(TYPES.ERROR_RES, (p) => {
        clearTimeout(timer); off(); offErr()
        reject(new Error(`[${p.errorCode || '?'}] ${p.description || 'API error'}`))
      })
    })
  }

  _startHeartbeat() { this._heartbeat = setInterval(() => this._send(TYPES.HEARTBEAT, {}), 25000) }
  _stopHeartbeat()  { if (this._heartbeat) clearInterval(this._heartbeat) }
}

module.exports = CTraderService