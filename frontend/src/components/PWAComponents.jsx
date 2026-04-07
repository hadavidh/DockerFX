/**
 * PWAComponents.jsx
 * Composants UI pour la PWA :
 *   - InstallBanner     : bannière "Installer l'app"
 *   - UpdateBanner      : bannière "Mise à jour disponible"
 *   - PushSettings      : section dans Paramètres
 *   - MobileBottomNav   : navigation bas d'écran (mode standalone)
 *   - OfflineBanner     : bannière hors-ligne
 */

import { useState, useEffect } from 'react'

// ── Détection mobile ──────────────────────────────────────────────
export const isMobile = () => window.innerWidth < 768
export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true

// ════════════════════════════════════════════════════════════════
// INSTALL BANNER — Barre d'installation en haut
// ════════════════════════════════════════════════════════════════
export function InstallBanner({ pwa }) {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('pwa-install-dismissed') === '1'
  )

  if (!pwa.installable || dismissed || pwa.installed) return null

  const dismiss = () => {
    setDismissed(true)
    localStorage.setItem('pwa-install-dismissed', '1')
  }

  return (
    <div style={{
      background    : 'linear-gradient(135deg, rgba(30,64,175,.95), rgba(30,58,95,.95))',
      border        : '1px solid rgba(59,130,246,.4)',
      borderRadius  : 10,
      padding       : '12px 16px',
      marginBottom  : 12,
      display       : 'flex',
      alignItems    : 'center',
      justifyContent: 'space-between',
      gap           : 12,
      flexWrap      : 'wrap',
      backdropFilter: 'blur(8px)',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <div style={{
          width:44, height:44, borderRadius:10, flexShrink:0,
          background: 'linear-gradient(135deg, #1E3A5F, #1E40AF)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:18, fontWeight:900, color:'white', fontFamily:'Arial',
        }}>FX</div>
        <div>
          <div style={{ color:'#e2e8f0', fontWeight:700, fontSize:14 }}>
            Installer ICT Trading Dashboard
          </div>
          <div style={{ color:'#94a3b8', fontSize:12, marginTop:2 }}>
            Accès rapide depuis votre écran d'accueil · Notifications natives
          </div>
        </div>
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <button onClick={pwa.install} style={{
          padding:'7px 18px', borderRadius:8, fontSize:13, cursor:'pointer',
          fontWeight:700, background:'#1E40AF', border:'none', color:'white',
          whiteSpace:'nowrap',
        }}>
          ⬇️ Installer
        </button>
        <button onClick={dismiss} style={{
          padding:'7px 10px', borderRadius:8, fontSize:13, cursor:'pointer',
          background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.15)',
          color:'#64748b',
        }}>
          ✕
        </button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// iOS INSTALL INSTRUCTIONS (pas de beforeinstallprompt sur Safari)
// ════════════════════════════════════════════════════════════════
export function IOSInstallHint() {
  const [show, setShow]   = useState(false)
  const [hidden, setHidden]= useState(
    () => localStorage.getItem('ios-hint-dismissed') === '1'
  )

  useEffect(() => {
    const isIOS    = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const inSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
    setShow(isIOS && inSafari && !isStandalone() && !hidden)
  }, [hidden])

  if (!show) return null

  return (
    <div style={{
      background:'rgba(30,64,175,.15)', border:'1px solid rgba(59,130,246,.3)',
      borderRadius:10, padding:'14px 16px', marginBottom:12,
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div style={{ color:'#3b82f6', fontWeight:700, fontSize:13, marginBottom:8 }}>
          📱 Installer sur iPhone / iPad
        </div>
        <button onClick={()=>{ setHidden(true); localStorage.setItem('ios-hint-dismissed','1') }}
          style={{ background:'none', border:'none', color:'#64748b', cursor:'pointer', fontSize:16 }}>✕</button>
      </div>
      <div style={{ color:'#94a3b8', fontSize:12, lineHeight:1.6 }}>
        1. Appuyez sur l'icône <strong style={{color:'#e2e8f0'}}>Partager</strong> (⬆️) en bas de Safari<br/>
        2. Sélectionnez <strong style={{color:'#e2e8f0'}}>"Sur l'écran d'accueil"</strong><br/>
        3. Appuyez sur <strong style={{color:'#e2e8f0'}}>Ajouter</strong>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// UPDATE BANNER
// ════════════════════════════════════════════════════════════════
export function UpdateBanner({ pwa }) {
  if (!pwa.updateAvailable) return null
  return (
    <div style={{
      background:'rgba(245,166,35,.12)', border:'1px solid rgba(245,166,35,.35)',
      borderRadius:10, padding:'10px 16px', marginBottom:12,
      display:'flex', alignItems:'center', justifyContent:'space-between', gap:10,
    }}>
      <span style={{ color:'#f5a623', fontSize:13, fontWeight:600 }}>
        🔄 Nouvelle version disponible
      </span>
      <button onClick={pwa.applyUpdate} style={{
        padding:'5px 16px', borderRadius:6, fontSize:12, cursor:'pointer',
        background:'rgba(245,166,35,.2)', border:'1px solid #f5a623', color:'#f5a623', fontWeight:600,
      }}>
        Mettre à jour
      </button>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// OFFLINE BANNER
// ════════════════════════════════════════════════════════════════
export function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const on  = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  if (!offline) return null
  return (
    <div style={{
      background:'rgba(255,69,96,.1)', border:'1px solid rgba(255,69,96,.3)',
      borderRadius:8, padding:'10px 16px', marginBottom:12,
      color:'#ff4560', fontSize:13, fontWeight:600, textAlign:'center',
    }}>
      📡 Hors-ligne — Les signaux ne seront pas reçus · Reconnexion en cours...
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// MOBILE BOTTOM NAV — Navigation fixe en bas (mode standalone)
// ════════════════════════════════════════════════════════════════
export function MobileBottomNav({ activeTab, setTab, signalCount = 0 }) {
  if (!isStandalone()) return null

  const tabs = [
    { id:'dashboard', icon:'📈', label:'Dashboard' },
    { id:'analytics', icon:'📊', label:'Analytics' },
    { id:'backtest',  icon:'🔬', label:'Backtest'  },
    { id:'journal',   icon:'📓', label:'Journal'   },
    { id:'accounts',  icon:'🏦', label:'Comptes'   },
  ]

  return (
    <nav style={{
      position      : 'fixed',
      bottom        : 0,
      left          : 0,
      right         : 0,
      zIndex        : 1000,
      background    : 'rgba(15,23,42,.97)',
      backdropFilter: 'blur(20px)',
      borderTop     : '1px solid rgba(255,255,255,.08)',
      display       : 'flex',
      paddingBottom : 'env(safe-area-inset-bottom, 4px)',
    }}>
      {tabs.map(tab => (
        <button key={tab.id} onClick={() => setTab(tab.id)} style={{
          flex          : 1,
          display       : 'flex',
          flexDirection : 'column',
          alignItems    : 'center',
          justifyContent: 'center',
          gap           : 2,
          padding       : '8px 4px',
          border        : 'none',
          background    : 'transparent',
          cursor        : 'pointer',
          position      : 'relative',
        }}>
          <span style={{ fontSize:20 }}>{tab.icon}</span>
          <span style={{
            fontSize  : 9,
            fontFamily: 'Arial, sans-serif',
            fontWeight: activeTab === tab.id ? 700 : 400,
            color     : activeTab === tab.id ? '#3b82f6' : '#475569',
          }}>{tab.label}</span>
          {tab.id === 'dashboard' && signalCount > 0 && (
            <span style={{
              position  : 'absolute', top:4, right:'20%',
              minWidth  : 16, height:16, borderRadius:8,
              background: '#ff4560', color:'white',
              fontSize  : 9, fontWeight:700,
              display   : 'flex', alignItems:'center', justifyContent:'center',
              padding   : '0 3px',
            }}>{signalCount > 99 ? '99+' : signalCount}</span>
          )}
        </button>
      ))}
    </nav>
  )
}

// ════════════════════════════════════════════════════════════════
// PUSH SETTINGS SECTION (pour la page Paramètres)
// ════════════════════════════════════════════════════════════════
export function PushSettingsSection({ pwa }) {
  const [testing, setTesting] = useState(false)

  const handleTest = async () => {
    setTesting(true)
    pwa.testNotification('🤖 Test AutoBot', 'BUY EURUSD · Score 82/100 · R:R 1:2.1')
    setTimeout(() => setTesting(false), 2000)
  }

  const isSupported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window

  if (!isSupported) {
    return (
      <div style={{ color:'#64748b', fontSize:12, padding:'8px 0' }}>
        ⚠️ Les notifications push ne sont pas supportées sur ce navigateur.
        Utilisez Chrome, Edge ou Firefox pour les activer.
      </div>
    )
  }

  return (
    <div>
      <p style={{ color:'#64748b', fontSize:12, margin:'0 0 14px' }}>
        Recevez des notifications push sur votre appareil pour chaque signal qualifié,
        ordre exécuté et alerte de drawdown — même quand l'app est fermée.
      </p>

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {/* État actuel */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'12px 16px', borderRadius:8,
          background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.08)',
        }}>
          <div>
            <div style={{ color:'#e2e8f0', fontWeight:600, fontSize:13 }}>
              Notifications push
            </div>
            <div style={{ color:'#64748b', fontSize:11, marginTop:2 }}>
              {pwa.pushPermission === 'granted'
                ? pwa.pushSubscribed ? '✅ Actives et enregistrées sur ce serveur' : '⚠️ Permission OK mais pas encore souscrit'
                : pwa.pushPermission === 'denied'
                  ? '❌ Bloquées — Modifier dans les paramètres du navigateur'
                  : '○ Non activées'}
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            {pwa.pushSubscribed ? (
              <button onClick={pwa.unsubscribePush} style={{
                padding:'5px 14px', borderRadius:6, fontSize:12, cursor:'pointer',
                background:'rgba(255,69,96,.1)', border:'1px solid rgba(255,69,96,.3)', color:'#ff4560',
              }}>Désactiver</button>
            ) : (
              <button onClick={pwa.subscribePush}
                disabled={pwa.pushPermission === 'denied'}
                style={{
                  padding:'5px 14px', borderRadius:6, fontSize:12, cursor:'pointer', fontWeight:600,
                  background:pwa.pushPermission==='denied'?'rgba(255,255,255,.05)':'rgba(59,130,246,.2)',
                  border:`1px solid ${pwa.pushPermission==='denied'?'rgba(255,255,255,.1)':'#3b82f6'}`,
                  color:pwa.pushPermission==='denied'?'#475569':'#3b82f6',
                  opacity:pwa.pushPermission==='denied'?0.5:1,
                }}>
                {pwa.pushPermission === 'denied' ? '🔒 Bloqué' : '🔔 Activer'}
              </button>
            )}
            {pwa.pushSubscribed && (
              <button onClick={handleTest} disabled={testing} style={{
                padding:'5px 14px', borderRadius:6, fontSize:12, cursor:'pointer',
                background:'rgba(0,217,126,.1)', border:'1px solid rgba(0,217,126,.3)', color:'#00d97e',
              }}>
                {testing ? '...' : '🧪 Tester'}
              </button>
            )}
          </div>
        </div>

        {/* Types de notifications */}
        {pwa.pushSubscribed && (
          <div style={{ padding:'12px 16px', borderRadius:8, background:'rgba(0,217,126,.05)', border:'1px solid rgba(0,217,126,.15)' }}>
            <div style={{ color:'#00d97e', fontWeight:600, fontSize:12, marginBottom:8 }}>Notifications activées pour :</div>
            {[
              '🤖 Ordres automatiques exécutés',
              '🟢🔴 Signaux qualifiés reçus (Auto OK)',
              '🚨 Alertes drawdown FTMO',
              '🔄 Changements AutoMode (pause/reprise)',
            ].map((item, i) => (
              <div key={i} style={{ color:'#94a3b8', fontSize:11, padding:'2px 0' }}>{item}</div>
            ))}
          </div>
        )}

        {/* Installation PWA */}
        {(pwa.installable || !pwa.installed) && (
          <div style={{ padding:'12px 16px', borderRadius:8, background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.08)' }}>
            <div style={{ color:'#e2e8f0', fontWeight:600, fontSize:13, marginBottom:4 }}>Application installée</div>
            <div style={{ color:'#64748b', fontSize:11, marginBottom:10 }}>
              {pwa.installed
                ? '✅ L\'app est installée sur cet appareil'
                : 'Installez l\'app pour un accès hors-ligne et des notifications améliorées'}
            </div>
            {pwa.installable && (
              <button onClick={pwa.install} style={{
                padding:'6px 16px', borderRadius:6, fontSize:12, cursor:'pointer', fontWeight:600,
                background:'rgba(30,64,175,.25)', border:'1px solid #1E40AF', color:'#3b82f6',
              }}>⬇️ Installer sur cet appareil</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
