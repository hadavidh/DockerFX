'use strict'
/**
 * auth.js — Middleware d'authentification JWT
 * Login/Password stockés dans .env
 * Token JWT valide    24h
 */

const crypto = require('crypto')

const LOGIN    = process.env.DASHBOARD_LOGIN   
const PASSWORD = process.env.DASHBOARD_PASSWORD 
const SECRET   = process.env.JWT_SECRET         || crypto.randomBytes(32).toString('hex')

// ── JWT minimal (sans dépendance externe) ────────────────────────
function b64url(str) {
  return Buffer.from(str).toString('base64')
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'')
}

function signJWT(payload) {
  const header  = b64url(JSON.stringify({ alg:'HS256', typ:'JWT' }))
  const body    = b64url(JSON.stringify({ ...payload, iat: Math.floor(Date.now()/1000) }))
  const sig     = crypto.createHmac('sha256', SECRET)
    .update(`${header}.${body}`).digest('base64')
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'')
  return `${header}.${body}.${sig}`
}

function verifyJWT(token) {
  try {
    const [header, body, sig] = token.split('.')
    const expected = crypto.createHmac('sha256', SECRET)
      .update(`${header}.${body}`).digest('base64')
      .replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'')
    if (sig !== expected) return null
    const payload = JSON.parse(Buffer.from(body, 'base64').toString())
    // Expire après 24h
    if (payload.exp && payload.exp < Math.floor(Date.now()/1000)) return null
    return payload
  } catch { return null }
}

// ── Route POST /auth/login ───────────────────────────────────────
function loginRoute(req, res) {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'email et password requis' })
  if (email !== LOGIN || password !== PASSWORD) {
    return res.status(401).json({ error: 'Identifiants incorrects' })
  }
  const exp   = Math.floor(Date.now()/1000) + 86400 // 24h
  const token = signJWT({ email, exp })
  res.json({ ok: true, token, email, expiresIn: 86400 })
}

// ── Middleware de protection ─────────────────────────────────────
function requireAuth(req, res, next) {
  // Whitelist : pas d'auth pour le webhook TradingView
  const pub = ['/webhook', '/health', '/api/auth/login']
  if (pub.some(p => req.path.startsWith(p))) return next()

  // WebSocket upgrade — pas de middleware classique
  if (req.headers.upgrade === 'websocket') return next()

  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Token manquant — connectez-vous' })

  const payload = verifyJWT(token)
  if (!payload) return res.status(401).json({ error: 'Token invalide ou expiré' })

  req.user = payload
  next()
}

module.exports = { loginRoute, requireAuth }