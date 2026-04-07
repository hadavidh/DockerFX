#!/usr/bin/env node
/**
 * generate-vapid.js
 * Génère une paire de clés VAPID pour les Web Push Notifications.
 *
 * Usage : node generate-vapid.js
 *
 * Coller les valeurs générées dans .env
 */
 
const webpush = require('web-push')
const keys    = webpush.generateVAPIDKeys()
 
console.log('\n🔑 Clés VAPID générées :\n')
console.log('# ── Copier dans .env ──────────────────────────────────')
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`)
console.log(`VAPID_EMAIL=mailto:hadavidh@gmail.com`)
console.log('')
console.log('# ── Copier dans frontend/.env (ou vite.config.js) ────')
console.log(`VITE_VAPID_PUBLIC_KEY=${keys.publicKey}`)
console.log('\n⚠️  IMPORTANT :')
console.log('  - Ne jamais committer VAPID_PRIVATE_KEY sur Git')
console.log('  - Regénérer les clés = désinscrit tous les abonnés push')
console.log('  - Conserver les clés en lieu sûr\n')