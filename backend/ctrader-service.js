'use strict'
const WebSocket = require('ws')
const MSG = {
  HEARTBEAT:51,
  PROTO_OA_APPLICATION_AUTH_REQ:2100,PROTO_OA_APPLICATION_AUTH_RES:2101,
  PROTO_OA_ACCOUNT_AUTH_REQ:2102,PROTO_OA_ACCOUNT_AUTH_RES:2103,
  PROTO_OA_NEW_ORDER_REQ:2106,PROTO_OA_EXECUTION_EVENT:2126,
  PROTO_OA_ERROR_RES:2142,PROTO_OA_SYMBOLS_LIST_REQ:2115,
  PROTO_OA_SYMBOLS_LIST_RES:2116,
  PROTO_OA_GET_ACCOUNTS_BY_ACCESS_TOKEN_REQ:2149,
  PROTO_OA_GET_ACCOUNTS_BY_ACCESS_TOKEN_RES:2150,
}
const TRADE_SIDE={BUY:1,SELL:2},ORDER_TYPE={MARKET:1}
class CTraderService {
  constructor(cfg){
    this.clientId=cfg.clientId;this.clientSecret=cfg.clientSecret
    this.accessToken=cfg.accessToken;this.accountId=cfg.accountId?parseInt(cfg.accountId):null
    this.log=cfg.log||console.log;this.ws=null;this.connected=false
    this.appAuthed=false;this.acctAuthed=false;this.msgId=1
    this.symbolCache=new Map();this._listeners=[];this._heartbeat=null;this._reconnect=null
  }
  connect(){
    return new Promise((resolve,reject)=>{
      const url=`wss://live.ctraderapi.com:5035`
      this.log(`[cTrader] Connexion → ${url}`)
      this.ws=new WebSocket(url)
      this.ws.on('open',async()=>{
        this.connected=true;this.log('[cTrader] WebSocket connecté')
        this._startHeartbeat()
        try{await this._authenticate();resolve()}catch(e){reject(e)}
      })
      this.ws.on('message',(raw)=>this._dispatch(raw))
      this.ws.on('close',(code)=>{
        this.connected=this.appAuthed=this.acctAuthed=false
        this._stopHeartbeat()
        this.log(`[cTrader] Fermé (code ${code}) — reconnexion dans 15s`)
        this._reconnect=setTimeout(()=>this.connect().catch(()=>{}),15000)
      })
      this.ws.on('error',(e)=>{this.log(`[cTrader] Erreur: ${e.message}`);reject(e)})
    })
  }
  disconnect(){if(this._reconnect)clearTimeout(this._reconnect);this._stopHeartbeat();this.ws?.close()}
  get isReady(){return this.connected&&this.appAuthed&&this.acctAuthed}
  async _authenticate(){
    this.log('[cTrader] ApplicationAuth...')
    this._send(MSG.PROTO_OA_APPLICATION_AUTH_REQ,{clientId:this.clientId,clientSecret:this.clientSecret})
    await this._waitFor(MSG.PROTO_OA_APPLICATION_AUTH_RES)
    this.appAuthed=true;this.log('[cTrader] App authentifiée ✅')
    if(!this.accountId){
      this.log('[cTrader] Récupération des comptes...')
      this._send(MSG.PROTO_OA_GET_ACCOUNTS_BY_ACCESS_TOKEN_REQ,{accessToken:this.accessToken})
      const res=await this._waitFor(MSG.PROTO_OA_GET_ACCOUNTS_BY_ACCESS_TOKEN_RES)
      if(res.ctidTraderAccount?.length>0){
        this.accountId=res.ctidTraderAccount[0].ctidTraderAccountId
        this.log(`[cTrader] AccountId: ${this.accountId}`)
      }
    }
    this.log(`[cTrader] AccountAuth ${this.accountId}...`)
    this._send(MSG.PROTO_OA_ACCOUNT_AUTH_REQ,{ctidTraderAccountId:this.accountId,accessToken:this.accessToken})
    await this._waitFor(MSG.PROTO_OA_ACCOUNT_AUTH_RES)
    this.acctAuthed=true;this.log('[cTrader] Compte authentifié ✅ — Prêt à trader')
  }
  async placeOrder({symbol,side,volume,stopLoss,takeProfit,comment}){
    if(!this.isReady)throw new Error('cTrader non prêt')
    const symbolId=await this._getSymbolId(symbol)
    if(!symbolId)throw new Error(`Symbole inconnu: ${symbol}`)
    const payload={
      ctidTraderAccountId:this.accountId,symbolId,
      orderType:ORDER_TYPE.MARKET,
      tradeSide:side==='BUY'?TRADE_SIDE.BUY:TRADE_SIDE.SELL,
      volume:Math.round(parseFloat(volume)*100000),
      comment:comment||`ICT ${side} ${symbol}`,
    }
    if(stopLoss&&parseFloat(stopLoss)>0)payload.stopLoss=parseFloat(stopLoss)
    if(takeProfit&&parseFloat(takeProfit)>0)payload.takeProfit=parseFloat(takeProfit)
    this.log(`[cTrader] NewOrderReq: ${side} ${volume}L ${symbol}`)
    this._send(MSG.PROTO_OA_NEW_ORDER_REQ,payload)
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Timeout ordre 15s')),15000)
      const off=this._on(MSG.PROTO_OA_EXECUTION_EVENT,(p)=>{
        clearTimeout(timer);off()
        resolve({ok:true,positionId:p.position?.positionId||p.deal?.dealId,symbol,side,volume,price:p.deal?.executionPrice})
      })
      const offErr=this._on(MSG.PROTO_OA_ERROR_RES,(p)=>{
        clearTimeout(timer);off();offErr()
        reject(new Error(p.description||p.errorCode||'cTrader error'))
      })
    })
  }
  async _getSymbolId(sym){
    const name=sym.replace(/^[A-Z]+:/,'').toUpperCase()
    if(this.symbolCache.has(name))return this.symbolCache.get(name)
    this._send(MSG.PROTO_OA_SYMBOLS_LIST_REQ,{ctidTraderAccountId:this.accountId})
    const res=await this._waitFor(MSG.PROTO_OA_SYMBOLS_LIST_RES)
    for(const s of(res.symbol||[]))this.symbolCache.set(s.symbolName.toUpperCase(),s.symbolId)
    return this.symbolCache.get(name)||null
  }
  _send(payloadType,payload={}){
    const msg=JSON.stringify({payloadType,payload,clientMsgId:String(this.msgId++)})
    if(this.ws?.readyState===WebSocket.OPEN)this.ws.send(msg)
  }
  _decode(raw){try{return JSON.parse(raw.toString())}catch{return{payloadType:-1,payload:{}}}}
  _dispatch(raw){
    const msg=this._decode(raw)
    this._listeners.filter(l=>l.type===msg.payloadType).forEach(l=>l.cb(msg.payload||{}))
  }
  _on(type,cb){const e={type,cb};this._listeners.push(e);return()=>{this._listeners=this._listeners.filter(l=>l!==e)}}
  _waitFor(type,timeout=12000){
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{off();reject(new Error(`Timeout payloadType=${type}`))},timeout)
      const off=this._on(type,(p)=>{clearTimeout(timer);off();resolve(p)})
      const offErr=this._on(MSG.PROTO_OA_ERROR_RES,(p)=>{clearTimeout(timer);off();offErr();reject(new Error(p.description||'API error'))})
    })
  }
  _startHeartbeat(){this._heartbeat=setInterval(()=>this._send(MSG.HEARTBEAT,{}),25000)}
  _stopHeartbeat(){if(this._heartbeat)clearInterval(this._heartbeat)}
}
module.exports=CTraderService