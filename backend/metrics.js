'use strict'

/**
 * metrics.js — Métriques Prometheus pour ICT Trading Dashboard
 *
 * Expose 10 métriques sur GET /metrics :
 *   — 5 métriques Node.js runtime (automatiques via prom-client)
 *   — 5 métriques métier custom (webhooks, ordres, latence, WS, cTrader)
 *
 * Utilisation dans server.js :
 *   const metrics = require('./metrics')
 */

const client = require('prom-client')

// ── Registry dédié (évite les conflits si les tests rechargent le module) ──
const register = new client.Registry()

// ── Métriques Node.js runtime (gratuites — CPU event loop, GC, heap…) ──────
client.collectDefaultMetrics({
  register,
  prefix: 'nodejs_',
  labels: { app: 'ict-trading-backend' },
})

// ════════════════════════════════════════════════════════════════
// MÉTRIQUE 1 — Webhooks reçus (Counter)
//
// Pourquoi un Counter ?
//   Un counter ne fait qu'augmenter. Prometheus calcule ensuite
//   le taux avec rate() : rate(trading_webhooks_total[5m])
//   = nombre de webhooks par seconde sur les 5 dernières minutes.
//
// Labels :
//   strategy → quelle stratégie a envoyé le signal (NEXUS_Pro_v1, ICT_AutoBot_v1…)
//   action   → BUY ou SELL
// ════════════════════════════════════════════════════════════════
const webhooksTotal = new client.Counter({
  name   : 'trading_webhooks_total',
  help   : 'Nombre total de webhooks TradingView reçus',
  labelNames: ['strategy', 'action'],
  registers : [register],
})

// ════════════════════════════════════════════════════════════════
// MÉTRIQUE 2 — Ordres exécutés (Counter)
//
// Pourquoi ?
//   Distingue les ordres réels (cTrader) des simulations.
//   En production, simulated=false doit dominer.
//   Si simulated=true monte → cTrader est déconnecté.
//
// Labels :
//   strategy  → stratégie source
//   simulated → "true" si cTrader non connecté (mode simulation)
// ════════════════════════════════════════════════════════════════
const ordersPlacedTotal = new client.Counter({
  name   : 'trading_orders_placed_total',
  help   : 'Nombre total d\'ordres exécutés (réels + simulés)',
  labelNames: ['strategy', 'simulated'],
  registers : [register],
})

// ════════════════════════════════════════════════════════════════
// MÉTRIQUE 3 — Ordres bloqués (Counter)
//
// Pourquoi ?
//   Un ordre peut être bloqué par 3 raisons :
//     - max_trades : trop de positions ouvertes
//     - correlation : exposition devise trop élevée
//     - automode    : AutoMode global ou stratégie désactivé
//   Si le ratio bloqués/reçus est trop élevé → les filtres sont
//   peut-être trop restrictifs.
//
// Labels :
//   reason → max_trades | correlation | automode
// ════════════════════════════════════════════════════════════════
const ordersBlockedTotal = new client.Counter({
  name   : 'trading_orders_blocked_total',
  help   : 'Nombre total d\'ordres bloqués par les filtres',
  labelNames: ['reason'],
  registers : [register],
})

// ════════════════════════════════════════════════════════════════
// MÉTRIQUE 4 — Latence webhook (Histogram)
//
// Pourquoi un Histogram et pas un Gauge ?
//   Un Gauge donne la DERNIÈRE valeur. Un Histogram permet de
//   calculer des percentiles : p50 (médiane), p95, p99.
//   Le p95 est crucial : "95% des webhooks répondent en moins de Xms"
//   TradingView timeout à 5s → si p95 > 3s, on perd des signaux.
//
// Buckets (en secondes) :
//   0.05s, 0.1s, 0.25s, 0.5s, 1s, 2s, 5s
//   → couvrent de "très rapide" à "timeout TradingView"
// ════════════════════════════════════════════════════════════════
const webhookDuration = new client.Histogram({
  name   : 'trading_webhook_duration_seconds',
  help   : 'Durée de traitement des webhooks en secondes',
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers : [register],
})

// ════════════════════════════════════════════════════════════════
// MÉTRIQUE 5 — Connexions WebSocket actives (Gauge)
//
// Pourquoi un Gauge ?
//   Une connexion peut augmenter ET diminuer (ouvrir/fermer onglet).
//   Un Gauge représente une valeur instantanée qui monte et descend.
//
// Pour la démo : si tu ouvres 2 onglets du dashboard, cette
// métrique passe à 2. Tu peux le montrer en live !
// ════════════════════════════════════════════════════════════════
const wsConnectionsActive = new client.Gauge({
  name   : 'trading_websocket_connections_active',
  help   : 'Nombre de connexions WebSocket dashboard actives',
  registers : [register],
})

// ════════════════════════════════════════════════════════════════
// MÉTRIQUE 6 — Statut connexion cTrader (Gauge)
//
// Pourquoi ?
//   La connexion TCP vers FTMO peut tomber silencieusement
//   (refresh token expiré, réseau instable).
//   1 = connecté et prêt à trader
//   0 = déconnecté → tous les ordres vont en simulation
//
//   C'est l'alerte la plus critique pour un bot de trading.
// ════════════════════════════════════════════════════════════════
const ctraderConnected = new client.Gauge({
  name   : 'trading_ctrader_connected',
  help   : 'Statut connexion cTrader : 1=connecté, 0=déconnecté',
  registers : [register],
})

// ════════════════════════════════════════════════════════════════
// MÉTRIQUE 7 — Erreurs cTrader (Counter)
//
// Pourquoi ?
//   Compte les erreurs protobuf (dont "Message missing required
//   fields: volume" du bug v1.4.3). Si ce counter monte,
//   quelque chose cloche dans les ordres.
//
// Labels :
//   type → volume_error | connection_error | order_error
// ════════════════════════════════════════════════════════════════
const ctraderErrorsTotal = new client.Counter({
  name   : 'trading_ctrader_errors_total',
  help   : 'Nombre total d\'erreurs cTrader',
  labelNames: ['type'],
  registers : [register],
})

// ════════════════════════════════════════════════════════════════
// EXPORTS — fonctions appelées depuis server.js
// ════════════════════════════════════════════════════════════════

module.exports = {
  register,

  // Appelé dans POST /webhook — au début du traitement
  recordWebhook(strategy, action) {
    webhooksTotal.inc({ strategy: strategy || 'unknown', action: action || 'unknown' })
  },

  // Démarre le timer latence — retourne une fonction stop()
  // Usage : const stop = metrics.startWebhookTimer()
  //         ... traitement ...
  //         stop()
  startWebhookTimer() {
    return webhookDuration.startTimer()
  },

  // Appelé dans placeAutoOrder() quand l'ordre est exécuté
  recordOrderPlaced(strategy, simulated = false) {
    ordersPlacedTotal.inc({
      strategy : strategy || 'unknown',
      simulated: String(simulated),
    })
  },

  // Appelé dans placeAutoOrder() quand l'ordre est bloqué
  recordOrderBlocked(reason) {
    ordersBlockedTotal.inc({ reason: reason || 'unknown' })
  },

  // Appelé dans wss.on('connection') et ws.on('close')
  setWsConnections(count) {
    wsConnectionsActive.set(count)
  },

  // Appelé après chaque tentative de connexion cTrader
  setCtraderStatus(isConnected) {
    ctraderConnected.set(isConnected ? 1 : 0)
  },

  // Appelé dans le catch de placeOrder()
  recordCtraderError(type = 'order_error') {
    ctraderErrorsTotal.inc({ type })
  },
}