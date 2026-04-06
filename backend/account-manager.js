'use strict'
const fs   = require('fs')
const path = require('path')

const DATA_DIR     = process.env.DATA_DIR || '/app/data'
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json')

// ── Compte par défaut depuis .env ─────────────────────────────────
const DEFAULT_ACCOUNTS = [
  {
    id       : 'default',
    name     : process.env.CTRADER_ACCOUNT_NAME || 'FTMO Challenge',
    host     : process.env.CTRADER_HOST         || 'demo.ctraderapi.com',
    accountId: process.env.CTRADER_ACCOUNT_ID   || '',
    clientId : process.env.CTRADER_CLIENT_ID    || '',
    secret   : process.env.CTRADER_CLIENT_SECRET|| '',
    token    : process.env.CTRADER_ACCESS_TOKEN || '',
    refresh  : process.env.CTRADER_REFRESH_TOKEN|| '',
    type     : 'demo',   // 'demo' | 'live'
    label    : 'Challenge',
    color    : '#3b82f6',
    active   : true,
  }
]

class AccountManager {
  constructor() {
    this._ensureDir()
    this.accounts = this._load()
  }

  _ensureDir() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  }

  _load() {
    try {
      if (fs.existsSync(ACCOUNTS_FILE)) {
        const saved = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8'))
        // Merge : ajoute le compte default si absent
        if (!saved.find(a => a.id === 'default') && DEFAULT_ACCOUNTS[0].accountId) {
          saved.unshift(DEFAULT_ACCOUNTS[0])
        }
        return saved
      }
    } catch {}
    return DEFAULT_ACCOUNTS[0].accountId ? DEFAULT_ACCOUNTS : []
  }

  _save() {
    try { fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(this.accounts, null, 2)) } catch {}
  }

  getAll()        { return this.accounts.map(a => this._sanitize(a)) }
  getActive()     { return this.accounts.find(a => a.active) || this.accounts[0] }
  getById(id)     { return this.accounts.find(a => a.id === id) }
  getRaw(id)      { return this.accounts.find(a => a.id === id) }   // avec credentials

  _sanitize(a) {
    // Ne pas exposer les credentials via l'API
    const { token, refresh, secret, ...safe } = a
    return { ...safe, hasToken: !!token, hasRefresh: !!refresh }
  }

  add(data) {
    const id = 'acc_' + Date.now()
    const account = {
      id,
      name     : data.name      || 'Nouveau compte',
      host     : data.host      || 'demo.ctraderapi.com',
      accountId: data.accountId || '',
      clientId : data.clientId  || '',
      secret   : data.secret    || '',
      token    : data.token     || '',
      refresh  : data.refresh   || '',
      type     : data.type      || 'demo',
      label    : data.label     || 'Demo',
      color    : data.color     || '#64748b',
      active   : false,
    }
    this.accounts.push(account)
    this._save()
    return this._sanitize(account)
  }

  update(id, data) {
    const idx = this.accounts.findIndex(a => a.id === id)
    if (idx < 0) return { error: 'Compte introuvable' }
    // Champs modifiables (on peut mettre à jour les credentials)
    const allowed = ['name','host','accountId','clientId','secret','token','refresh','type','label','color']
    for (const k of allowed) if (data[k] !== undefined) this.accounts[idx][k] = data[k]
    this._save()
    return this._sanitize(this.accounts[idx])
  }

  updateTokens(id, { accessToken, refreshToken, expiresAt }) {
    const acc = this.accounts.find(a => a.id === id)
    if (!acc) return false
    if (accessToken)  acc.token   = accessToken
    if (refreshToken) acc.refresh = refreshToken
    if (expiresAt)    acc.expiresAt = expiresAt
    this._save()
    return true
  }

  remove(id) {
    if (this.accounts.length <= 1) return { error: 'Impossible de supprimer le dernier compte' }
    const idx = this.accounts.findIndex(a => a.id === id)
    if (idx < 0) return { error: 'Compte introuvable' }
    const wasActive = this.accounts[idx].active
    this.accounts.splice(idx, 1)
    if (wasActive && this.accounts.length > 0) this.accounts[0].active = true
    this._save()
    return { ok: true }
  }

  setActive(id) {
    const acc = this.accounts.find(a => a.id === id)
    if (!acc) return { error: 'Compte introuvable' }
    this.accounts.forEach(a => a.active = false)
    acc.active = true
    this._save()
    return this._sanitize(acc)
  }
}

module.exports = AccountManager