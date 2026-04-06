'use strict'
const axios = require('axios')

// ── Telegram Bot bidirectionnel ───────────────────────────────────
// Polling long (getUpdates) — pas besoin de webhook entrant
class TelegramBot {
  constructor(opts = {}) {
    this.token      = opts.token   || process.env.TELEGRAM_TOKEN  || ''
    this.chatId     = opts.chatId  || process.env.TELEGRAM_CHATID || ''
    this.log        = opts.log     || console.log
    this._offset    = 0
    this._polling   = false
    this._timer     = null
    this._commands  = {}   // { '/cmd': handler(args, chatId) }

    // Commandes par défaut
    this._registerDefaults(opts)
  }

  _registerDefaults(opts) {
    const {
      onPause, onResume, onStatus, onBalance, onPositions,
      onStop, onHelp,
    } = opts

    if (onPause)     this.on('/pause',     onPause)
    if (onResume)    this.on('/resume',    onResume)
    if (onStatus)    this.on('/status',    onStatus)
    if (onBalance)   this.on('/balance',   onBalance)
    if (onPositions) this.on('/positions', onPositions)
    if (onStop)      this.on('/stop',      onStop)
    if (onHelp)      this.on('/help',      onHelp)
    else this.on('/help', () =>
      '📋 *Commandes disponibles*\n\n' +
      '/pause     — Désactive l\'AutoMode\n' +
      '/resume    — Réactive l\'AutoMode\n' +
      '/status    — État actuel du bot\n' +
      '/balance   — Solde FTMO\n' +
      '/positions — Positions ouvertes\n' +
      '/help      — Cette aide'
    )
  }

  on(command, handler) {
    // Normalise : /pause → /pause, /PAUSE → /pause
    this._commands[command.toLowerCase()] = handler
  }

  async send(text, chatId = null, parseMode = 'Markdown') {
    if (!this.token) return false
    const target = chatId || this.chatId
    if (!target) return false
    try {
      await axios.post(`https://api.telegram.org/bot${this.token}/sendMessage`, {
        chat_id              : target,
        text,
        parse_mode           : parseMode,
        disable_web_page_preview: true,
      }, { timeout: 8000 })
      return true
    } catch (e) {
      this.log(`[TelegramBot] Send error: ${e.message}`)
      return false
    }
  }

  // Démarre le polling long
  startPolling(intervalMs = 3000) {
    if (!this.token || this._polling) return
    this._polling = true
    this.log('[TelegramBot] Polling démarré ✅')
    this._poll()
    this._timer = setInterval(() => this._poll(), intervalMs)
  }

  stopPolling() {
    this._polling = false
    if (this._timer) clearInterval(this._timer)
    this.log('[TelegramBot] Polling arrêté')
  }

  async _poll() {
    if (!this.token) return
    try {
      const res  = await axios.get(`https://api.telegram.org/bot${this.token}/getUpdates`, {
        params : { offset: this._offset, timeout: 2, allowed_updates: ['message'] },
        timeout: 5000,
      })
      const updates = res.data?.result || []
      for (const upd of updates) {
        this._offset = upd.update_id + 1
        await this._handleUpdate(upd)
      }
    } catch (e) {
      // Silencieux sauf si erreur réseau
      if (!e.message?.includes('timeout') && !e.message?.includes('ECONNREFUSED')) {
        this.log(`[TelegramBot] Poll error: ${e.message}`)
      }
    }
  }

  async _handleUpdate(upd) {
    const msg    = upd.message
    if (!msg?.text) return

    const fromId = String(msg.chat?.id)
    const text   = msg.text.trim()

    // Sécurité : n'accepter que depuis le chat autorisé
    if (this.chatId && fromId !== String(this.chatId)) {
      await this.send('❌ Accès non autorisé.', fromId)
      this.log(`[TelegramBot] Message refusé de chatId=${fromId}`)
      return
    }

    // Parse commande
    const parts   = text.split(' ')
    const command = parts[0].toLowerCase()
    const args    = parts.slice(1)

    this.log(`[TelegramBot] Commande reçue: ${command} de ${fromId}`)

    const handler = this._commands[command]
    if (handler) {
      try {
        const response = await handler(args, fromId)
        if (response) await this.send(response, fromId)
      } catch (e) {
        await this.send(`❌ Erreur: ${e.message}`, fromId)
      }
    } else {
      await this.send(`❓ Commande inconnue: \`${command}\`\nTapez /help pour la liste.`, fromId)
    }
  }
}

module.exports = TelegramBot