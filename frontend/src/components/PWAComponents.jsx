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
          width:44, height:44, borderRadius:10, flexShrink:0, overflow:'hidden',
        }}><img src="data:image/png;base64,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" alt="Docker FX" style={{width:'100%',height:'100%',objectFit:'cover'}}/></div>
        <div>
          <div style={{ color:'#e2e8f0', fontWeight:700, fontSize:14 }}>
            Installer Docker FX Dashboard
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
