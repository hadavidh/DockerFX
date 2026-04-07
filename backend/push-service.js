'use strict'
/**
 * push-service.js
 * Gestion des subscriptions Web Push + envoi de notifications
 * Dépendance : npm install web-push --save
 */

const webpush = require('web-push')
const fs      = require('fs')
const path    = require('path')

const DATA_DIR  = process.env.DATA_DIR || '/app/data'
const SUBS_FILE = path.join(DATA_DIR, 'push-subscriptions.json')

// ── Configuration VAPID ───────────────────────────────────────────
const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  || ''
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || ''
const VAPID_EMAIL   = process.env.VAPID_EMAIL       || 'mailto:admin@ict-dashboard.com'

class PushService {
  constructor(log = console.log) {
    this.log           = log
    this.subscriptions = []  // Array of WebPush subscription objects
    this._initialized  = false

    this._init()
  }

  _init() {
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      this.log('[Push] ⚠️  VAPID_PUBLIC_KEY ou VAPID_PRIVATE_KEY manquants — Push désactivé')
      this.log('[Push]     Générer les clés : node generate-vapid.js')
      return
    }

    try {
      webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE)
      this.subscriptions = this._load()
      this._initialized  = true
      this.log(`[Push] ✅ Web Push initialisé — ${this.subscriptions.length} subscription(s)`)
    } catch(e) {
      this.log(`[Push] ❌ Init erreur: ${e.message}`)
    }
  }

  _load() {
    try {
      if (fs.existsSync(SUBS_FILE)) return JSON.parse(fs.readFileSync(SUBS_FILE, 'utf8'))
    } catch {}
    return []
  }

  _save() {
    try {
      const dir = path.dirname(SUBS_FILE)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(SUBS_FILE, JSON.stringify(this.subscriptions, null, 2))
    } catch(e) { this.log(`[Push] Save err: ${e.message}`) }
  }

  // ── Ajouter une subscription ──────────────────────────────────
  subscribe(subData) {
    if (!subData?.endpoint) return { error: 'Subscription invalide' }
    // Supprimer l'ancienne si même endpoint
    this.subscriptions = this.subscriptions.filter(s => s.endpoint !== subData.endpoint)
    this.subscriptions.push({
      ...subData,
      subscribedAt: new Date().toISOString(),
    })
    this._save()
    this.log(`[Push] Subscription ajoutée (total: ${this.subscriptions.length})`)
    return { ok: true, total: this.subscriptions.length }
  }

  // ── Supprimer une subscription ────────────────────────────────
  unsubscribe(endpoint) {
    const before = this.subscriptions.length
    this.subscriptions = this.subscriptions.filter(s => s.endpoint !== endpoint)
    this._save()
    this.log(`[Push] Subscription supprimée (${before} → ${this.subscriptions.length})`)
    return { ok: true }
  }

  // ── Envoyer une notification à tous les abonnés ───────────────
  async send(payload) {
    if (!this._initialized || this.subscriptions.length === 0) return

    const data    = typeof payload === 'string' ? { title:'ICT Trading', body:payload } : payload
    const message = JSON.stringify(data)

    const dead = []
    await Promise.allSettled(
      this.subscriptions.map(async sub => {
        try {
          await webpush.sendNotification(sub, message)
        } catch(e) {
          // 410 Gone = subscription expirée, à supprimer
          if (e.statusCode === 410 || e.statusCode === 404) {
            dead.push(sub.endpoint)
          } else {
            this.log(`[Push] Send err: ${e.message}`)
          }
        }
      })
    )

    // Nettoyer les subscriptions mortes
    if (dead.length) {
      this.subscriptions = this.subscriptions.filter(s => !dead.includes(s.endpoint))
      this._save()
      this.log(`[Push] ${dead.length} subscription(s) expirée(s) supprimée(s)`)
    }
  }

  // ── Helpers pour les types d'événements ──────────────────────
  async notifyOrderExecuted({ pair, action, lots, price, score, positionId, account }) {
    await this.send({
      title   : `🤖 ${action} ${pair}`,
      body    : `${lots}L @ ${price} | Score ${score}/100 | ${account||''}`,
      tag     : `order-${positionId}`,
      icon    : '/icons/icon-192.png',
      badge   : '/icons/icon-96.png',
      vibrate : [200, 100, 200, 100, 200],
      data    : { type:'order_executed', tab:'journal', pair, action, positionId, requireInteraction:true },
      actions : [
        { action:'view',    title:'Voir le journal' },
        { action:'dismiss', title:'Ignorer' },
      ],
    })
  }

  async notifySignal({ pair, action, score, rr, strategy }) {
    await this.send({
      title  : `${action === 'BUY' ? '🟢' : '🔴'} Signal ${pair}`,
      body   : `Score ${score}/100 | R:R 1:${rr} | ${strategy}`,
      tag    : `signal-${pair}-${action}`,
      icon   : '/icons/icon-192.png',
      badge  : '/icons/icon-96.png',
      data   : { type:'signal', tab:'dashboard', pair, action },
    })
  }

  async notifyDrawdown({ pct, type, message }) {
    await this.send({
      title   : type === 'daily_stop'
        ? `🚨 STOP — Drawdown ${pct}%`
        : `⚠️ Alerte Drawdown ${pct}%`,
      body    : message || `Drawdown journalier: ${pct}%`,
      tag     : 'drawdown-alert',
      icon    : '/icons/icon-192.png',
      badge   : '/icons/icon-96.png',
      vibrate : [500, 200, 500, 200, 500],
      data    : { type:'drawdown', tab:'dashboard', requireInteraction:true },
    })
  }

  async notifyAutoMode(enabled, reason) {
    await this.send({
      title: enabled ? '🟢 AutoMode activé' : '🔴 AutoMode désactivé',
      body : reason || (enabled ? 'Les ordres auto sont actifs' : 'Les ordres auto sont suspendus'),
      tag  : 'automode',
      icon : '/icons/icon-192.png',
      badge: '/icons/icon-96.png',
      data : { type:'automode', tab:'dashboard' },
    })
  }

  get isEnabled() { return this._initialized }
  get count()     { return this.subscriptions.length }
}

module.exports = PushService
