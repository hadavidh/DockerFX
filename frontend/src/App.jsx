import { useState, useEffect, useRef, useCallback } from 'react'
import PairTile from './components/PairTile'
import Login from './components/Login'
import './App.css'

const PAIRS = [
  'EURUSD','GBPUSD','USDJPY','USDCHF','AUDUSD','USDCAD','NZDUSD',
  'EURGBP','EURJPY','EURCHF','EURAUD','EURCAD','EURNZD',
  'GBPJPY','GBPCHF','GBPAUD','GBPCAD','GBPNZD',
  'AUDJPY','AUDCHF','AUDCAD','AUDNZD',
  'CADJPY','CADCHF','CHFJPY','NZDJPY','NZDCHF','NZDCAD',
]

function empty(pair) { return { pair, htf:null, ltf:null, hasSignal:false } }

// ── Composant Dashboard (rendu uniquement si authentifié) ──────────
function Dashboard({ token, onLogout }) {
  const [states,   setStates]  = useState(() => { const s={}; PAIRS.forEach(p=>{s[p]=empty(p)}); return s })
  const [history,  setHistory] = useState([])
  const [wsStatus, setWs]      = useState('connecting')
  const [ctrader,  setCtrader] = useState(null)
  const [filter,   setFilter]  = useState('ALL')
  const wsRef = useRef(null)

  const hdr = { 'Authorization': 'Bearer ' + token }

  const connectWS = useCallback(() => {
    const ws = new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${window.location.host}/ws?token=${encodeURIComponent(token)}`)
    wsRef.current = ws
    ws.onopen  = () => setWs('connected')
    ws.onclose = () => { setWs('disconnected'); setTimeout(connectWS, 4000) }
    ws.onerror = () => setWs('error')
    ws.onmessage = e => {
      try {
        const m = JSON.parse(e.data)
        if (m.type==='init')   { setStates(m.states||{}); setHistory(m.history||[]) }
        if (m.type==='signal') setStates(p=>({...p,[m.state.pair]:m.state}))
      } catch {}
    }
  }, [token])

  useEffect(() => {
    connectWS()
    const poll = setInterval(() =>
      fetch('/api/ctrader',{headers:hdr})
        .then(r=>r.status===401?onLogout():r.json())
        .then(d=>d&&setCtrader(d)).catch(()=>{})
    , 6000)
    fetch('/api/ctrader',{headers:hdr}).then(r=>r.json()).then(setCtrader).catch(()=>{})
    return () => { wsRef.current?.close(); clearInterval(poll) }
  }, [connectWS])

  const getAction = s => s.ltf?.action || s.htf?.action || s.htf?.direction || s.direction
  const all = Object.values(states)
  const buyCount  = all.filter(s=>getAction(s)==='BUY').length
  const sellCount = all.filter(s=>getAction(s)==='SELL').length
  const ltfCount  = all.filter(s=>s.ltf).length
  const totalSig  = all.filter(s=>s.hasSignal||(s.direction&&s.direction!=='NEUTRAL')).length

  const sorted = PAIRS.map(p=>states[p]||empty(p))
    .filter(s=>{
      const a=getAction(s)
      if(filter==='BUY')    return a==='BUY'
      if(filter==='SELL')   return a==='SELL'
      if(filter==='SIGNAL') return s.hasSignal||(s.direction&&s.direction!=='NEUTRAL')
      if(filter==='LTF')    return !!s.ltf
      return true
    })
    .sort((a,b)=>{
      if(a.ltf&&!b.ltf) return -1
      if(!a.ltf&&b.ltf) return 1
      const pa=Math.max(a.htf?.prob||a.prob||0,a.ltf?.prob||0)
      const pb=Math.max(b.htf?.prob||b.prob||0,b.ltf?.prob||0)
      return pb-pa
    })

  const wsColor = {connected:'#00d97e',disconnected:'#ff4560',connecting:'#f5a623',error:'#ff4560'}[wsStatus]||'#64748b'
  const ctColor = ctrader?.ready?'#00d97e':ctrader?.simMode?'#f5a623':'#ff4560'

  const hBadge = h => {
    if(h.signal==='SIGNAL_TRES_FORT_15M') return {cls:'ltf',txt:'⚡ '+(h.entry_type||'15M')}
    if(h.signal==='EMA200_REJECTION')     return {cls:'ema',txt:'EMA200'}
    if(h.quality==='EXCELLENT')           return {cls:'exc',txt:'EXCELLENT'}
    if(h.quality==='BON')                 return {cls:'bon',txt:'BON'}
    return {cls:'def',txt:h.quality||'—'}
  }

  return (
    <div className="app">
      <div className="hdr">
        <div className="hdr-brand">
          <div className="hdr-logo">FX</div>
          <div>
            <div className="hdr-title">ICT Trading Dashboard</div>
            <div className="hdr-sub">FTMO · cTrader Open API · 28 paires Forex</div>
          </div>
        </div>
        <div className="hdr-right">
          <div className="badge" style={{borderColor:wsColor,color:wsColor}}>
            <div className="dot" style={{background:wsColor}}/>{wsStatus}
          </div>
          <div className="badge" style={{borderColor:ctColor,color:ctColor}}>
            <div className="dot" style={{background:ctColor}}/>
            {ctrader?.ready?'cTrader Live':ctrader?.simMode?'Simulation':'cTrader ✗'}
          </div>
          <button onClick={onLogout} style={{
            padding:'4px 12px',borderRadius:6,
            background:'rgba(255,69,96,.1)',border:'1px solid rgba(255,69,96,.3)',
            color:'#ff4560',fontSize:11,cursor:'pointer',fontFamily:'var(--sans)',
          }}>Déconnexion</button>
        </div>
      </div>

      <div className="stats">
        {[
          {val:buyCount, lbl:'BUY actifs',      color:'#00d97e', bc:'rgba(0,217,126,.15)'},
          {val:sellCount,lbl:'SELL actifs',     color:'#ff4560', bc:'rgba(255,69,96,.15)'},
          {val:ltfCount, lbl:'⚡ Très fort 15M',color:'#f5a623', bc:'rgba(245,166,35,.15)'},
          {val:totalSig, lbl:'Total signaux',   color:'#94a3b8', bc:'rgba(255,255,255,.06)'},
        ].map(s=>(
          <div key={s.lbl} className="stat-card" style={{borderColor:s.bc}}>
            <span className="stat-val" style={{color:s.color}}>{s.val}</span>
            <span className="stat-lbl">{s.lbl}</span>
          </div>
        ))}
      </div>

      <div className="filters">
        {[{k:'ALL',l:'Toutes'},{k:'SIGNAL',l:'Signaux actifs'},{k:'LTF',l:'⚡ Très fort 15M'},{k:'BUY',l:'▲ BUY'},{k:'SELL',l:'▼ SELL'}].map(f=>(
          <button key={f.k} className={`filter-btn ${filter===f.k?'active':''}`} onClick={()=>setFilter(f.k)}>{f.l}</button>
        ))}
        <button className="filter-btn test-btn"
          onClick={()=>fetch('/api/test',{headers:hdr}).then(()=>fetch('/api/states',{headers:hdr}).then(r=>r.json()).then(setStates))}>
          ◎ Tester signaux
        </button>
      </div>

      <div className="section-title">Paires Forex</div>
      <div className="grid">
        {sorted.map(s=><PairTile key={s.pair} state={s}/>)}
      </div>

      {history.length>0&&(
        <div className="history-wrap">
          <div className="history-head">Historique des signaux</div>
          <table className="htable">
            <thead><tr><th>Paire</th><th>Action</th><th>TF</th><th>Entry</th><th>SL</th><th>TP</th><th>Prob</th><th>Type</th><th>Heure</th></tr></thead>
            <tbody>
              {history.slice(0,15).map((h,i)=>{
                const b=hBadge(h)
                return (
                  <tr key={i}>
                    <td style={{fontWeight:600,color:'#e2e8f0'}}>{h.pair}</td>
                    <td className={h.action==='BUY'?'h-buy':'h-sell'}>{h.action}</td>
                    <td style={{color:'#64748b'}}>{h.tf}M</td>
                    <td>{h.price}</td>
                    <td style={{color:'#ff4560'}}>{h.sl}</td>
                    <td style={{color:'#00d97e'}}>{h.tp}</td>
                    <td>{h.prob}%</td>
                    <td><span className={`h-badge ${b.cls}`}>{b.txt}</span></td>
                    <td style={{color:'#64748b'}}>{h.receivedAt?new Date(h.receivedAt).toLocaleTimeString('fr-FR'):''}</td>
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

// ── App racine ────────────────────────────────────────────────────
export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('ict_token') || null)

  const handleAuth = (t) => {
    setToken(t)
  }

  const handleLogout = () => {
    localStorage.removeItem('ict_token')
    localStorage.removeItem('ict_email')
    setToken(null)
  }

  if (!token) return <Login onAuth={handleAuth}/>
  return <Dashboard token={token} onLogout={handleLogout}/>
}
