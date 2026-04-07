/**
 * server-push-patch.js
 * ════════════════════════════════════════════════════════════════
 * Ce fichier montre les ajouts à faire dans server.js
 * pour intégrer le Web Push.
 *
 * Copier-coller les sections dans server.js aux bons endroits.
 * ════════════════════════════════════════════════════════════════
 */

// ── 1. IMPORT (en haut de server.js, avec les autres require) ─────
const PushService = require('./push-service')

// ── 2. INSTANCIATION (après les autres managers) ──────────────────
const PS = new PushService(log.info)

// ── 3. MODIFIER placeAutoOrder — après l'ordre réel ──────────────
// Dans la section "Ordre réel" de placeAutoOrder(), ajouter :
/*
    // Push notification
    await PS.notifyOrderExecuted({
      pair, action, lots, price: r.price,
      score: d.score, positionId: r.positionId,
      account: AM.getActive()?.name,
    })
*/

// ── 4. MODIFIER le webhook — après sendTelegram ───────────────────
// Dans app.post('/webhook', ...) ajouter après les broadcasts :
/*
    // Push si signal qualifié
    if (d.auto_ok === true) {
      await PS.notifySignal({
        pair: entry.pair, action: entry.action,
        score: d.score || 0, rr: d.rr_reel || '?',
        strategy: strat?.name || stratId,
      })
    }
*/

// ── 5. MODIFIER DrawdownMonitor onAlert callback ───────────────────
// Dans la construction du ddMonitor :
/*
    onAlert: async (type, msg, data) => {
      await tgBot.send(msg)
      await PS.notifyDrawdown({ pct: data.dailyDD || data.totalDD, type, message: msg })
      broadcast({ type: 'drawdown_alert', alertType: type, ...data })
      // ...
    },
*/

// ── 6. MODIFIER /api/automode POST ───────────────────────────────
// Dans app.post('/api/automode', ...) ajouter :
/*
    await PS.notifyAutoMode(enabled)
*/

// ── 7. ROUTES WEB PUSH (ajouter dans server.js) ──────────────────

// ═════════════════════════════════════════════
// À insérer dans server.js
// ═════════════════════════════════════════════

// Route : subscribe
// app.post('/api/push/subscribe', (req, res) => {
//   const result = PS.subscribe(req.body)
//   if (result.error) return res.status(400).json(result)
//   res.json(result)
// })

// Route : unsubscribe
// app.post('/api/push/unsubscribe', (req, res) => {
//   PS.unsubscribe(req.body.endpoint)
//   res.json({ ok: true })
// })

// Route : status push
// app.get('/api/push/status', (_, res) => {
//   res.json({ enabled: PS.isEnabled, count: PS.count, publicKey: process.env.VAPID_PUBLIC_KEY || '' })
// })

// Route : test push
// app.post('/api/push/test', async (_, res) => {
//   await PS.send({ title:'🧪 Test Push', body:'Notification de test ICT Dashboard', tag:'test', icon:'/icons/icon-192.png' })
//   res.json({ ok: true, sent: PS.count })
// })


// ════════════════════════════════════════════
// VERSION COMPLÈTE — Coller directement dans server.js
// ════════════════════════════════════════════

module.exports = {
  addPushRoutes(app, PS) {
    app.post('/api/push/subscribe', (req, res) => {
      const result = PS.subscribe(req.body)
      if (result.error) return res.status(400).json(result)
      res.json(result)
    })

    app.post('/api/push/unsubscribe', (req, res) => {
      PS.unsubscribe(req.body?.endpoint || '')
      res.json({ ok: true })
    })

    app.get('/api/push/status', (_, res) => {
      res.json({
        enabled  : PS.isEnabled,
        count    : PS.count,
        publicKey: process.env.VAPID_PUBLIC_KEY || '',
      })
    })

    app.post('/api/push/test', async (_, res) => {
      await PS.send({
        title: '🧪 Test Push ICT Dashboard',
        body : 'Notification fonctionnelle ✅',
        tag  : 'test',
        icon : '/icons/icon-192.png',
        badge: '/icons/icon-96.png',
      })
      res.json({ ok: true, sent: PS.count })
    })
  }
}
