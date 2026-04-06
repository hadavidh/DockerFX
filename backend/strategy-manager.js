'use strict'
/**
 * strategy-manager.js
 * Gestion des stratégies + historique 60 jours par stratégie
 */
const fs   = require('fs')
const path = require('path')

const DATA_DIR        = process.env.DATA_DIR || '/app/data'
const STRATEGIES_FILE = path.join(DATA_DIR, 'strategies.json')
const HISTORY_FILE    = path.join(DATA_DIR, 'history.json')
const MAX_HISTORY_DAYS = 60
const MAX_HISTORY_PER_STRAT = 2000

// ── Stratégies par défaut ─────────────────────────────────────────
const DEFAULT_STRATEGIES = [
  {
    id         : 'ICT_AutoBot_v1',
    name       : 'ICT AutoBot v1.0',
    description: 'Triple EMA + RSI + Filtre Obstacles HTF',
    color      : '#f5a623',
    tf         : '4H + 15M',
    pairs      : 28,
    createdAt  : new Date().toISOString(),
    active     : true,
  },
  {
    id         : 'NEXUS_Pro_v1',
    name       : 'NEXUS Pro v2.0',
    description: 'EMA 50/200 (4H) + ADX + SuperTrend (1H) + Session London/NY',
    color      : '#3b82f6',
    tf         : '1H + 4H Hybrid',
    pairs      : 28,
    createdAt  : new Date().toISOString(),
    active     : false,
  },
  {
    id         : 'EMA_RSI_v21',
    name       : 'EMA + RSI v2.1',
    description: 'Triple EMA + RSI + Signaux 15min',
    color      : '#00d97e',
    tf         : '4H + 15M',
    pairs      : 28,
    createdAt  : new Date().toISOString(),
    active     : false,
  },
  {
    id         : 'ICT_Structure_v41',
    name       : 'ICT Structure MTF v4.1',
    description: 'Order Blocks + FVG + BOS + EMA 200 Rejection',
    color      : '#9333ea',
    tf         : '4H',
    pairs      : 28,
    createdAt  : new Date().toISOString(),
    active     : false,
  },
]

class StrategyManager {
  constructor() {
    this._ensureDataDir()
    this.strategies   = this._loadStrategies()
    this.history      = this._loadHistory()
    this.pairStates   = {}
    this._initPairStates()
  }

  // ── Init ──────────────────────────────────────────────────────
  _ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  }

  _initPairStates() {
    const PAIRS = [
      'EURUSD','GBPUSD','USDJPY','USDCHF','AUDUSD','USDCAD','NZDUSD',
      'EURGBP','EURJPY','EURCHF','EURAUD','EURCAD','EURNZD',
      'GBPJPY','GBPCHF','GBPAUD','GBPCAD','GBPNZD',
      'AUDJPY','AUDCHF','AUDCAD','AUDNZD',
      'CADJPY','CADCHF','CHFJPY','NZDJPY','NZDCHF','NZDCAD',
    ]
    for (const strat of this.strategies) {
      if (!this.pairStates[strat.id]) {
        this.pairStates[strat.id] = {}
        PAIRS.forEach(p => {
          this.pairStates[strat.id][p] = { pair:p, htf:null, ltf:null, hasSignal:false }
        })
      }
    }
  }

  // ── Persistance ───────────────────────────────────────────────
  _loadStrategies() {
    try {
      if (fs.existsSync(STRATEGIES_FILE)) {
        const saved = JSON.parse(fs.readFileSync(STRATEGIES_FILE, 'utf8'))
        // ── Merge : ajoute les nouvelles stratégies par défaut si absentes ──
        for (const def of DEFAULT_STRATEGIES) {
          if (!saved.find(s => s.id === def.id)) {
            saved.push(def)
          }
        }
        return saved
      }
    } catch {}
    return DEFAULT_STRATEGIES
  }

  _saveStrategies() {
    try { fs.writeFileSync(STRATEGIES_FILE, JSON.stringify(this.strategies, null, 2)) } catch {}
  }

  _loadHistory() {
    try {
      if (fs.existsSync(HISTORY_FILE))
        return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'))
    } catch {}
    return {}
  }

  _saveHistory() {
    try { fs.writeFileSync(HISTORY_FILE, JSON.stringify(this.history)) } catch {}
  }

  // ── Stratégies CRUD ───────────────────────────────────────────
  getStrategies()     { return this.strategies }
  getStrategy(id)     { return this.strategies.find(s => s.id === id) }
  getActiveStrategy() { return this.strategies.find(s => s.active) || this.strategies[0] }

  createStrategy(data) {
    const id = data.id || data.name.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30) + '_' + Date.now()
    const strat = {
      id,
      name       : data.name        || 'Nouvelle stratégie',
      description: data.description || '',
      color      : data.color       || '#3b82f6',
      tf         : data.tf          || '4H',
      pairs      : 28,
      createdAt  : new Date().toISOString(),
      active     : false,
    }
    if (this.strategies.find(s => s.id === id))
      return { error: 'ID déjà existant' }
    this.strategies.push(strat)
    this._initPairStates()
    this._saveStrategies()
    return strat
  }

  updateStrategy(id, data) {
    const idx = this.strategies.findIndex(s => s.id === id)
    if (idx < 0) return { error: 'Stratégie introuvable' }
    this.strategies[idx] = { ...this.strategies[idx], ...data, id }
    this._saveStrategies()
    return this.strategies[idx]
  }

  deleteStrategy(id) {
    if (this.strategies.length <= 1) return { error: 'Impossible de supprimer la dernière stratégie' }
    const idx = this.strategies.findIndex(s => s.id === id)
    if (idx < 0) return { error: 'Stratégie introuvable' }
    const wasActive = this.strategies[idx].active
    this.strategies.splice(idx, 1)
    if (wasActive && this.strategies.length > 0) this.strategies[0].active = true
    delete this.pairStates[id]
    this._saveStrategies()
    return { ok: true }
  }

  setActiveStrategy(id) {
    const strat = this.strategies.find(s => s.id === id)
    if (!strat) return { error: 'Stratégie introuvable' }
    this.strategies.forEach(s => s.active = false)
    strat.active = true
    this._saveStrategies()
    return strat
  }

  // ── Réinitialiser les paires d'une stratégie ──────────────────
  resetStrategyPairs(stratId) {
    if (!this.pairStates[stratId]) return
    for (const pair of Object.keys(this.pairStates[stratId])) {
      this.pairStates[stratId][pair] = { pair, htf:null, ltf:null, hasSignal:false }
    }
  }

  // ── Réception d'un signal ─────────────────────────────────────
  receiveSignal(data) {
    const stratId = data.strategy || this.getActiveStrategy().id
    const pair    = (data.pair || '').replace(/^[A-Z]+:/, '').toUpperCase().trim()
    if (!pair || !data.action) return null

    // Créer la stratégie à la volée si inconnue
    if (!this.strategies.find(s => s.id === stratId)) {
      this.createStrategy({ id: stratId, name: stratId, color: '#94a3b8' })
    }
    if (!this.pairStates[stratId]) this._initPairStates()
    if (!this.pairStates[stratId][pair]) {
      this.pairStates[stratId][pair] = { pair, htf:null, ltf:null, hasSignal:false }
    }

    // Détecte le type de signal
    const isLtf    = data.signal === 'SIGNAL_TRES_FORT_15M'
    const isNexus  = data.signal === 'NEXUS_TREND_BULL' || data.signal === 'NEXUS_TREND_BEAR'

    const entry = {
      ...data,
      pair,
      action    : data.action.toUpperCase(),
      prob      : parseInt(data.prob, 10) || 0,
      strategy  : stratId,
      receivedAt: new Date().toISOString(),
    }

    // Update pair state
    if (isLtf) {
      // ICT : signal 15M → ltf
      this.pairStates[stratId][pair].ltf      = entry
      this.pairStates[stratId][pair].hasSignal = true
    } else if (isNexus) {
      // NEXUS : signal hybride 1H/4H → htf (pas de ltf séparé)
      this.pairStates[stratId][pair].htf      = entry
      this.pairStates[stratId][pair].ltf      = entry  // affiche aussi dans ltf pour le dashboard
      this.pairStates[stratId][pair].hasSignal = true
    } else {
      // ICT signal 4H → htf
      const prev = this.pairStates[stratId][pair].htf
      if (prev && prev.action !== entry.action)
        this.pairStates[stratId][pair].ltf = null
      this.pairStates[stratId][pair].htf      = entry
      this.pairStates[stratId][pair].hasSignal = true
    }

    // Ajouter à l'historique
    if (!this.history[stratId]) this.history[stratId] = []
    this.history[stratId].unshift(entry)

    // Purger > 60 jours et > MAX_HISTORY_PER_STRAT
    const cutoff = new Date(Date.now() - MAX_HISTORY_DAYS * 86400000).toISOString()
    this.history[stratId] = this.history[stratId]
      .filter(h => h.receivedAt > cutoff)
      .slice(0, MAX_HISTORY_PER_STRAT)

    if (this.history[stratId].length % 10 === 0) this._saveHistory()

    return { entry, stratId, isLtf }
  }

  // ── Stats par stratégie ───────────────────────────────────────
  getStats(stratId) {
    const hist  = this.history[stratId] || []
    const now   = Date.now()
    const day7  = new Date(now - 7  * 86400000).toISOString()
    const day30 = new Date(now - 30 * 86400000).toISOString()
    const day60 = new Date(now - 60 * 86400000).toISOString()

    const last7  = hist.filter(h => h.receivedAt > day7)
    const last30 = hist.filter(h => h.receivedAt > day30)
    const last60 = hist.filter(h => h.receivedAt > day60)

    const pairs  = this.pairStates[stratId] || {}
    const active = Object.values(pairs).filter(p => p.hasSignal).length

    const byPair = {}
    for (const h of last60) {
      if (!byPair[h.pair]) byPair[h.pair] = { pair:h.pair, total:0, buy:0, sell:0, excellent:0 }
      byPair[h.pair].total++
      if (h.action === 'BUY')  byPair[h.pair].buy++
      if (h.action === 'SELL') byPair[h.pair].sell++
      if (h.quality === 'EXCELLENT'
       || h.signal  === 'SIGNAL_TRES_FORT_15M'
       || h.signal  === 'NEXUS_TREND_BULL'
       || h.signal  === 'NEXUS_TREND_BEAR') {
        byPair[h.pair].excellent++
      }
    }

    return {
      stratId,
      active_pairs : active,
      signals_7d   : last7.length,
      signals_30d  : last30.length,
      signals_60d  : last60.length,
      buy_7d       : last7.filter(h => h.action === 'BUY').length,
      sell_7d      : last7.filter(h => h.action === 'SELL').length,
      excellent_7d : last7.filter(h =>
        h.quality === 'EXCELLENT' ||
        h.signal  === 'SIGNAL_TRES_FORT_15M' ||
        h.signal  === 'NEXUS_TREND_BULL' ||
        h.signal  === 'NEXUS_TREND_BEAR'
      ).length,
      top_pairs    : Object.values(byPair).sort((a,b) => b.total - a.total).slice(0, 5),
    }
  }

  // ── Getters ───────────────────────────────────────────────────
  getPairStates(stratId) {
    return this.pairStates[stratId] || {}
  }

  getHistory(stratId, limit = 100) {
    return (this.history[stratId] || []).slice(0, limit)
  }

  getAllHistory(limit = 200) {
    const all = []
    for (const strat of this.strategies) {
      const h = (this.history[strat.id] || []).slice(0, 50)
      all.push(...h)
    }
    return all.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)).slice(0, limit)
  }
}

module.exports = StrategyManager