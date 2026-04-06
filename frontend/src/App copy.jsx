import { useState, useEffect, useRef, useCallback } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts'
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
function empty(p) { return { pair:p, htf:null, ltf:null, hasSignal:false } }

// ── Push Notifications ────────────────────────────────────────────
function usePushNotifications() {
  const [permitted, setPermitted] = useState(Notification.permission === 'granted')

  const request = async () => {
    if (!('Notification' in window)) return false
    const perm = await Notification.requestPermission()
    setPermitted(perm === 'granted')
    return perm === 'granted'
  }

  const send = useCallback((title, body, icon = '🤖') => {
    if (Notification.permission !== 'granted') return
    try { new Notification(title, { body, icon:'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22><text y=%2215%22 font-size=%2215%22>' + icon + '</text></svg>' }) }
    catch {}
  }, [])

  return { permitted, request, send }
}

// ── Header AutoMode Panel ─────────────────────────────────────────
function AutoModePanel({ token, autoMode, setAutoMode }) {
  const [balance, setBalance] = useState(null)
  const [loading, setLoading] = useState(false)
  const hdr = { 'Authorization':'Bearer '+token, 'Content-Type':'application/json' }

  useEffect(() => {
    const fn = () => fetch('/api/balance',{headers:hdr}).then(r=>r.ok?r.json():null).then(d=>d&&setBalance(d)).catch(()=>{})
    fn()
    const t = setInterval(fn, 30000)
    return () => clearInterval(t)
  }, [])

  const toggle = async () => {
    setLoading(true)
    try { const d = await fetch('/api/automode',{method:'POST',headers:hdr,body:JSON.stringify({enabled:!autoMode})}).then(r=>r.json()); setAutoMode(d.autoMode) } catch {}
    setLoading(false)
  }

  const openTrades    = balance?.openTrades ?? 0
  const maxOpenTrades = balance?.maxOpenTrades ?? 5

  return (
    <div style={{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}}>
      {balance?.balance != null && (
        <div style={{display:'flex',alignItems:'center',gap:'6px',padding:'4px 10px',borderRadius:6,background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)',fontSize:11,color:'#94a3b8',fontFamily:'var(--mono)'}}>
          <span style={{color:'#f5a623'}}>💰</span>
          <span style={{color:'#e2e8f0',fontWeight:600}}>${balance.balance.toLocaleString('fr-FR',{maximumFractionDigits:0})}</span>
          <span style={{color:'#334155'}}>|</span>
          <span>{balance.riskPercent}% = <span style={{color:'#00d97e',fontWeight:600}}>${balance.riskUSD}</span></span>
          <span style={{color:'#334155'}}>|</span>
          <span style={{color:openTrades>=maxOpenTrades?'#ff4560':'#94a3b8'}}>
            <span style={{color:openTrades>=maxOpenTrades?'#ff4560':'#00d97e',fontWeight:600}}>{openTrades}/{maxOpenTrades}</span> trades
          </span>
        </div>
      )}
      <button onClick={toggle} disabled={loading} style={{
        display:'flex',alignItems:'center',gap:'6px',padding:'5px 14px',borderRadius:6,
        border:`1.5px solid ${autoMode?'#00d97e':'#ff4560'}`,
        background:autoMode?'rgba(0,217,126,.12)':'rgba(255,69,96,.12)',
        color:autoMode?'#00d97e':'#ff4560',cursor:loading?'wait':'pointer',
        fontWeight:700,fontSize:12,fontFamily:'var(--sans)',transition:'all .2s',whiteSpace:'nowrap',
      }}>
        <span>🤖</span> AutoBot
        <span style={{padding:'1px 6px',borderRadius:4,background:autoMode?'rgba(0,217,126,.25)':'rgba(255,69,96,.25)',fontSize:10,fontWeight:800}}>
          {autoMode?'● ON':'● OFF'}
        </span>
      </button>
    </div>
  )
}

// ── Positions ouvertes ────────────────────────────────────────────
function PositionsPanel({ token, positions }) {
  const [expanded, setExpanded] = useState(true)
  const hdr = {'Authorization':'Bearer '+token}
  const fmt = (ts) => {
    if (!ts) return '—'
    const ms = Date.now() - new Date(ts).getTime()
    const m = Math.floor(ms/60000), h = Math.floor(m/60), d = Math.floor(h/24)
    return d>0?`${d}j ${h%24}h`:h>0?`${h}h ${m%60}m`:`${m}m`
  }
  if (!positions?.length) return (
    <div style={{margin:'0 0 14px',padding:'10px 16px',borderRadius:8,background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.07)',color:'#64748b',fontSize:12}}>
      📊 Aucune position ouverte
    </div>
  )
  return (
    <div style={{margin:'0 0 14px',borderRadius:8,background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.1)',overflow:'hidden'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 16px',cursor:'pointer',borderBottom:expanded?'1px solid rgba(255,255,255,.06)':'none'}} onClick={()=>setExpanded(!expanded)}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{color:'#f5a623'}}>📊</span>
          <span style={{color:'#e2e8f0',fontWeight:600,fontSize:13}}>Positions ouvertes</span>
          <span style={{padding:'1px 8px',borderRadius:10,background:'rgba(245,166,35,.2)',color:'#f5a623',fontSize:11,fontWeight:700}}>{positions.length}</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <button onClick={(e)=>{e.stopPropagation();fetch('/api/positions/refresh',{method:'POST',headers:hdr})}} style={{padding:'2px 8px',borderRadius:4,fontSize:11,border:'1px solid rgba(255,255,255,.15)',background:'rgba(255,255,255,.05)',color:'#94a3b8',cursor:'pointer'}}>↻</button>
          <span style={{color:'#64748b',fontSize:12}}>{expanded?'▲':'▼'}</span>
        </div>
      </div>
      {expanded && (
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,fontFamily:'var(--mono)'}}>
            <thead>
              <tr style={{background:'rgba(0,0,0,.2)'}}>
                {['Paire','Dir.','Lots','Entry','SL','TP','Durée'].map(h=>(
                  <th key={h} style={{padding:'7px 12px',textAlign:'left',color:'#64748b',fontWeight:600,fontSize:11,borderBottom:'1px solid rgba(255,255,255,.06)'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {positions.map((pos,i)=>(
                <tr key={pos.positionId} style={{borderBottom:'1px solid rgba(255,255,255,.04)',background:i%2===0?'transparent':'rgba(255,255,255,.01)'}}>
                  <td style={{padding:'7px 12px',color:'#e2e8f0',fontWeight:600}}>{pos.symbol}</td>
                  <td style={{padding:'7px 12px',color:pos.side==='BUY'?'#00d97e':'#ff4560',fontWeight:700}}>{pos.side==='BUY'?'▲':'▼'} {pos.side}</td>
                  <td style={{padding:'7px 12px',color:'#94a3b8'}}>{pos.lots}L</td>
                  <td style={{padding:'7px 12px'}}>{pos.openPrice?.toFixed(5)||'—'}</td>
                  <td style={{padding:'7px 12px',color:'#ff4560'}}>{pos.stopLoss?.toFixed(5)||'—'}</td>
                  <td style={{padding:'7px 12px',color:'#00d97e'}}>{pos.takeProfit?.toFixed(5)||'—'}</td>
                  <td style={{padding:'7px 12px',color:'#64748b'}}>{fmt(pos.openTime)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// ANALYTICS PAGE
// ════════════════════════════════════════════════════════════════
function AnalyticsPage({ token }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [days,    setDays]    = useState(30)
  const hdr = {'Authorization':'Bearer '+token}

  useEffect(() => {
    setLoading(true)
    fetch(`/api/analytics?days=${days}`, {headers:hdr})
      .then(r=>r.ok?r.json():null)
      .then(d=>{setData(d);setLoading(false)})
      .catch(()=>setLoading(false))
  }, [days])

  const card = (children, title, flex='1 1 340px') => (
    <div style={{flex,minWidth:280,background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.08)',borderRadius:10,padding:'16px',marginBottom:12}}>
      {title && <div style={{color:'#94a3b8',fontSize:11,fontWeight:700,letterSpacing:'.5px',textTransform:'uppercase',marginBottom:12}}>{title}</div>}
      {children}
    </div>
  )

  if (loading) return <div style={{color:'#64748b',padding:40,textAlign:'center'}}>Chargement des analytics...</div>
  if (!data)   return <div style={{color:'#ff4560',padding:40,textAlign:'center'}}>Erreur de chargement</div>

  const chartColors = { buy:'#00d97e', sell:'#ff4560', neutral:'#3b82f6', warn:'#f5a623' }
  const tooltipStyle = { background:'#1E293B', border:'1px solid #334155', borderRadius:6, fontSize:12 }

  return (
    <div style={{padding:'0 0 40px'}}>
      {/* Header + période */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
        <div>
          <h2 style={{color:'#e2e8f0',margin:0,fontSize:18}}>📊 Analytics</h2>
          <p style={{color:'#64748b',margin:'4px 0 0',fontSize:12}}>{data.totalSignals} signaux analysés</p>
        </div>
        <div style={{display:'flex',gap:6}}>
          {[7,14,30,60].map(d=>(
            <button key={d} onClick={()=>setDays(d)} style={{
              padding:'4px 12px',borderRadius:6,fontSize:12,cursor:'pointer',
              background:days===d?'rgba(59,130,246,.25)':'rgba(255,255,255,.05)',
              border:`1px solid ${days===d?'#3b82f6':'rgba(255,255,255,.1)'}`,
              color:days===d?'#3b82f6':'#94a3b8',
            }}>{d}j</button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:16}}>
        {[
          {label:'Total signaux', val:data.totalSignals, color:'#94a3b8'},
          {label:'Auto OK', val:`${data.autoOkTotal} (${data.autoOkRate}%)`, color:'#00d97e'},
          {label:'Non qualifiés', val:data.autoNotOkTotal, color:'#ff4560'},
        ].map(k=>(
          <div key={k.label} style={{flex:'1 1 150px',background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.08)',borderRadius:8,padding:'12px 16px'}}>
            <div style={{fontSize:22,fontWeight:700,color:k.color,fontFamily:'var(--mono)'}}>{k.val}</div>
            <div style={{fontSize:11,color:'#64748b',marginTop:4}}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
        {/* Courbe d'équité simulée */}
        {card(
          <>
            <div style={{fontSize:10,color:'#475569',marginBottom:8}}>⚠️ Simulation basée sur score ≥ 70 = TP hit — pas un résultat réel</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.equityCurve}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="date" tick={{fill:'#64748b',fontSize:10}} tickFormatter={d=>d.slice(5)} />
                <YAxis tick={{fill:'#64748b',fontSize:10}} width={65} tickFormatter={v=>`$${v.toLocaleString()}`} />
                <Tooltip contentStyle={tooltipStyle} formatter={v=>[`$${v.toLocaleString()}`, 'Capital']} />
                <Line type="monotone" dataKey="equity" stroke="#00d97e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </>,
          '💹 Courbe capital simulée', '1 1 100%'
        )}

        {/* Signaux par jour */}
        {card(
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.signalsByDay.slice(-21)} barSize={8}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
              <XAxis dataKey="date" tick={{fill:'#64748b',fontSize:9}} tickFormatter={d=>d.slice(5)} />
              <YAxis tick={{fill:'#64748b',fontSize:10}} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="autoOk" stackId="a" fill="#00d97e" name="Auto OK" />
              <Bar dataKey="total"  stackId="b" fill="#334155" name="Total" />
            </BarChart>
          </ResponsiveContainer>,
          '📅 Signaux par jour'
        )}

        {/* R:R distribution */}
        {card(
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.rrDistribution} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
              <XAxis dataKey="range" tick={{fill:'#64748b',fontSize:11}} />
              <YAxis tick={{fill:'#64748b',fontSize:10}} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" radius={[4,4,0,0]}>
                {data.rrDistribution.map((entry, i) => (
                  <Cell key={i} fill={i < 2 ? '#ff4560' : i < 4 ? '#f5a623' : '#00d97e'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>,
          '📐 Distribution R:R'
        )}

        {/* Score distribution */}
        {card(
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.scoreBuckets} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
              <XAxis dataKey="range" tick={{fill:'#64748b',fontSize:10}} />
              <YAxis tick={{fill:'#64748b',fontSize:10}} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" radius={[4,4,0,0]}>
                {data.scoreBuckets.map((entry, i) => (
                  <Cell key={i} fill={i >= 7 ? '#00d97e' : i >= 5 ? '#f5a623' : '#64748b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>,
          '🎯 Distribution des scores'
        )}

        {/* Heatmap par heure */}
        {card(
          <div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(24,1fr)',gap:2}}>
              {data.hourData.map(h=>{
                const intensity = Math.min(1, h.count / Math.max(...data.hourData.map(x=>x.count), 1))
                const isLondon  = h.hour >= 7  && h.hour < 12
                const isNY      = h.hour >= 13 && h.hour < 17
                const bg = isLondon || isNY
                  ? `rgba(0,217,126,${0.15 + intensity * 0.75})`
                  : `rgba(255,255,255,${intensity * 0.2})`
                return (
                  <div key={h.hour} title={`${h.hour}h UTC — ${h.count} signaux | Score moy: ${h.avgScore}`}
                    style={{aspectRatio:'1',borderRadius:3,background:bg,cursor:'default',position:'relative'}}>
                  </div>
                )
              })}
            </div>
            <div style={{display:'flex',gap:12,marginTop:8,fontSize:10,color:'#64748b'}}>
              <span>0h ────────────────── 23h UTC</span>
              <span style={{color:'#00d97e',marginLeft:'auto'}}>■ London (7-12) / NY (13-17)</span>
            </div>
          </div>,
          '🕐 Heatmap signaux par heure (UTC)'
        )}

        {/* Top paires */}
        {card(
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.topPairs} layout="vertical" barSize={12}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
              <XAxis type="number" tick={{fill:'#64748b',fontSize:10}} />
              <YAxis type="category" dataKey="pair" tick={{fill:'#94a3b8',fontSize:11}} width={55} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="autoOk" fill="#00d97e" name="Auto OK" stackId="a" />
              <Bar dataKey="total"  fill="#1E293B" name="Total"   stackId="b" />
            </BarChart>
          </ResponsiveContainer>,
          '🏆 Top paires par signaux'
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// JOURNAL PAGE
// ════════════════════════════════════════════════════════════════
function JournalPage({ token }) {
  const [entries, setEntries] = useState([])
  const [stats,   setStats]   = useState(null)
  const [editing, setEditing] = useState(null)  // id en cours d'édition
  const [editData,setEditData]= useState({})
  const hdr = {'Authorization':'Bearer '+token,'Content-Type':'application/json'}

  const loadJournal = () => {
    fetch('/api/journal', {headers:hdr}).then(r=>r.ok?r.json():null).then(d=>{
      if (d) { setEntries(d.entries||[]); setStats(d.stats||null) }
    }).catch(()=>{})
  }

  useEffect(() => { loadJournal() }, [])

  const saveEdit = async (id) => {
    await fetch(`/api/journal/${id}`, {method:'PUT',headers:hdr,body:JSON.stringify(editData)})
    setEditing(null)
    setEditData({})
    loadJournal()
  }

  const startEdit = (entry) => {
    setEditing(entry.id)
    setEditData({ notes:entry.notes||'', outcome:entry.outcome||'', exitPrice:entry.exitPrice||'', pnlUSD:entry.pnlUSD||'' })
  }

  const exportCSV = () => {
    const a = document.createElement('a')
    a.href = '/api/journal/export/csv'
    a.download = `journal_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
  }

  const outcomeColor = o => o==='win'?'#00d97e':o==='loss'?'#ff4560':o==='be'?'#f5a623':'#64748b'
  const outcomeLabel = o => o==='win'?'✅ Win':o==='loss'?'❌ Loss':o==='be'?'➡️ BE':'—'

  return (
    <div style={{paddingBottom:40}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
        <div>
          <h2 style={{color:'#e2e8f0',margin:0,fontSize:18}}>📓 Journal de trading</h2>
          <p style={{color:'#64748b',margin:'4px 0 0',fontSize:12}}>{entries.length} trades enregistrés</p>
        </div>
        <button onClick={exportCSV} style={{padding:'6px 16px',borderRadius:6,fontSize:12,cursor:'pointer',background:'rgba(59,130,246,.15)',border:'1px solid rgba(59,130,246,.3)',color:'#3b82f6',fontWeight:600}}>
          ⬇️ Export CSV/Excel
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:16}}>
          {[
            {l:'Total exécutés', v:stats.executed, c:'#94a3b8'},
            {l:'Wins', v:stats.wins, c:'#00d97e'},
            {l:'Losses', v:stats.losses, c:'#ff4560'},
            {l:'Winrate', v:`${stats.winRate}%`, c:stats.winRate>=50?'#00d97e':'#ff4560'},
            {l:'P&L total', v:`$${stats.totalPnl}`, c:stats.totalPnl>=0?'#00d97e':'#ff4560'},
            {l:'R:R moyen', v:`1:${stats.avgRR}`, c:'#f5a623'},
          ].map(k=>(
            <div key={k.l} style={{flex:'1 1 130px',background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.08)',borderRadius:8,padding:'10px 14px'}}>
              <div style={{fontSize:20,fontWeight:700,color:k.c,fontFamily:'var(--mono)'}}>{k.v}</div>
              <div style={{fontSize:10,color:'#64748b',marginTop:3}}>{k.l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div style={{background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.08)',borderRadius:10,overflow:'hidden'}}>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead>
              <tr style={{background:'rgba(0,0,0,.25)'}}>
                {['Date','Paire','Dir.','Lots','Entry','SL','TP','R:R','Score','Outcome','P&L','Notes',''].map(h=>(
                  <th key={h} style={{padding:'9px 12px',textAlign:'left',color:'#64748b',fontWeight:600,fontSize:11,borderBottom:'1px solid rgba(255,255,255,.08)',whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr><td colSpan={13} style={{padding:24,textAlign:'center',color:'#64748b'}}>Aucun trade enregistré — les ordres auto sont automatiquement loggés ici</td></tr>
              ) : entries.map((e,i) => (
                <tr key={e.id} style={{borderBottom:'1px solid rgba(255,255,255,.04)',background:i%2===0?'transparent':'rgba(255,255,255,.01)'}}>
                  <td style={{padding:'7px 12px',color:'#64748b',fontSize:10,fontFamily:'var(--mono)',whiteSpace:'nowrap'}}>{new Date(e.executedAt).toLocaleDateString('fr-FR')} {new Date(e.executedAt).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</td>
                  <td style={{padding:'7px 12px',color:'#e2e8f0',fontWeight:600}}>{e.pair}</td>
                  <td style={{padding:'7px 12px',color:e.action==='BUY'?'#00d97e':'#ff4560',fontWeight:700}}>{e.action==='BUY'?'▲':'▼'} {e.action}</td>
                  <td style={{padding:'7px 12px',color:'#94a3b8',fontFamily:'var(--mono)'}}>{e.lots}L</td>
                  <td style={{padding:'7px 12px',fontFamily:'var(--mono)',fontSize:11}}>{e.entryPrice||'—'}</td>
                  <td style={{padding:'7px 12px',color:'#ff4560',fontFamily:'var(--mono)',fontSize:11}}>{e.sl||'—'}</td>
                  <td style={{padding:'7px 12px',color:'#00d97e',fontFamily:'var(--mono)',fontSize:11}}>{e.tp||'—'}</td>
                  <td style={{padding:'7px 12px',color:'#f5a623',fontFamily:'var(--mono)'}}>{e.rr?`1:${e.rr}`:'—'}</td>
                  <td style={{padding:'7px 12px'}}>
                    {e.score ? <span style={{color:e.score>=80?'#00d97e':e.score>=60?'#f5a623':'#ff4560',fontWeight:600,fontFamily:'var(--mono)'}}>{e.score}</span> : '—'}
                  </td>

                  {/* Outcome (éditable) */}
                  <td style={{padding:'7px 12px'}}>
                    {editing === e.id ? (
                      <select value={editData.outcome||''} onChange={ev=>setEditData(p=>({...p,outcome:ev.target.value}))}
                        style={{background:'#1E293B',border:'1px solid #334155',color:'#e2e8f0',borderRadius:4,padding:'2px 4px',fontSize:11}}>
                        <option value="">—</option>
                        <option value="win">✅ Win</option>
                        <option value="loss">❌ Loss</option>
                        <option value="be">➡️ BE</option>
                      </select>
                    ) : (
                      <span style={{color:outcomeColor(e.outcome),fontWeight:600,fontSize:11}}>{outcomeLabel(e.outcome)}</span>
                    )}
                  </td>

                  {/* P&L (éditable) */}
                  <td style={{padding:'7px 12px'}}>
                    {editing === e.id ? (
                      <input type="number" value={editData.pnlUSD||''} onChange={ev=>setEditData(p=>({...p,pnlUSD:ev.target.value}))}
                        placeholder="0.00" style={{width:70,background:'#1E293B',border:'1px solid #334155',color:'#e2e8f0',borderRadius:4,padding:'2px 6px',fontSize:11}} />
                    ) : (
                      <span style={{color:e.pnlUSD>0?'#00d97e':e.pnlUSD<0?'#ff4560':'#64748b',fontFamily:'var(--mono)',fontWeight:600}}>
                        {e.pnlUSD!==null?`$${e.pnlUSD}`:'—'}
                      </span>
                    )}
                  </td>

                  {/* Notes (éditable) */}
                  <td style={{padding:'7px 12px',maxWidth:200}}>
                    {editing === e.id ? (
                      <input value={editData.notes||''} onChange={ev=>setEditData(p=>({...p,notes:ev.target.value}))}
                        placeholder="Notes..." style={{width:'100%',background:'#1E293B',border:'1px solid #334155',color:'#e2e8f0',borderRadius:4,padding:'2px 6px',fontSize:11}} />
                    ) : (
                      <span style={{color:'#64748b',fontSize:11}}>{e.notes||'—'}</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td style={{padding:'7px 12px',whiteSpace:'nowrap'}}>
                    {editing === e.id ? (
                      <>
                        <button onClick={()=>saveEdit(e.id)} style={{padding:'2px 8px',borderRadius:4,fontSize:11,background:'rgba(0,217,126,.2)',border:'1px solid #00d97e',color:'#00d97e',cursor:'pointer',marginRight:4}}>✓</button>
                        <button onClick={()=>setEditing(null)} style={{padding:'2px 8px',borderRadius:4,fontSize:11,background:'rgba(255,69,96,.1)',border:'1px solid #ff4560',color:'#ff4560',cursor:'pointer'}}>✗</button>
                      </>
                    ) : (
                      <button onClick={()=>startEdit(e)} style={{padding:'2px 8px',borderRadius:4,fontSize:11,background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.15)',color:'#94a3b8',cursor:'pointer'}}>✏️</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// SETTINGS PAGE
// ════════════════════════════════════════════════════════════════
function SettingsPage({ token, pushNotif }) {
  const [pauseCfg, setPauseCfg] = useState({ weekendPause:false, nfpPause:false, customSchedules:[] })
  const [tokenSt,  setTokenSt]  = useState(null)
  const [saved,    setSaved]    = useState(false)
  const hdr = {'Authorization':'Bearer '+token,'Content-Type':'application/json'}

  useEffect(() => {
    fetch('/api/pause-config', {headers:hdr}).then(r=>r.ok?r.json():null).then(d=>d&&setPauseCfg(d)).catch(()=>{})
    fetch('/api/token/status',  {headers:hdr}).then(r=>r.ok?r.json():null).then(d=>d&&setTokenSt(d)).catch(()=>{})
  }, [])

  const savePause = async () => {
    await fetch('/api/pause-config',{method:'POST',headers:hdr,body:JSON.stringify(pauseCfg)})
    setSaved(true)
    setTimeout(()=>setSaved(false),2000)
  }

  const refreshToken = async () => {
    const res  = await fetch('/api/token/refresh',{method:'POST',headers:hdr})
    const data = await res.json()
    if (data.ok) setTokenSt(prev=>({...prev,needsRefresh:false,daysLeft:30}))
  }

  const section = (title, children) => (
    <div style={{background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.08)',borderRadius:10,padding:'18px',marginBottom:14}}>
      <h3 style={{color:'#94a3b8',margin:'0 0 14px',fontSize:13,fontWeight:700,letterSpacing:'.5px',textTransform:'uppercase'}}>{title}</h3>
      {children}
    </div>
  )

  const toggle = (key, val) => setPauseCfg(p=>({...p,[key]:val}))

  return (
    <div style={{paddingBottom:40,maxWidth:720}}>
      <h2 style={{color:'#e2e8f0',margin:'0 0 16px',fontSize:18}}>⚙️ Paramètres</h2>

      {/* Auto-Pause */}
      {section('😴 Auto-Pause — Désactivation automatique',
        <>
          <p style={{color:'#64748b',fontSize:12,margin:'0 0 14px'}}>L\'AutoMode se désactive et se réactive automatiquement selon les périodes configurées.</p>
          {[
            { key:'weekendPause', label:'⏸ Pause Weekend', desc:'Désactive du vendredi 22h UTC au dimanche 22h UTC' },
            { key:'nfpPause',     label:'📰 Pause NFP',     desc:'Désactive le 1er vendredi du mois de 12h30 à 14h UTC (publication NFP)' },
          ].map(item=>(
            <div key={item.key} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid rgba(255,255,255,.06)'}}>
              <div>
                <div style={{color:'#e2e8f0',fontSize:13,fontWeight:600}}>{item.label}</div>
                <div style={{color:'#64748b',fontSize:11,marginTop:2}}>{item.desc}</div>
              </div>
              <button onClick={()=>toggle(item.key,!pauseCfg[item.key])} style={{
                padding:'5px 16px',borderRadius:6,cursor:'pointer',fontWeight:700,fontSize:12,
                border:`1.5px solid ${pauseCfg[item.key]?'#00d97e':'#334155'}`,
                background:pauseCfg[item.key]?'rgba(0,217,126,.15)':'rgba(255,255,255,.05)',
                color:pauseCfg[item.key]?'#00d97e':'#64748b',
              }}>{pauseCfg[item.key]?'✅ Actif':'○ Inactif'}</button>
            </div>
          ))}
          <button onClick={savePause} style={{
            marginTop:14,padding:'7px 20px',borderRadius:6,fontSize:12,cursor:'pointer',fontWeight:600,
            background:saved?'rgba(0,217,126,.2)':'rgba(59,130,246,.2)',
            border:`1px solid ${saved?'#00d97e':'#3b82f6'}`,
            color:saved?'#00d97e':'#3b82f6',
          }}>{saved?'✅ Sauvegardé !':'💾 Sauvegarder'}</button>
        </>
      )}

      {/* Push notifications */}
      {section('🔔 Notifications navigateur',
        <>
          <p style={{color:'#64748b',fontSize:12,margin:'0 0 14px'}}>Recevez des notifications push dans votre navigateur quand un ordre est exécuté ou un signal qualifié est reçu.</p>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{fontSize:13,color:pushNotif.permitted?'#00d97e':'#64748b'}}>
              {pushNotif.permitted?'✅ Notifications activées':'⚠️ Notifications désactivées'}
            </div>
            {!pushNotif.permitted && (
              <button onClick={pushNotif.request} style={{padding:'5px 14px',borderRadius:6,fontSize:12,cursor:'pointer',background:'rgba(59,130,246,.2)',border:'1px solid #3b82f6',color:'#3b82f6',fontWeight:600}}>
                🔔 Activer les notifications
              </button>
            )}
          </div>
        </>
      )}

      {/* Token cTrader */}
      {section('🔑 Token cTrader OAuth2',
        <>
          {tokenSt ? (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <div style={{display:'grid',gridTemplateColumns:'auto 1fr',gap:'6px 14px',fontSize:12}}>
                <span style={{color:'#64748b'}}>Refresh token :</span>
                <span style={{color:tokenSt.hasRefresh?'#00d97e':'#ff4560',fontWeight:600}}>{tokenSt.hasRefresh?'✅ Présent':'❌ Absent (ajouter dans .env)'}</span>
                <span style={{color:'#64748b'}}>Expire dans :</span>
                <span style={{color:tokenSt.daysLeft<5?'#ff4560':tokenSt.daysLeft<10?'#f5a623':'#00d97e',fontWeight:600}}>
                  {tokenSt.daysLeft !== null ? `${tokenSt.daysLeft} jours` : 'Inconnu'}
                </span>
                <span style={{color:'#64748b'}}>Date expiration :</span>
                <span style={{color:'#94a3b8',fontFamily:'var(--mono)',fontSize:11}}>{tokenSt.expiresAt?new Date(tokenSt.expiresAt).toLocaleDateString('fr-FR'):'—'}</span>
              </div>
              {(tokenSt.needsRefresh || !tokenSt.hasRefresh) && (
                <button onClick={refreshToken} style={{alignSelf:'flex-start',padding:'6px 16px',borderRadius:6,fontSize:12,cursor:'pointer',background:'rgba(245,166,35,.2)',border:'1px solid #f5a623',color:'#f5a623',fontWeight:600}}>
                  🔄 Refresh token maintenant
                </button>
              )}
              {!tokenSt.needsRefresh && tokenSt.daysLeft !== null && (
                <div style={{fontSize:11,color:'#64748b'}}>Le refresh automatique est planifié 2 jours avant l'expiration.</div>
              )}
            </div>
          ) : <div style={{color:'#64748b',fontSize:12}}>Chargement...</div>}
        </>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// DASHBOARD (tab principal)
// ════════════════════════════════════════════════════════════════
function DashboardTab({ token, states, history, strategies, activeStrat, switchStrategy, loadPairs, filter, setFilter, autoMode, positions }) {
  const all       = Object.values(states)
  const getAction = s => s.ltf?.action||s.htf?.action||s.htf?.direction||s.direction
  const buyCount  = all.filter(s=>getAction(s)==='BUY').length
  const sellCount = all.filter(s=>getAction(s)==='SELL').length
  const ltfCount  = all.filter(s=>s.ltf).length
  const totalSig  = all.filter(s=>s.hasSignal||(s.direction&&s.direction!=='NEUTRAL')).length
  const hdr       = {'Authorization':'Bearer '+token}

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
      if(a.ltf&&!b.ltf)return -1; if(!a.ltf&&b.ltf)return 1
      return Math.max(b.htf?.prob||0,b.ltf?.prob||0)-Math.max(a.htf?.prob||0,a.ltf?.prob||0)
    })

  const activeColor = strategies.find(s=>s.id===activeStrat)?.color||'#3b82f6'

  const hBadge = h => {
    if(h.signal==='SIGNAL_TRES_FORT_15M') return {cls:'ltf',txt:'⚡ '+(h.entry_type||'15M')}
    if(h.signal==='NEXUS_TREND_BULL'||h.signal==='NEXUS_TREND_BEAR') return {cls:'ltf',txt:'🔵 NEXUS'}
    if(h.quality==='EXCELLENT') return {cls:'exc',txt:'EXCELLENT'}
    if(h.quality==='BON')       return {cls:'bon',txt:'BON'}
    return {cls:'def',txt:h.quality||'—'}
  }

  return (
    <>
      {!autoMode && (
        <div style={{background:'rgba(255,69,96,.08)',border:'1px solid rgba(255,69,96,.25)',borderRadius:8,padding:'10px 18px',marginBottom:12,color:'#ff4560',fontSize:13,fontWeight:600,display:'flex',alignItems:'center',gap:10}}>
          🔴 AutoBot désactivé — les signaux sont reçus mais aucun ordre ne sera envoyé
        </div>
      )}

      {strategies.length > 0 && (
        <StrategyManager strategies={strategies} activeStratId={activeStrat} token={token} onActivate={switchStrategy}
          onUpdate={async()=>{ await fetch('/api/strategies',{headers:hdr}); if(activeStrat) loadPairs(activeStrat) }} />
      )}

      <PositionsPanel token={token} positions={positions} />

      <div className="stats">
        {[
          {val:buyCount,  lbl:'BUY actifs',      color:'#00d97e',bc:'rgba(0,217,126,.15)'},
          {val:sellCount, lbl:'SELL actifs',      color:'#ff4560',bc:'rgba(255,69,96,.15)'},
          {val:ltfCount,  lbl:'⚡ Très fort 15M', color:'#f5a623',bc:'rgba(245,166,35,.15)'},
          {val:totalSig,  lbl:'Total signaux',    color:'#94a3b8',bc:'rgba(255,255,255,.06)'},
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
        <button className="filter-btn test-btn" onClick={()=>fetch(`/api/test?strategy=${activeStrat}`,{headers:hdr}).then(()=>loadPairs(activeStrat))}>◎ Tester</button>
      </div>

      <div className="section-title" style={{color:activeColor}}>
        {strategies.find(s=>s.id===activeStrat)?.name||'Paires'} — {sorted.filter(s=>s.hasSignal).length} signaux actifs
      </div>
      <div className="grid">{sorted.map(s=><PairTile key={s.pair} state={s}/>)}</div>

      {history.length > 0 && (
        <div className="history-wrap">
          <div className="history-head" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <span>Historique</span>
            <span style={{fontSize:10,color:'#475569',fontFamily:'var(--mono)'}}>{strategies.find(s=>s.id===activeStrat)?.name} · 60j</span>
          </div>
          <table className="htable">
            <thead><tr><th>Paire</th><th>Action</th><th>TF</th><th>Entry</th><th>SL</th><th>TP réel</th><th>Prob</th><th>R:R</th><th>Score</th><th>Auto</th><th>Type</th><th>Heure</th></tr></thead>
            <tbody>
              {history.slice(0,20).map((h,i)=>{
                const b=hBadge(h)
                return (
                  <tr key={i}>
                    <td style={{fontWeight:600,color:'#e2e8f0'}}>{h.pair}</td>
                    <td className={h.action==='BUY'?'h-buy':'h-sell'}>{h.action}</td>
                    <td style={{color:'#64748b'}}>{h.tf}M</td>
                    <td style={{fontFamily:'var(--mono)',fontSize:11}}>{h.price}</td>
                    <td style={{color:'#ff4560',fontFamily:'var(--mono)',fontSize:11}}>{h.sl}</td>
                    <td style={{color:'#00d97e',fontFamily:'var(--mono)',fontSize:11}}>{h.tp_reel||h.tp}</td>
                    <td>{h.prob}%</td>
                    <td style={{color:'#f5a623'}}>{h.rr_reel?`1:${h.rr_reel}`:'—'}</td>
                    <td>{h.score?<span style={{color:h.score>=80?'#00d97e':h.score>=60?'#f5a623':'#ff4560',fontFamily:'var(--mono)',fontWeight:600}}>{h.score}/100</span>:'—'}</td>
                    <td>{h.auto_ok===true?<span style={{color:'#00d97e',fontSize:11,fontWeight:700}}>✅</span>:h.auto_ok===false?<span style={{color:'#ff4560',fontSize:11}}>⛔</span>:'—'}</td>
                    <td><span className={`h-badge ${b.cls}`}>{b.txt}</span></td>
                    <td style={{color:'#64748b'}}>{h.receivedAt?new Date(h.receivedAt).toLocaleTimeString('fr-FR'):''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

// ════════════════════════════════════════════════════════════════
// MAIN DASHBOARD CONTAINER
// ════════════════════════════════════════════════════════════════
function Dashboard({ token, onLogout }) {
  const [activeTab,  setActiveTab]  = useState('dashboard')
  const [states,     setStates]     = useState(()=>{const s={};PAIRS.forEach(p=>{s[p]=empty(p)});return s})
  const [history,    setHistory]    = useState([])
  const [strategies, setStrategies] = useState([])
  const [activeStrat,setActiveStrat]= useState(null)
  const [wsStatus,   setWs]         = useState('connecting')
  const [ctrader,    setCtrader]    = useState(null)
  const [filter,     setFilter]     = useState('ALL')
  const [autoMode,   setAutoMode]   = useState(true)
  const [positions,  setPositions]  = useState([])
  const wsRef     = useRef(null)
  const pushNotif = usePushNotifications()
  const hdr = {'Authorization':'Bearer '+token}

  useEffect(() => {
    fetch('/api/automode',  {headers:hdr}).then(r=>r.ok?r.json():null).then(d=>d&&setAutoMode(d.autoMode)).catch(()=>{})
    fetch('/api/positions', {headers:hdr}).then(r=>r.ok?r.json():null).then(d=>d&&setPositions(d.positions||[])).catch(()=>{})
  }, [])

  const loadStrategies = useCallback(async () => {
    try {
      const r=await fetch('/api/strategies',{headers:hdr}); if(r.status===401){onLogout();return}
      const strats=await r.json(); setStrategies(strats)
      const active=strats.find(s=>s.active)||strats[0]; if(active)setActiveStrat(active.id); return active
    } catch {}
  }, [token])

  const loadPairs = useCallback(async (stratId) => {
    if(!stratId)return
    try { const r=await fetch(`/api/states?strategy=${stratId}`,{headers:hdr}); if(r.ok)setStates(await r.json()) } catch {}
  }, [token])

  const loadHistory = useCallback(async (stratId) => {
    if(!stratId)return
    try { const r=await fetch(`/api/history?strategy=${stratId}&limit=50`,{headers:hdr}); if(r.ok)setHistory(await r.json()) } catch {}
  }, [token])

  const switchStrategy = useCallback(async (stratId) => {
    setActiveStrat(stratId)
    const s={};PAIRS.forEach(p=>{s[p]=empty(p)});setStates(s)
    setHistory([]);setFilter('ALL')
    await loadPairs(stratId); await loadHistory(stratId)
  }, [loadPairs, loadHistory])

  const connectWS = useCallback(() => {
    const proto=location.protocol==='https:'?'wss':'ws'
    const ws=new WebSocket(`${proto}://${window.location.host}/ws?token=${encodeURIComponent(token)}`)
    wsRef.current=ws
    ws.onopen  = () => setWs('connected')
    ws.onclose = () => { setWs('disconnected'); setTimeout(connectWS,4000) }
    ws.onerror = () => setWs('error')
    ws.onmessage = e => {
      try {
        const m=JSON.parse(e.data)
        if(m.type==='init'){ setStates(m.states||{}); setHistory(m.history||[]); if(m.strategies)setStrategies(m.strategies); if(m.activeStrat)setActiveStrat(m.activeStrat.id); if(typeof m.autoMode==='boolean')setAutoMode(m.autoMode) }
        if(m.type==='signal'&&m.stratId){ setActiveStrat(prev=>{if(m.stratId===prev)setStates(p=>({...p,[m.state.pair]:m.state}));return prev}) }
        if(m.type==='strategy_changed'){ setStrategies(m.strategies||[]); const a=m.strategies?.find(s=>s.active); if(a)switchStrategy(a.id) }
        if(m.type==='new_signal') setHistory(prev=>[m.entry,...prev].slice(0,50))
        if(m.type==='pairs_reset'){ setActiveStrat(prev=>{if(m.stratId===prev){const s={};PAIRS.forEach(p=>{s[p]=empty(p)});setStates(s)}return prev}) }
        if(m.type==='automode_changed') setAutoMode(m.autoMode)
        if(m.type==='positions_update') setPositions(m.positions||[])
        // Push notification navigateur
        if(m.type==='push_event') pushNotif.send(m.title, m.body)
      } catch {}
    }
  }, [token, switchStrategy, pushNotif])

  useEffect(() => {
    const init=async()=>{ const a=await loadStrategies(); if(a){await loadPairs(a.id);await loadHistory(a.id)} connectWS() }
    init()
    const poll=setInterval(()=>fetch('/api/ctrader',{headers:hdr}).then(r=>r.status===401?onLogout():r.json()).then(d=>d&&setCtrader(d)).catch(()=>{}),6000)
    return ()=>{ wsRef.current?.close(); clearInterval(poll) }
  }, [])

  const wsColor  = {connected:'#00d97e',disconnected:'#ff4560',connecting:'#f5a623',error:'#ff4560'}[wsStatus]||'#64748b'
  const ctColor  = ctrader?.ready?'#00d97e':ctrader?.simMode?'#f5a623':'#ff4560'
  const ctLabel  = ctrader?.ready?`cTrader ${ctrader.mode==='demo'?'Demo':'Live'}`:ctrader?.simMode?'Simulation':'cTrader ✗'
  const activeColor = strategies.find(s=>s.id===activeStrat)?.color||'#3b82f6'

  const tabs = [
    {id:'dashboard',label:'📈 Dashboard'},
    {id:'analytics', label:'📊 Analytics'},
    {id:'journal',   label:'📓 Journal'},
    {id:'settings',  label:'⚙️ Paramètres'},
  ]

  return (
    <div className="app">
      {/* HEADER */}
      <div className="hdr">
        <div className="hdr-brand">
          <div className="hdr-logo" style={{background:`linear-gradient(135deg,${activeColor}88,${activeColor})`}}>FX</div>
          <div>
            <div className="hdr-title">ICT Trading Dashboard</div>
            <div className="hdr-sub">FTMO · cTrader Open API · 28 paires Forex</div>
          </div>
        </div>
        <div className="hdr-right">
          <AutoModePanel token={token} autoMode={autoMode} setAutoMode={setAutoMode} />
          <div className="badge" style={{borderColor:wsColor,color:wsColor}}><div className="dot" style={{background:wsColor}}/>{wsStatus}</div>
          <div className="badge" style={{borderColor:ctColor,color:ctColor}}><div className="dot" style={{background:ctColor}}/>{ctLabel}</div>
          <button onClick={onLogout} style={{padding:'4px 12px',borderRadius:6,background:'rgba(255,69,96,.1)',border:'1px solid rgba(255,69,96,.3)',color:'#ff4560',fontSize:11,cursor:'pointer'}}>Déconnexion</button>
        </div>
      </div>

      {/* NAV TABS */}
      <div style={{display:'flex',gap:4,marginBottom:16,borderBottom:'1px solid rgba(255,255,255,.08)',paddingBottom:0}}>
        {tabs.map(tab=>(
          <button key={tab.id} onClick={()=>setActiveTab(tab.id)} style={{
            padding:'8px 18px',borderRadius:'6px 6px 0 0',fontSize:13,cursor:'pointer',fontWeight:600,
            border:'1px solid rgba(255,255,255,.08)',borderBottom:'none',
            background:activeTab===tab.id?'rgba(255,255,255,.06)':'transparent',
            color:activeTab===tab.id?'#e2e8f0':'#64748b',
            borderBottom:activeTab===tab.id?'2px solid '+activeColor:'2px solid transparent',
            transition:'all .15s',
          }}>{tab.label}</button>
        ))}
      </div>

      {/* TAB CONTENT */}
      {activeTab==='dashboard' && (
        <DashboardTab token={token} states={states} history={history} strategies={strategies}
          activeStrat={activeStrat} switchStrategy={switchStrategy} loadPairs={loadPairs}
          filter={filter} setFilter={setFilter} autoMode={autoMode} positions={positions} />
      )}
      {activeTab==='analytics' && <AnalyticsPage token={token} />}
      {activeTab==='journal'   && <JournalPage   token={token} />}
      {activeTab==='settings'  && <SettingsPage  token={token} pushNotif={pushNotif} />}
    </div>
  )
}

export default function App() {
  const [token, setToken] = useState(()=>localStorage.getItem('ict_token')||null)
  const logout = ()=>{ localStorage.removeItem('ict_token'); setToken(null) }
  if (!token) return <Login onAuth={setToken}/>
  return <Dashboard token={token} onLogout={logout}/>
}
