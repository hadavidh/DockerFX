'use strict'
const fs   = require('fs')
const path = require('path')

const DATA_DIR    = process.env.DATA_DIR || '/app/data'
const JOURNAL_FILE = path.join(DATA_DIR, 'journal.json')

class JournalManager {
  constructor() {
    this._ensureDir()
    this.entries = this._load()
  }

  _ensureDir() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  }

  _load() {
    try {
      if (fs.existsSync(JOURNAL_FILE)) return JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf8'))
    } catch {}
    return []
  }

  _save() {
    try { fs.writeFileSync(JOURNAL_FILE, JSON.stringify(this.entries, null, 2)) } catch {}
  }

  // Ajoute un trade exécuté par le bot
  addTrade(data) {
    const entry = {
      id         : `trade_${Date.now()}`,
      pair       : data.pair       || '',
      action     : data.action     || '',
      strategy   : data.stratId    || data.strategy || '',
      lots       : data.lots       || 0,
      entryPrice : data.price      || null,
      sl         : data.sl         || null,
      tp         : data.tp         || null,
      rr         : data.rr_reel    || null,
      score      : data.score      || null,
      signal     : data.signal     || '',
      entryType  : data.entry_type || '',
      positionId : data.positionId || null,
      simulated  : data.simulated  || false,
      executedAt : new Date().toISOString(),
      // À remplir manuellement ou via fermeture de position
      exitPrice  : null,
      outcome    : null,   // 'win' | 'loss' | 'be' (breakeven)
      pnlUSD     : null,
      closedAt   : null,
      notes      : '',
      tags       : [],
    }
    this.entries.unshift(entry)
    this._save()
    return entry
  }

  // Mise à jour manuelle (notes, outcome, exit price)
  updateTrade(id, updates) {
    const idx = this.entries.findIndex(e => e.id === id)
    if (idx < 0) return { error: 'Trade introuvable' }
    const allowed = ['notes', 'outcome', 'exitPrice', 'pnlUSD', 'closedAt', 'tags']
    for (const key of allowed) {
      if (updates[key] !== undefined) this.entries[idx][key] = updates[key]
    }
    this.entries[idx].updatedAt = new Date().toISOString()
    this._save()
    return this.entries[idx]
  }

  deleteTrade(id) {
    const idx = this.entries.findIndex(e => e.id === id)
    if (idx < 0) return { error: 'Trade introuvable' }
    this.entries.splice(idx, 1)
    this._save()
    return { ok: true }
  }

  getEntries(limit = 200, filters = {}) {
    let result = [...this.entries]
    if (filters.pair)     result = result.filter(e => e.pair === filters.pair)
    if (filters.strategy) result = result.filter(e => e.strategy === filters.strategy)
    if (filters.outcome)  result = result.filter(e => e.outcome === filters.outcome)
    return result.slice(0, limit)
  }

  getStats() {
    const total    = this.entries.length
    const executed = this.entries.filter(e => !e.simulated)
    const withPnl  = executed.filter(e => e.pnlUSD !== null)
    const wins     = executed.filter(e => e.outcome === 'win')
    const losses   = executed.filter(e => e.outcome === 'loss')
    const be       = executed.filter(e => e.outcome === 'be')
    const totalPnl = withPnl.reduce((s, e) => s + (e.pnlUSD || 0), 0)
    const winRate  = wins.length / Math.max(wins.length + losses.length, 1)
    const avgRR    = executed
      .filter(e => e.rr)
      .reduce((s, e, _, a) => s + parseFloat(e.rr) / a.length, 0)

    // Stats par paire
    const byPair = {}
    for (const e of executed) {
      if (!byPair[e.pair]) byPair[e.pair] = { pair:e.pair, total:0, wins:0, losses:0, pnl:0 }
      byPair[e.pair].total++
      if (e.outcome === 'win')  byPair[e.pair].wins++
      if (e.outcome === 'loss') byPair[e.pair].losses++
      if (e.pnlUSD) byPair[e.pair].pnl += e.pnlUSD
    }

    return {
      total, executed: executed.length,
      wins: wins.length, losses: losses.length, be: be.length,
      winRate: Math.round(winRate * 100), totalPnl: Math.round(totalPnl * 100) / 100,
      avgRR: Math.round(avgRR * 100) / 100,
      byPair: Object.values(byPair).sort((a,b) => b.total - a.total).slice(0, 10),
    }
  }

  exportCSV() {
    const headers = [
      'Date','Paire','Direction','Lots','Entry','SL','TP','R:R',
      'Score','Stratégie','Signal','Outcome','Exit','PnL USD','Fermé le','Notes'
    ]
    const rows = this.entries.map(e => [
      e.executedAt, e.pair, e.action, e.lots,
      e.entryPrice || '', e.sl || '', e.tp || '', e.rr || '',
      e.score || '', e.strategy, e.signal,
      e.outcome || '', e.exitPrice || '', e.pnlUSD !== null ? e.pnlUSD : '',
      e.closedAt || '',
      `"${(e.notes || '').replace(/"/g, '""')}"`,
    ])
    return [headers, ...rows].map(r => r.join(',')).join('\n')
  }
}

module.exports = JournalManager
