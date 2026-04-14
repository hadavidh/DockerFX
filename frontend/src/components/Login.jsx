import { useState } from 'react'

export default function Login({ onAuth }) {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [showPwd,  setShowPwd]  = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true); setError(null)
    try {
      const res  = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      const data = await res.json()
      if (data.ok && data.token) {
        localStorage.setItem('ict_token', data.token)
        localStorage.setItem('ict_email', data.email)
        onAuth(data.token)
      } else {
        setError(data.error || 'Identifiants incorrects')
      }
    } catch {
      setError('Impossible de contacter le serveur')
    }
    setLoading(false)
  }

  return (
    <div
      data-testid="login-page"
      style={{
        minHeight:'100vh', background:'#080c14',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontFamily:"'Space Grotesk', sans-serif", padding:20,
      }}>
      {/* Ambient glow */}
      <div style={{
        position:'fixed', top:'20%', left:'50%', transform:'translateX(-50%)',
        width:600, height:300, borderRadius:'50%',
        background:'radial-gradient(ellipse, rgba(59,130,246,.06) 0%, transparent 70%)',
        pointerEvents:'none',
      }}/>

      <div
        data-testid="login-card"
        style={{
          width:'100%', maxWidth:400,
          background:'#0d1420', border:'1px solid rgba(255,255,255,.08)',
          borderRadius:16, overflow:'hidden',
          boxShadow:'0 24px 64px rgba(0,0,0,.5)',
        }}>
        {/* Header */}
        <div style={{
          padding:'28px 28px 20px',
          borderBottom:'1px solid rgba(255,255,255,.06)',
          background:'rgba(59,130,246,.04)',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
            <div
              data-testid="login-logo"
              style={{
                width:44, height:44, borderRadius:10,
                background:'linear-gradient(135deg,#1d4ed8,#3b82f6)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:18, fontWeight:700, color:'#fff', letterSpacing:-1,
              }}>FX</div>
            <div>
              <div data-testid="login-title" style={{ fontSize:18, fontWeight:600, color:'#e2e8f0' }}>ICT Dashboard</div>
              <div style={{ fontSize:11, color:'#64748b', marginTop:1 }}>FTMO · cTrader Open API</div>
            </div>
          </div>
          <div style={{ fontSize:13, color:'#475569' }}>
            Accès sécurisé — connectez-vous pour continuer
          </div>
        </div>

        {/* Form */}
        <form
          data-testid="login-form"
          onSubmit={submit}
          style={{ padding:28 }}>

          {/* Email */}
          <div style={{ marginBottom:14 }}>
            <label
              data-testid="login-email-label"
              style={{
                display:'block', fontSize:10, color:'#64748b',
                marginBottom:6, letterSpacing:'.8px', textTransform:'uppercase',
              }}>Email</label>
            <input
              data-testid="login-email-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="votre@email.com"
              required
              style={{
                width:'100%', padding:'11px 12px', borderRadius:8,
                background:'#111827', border:'1px solid rgba(255,255,255,.08)',
                color:'#e2e8f0', fontFamily:"'Space Grotesk',sans-serif", fontSize:14,
                outline:'none', boxSizing:'border-box', transition:'border-color .15s',
              }}
              onFocus={e  => e.target.style.borderColor='rgba(59,130,246,.6)'}
              onBlur={e   => e.target.style.borderColor='rgba(255,255,255,.08)'}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom:20 }}>
            <label
              data-testid="login-password-label"
              style={{
                display:'block', fontSize:10, color:'#64748b',
                marginBottom:6, letterSpacing:'.8px', textTransform:'uppercase',
              }}>Mot de passe</label>
            <div style={{ position:'relative' }}>
              <input
                data-testid="login-password-input"
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••••••••"
                required
                style={{
                  width:'100%', padding:'11px 42px 11px 12px', borderRadius:8,
                  background:'#111827', border:'1px solid rgba(255,255,255,.08)',
                  color:'#e2e8f0', fontFamily:"'JetBrains Mono',monospace", fontSize:14,
                  outline:'none', boxSizing:'border-box', transition:'border-color .15s',
                }}
                onFocus={e  => e.target.style.borderColor='rgba(59,130,246,.6)'}
                onBlur={e   => e.target.style.borderColor='rgba(255,255,255,.08)'}
              />
              <button
                data-testid="login-show-password-btn"
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                style={{
                  position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
                  background:'none', border:'none', color:'#475569',
                  cursor:'pointer', fontSize:16, padding:4,
                }}
              >{showPwd ? '🙈' : '👁'}</button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              data-testid="login-error-msg"
              style={{
                background:'rgba(255,69,96,.08)', border:'1px solid rgba(255,69,96,.2)',
                borderRadius:8, padding:'9px 12px', marginBottom:14,
                fontSize:12, color:'#ff4560', display:'flex', alignItems:'center', gap:6,
              }}>
              ⚠ {error}
            </div>
          )}

          {/* Submit */}
          <button
            data-testid="login-submit-btn"
            type="submit"
            disabled={loading || !email || !password}
            style={{
              width:'100%', padding:12, borderRadius:9,
              background: loading ? 'rgba(59,130,246,.4)' : '#3b82f6',
              border:'none', color:'#fff',
              fontWeight:600, fontSize:14,
              fontFamily:"'Space Grotesk',sans-serif",
              cursor: loading||!email||!password ? 'not-allowed' : 'pointer',
              opacity: !email||!password ? 0.5 : 1,
              transition:'all .15s',
            }}
            onMouseOver={e => { if (!loading && email && password) e.target.style.background='#2563eb' }}
            onMouseOut={e  => { if (!loading) e.target.style.background='#3b82f6' }}
          >
            {loading ? '⏳ Connexion...' : 'Se connecter →'}
          </button>

          {/* Security note */}
          <div
            data-testid="login-security-note"
            style={{
              marginTop:16, textAlign:'center',
              fontSize:10, color:'#334155', letterSpacing:'.3px',
            }}>
            🔒 Session sécurisée · Expire après 24h
          </div>
        </form>
      </div>
    </div>
  )
}
