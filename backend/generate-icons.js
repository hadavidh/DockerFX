#!/usr/bin/env node
/**
 * generate-icons.js
 * Génère tous les icônes PWA nécessaires depuis un SVG inline.
 * Usage : node generate-icons.js
 * Sortie : frontend/public/icons/icon-*.png
 *
 * Dépendances : npm install sharp --save-dev
 */
 
const fs   = require('fs')
const path = require('path')
 
const SIZES  = [72, 96, 128, 144, 152, 192, 384, 512]
const OUTDIR = path.join(__dirname, 'frontend', 'public', 'icons')
 
// SVG de l'icône — fond bleu sombre, lettres FX blanc
const makeSVG = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1E3A5F;stop-opacity:1"/>
      <stop offset="100%" style="stop-color:#1E40AF;stop-opacity:1"/>
    </linearGradient>
  </defs>
  <!-- Fond arrondi -->
  <rect width="${size}" height="${size}" rx="${size*0.2}" ry="${size*0.2}" fill="url(#bg)"/>
  <!-- Lettres FX -->
  <text
    x="50%" y="56%"
    text-anchor="middle"
    dominant-baseline="middle"
    font-family="Arial, sans-serif"
    font-weight="900"
    font-size="${size * 0.42}px"
    fill="white"
    letter-spacing="-1"
  >FX</text>
  <!-- Point vert (online indicator) -->
  <circle cx="${size*0.78}" cy="${size*0.24}" r="${size*0.08}" fill="#00d97e"/>
</svg>`
 
async function run() {
  try {
    const sharp = require('sharp')
 
    if (!fs.existsSync(OUTDIR)) fs.mkdirSync(OUTDIR, { recursive: true })
 
    for (const size of SIZES) {
      const svgBuffer = Buffer.from(makeSVG(size))
      const outPath   = path.join(OUTDIR, `icon-${size}.png`)
      await sharp(svgBuffer).png().toFile(outPath)
      console.log(`✅ icon-${size}.png`)
    }
 
    // Screenshot placeholder (390×844)
    const screenshotSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844" viewBox="0 0 390 844">
      <rect width="390" height="844" fill="#0F172A"/>
      <text x="195" y="422" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="24" fill="#3b82f6">ICT Trading Dashboard</text>
    </svg>`
    await sharp(Buffer.from(screenshotSVG)).png().toFile(path.join(OUTDIR, 'screenshot-mobile.png'))
    console.log('✅ screenshot-mobile.png')
    console.log('\n🎉 Tous les icônes générés dans', OUTDIR)
 
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      console.error('❌ sharp non installé. Exécutez : cd frontend && npm install sharp --save-dev')
      // Fallback : créer des SVG directement (sans PNG)
      console.log('\n📝 Fallback : génération de SVG à la place...')
      if (!fs.existsSync(OUTDIR)) fs.mkdirSync(OUTDIR, { recursive: true })
      for (const size of SIZES) {
        fs.writeFileSync(path.join(OUTDIR, `icon-${size}.svg`), makeSVG(size))
        console.log(`✅ icon-${size}.svg`)
      }
      // Mettre à jour manifest pour utiliser SVG
      console.log('\n⚠️  Mettez à jour manifest.json pour utiliser .svg à la place de .png')
    } else {
      console.error('❌', e.message)
    }
  }
}
 
run()