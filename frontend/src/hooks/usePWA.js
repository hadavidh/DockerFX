/**
 * usePWA.js — Hook React complet pour la PWA
 * Gère : installation, push notifications, badge, mises à jour SW
 *
 * Usage :
 *   const pwa = usePWA(token)
 *   pwa.installable         → true si l'app peut être installée
 *   pwa.installed           → true si déjà installée
 *   pwa.install()           → déclenche l'invite d'installation
 *   pwa.pushPermission      → 'default' | 'granted' | 'denied'
 *   pwa.subscribePush()     → demande la permission + enregistre
 *   pwa.unsubscribePush()   → désabonne
 *   pwa.setBadge(n)         → badge sur l'icône
 *   pwa.clearBadge()
 *   pwa.updateAvailable     → true si nouvelle version dispo
 *   pwa.applyUpdate()       → applique la mise à jour
 */

import { useState, useEffect, useRef, useCallback } from 'react'

// ── Clé publique VAPID (doit correspondre à VAPID_PUBLIC_KEY dans .env) ──
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || 'BJ_HO3Az4I4NmBIpGHY-uymQyzhauDvLJc7lVtDzRBP4qE3zJ-VcYL_itXlWswOMUnYs_T2Wf5eXQbh-o3LaTNU'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = window.atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

export function usePWA(token) {
  const [installable,     setInstallable]     = useState(false)
  const [installed,       setInstalled]       = useState(false)
  const [pushPermission,  setPushPermission]  = useState(Notification?.permission || 'default')
  const [pushSubscribed,  setPushSubscribed]  = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [swReg,           setSwReg]           = useState(null)

  const deferredPrompt = useRef(null)
  const hdr = { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }

  // ── Détection installation ────────────────────────────────────
  useEffect(() => {
    // Android / Chrome : beforeinstallprompt
    const onPrompt = (e) => {
      e.preventDefault()
      deferredPrompt.current = e
      setInstallable(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)

    // Déjà installé (standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
                      || window.navigator.standalone === true
    setInstalled(isStandalone)
    if (isStandalone) setInstallable(false)

    // Écouter si l'app vient d'être installée
    const onInstalled = () => { setInstalled(true); setInstallable(false); deferredPrompt.current = null }
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  // ── Service Worker ref ────────────────────────────────────────
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.ready.then(reg => {
      setSwReg(reg)
      // Vérifier si déjà abonné aux push
      reg.pushManager.getSubscription().then(sub => {
        setPushSubscribed(!!sub)
      })
    })

    // Mise à jour disponible
    const onUpdate = () => setUpdateAvailable(true)
    window.addEventListener('sw-update-available', onUpdate)

    // Navigation depuis notification
    const onNav = (e) => {
      if (e.detail?.tab) {
        window.dispatchEvent(new CustomEvent('pwa-navigate', { detail: e.detail }))
      }
    }
    window.addEventListener('sw-navigate', onNav)

    // Masquer le loader initial
    window.__hideLoader?.()

    return () => {
      window.removeEventListener('sw-update-available', onUpdate)
      window.removeEventListener('sw-navigate', onNav)
    }
  }, [])

  // ── Installer l'app ───────────────────────────────────────────
  const install = useCallback(async () => {
    if (!deferredPrompt.current) return false
    deferredPrompt.current.prompt()
    const { outcome } = await deferredPrompt.current.userChoice
    deferredPrompt.current = null
    if (outcome === 'accepted') { setInstalled(true); setInstallable(false) }
    return outcome === 'accepted'
  }, [])

  // ── S'abonner aux push notifications ─────────────────────────
  const subscribePush = useCallback(async () => {
    if (!('Notification' in window) || !swReg) return false

    // Demande de permission
    const perm = await Notification.requestPermission()
    setPushPermission(perm)
    if (perm !== 'granted') return false

    try {
      // Créer la subscription Web Push
      const subscription = await swReg.pushManager.subscribe({
        userVisibleOnly     : true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      // Envoyer la subscription au backend
      const res = await fetch('/api/push/subscribe', {
        method : 'POST',
        headers: hdr,
        body   : JSON.stringify(subscription.toJSON()),
      })

      if (res.ok) {
        setPushSubscribed(true)
        console.log('[PWA] Push subscription enregistrée ✅')
        return true
      }
    } catch (e) {
      console.error('[PWA] Push subscribe err:', e)
    }
    return false
  }, [swReg, token])

  // ── Se désabonner ─────────────────────────────────────────────
  const unsubscribePush = useCallback(async () => {
    if (!swReg) return
    const sub = await swReg.pushManager.getSubscription()
    if (sub) {
      await sub.unsubscribe()
      await fetch('/api/push/unsubscribe', { method: 'POST', headers: hdr, body: JSON.stringify({ endpoint: sub.endpoint }) })
      setPushSubscribed(false)
    }
  }, [swReg, token])

  // ── Badge sur l'icône ─────────────────────────────────────────
  const setBadge = useCallback((count) => {
    if (navigator.setAppBadge) {
      navigator.setAppBadge(count).catch(() => {})
    }
    // Via SW pour les navigateurs qui ne supportent pas directement
    swReg?.active?.postMessage({ type: 'SET_BADGE', count })
  }, [swReg])

  const clearBadge = useCallback(() => {
    if (navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {})
    swReg?.active?.postMessage({ type: 'CLEAR_BADGE' })
  }, [swReg])

  // ── Appliquer la mise à jour SW ───────────────────────────────
  const applyUpdate = useCallback(() => {
    if (!swReg?.waiting) return
    swReg.waiting.postMessage({ type: 'SKIP_WAITING' })
    window.location.reload()
  }, [swReg])

  // ── Test push local (sans backend) ───────────────────────────
  const testNotification = useCallback((title, body) => {
    if (Notification.permission !== 'granted') return
    new Notification(title || 'ICT Trading', {
      body : body || 'Notification de test',
      icon : '/icons/icon-192.png',
      badge: '/icons/icon-96.png',
    })
  }, [])

  return {
    installable, installed, install,
    pushPermission, pushSubscribed, subscribePush, unsubscribePush,
    setBadge, clearBadge,
    updateAvailable, applyUpdate,
    testNotification,
    isStandalone: installed,
  }
}
