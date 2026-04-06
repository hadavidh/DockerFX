import { useState, useEffect, useRef, useCallback } from 'react'
import PairTile from './components/PairTile'
import Login from './components/Login'
import StrategyManager from './components/StrategyManager'
import './App.css'

const PAIRS = [
  'EURUSD','GBPUSD','USDJPY','USDCHF','AUDUSD','USDCAD','NZDUSD',
  'EURGBP','EURJPY','EURCHF','EURAUD','EURCAD','EURNZD',
  'GBPJPY','GBPCHF','GBPAUD','GBPCAD','GBPNZD',
  'AUDJPY','AUDCHF','AUDCAD','AUDNZD',
  'CADJPY','CADCHF','CHFJPY','NZDJPY','NZDCHF','NZDCAD',
]

function empty(pair) { return { pair, htf:null, ltf:null, hasSignal:false } }

function AutoModePanel({ token, autoMode, setAutoMode }) {
  const [balance, setBalance] = useState(null)
  const [loading, setLoading] = useState(false)
  const hdr = { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }

  const fetchBalance = () => {
    fetch('/api/balance', { headers: hdr })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setBalance(d))
      .catch(() => {})
  }

  useEffect(() => {
    fetchBalance()
    const t = setInterval(fetchBalance, 30000)
    return () => clearInterval(t)
  }, [])

  const toggle = async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/automode', {
        method : 'POST',
        headers: hdr,
        body   : JSON.stringify({ enabled: !autoMode }),
      })
      const data = await res.json()
      setAutoMode(data.autoMode)
    } catch {}
    setLoading(false)
  }

  return (
    <div style={{ display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap' }}>
      {balance?.balance != null && (
        <div style={{
          display:'flex', alignItems:'center', gap:'6px',
          padding:'4px 10px', borderRadius:6,
          background:'rgba(255,255,255,.05)',
          border:'1px solid rgba(255,255,255,.1)',
          fontSize:11, color:'#94a3b8', fontFamily:'var(--mono)',
        }}>
          <span style={{color:'#f5a623'}}>💰</span>
          <span style={{color:'#e2e8f0',fontWeight:600}}>
            ${balance.balance.toLocaleString('fr-FR',{maximumFractionDigits:0})}
          </span>
          <span style={{color:'#334155'}}>|</span>
          <span>Risque <span style={{color:'#f5a623'}}>{balance.riskPercent}%</span></span>
          <span style={{color:'#334155'}}>=</span>
          <span style={{color:'#00d97e',fontWeight:600}}>${balance.riskUSD}</span>
        </div>
      )}
      <button onClick={toggle} disabled={loading}
        title={autoMode ? 'Désactiver les ordres auto' : 'Activer les ordres auto'}
        style={{
          display:'flex', alignItems:'center', gap:'6px',
          padding:'5px 14px', borderRadius:6,
          border:`1.5px solid ${autoMode?'#00d97e':'#ff4560'}`,
          background:autoMode?'rgba(0,217,126,.12)':'rgba(255,69,96,.12)',
          color:autoMode?'#00d97e':'#ff4560',
          cursor:loading?'wait':'pointer',
          fontWeight:700, fontSize:12, fontFamily:'var(--sans)',
          letterSpacing:'.3px', transition:'all .2s',
          opacity:loading?.6:1, whiteSpace:'nowrap',
        }}>
        <span style={{fontSize:14}}>🤖</span>
        AutoBot
        <span style={{
          padding:'1px 6px', borderRadius:4,
          background:autoMode?'rgba(0,217,126,.25)':'rgba(255,69,96,.25)',
          fontSize:10, fontWeight:800, letterSpacing:'.5px',
        }}>
          {autoMode ? '● ON' : '● OFF'}
        </span>
      </button>
    </div>
  )
}

function Dashboard({ token, onLogout }) {
  const [states,      setStates]      = useState(() => { const s={}; PAIRS.forEach(p=>{s[p]=empty(p)}); return s })
  const [history,     setHistory]     = useState([])
  const [strategies,  setStrategies]  = useState([])
  const [activeStrat, setActiveStrat] = useState(null)
  const [wsStatus,    setWs]          = useState('connecting')
  const [ctrader,     setCtrader]     = useState(null)
  const [filter,      setFilter]      = useState('ALL')
  const [autoMode,    setAutoMode]    = useState(true)
  const wsRef = useRef(null)
  const hdr   = { 'Authorization': 'Bearer ' + token }

  useEffect(() => {
    fetch('/api/automode', { headers: hdr })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setAutoMode(d.autoMode))
      .catch(() => {})
  }, [])

  const loadStrategies = useCallback(async () => {
    try {
      const r = await fetch('/api/strategies', { headers:hdr })
      if (r.status === 401) { onLogout(); return }
      const strats = await r.json()
      setStrategies(strats)
      const active = strats.find(s=>s.active) || strats[0]
      if (active) setActiveStrat(active.id)
      return active
    } catch {}
  }, [token])

  const loadPairs = useCallback(async (stratId) => {
    if (!stratId) return
    try {
      const r = await fetch(`/api/states?strategy=${stratId}`, { headers:hdr })
      if (r.ok) setStates(await r.json())
    } catch {}
  }, [token])

  const loadHistory = useCallback(async (stratId) => {
    if (!stratId) return
    try {
      const r = await fetch(`/api/history?strategy=${stratId}&limit=50`, { headers:hdr })
      if (r.ok) setHistory(await r.json())
    } catch {}
  }, [token])

  const switchStrategy = useCallback(async (stratId) => {
    setActiveStrat(stratId)
    const s={}; PAIRS.forEach(p=>{s[p]=empty(p)}); setStates(s)
    setHistory([])
    setFilter('ALL')
    await loadPairs(stratId)
    await loadHistory(stratId)
  }, [loadPairs, loadHistory])

  const connectWS = useCallback(() => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${proto}://${window.location.host}/ws?token=${encodeURIComponent(token)}`)
    wsRef.current = ws
    ws.onopen  = () => setWs('connected')
    ws.onclose = () => { setWs('disconnected'); setTimeout(connectWS, 4000) }
    ws.onerror = () => setWs('error')
    ws.onmessage = e => {
      try {
        const m = JSON.parse(e.data)
        if (m.type === 'init') {
          setStates(m.states || {})
          setHistory(m.history || [])
          if (m.strategies)  setStrategies(m.strategies)
          if (m.activeStrat) setActiveStrat(m.activeStrat.id)
          if (typeof m.autoMode === 'boolean') setAutoMode(m.autoMode)
        }
        if (m.type === 'signal' && m.stratId) {
          setActiveStrat(prev => {
            if (m.stratId === prev) setStates(p => ({ ...p, [m.state.pair]: m.state }))
            return prev
          })
        }
        if (m.type === 'strategy_changed') {
          setStrategies(m.strategies || [])
          const newActive = m.strategies?.find(s=>s.active)
          if (newActive) switchStrategy(newActive.id)
        }
        if (m.type === 'new_signal') {
          setHistory(prev => [m.entry, ...prev].slice(0, 50))
        }
        if (m.type === 'pairs_reset') {
          setActiveStrat(prev => {
            if (m.stratId === prev) { const s={}; PAIRS.forEach(p=>{s[p]=empty(p)}); setStates(s) }
            return prev
          })
        }
        if (m.type === 'automode_changed') setAutoMode(m.autoMode)
      } catch {}
    }
  }, [token, switchStrategy])

  useEffect(() => {
    const init = async () => {
      const active = await loadStrategies()
      if (active) { await loadPairs(active.id); await loadHistory(active.id) }
      connectWS()
    }
    init()
    const poll = setInterval(() =>
      fetch('/api/ctrader', { headers:hdr })
        .then(r => r.status === 401 ? onLogout() : r.json())
        .then(d => d && setCtrader(d))
        .catch(() => {})
    , 6000)
    return () => { wsRef.current?.close(); clearInterval(poll) }
  }, [])

  const all       = Object.values(states)
  const getAction = s => s.ltf?.action || s.htf?.action || s.htf?.direction || s.direction
  const buyCount  = all.filter(s => getAction(s) === 'BUY').length
  const sellCount = all.filter(s => getAction(s) === 'SELL').length
  const ltfCount  = all.filter(s => s.ltf).length
  const totalSig  = all.filter(s => s.hasSignal || (s.direction && s.direction !== 'NEUTRAL')).length

  const sorted = PAIRS.map(p => states[p] || empty(p))
    .filter(s => {
      const a = getAction(s)
      if (filter === 'BUY')    return a === 'BUY'
      if (filter === 'SELL')   return a === 'SELL'
      if (filter === 'SIGNAL') return s.hasSignal || (s.direction && s.direction !== 'NEUTRAL')
      if (filter === 'LTF')    return !!s.ltf
      return true
    })
    .sort((a, b) => {
      if (a.ltf && !b.ltf) return -1
      if (!a.ltf && b.ltf) return 1
      const pa = Math.max(a.htf?.prob || a.prob || 0, a.ltf?.prob || 0)
      const pb = Math.max(b.htf?.prob || b.prob || 0, b.ltf?.prob || 0)
      return pb - pa
    })

  const activeColor = strategies.find(s => s.id === activeStrat)?.color || '#3b82f6'
  const wsColor = { connected:'#00d97e', disconnected:'#ff4560', connecting:'#f5a623', error:'#ff4560' }[wsStatus] || '#64748b'
  const ctColor = ctrader?.ready ? '#00d97e' : ctrader?.simMode ? '#f5a623' : '#ff4560'
  const ctLabel = ctrader?.ready
    ? `cTrader ${ctrader.mode === 'demo' ? 'Demo' : 'Live'}`
    : ctrader?.simMode ? 'Simulation' : 'cTrader ✗'

  const hBadge = h => {
    if (h.signal === 'SIGNAL_TRES_FORT_15M') return { cls:'ltf', txt:'⚡ ' + (h.entry_type || '15M') }
    if (h.signal === 'EMA200_REJECTION')     return { cls:'ema', txt:'EMA200' }
    if (h.quality === 'EXCELLENT')           return { cls:'exc', txt:'EXCELLENT' }
    if (h.quality === 'BON')                 return { cls:'bon', txt:'BON' }
    return { cls:'def', txt: h.quality || '—' }
  }

  return (
    <div className="app">

      {/* HEADER */}
      <div className="hdr">
        <div className="hdr-brand">
          <div className="hdr-logo" style={{ background:`linear-gradient(135deg,${activeColor}88,${activeColor})` }}>FX</div>
          <div>
            <div className="hdr-title">ICT Trading Dashboard</div>
            <div className="hdr-sub">FTMO · cTrader Open API · 28 paires Forex</div>
          </div>
        </div>
        <div className="hdr-right">
          <AutoModePanel token={token} autoMode={autoMode} setAutoMode={setAutoMode} />
          <div className="badge" style={{ borderColor:wsColor, color:wsColor }}>
            <div className="dot" style={{ background:wsColor }}/>{wsStatus}
          </div>
          <div className="badge" style={{ borderColor:ctColor, color:ctColor }}>
            <div className="dot" style={{ background:ctColor }}/>{ctLabel}
          </div>
          <button onClick={onLogout} style={{
            padding:'4px 12px', borderRadius:6,
            background:'rgba(255,69,96,.1)',
            border:'1px solid rgba(255,69,96,.3)',
            color:'#ff4560', fontSize:11, cursor:'pointer', fontFamily:'var(--sans)',
          }}>Déconnexion</button>
        </div>
      </div>

      {/* BANNER AutoMode OFF */}
      {!autoMode && (
        <div style={{
          background:'rgba(255,69,96,.08)', border:'1px solid rgba(255,69,96,.25)',
          borderRadius:8, padding:'10px 18px', marginBottom:12,
          color:'#ff4560', fontSize:13, fontWeight:600,
          display:'flex', alignItems:'center', gap:10,
        }}>
          🔴 AutoBot désactivé — les signaux sont reçus mais aucun ordre ne sera envoyé à cTrader
        </div>
      )}

      {/* STRATEGY MANAGER */}
      {strategies.length > 0 && (
        <StrategyManager
          strategies={strategies}
          activeStratId={activeStrat}
          token={token}
          onActivate={switchStrategy}
          onUpdate={async () => {
            await loadStrategies()
            if (activeStrat) { await loadPairs(activeStrat); await loadHistory(activeStrat) }
          }}
        />
      )}

      {/* STATS */}
      <div className="stats">
        {[
          { val:buyCount,  lbl:'BUY actifs',      color:'#00d97e', bc:'rgba(0,217,126,.15)' },
          { val:sellCount, lbl:'SELL actifs',      color:'#ff4560', bc:'rgba(255,69,96,.15)' },
          { val:ltfCount,  lbl:'⚡ Très fort 15M', color:'#f5a623', bc:'rgba(245,166,35,.15)' },
          { val:totalSig,  lbl:'Total signaux',    color:'#94a3b8', bc:'rgba(255,255,255,.06)' },
        ].map(s => (
          <div key={s.lbl} className="stat-card" style={{ borderColor:s.bc }}>
            <span className="stat-val" style={{ color:s.color }}>{s.val}</span>
            <span className="stat-lbl">{s.lbl}</span>
          </div>
        ))}
      </div>

      {/* FILTRES */}
      <div className="filters">
        {[
          { k:'ALL',    l:'Toutes' },
          { k:'SIGNAL', l:'Signaux actifs' },
          { k:'LTF',    l:'⚡ Très fort 15M' },
          { k:'BUY',    l:'▲ BUY' },
          { k:'SELL',   l:'▼ SELL' },
        ].map(f => (
          <button key={f.k} className={`filter-btn ${filter === f.k ? 'active' : ''}`}
            onClick={() => setFilter(f.k)}>{f.l}</button>
        ))}
        <button className="filter-btn test-btn"
          onClick={() => fetch(`/api/test?strategy=${activeStrat}`, { headers:hdr }).then(() => loadPairs(activeStrat))}>
          ◎ Tester signaux
        </button>
      </div>

      {/* GRID */}
      <div className="section-title" style={{ color:activeColor }}>
        {strategies.find(s => s.id === activeStrat)?.name || 'Paires'} — {sorted.filter(s => s.hasSignal).length} signaux actifs
      </div>
      <div className="grid">
        {sorted.map(s => <PairTile key={s.pair} state={s} />)}
      </div>

      {/* HISTORIQUE */}
      {history.length > 0 && (
        <div className="history-wrap">
          <div className="history-head" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span>Historique des signaux</span>
            <span style={{ fontSize:10, color:'#475569', fontFamily:'var(--mono)' }}>
              {strategies.find(s => s.id === activeStrat)?.name} · 60 jours
            </span>
          </div>
          <table className="htable">
            <thead>
              <tr>
                <th>Paire</th><th>Action</th><th>TF</th><th>Entry</th>
                <th>SL</th><th>TP réel</th><th>Prob</th><th>R:R</th>
                <th>Score</th><th>Auto</th><th>Type</th><th>Heure</th>
              </tr>
            </thead>
            <tbody>
              {history.slice(0, 20).map((h, i) => {
                const b = hBadge(h)
                return (
                  <tr key={i}>
                    <td style={{ fontWeight:600, color:'#e2e8f0' }}>{h.pair}</td>
                    <td className={h.action === 'BUY' ? 'h-buy' : 'h-sell'}>{h.action}</td>
                    <td style={{ color:'#64748b' }}>{h.tf}M</td>
                    <td style={{ fontFamily:'var(--mono)', fontSize:11 }}>{h.price}</td>
                    <td style={{ color:'#ff4560', fontFamily:'var(--mono)', fontSize:11 }}>{h.sl}</td>
                    <td style={{ color:'#00d97e', fontFamily:'var(--mono)', fontSize:11 }}>{h.tp_reel || h.tp}</td>
                    <td>{h.prob}%</td>
                    <td style={{ color:'#f5a623' }}>{h.rr_reel ? `1:${h.rr_reel}` : '—'}</td>
                    <td>
                      {h.score ? (
                        <span style={{
                          color: h.score>=80?'#00d97e':h.score>=60?'#f5a623':'#ff4560',
                          fontFamily:'var(--mono)', fontWeight:600,
                        }}>{h.score}/100</span>
                      ) : '—'}
                    </td>
                    <td>
                      {h.auto_ok === true
                        ? <span style={{ color:'#00d97e', fontSize:11, fontWeight:700 }}>✅ AUTO</span>
                        : h.auto_ok === false
                        ? <span style={{ color:'#ff4560', fontSize:11 }}>⛔ BLOQUÉ</span>
                        : '—'}
                    </td>
                    <td><span className={`h-badge ${b.cls}`}>{b.txt}</span></td>
                    <td style={{ color:'#64748b' }}>
                      {h.receivedAt ? new Date(h.receivedAt).toLocaleTimeString('fr-FR') : ''}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('ict_token') || null)
  const logout = () => { localStorage.removeItem('ict_token'); setToken(null) }
  if (!token) return <Login onAuth={setToken} />
  return <Dashboard token={token} onLogout={logout} />
}
