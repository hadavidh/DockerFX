#!/bin/bash
# ════════════════════════════════════════════════════════════════
# apply-volume-fix.sh
# Corrige : "Message missing required fields: volume"
# Usage : bash apply-volume-fix.sh
# ════════════════════════════════════════════════════════════════

FILE="$HOME/dockerFX/backend/server.js"
BACKUP="${FILE}.bak_volume"

echo "💾 Backup → server.js.bak_volume"
cp "$FILE" "$BACKUP"

# ── Patch calcLotsDynamic ─────────────────────────────────────
python3 << 'PYEOF'
content = open('/root/dockerFX/backend/server.js').read()

old = """async function calcLotsDynamic(entry, sl, pair) {
  const ct = getActiveInstance()
  let balance = FALLBACK_BALANCE
  try { if (ct?.isReady) balance = await ct.getAccountBalance() } catch {}
  const riskUSD = balance * (RISK_PERCENT / 100)
  const diff    = Math.abs(parseFloat(entry) - parseFloat(sl))
  if (!diff || isNaN(diff)) return 0.01
  const pipSize = (pair||'').includes('JPY') ? 0.01 : 0.0001
  const lots    = riskUSD / ((diff / pipSize) * (PIP_VALUE[pair] || 10))
  return Math.max(0.01, Math.round(lots * 100) / 100)
}"""

new = """async function calcLotsDynamic(entry, sl, pair) {
  const ct = getActiveInstance()
  let balance = FALLBACK_BALANCE
  try { if (ct?.isReady) balance = await ct.getAccountBalance() } catch (e) {
    log.warn(`[Lots] Erreur balance: ${e.message} → fallback $${FALLBACK_BALANCE}`)
  }
  const entryNum = parseFloat(String(entry).replace(',','.'))
  const slNum    = parseFloat(String(sl).replace(',','.'))
  if (isNaN(entryNum) || isNaN(slNum)) { log.error(`[Lots] entry/sl invalide: "${entry}" / "${sl}"`); return 0.01 }
  const diff = Math.abs(entryNum - slNum)
  if (!diff || diff === 0) { log.error('[Lots] SL = entry → 0.01L'); return 0.01 }
  const isJPY  = (pair||'').toUpperCase().includes('JPY')
  const pipSize = isJPY ? 0.01 : 0.0001
  const pips    = diff / pipSize
  const pipVal  = PIP_VALUE[(pair||'').toUpperCase()] || 10
  const riskUSD = balance * (RISK_PERCENT / 100)
  const lotsRaw = riskUSD / (pips * pipVal)
  const lots    = Math.max(0.01, Math.round(lotsRaw * 100) / 100)
  const volume  = Math.round(lots * 100000)
  log.info(`[Lots] ${pair} balance=$${balance.toFixed(0)} risk=$${riskUSD.toFixed(0)} pips=${pips.toFixed(1)} pipVal=$${pipVal} → ${lots}L (volume=${volume})`)
  if (volume < 1000) { log.warn(`[Lots] Volume ${volume} trop petit → 0.01L`); return 0.01 }
  return lots
}"""

if old in content:
    content = content.replace(old, new)
    open('/root/dockerFX/backend/server.js', 'w').write(content)
    print('✅ calcLotsDynamic patchée')
else:
    print('⚠️  Pattern calcLotsDynamic non trouvé — patch manuel requis')
    print('   Remplacer la fonction calcLotsDynamic dans server.js')
PYEOF

echo ""
echo "✅ Patch appliqué !"
echo ""
echo "🔨 Rebuild :"
echo "   cd ~/dockerFX && docker compose down && docker compose up --build -d"
echo ""
echo "📱 Test : envoyer un signal depuis TradingView et vérifier les logs :"
echo "   docker logs -f forex-backend 2>&1 | grep -E 'Lots|AutoBot|volume'"
