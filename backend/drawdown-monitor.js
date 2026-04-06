'use strict'
const fs   = require('fs')
const path = require('path')

const DATA_DIR   = process.env.DATA_DIR || '/app/data'
const DD_FILE    = path.join(DATA_DIR, 'drawdown.json')

class DrawdownMonitor {
  constructor(opts = {}) {
    this.maxDailyDD    = opts.maxDailyDD    || parseFloat(process.env.MAX_DAILY_DD    || '4')    // % avant alerte
    this.hardStopDD    = opts.hardStopDD    || parseFloat(process.env.HARD_STOP_DD    || '5')    // % stop absolu FTMO
    this.maxTotalDD    = opts.maxTotalDD    || parseFloat(process.env.MAX_TOTAL_DD    || '10')   // % drawdown total FTMO
    this.onAlert       = opts.onAlert       || (() => {})   // callback(type, msg, data)
    this.log           = opts.log           || console.log

    this._data = this._load()
  }

  _load() {
    try {
      if (fs.existsSync(DD_FILE)) return JSON.parse(fs.readFileSync(DD_FILE, 'utf8'))
    } catch {}
    return { dayStart: null, dayStartBalance: null, maxBalance: null, history: [] }
  }

  _save() {
    try { fs.writeFileSync(DD_FILE, JSON.stringify(this._data, null, 2)) } catch {}
  }

  // Appelé à chaque récupération du solde
  async check(currentBalance, accountId = 'default') {
    const now     = new Date()
    const today   = now.toISOString().slice(0, 10)
    const result  = { ok: true, alerts: [] }

    // Nouveau jour → reset dayStartBalance
    if (this._data.dayStart !== today) {
      this._data.dayStart        = today
      this._data.dayStartBalance = currentBalance
      this.log(`[Drawdown] Nouveau jour — balance de départ: $${currentBalance.toFixed(2)}`)
    }

    // Met à jour le max balance (highwater mark)
    if (!this._data.maxBalance || currentBalance > this._data.maxBalance) {
      this._data.maxBalance = currentBalance
    }

    const dayStartBal  = this._data.dayStartBalance || currentBalance
    const maxBal       = this._data.maxBalance       || currentBalance

    const dailyDD    = ((dayStartBal - currentBalance) / dayStartBal) * 100
    const totalDD    = ((maxBal - currentBalance) / maxBal) * 100

    // Enregistrement historique (toutes les heures max)
    const lastEntry  = this._data.history?.[this._data.history.length - 1]
    const lastTs     = lastEntry ? new Date(lastEntry.ts) : null
    if (!lastTs || (now - lastTs) > 3600000) {
      if (!this._data.history) this._data.history = []
      this._data.history.push({ ts: now.toISOString(), balance: currentBalance, dailyDD: Math.round(dailyDD * 100) / 100, totalDD: Math.round(totalDD * 100) / 100 })
      this._data.history = this._data.history.slice(-168)  // 7 jours
    }

    this._save()

    // ── Alertes ───────────────────────────────────────────────────

    // Drawdown journalier > seuil d'alerte
    if (dailyDD >= this.maxDailyDD && dailyDD < this.hardStopDD) {
      const msg = `⚠️ *DRAWDOWN JOURNALIER: ${dailyDD.toFixed(2)}%*\nBalance: $${currentBalance.toFixed(2)} | Début de journée: $${dayStartBal.toFixed(2)}\nSeuil alerte: ${this.maxDailyDD}%`
      result.alerts.push({ type: 'daily_warning', pct: dailyDD, msg })
      this.onAlert('daily_warning', msg, { dailyDD, currentBalance })
    }

    // Drawdown journalier > stop absolu → arrêt forcé
    if (dailyDD >= this.hardStopDD) {
      const msg = `🚨 *ARRÊT D'URGENCE — DRAWDOWN ${dailyDD.toFixed(2)}%*\nRègle FTMO: max ${this.hardStopDD}% par jour\nBalance: $${currentBalance.toFixed(2)}\n\nAutoMode DÉSACTIVÉ automatiquement 🔴`
      result.ok = false
      result.alerts.push({ type: 'daily_stop', pct: dailyDD, msg })
      this.onAlert('daily_stop', msg, { dailyDD, currentBalance })
      this.log(`[Drawdown] 🚨 STOP — daily DD ${dailyDD.toFixed(2)}% >= ${this.hardStopDD}%`)
    }

    // Drawdown total > seuil
    if (totalDD >= this.maxTotalDD * 0.8) {
      const msg = `⚠️ *DRAWDOWN TOTAL: ${totalDD.toFixed(2)}%* (max: ${this.maxTotalDD}%)\nBalance: $${currentBalance.toFixed(2)} | Max: $${maxBal.toFixed(2)}`
      result.alerts.push({ type: 'total_warning', pct: totalDD, msg })
      this.onAlert('total_warning', msg, { totalDD, currentBalance })
    }

    return {
      ...result,
      dailyDD    : Math.round(dailyDD  * 100) / 100,
      totalDD    : Math.round(totalDD  * 100) / 100,
      dayStartBal,
      maxBal,
      currentBalance,
      history    : (this._data.history || []).slice(-48),  // 48h
    }
  }

  getStatus() {
    return {
      dayStart         : this._data.dayStart,
      dayStartBalance  : this._data.dayStartBalance,
      maxBalance       : this._data.maxBalance,
      maxDailyDD       : this.maxDailyDD,
      hardStopDD       : this.hardStopDD,
      maxTotalDD       : this.maxTotalDD,
      history          : (this._data.history || []).slice(-48),
    }
  }
}

module.exports = DrawdownMonitor