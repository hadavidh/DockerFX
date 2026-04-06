import { useState, useEffect, useRef, useCallback } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import PairTile from './components/PairTile'
import Login from './components/Login'
import StrategyManager from './components/StrategyManager'
import './App.css'

const PAIRS = ['EURUSD','GBPUSD','USDJPY','USDCHF','AUDUSD','USDCAD','NZDUSD','EURGBP','EURJPY','EURCHF','EURAUD','EURCAD','EURNZD','GBPJPY','GBPCHF','GBPAUD','GBPCAD','GBPNZD','AUDJPY','AUDCHF','AUDCAD','AUDNZD','CADJPY','CADCHF','CHFJPY','NZDJPY','NZDCHF','NZDCAD']
const empty = p => ({ pair:p, htf:null, ltf:null, hasSignal:false })
const tt = { background:'#1E293B', border:'1px solid #334155', borderRadius:6, fontSize:12 }

// ── Hook push notifs ──────────────────────────────────────────────
function usePush() {
  const [ok, setOk] = useState(Notification.permission==='granted')
  const req  = async () => { const p=await Notification.requestPermission(); setOk(p==='granted') }
  const send = useCallback((title,body) => { if(Notification.permission==='granted') try{new Notification(title,{body})}catch{} },[])
  return {ok,req,send}
}

// ════════════════════════════════════════════════════════════════
// HEADER — AutoMode global + balance + account badge
// ════════════════════════════════════════════════════════════════
function HeaderPanel({ token, autoMode, setAutoMode, accounts, activeAccount, setActiveAccount }) {
  const [balance, setBalance] = useState(null)
  const [loading, setLoading] = useState(false)
  const hdr = {'Authorization':'Bearer '+token,'Content-Type':'application/json'}

  useEffect(()=>{
    const fn=()=>fetch('/api/balance',{headers:hdr}).then(r=>r.ok?r.json():null).then(d=>d&&setBalance(d)).catch(()=>{})
    fn(); const t=setInterval(fn,30000); return ()=>clearInterval(t)
  },[activeAccount])

  const toggle = async()=>{
    setLoading(true)
    try{const d=await fetch('/api/automode',{method:'POST',headers:hdr,body:JSON.stringify({enabled:!autoMode})}).then(r=>r.json());setAutoMode(d.autoMode)}catch{}
    setLoading(false)
  }

  const switchAccount = async(id)=>{
    await fetch(`/api/accounts/${id}/activate`,{method:'POST',headers:hdr})
    setActiveAccount(id)
  }

  const ddColor = balance?.dailyDD >= 4 ? '#ff4560' : balance?.dailyDD >= 2 ? '#f5a623' : '#00d97e'

  return (
    <div style={{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}}>

      {/* Sélecteur de compte */}
      {accounts.length > 1 && (
        <select value={activeAccount||''} onChange={e=>switchAccount(e.target.value)}
          style={{padding:'4px 8px',borderRadius:6,background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.15)',color:'#e2e8f0',fontSize:12,cursor:'pointer'}}>
          {accounts.map(a=>(
            <option key={a.id} value={a.id} style={{background:'#0F172A'}}>
              {a.name} {a.connected?'✅':'⚠️'}
            </option>
          ))}
        </select>
      )}

      {/* Balance + drawdown */}
      {balance?.balance != null && (
        <div style={{display:'flex',alignItems:'center',gap:'6px',padding:'4px 10px',borderRadius:6,background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)',fontSize:11,fontFamily:'var(--mono)'}}>
          <span style={{color:'#f5a623'}}>💰</span>
          <span style={{color:'#e2e8f0',fontWeight:600}}>${balance.balance.toLocaleString('fr-FR',{maximumFractionDigits:0})}</span>
          <span style={{color:'#334155'}}>|</span>
          <span style={{color:'#94a3b8'}}>{balance.riskPercent}%=<span style={{color:'#00d97e',fontWeight:600}}>${balance.riskUSD}</span></span>
          {balance.dailyDD != null && (
            <>
              <span style={{color:'#334155'}}>|</span>
              <span style={{color:ddColor,fontWeight:600}}>DD {balance.dailyDD}%</span>
            </>
          )}
          <span style={{color:'#334155'}}>|</span>
          <span style={{color:balance.openTrades>=balance.maxOpenTrades?'#ff4560':'#94a3b8'}}>
            <span style={{color:balance.openTrades>=balance.maxOpenTrades?'#ff4560':'#00d97e',fontWeight:600}}>{balance.openTrades}/{balance.maxOpenTrades}</span>
          </span>
        </div>
      )}

      {/* AutoBot global */}
      <button onClick={toggle} disabled={loading} style={{
        display:'flex',alignItems:'center',gap:'6px',padding:'5px 14px',borderRadius:6,
        border:`1.5px solid ${autoMode?'#00d97e':'#ff4560'}`,
        background:autoMode?'rgba(0,217,126,.12)':'rgba(255,69,96,.12)',
        color:autoMode?'#00d97e':'#ff4560',cursor:'pointer',fontWeight:700,fontSize:12,fontFamily:'var(--sans)',whiteSpace:'nowrap',
      }}>
        🤖 AutoBot <span style={{padding:'1px 6px',borderRadius:4,background:autoMode?'rgba(0,217,126,.25)':'rgba(255,69,96,.25)',fontSize:10,fontWeight:800}}>{autoMode?'● ON':'● OFF'}</span>
      </button>
    </div>
  )
}

// ── Positions panel ───────────────────────────────────────────────
function PositionsPanel({ token, positions }) {
  const [exp,setExp] = useState(true)
  const hdr = {'Authorization':'Bearer '+token}
  const fmt = ts => { if(!ts)return'—'; const ms=Date.now()-new Date(ts).getTime(),m=Math.floor(ms/60000),h=Math.floor(m/60),d=Math.floor(h/24); return d>0?`${d}j ${h%24}h`:h>0?`${h}h ${m%60}m`:`${m}m` }
  if(!positions?.length) return <div style={{margin:'0 0 12px',padding:'10px 16px',borderRadius:8,background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.07)',color:'#64748b',fontSize:12}}>📊 Aucune position ouverte</div>
  return (
    <div style={{margin:'0 0 12px',borderRadius:8,background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.1)',overflow:'hidden'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 16px',cursor:'pointer',borderBottom:exp?'1px solid rgba(255,255,255,.06)':'none'}} onClick={()=>setExp(!exp)}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{color:'#f5a623'}}>📊</span>
          <span style={{color:'#e2e8f0',fontWeight:600,fontSize:13}}>Positions ouvertes</span>
          <span style={{padding:'1px 8px',borderRadius:10,background:'rgba(245,166,35,.2)',color:'#f5a623',fontSize:11,fontWeight:700}}>{positions.length}</span>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={e=>{e.stopPropagation();fetch('/api/positions/refresh',{method:'POST',headers:hdr})}} style={{padding:'2px 8px',borderRadius:4,fontSize:11,border:'1px solid rgba(255,255,255,.15)',background:'rgba(255,255,255,.05)',color:'#94a3b8',cursor:'pointer'}}>↻</button>
          <span style={{color:'#64748b',fontSize:12}}>{exp?'▲':'▼'}</span>
        </div>
      </div>
      {exp && <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:12,fontFamily:'var(--mono)'}}>
        <thead><tr style={{background:'rgba(0,0,0,.2)'}}>{['Paire','Dir.','Lots','Entry','SL','TP','Durée'].map(h=><th key={h} style={{padding:'7px 12px',textAlign:'left',color:'#64748b',fontWeight:600,fontSize:11,borderBottom:'1px solid rgba(255,255,255,.06)'}}>{h}</th>)}</tr></thead>
        <tbody>{positions.map((p,i)=>(
          <tr key={p.positionId} style={{borderBottom:'1px solid rgba(255,255,255,.04)',background:i%2===0?'transparent':'rgba(255,255,255,.01)'}}>
            <td style={{padding:'7px 12px',color:'#e2e8f0',fontWeight:600}}>{p.symbol}</td>
            <td style={{padding:'7px 12px',color:p.side==='BUY'?'#00d97e':'#ff4560',fontWeight:700}}>{p.side==='BUY'?'▲':'▼'} {p.side}</td>
            <td style={{padding:'7px 12px',color:'#94a3b8'}}>{p.lots}L</td>
            <td style={{padding:'7px 12px'}}>{p.openPrice?.toFixed(5)||'—'}</td>
            <td style={{padding:'7px 12px',color:'#ff4560'}}>{p.stopLoss?.toFixed(5)||'—'}</td>
            <td style={{padding:'7px 12px',color:'#00d97e'}}>{p.takeProfit?.toFixed(5)||'—'}</td>
            <td style={{padding:'7px 12px',color:'#64748b'}}>{fmt(p.openTime)}</td>
          </tr>
        ))}</tbody>
      </table></div>}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// STRATEGY AUTOMODE PANEL — ON/OFF par stratégie
// ════════════════════════════════════════════════════════════════
function StrategyAutoModes({ token, strategies, stratModes, setStratModes }) {
  const hdr = {'Authorization':'Bearer '+token,'Content-Type':'application/json'}

  const toggle = async (stratId, current) => {
    const res  = await fetch(`/api/automode/${stratId}`,{method:'POST',headers:hdr,body:JSON.stringify({enabled:!current})})
    const data = await res.json()
    if (data.ok) setStratModes(prev => ({...prev,[stratId]:{...prev[stratId],enabled:!current}}))
  }

  if (!strategies.length) return null

  return (
    <div style={{display:'flex',gap:8,flexWrap:'wrap',padding:'10px 16px',marginBottom:12,background:'rgba(255,255,255,.03)',borderRadius:8,border:'1px solid rgba(255,255,255,.08)'}}>
      <span style={{color:'#64748b',fontSize:11,fontWeight:700,alignSelf:'center',marginRight:4}}>AUTOBOT PAR STRATÉGIE :</span>
      {strategies.map(strat => {
        const am = stratModes[strat.id] || { enabled: true }
        return (
          <button key={strat.id} onClick={() => toggle(strat.id, am.enabled)} style={{
            display:'flex',alignItems:'center',gap:6,padding:'4px 12px',borderRadius:6,fontSize:11,cursor:'pointer',fontWeight:600,
            border:`1px solid ${am.enabled?strat.color||'#00d97e':'rgba(255,255,255,.15)'}`,
            background:am.enabled?`${strat.color}18`:'rgba(255,255,255,.05)',
            color:am.enabled?strat.color||'#00d97e':'#64748b',
          }}>
            <span style={{width:6,height:6,borderRadius:'50%',background:am.enabled?strat.color||'#00d97e':'#334155',display:'inline-block'}}/>
            {strat.name}
          </button>
        )
      })}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// DRAWDOWN MONITOR PANEL
// ════════════════════════════════════════════════════════════════
function DrawdownPanel({ token }) {
  const [dd, setDd] = useState(null)
  const hdr = {'Authorization':'Bearer '+token}
  useEffect(()=>{
    fetch('/api/drawdown',{headers:hdr}).then(r=>r.ok?r.json():null).then(d=>d&&setDd(d)).catch(()=>{})
    const t=setInterval(()=>fetch('/api/drawdown',{headers:hdr}).then(r=>r.ok?r.json():null).then(d=>d&&setDd(d)).catch(()=>{}),60000)
    return ()=>clearInterval(t)
  },[])

  if (!dd || dd.dailyDD === null) return null

  const pctDay   = dd.dailyDD  || 0
  const pctTotal = dd.totalDD  || 0
  const maxDay   = dd.hardStopDD || 5
  const maxTotal = dd.maxTotalDD || 10
  const color    = pctDay >= maxDay * 0.8 ? '#ff4560' : pctDay >= maxDay * 0.5 ? '#f5a623' : '#00d97e'

  return (
    <div style={{display:'flex',gap:12,padding:'10px 16px',marginBottom:12,background:'rgba(255,255,255,.03)',borderRadius:8,border:`1px solid ${color}33`,flexWrap:'wrap'}}>
      <span style={{color:'#64748b',fontSize:11,fontWeight:700,alignSelf:'center'}}>📉 DRAWDOWN :</span>
      {[
        {label:'Journalier',pct:pctDay,max:maxDay},
        {label:'Total',     pct:pctTotal,max:maxTotal},
      ].map(d=>{
        const c = d.pct >= d.max*0.8 ? '#ff4560' : d.pct >= d.max*0.5 ? '#f5a623' : '#00d97e'
        const w = Math.min(100, (d.pct / d.max) * 100)
        return (
          <div key={d.label} style={{display:'flex',alignItems:'center',gap:8,flex:'1 1 200px',minWidth:160}}>
            <span style={{color:'#64748b',fontSize:11,whiteSpace:'nowrap'}}>{d.label}:</span>
            <div style={{flex:1,height:6,borderRadius:3,background:'rgba(255,255,255,.1)',overflow:'hidden'}}>
              <div style={{width:`${w}%`,height:'100%',background:c,borderRadius:3,transition:'width .5s'}}/>
            </div>
            <span style={{color:c,fontWeight:700,fontSize:12,fontFamily:'var(--mono)',whiteSpace:'nowrap'}}>{d.pct}% / {d.max}%</span>
          </div>
        )
      })}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// BACKTESTING PAGE
// ════════════════════════════════════════════════════════════════
function BacktestPage({ token }) {
  const [result, setResult] = useState(null)
  const [loading,setLoading]= useState(false)
  const [error,  setError]  = useState(null)
  const hdr = {'Authorization':'Bearer '+token}
  const fileRef = useRef()

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true); setError(null); setResult(null)
    const form = new FormData()
    form.append('file', file)
    try {
      const res  = await fetch('/api/backtest/import', {method:'POST',headers:{'Authorization':'Bearer '+token},body:form})
      const data = await res.json()
      if (data.error) setError(data.error)
      else setResult(data)
    } catch(e) { setError(e.message) }
    setLoading(false)
  }

  const kpi = (label, value, color='#e2e8f0', sub='') => (
    <div style={{flex:'1 1 150px',minWidth:130,background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.08)',borderRadius:8,padding:'12px 16px'}}>
      <div style={{fontSize:20,fontWeight:700,color,fontFamily:'var(--mono)'}}>{value}</div>
      <div style={{fontSize:10,color:'#64748b',marginTop:3}}>{label}</div>
      {sub&&<div style={{fontSize:10,color:'#475569',marginTop:2}}>{sub}</div>}
    </div>
  )

  return (
    <div style={{paddingBottom:40}}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:12}}>
        <div>
          <h2 style={{color:'#e2e8f0',margin:0,fontSize:18}}>🔬 Backtesting</h2>
          <p style={{color:'#64748b',margin:'6px 0 0',fontSize:12}}>Importez les résultats du Strategy Tester TradingView (.csv ou .json) pour visualiser les métriques.</p>
        </div>
        <div>
          <input ref={fileRef} type="file" accept=".csv,.json" style={{display:'none'}} onChange={handleFile}/>
          <button onClick={()=>fileRef.current?.click()} style={{padding:'8px 20px',borderRadius:8,fontSize:13,cursor:'pointer',fontWeight:600,background:'rgba(59,130,246,.2)',border:'1px solid #3b82f6',color:'#3b82f6'}}>
            📂 Importer CSV / JSON
          </button>
        </div>
      </div>

      {/* Instructions */}
      {!result && !loading && (
        <div style={{background:'rgba(59,130,246,.08)',border:'1px solid rgba(59,130,246,.2)',borderRadius:10,padding:'20px 24px',marginBottom:20}}>
          <h3 style={{color:'#3b82f6',margin:'0 0 12px',fontSize:14}}>📋 Comment exporter depuis TradingView</h3>
          {[
            '1. Ouvrez votre graphique avec la stratégie ICT AutoBot ou NEXUS Pro',
            '2. Cliquez sur l\'onglet "Strategy Tester" en bas',
            '3. Cliquez sur le bouton ⬇️ "Export trade list to CSV"',
            '4. Importez le fichier CSV ici',
          ].map((s,i)=><p key={i} style={{color:'#94a3b8',fontSize:12,margin:'4px 0'}}>{s}</p>)}
        </div>
      )}

      {loading && <div style={{color:'#64748b',padding:40,textAlign:'center',fontSize:14}}>⏳ Analyse en cours...</div>}
      {error   && <div style={{color:'#ff4560',padding:16,background:'rgba(255,69,96,.1)',borderRadius:8,marginBottom:16}}>{error}</div>}

      {result && (
        <>
          {/* KPIs */}
          <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:16}}>
            {kpi('Total trades',   result.summary.totalTrades, '#94a3b8')}
            {kpi('Win Rate',       `${result.summary.winRate}%`,           result.summary.winRate>=50?'#00d97e':'#ff4560')}
            {kpi('Profit Factor',  result.summary.profitFactor,            result.summary.profitFactor>=1.5?'#00d97e':result.summary.profitFactor>=1?'#f5a623':'#ff4560')}
            {kpi('Net Profit',     `$${result.summary.netProfit}`,         result.summary.netProfit>=0?'#00d97e':'#ff4560')}
            {kpi('Max Drawdown',   `${result.summary.maxDrawdown}%`,       result.summary.maxDrawdown<=10?'#00d97e':result.summary.maxDrawdown<=20?'#f5a623':'#ff4560')}
            {kpi('Expectancy/trade',`$${result.summary.expectancy}`,       result.summary.expectancy>0?'#00d97e':'#ff4560')}
            {kpi('Gain moyen',     `$${result.summary.avgWin}`,            '#00d97e', `(${result.summary.winTrades} wins)`)}
            {kpi('Perte moyenne',  `-$${result.summary.avgLoss}`,          '#ff4560', `(${result.summary.lossTrades} losses)`)}
          </div>

          {/* Courbe d'équité */}
          <div style={{background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.08)',borderRadius:10,padding:'16px',marginBottom:12}}>
            <div style={{color:'#94a3b8',fontSize:11,fontWeight:700,letterSpacing:'.5px',textTransform:'uppercase',marginBottom:12}}>📈 Courbe d\'équité</div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={result.equityCurve}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B"/>
                <XAxis dataKey="date" tick={{fill:'#64748b',fontSize:10}} tickFormatter={d=>d.slice(5)}/>
                <YAxis tick={{fill:'#64748b',fontSize:10}} width={65} tickFormatter={v=>`$${v}`}/>
                <Tooltip contentStyle={tt} formatter={(v,n)=>[`$${v}`,n]}/>
                <Line type="monotone" dataKey="equity" stroke="#00d97e" strokeWidth={2} dot={false}/>
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Liste des trades */}
          {result.trades.length > 0 && (
            <div style={{background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.08)',borderRadius:10,overflow:'hidden'}}>
              <div style={{padding:'12px 16px',borderBottom:'1px solid rgba(255,255,255,.06)',color:'#94a3b8',fontSize:11,fontWeight:700}}>
                LISTE DES TRADES ({result.trades.length} affichés)
              </div>
              <div style={{overflowX:'auto',maxHeight:300}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,fontFamily:'var(--mono)'}}>
                  <thead>
                    <tr style={{background:'rgba(0,0,0,.2)'}}>{['Date','Type','Prix','Qté','P&L','P&L cumulé'].map(h=><th key={h} style={{padding:'7px 12px',textAlign:'left',color:'#64748b',fontSize:11,borderBottom:'1px solid rgba(255,255,255,.06)'}}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {result.trades.slice(0,100).map((t,i)=>(
                      <tr key={i} style={{borderBottom:'1px solid rgba(255,255,255,.04)'}}>
                        <td style={{padding:'6px 12px',color:'#64748b'}}>{t.date.slice(0,16)}</td>
                        <td style={{padding:'6px 12px',color:t.type?.includes('Entry')?'#3b82f6':'#94a3b8'}}>{t.type}</td>
                        <td style={{padding:'6px 12px'}}>{t.price.toFixed(5)}</td>
                        <td style={{padding:'6px 12px',color:'#94a3b8'}}>{t.contracts}</td>
                        <td style={{padding:'6px 12px',color:t.profit>=0?'#00d97e':'#ff4560',fontWeight:600}}>{t.profit>=0?'+':''}{t.profit.toFixed(2)}</td>
                        <td style={{padding:'6px 12px',color:t.cumProfit>=0?'#00d97e':'#ff4560'}}>{t.cumProfit.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// ACCOUNTS PAGE
// ════════════════════════════════════════════════════════════════
function AccountsPage({ token, accounts, setAccounts, activeAccount, setActiveAccount }) {
  const [form,   setForm]   = useState({ name:'',host:'demo.ctraderapi.com',accountId:'',clientId:'',secret:'',token:'',refresh:'',type:'demo',label:'',color:'#3b82f6' })
  const [showAdd,setShowAdd]= useState(false)
  const [msg,    setMsg]    = useState('')
  const hdr = {'Authorization':'Bearer '+token,'Content-Type':'application/json'}

  const loadAccounts = () =>
    fetch('/api/accounts',{headers:hdr}).then(r=>r.ok?r.json():null).then(d=>d&&setAccounts(d.accounts||[])).catch(()=>{})

  const addAccount = async () => {
    if (!form.name || !form.accountId || !form.clientId || !form.token) { setMsg('Remplissez tous les champs obligatoires'); return }
    const res = await fetch('/api/accounts',{method:'POST',headers:hdr,body:JSON.stringify(form)})
    const d   = await res.json()
    if (d.error) { setMsg(d.error); return }
    setMsg('✅ Compte ajouté !'); setShowAdd(false); loadAccounts()
  }

  const activate = async (id) => {
    await fetch(`/api/accounts/${id}/activate`,{method:'POST',headers:hdr})
    setActiveAccount(id)
    setMsg('✅ Compte activé')
    loadAccounts()
  }

  const remove = async (id) => {
    if (!confirm('Supprimer ce compte ?')) return
    await fetch(`/api/accounts/${id}`,{method:'DELETE',headers:hdr})
    loadAccounts()
  }

  const section = (children) => (
    <div style={{background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.08)',borderRadius:10,padding:'18px',marginBottom:14}}>
      {children}
    </div>
  )

  const inp = (label,key,placeholder='',type='text') => (
    <div style={{display:'flex',flexDirection:'column',gap:4}}>
      <label style={{color:'#64748b',fontSize:11}}>{label}</label>
      <input type={type} value={form[key]||''} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))} placeholder={placeholder}
        style={{padding:'6px 10px',borderRadius:6,background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.12)',color:'#e2e8f0',fontSize:12}}/>
    </div>
  )

  return (
    <div style={{paddingBottom:40,maxWidth:720}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
        <h2 style={{color:'#e2e8f0',margin:0,fontSize:18}}>🏦 Comptes FTMO</h2>
        <button onClick={()=>setShowAdd(!showAdd)} style={{padding:'6px 16px',borderRadius:6,fontSize:12,cursor:'pointer',background:'rgba(59,130,246,.2)',border:'1px solid #3b82f6',color:'#3b82f6',fontWeight:600}}>
          {showAdd?'✕ Annuler':'+ Ajouter compte'}
        </button>
      </div>

      {msg && <div style={{padding:'8px 16px',borderRadius:6,marginBottom:12,background:'rgba(0,217,126,.1)',border:'1px solid rgba(0,217,126,.3)',color:'#00d97e',fontSize:12}}>{msg}</div>}

      {/* Liste des comptes */}
      {accounts.map(acc=>(
        <div key={acc.id} style={{
          display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10,
          padding:'14px 18px',marginBottom:10,borderRadius:8,
          background:acc.id===activeAccount?'rgba(59,130,246,.1)':'rgba(255,255,255,.03)',
          border:`1px solid ${acc.id===activeAccount?'rgba(59,130,246,.4)':'rgba(255,255,255,.08)'}`,
        }}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:10,height:10,borderRadius:'50%',background:acc.connected?'#00d97e':'#ff4560'}}/>
            <div>
              <div style={{color:'#e2e8f0',fontWeight:600}}>{acc.name}</div>
              <div style={{color:'#64748b',fontSize:11,marginTop:2}}>{acc.host} · ID: {acc.accountId} · {acc.type==='live'?'🔴 LIVE':'Demo'}</div>
            </div>
          </div>
          <div style={{display:'flex',gap:8}}>
            {acc.id !== activeAccount && (
              <button onClick={()=>activate(acc.id)} style={{padding:'4px 14px',borderRadius:5,fontSize:12,cursor:'pointer',background:'rgba(59,130,246,.2)',border:'1px solid #3b82f6',color:'#3b82f6',fontWeight:600}}>
                Activer
              </button>
            )}
            {acc.id === activeAccount && <span style={{color:'#3b82f6',fontSize:12,fontWeight:600,padding:'4px 0'}}>✅ Actif</span>}
            {acc.id !== 'default' && (
              <button onClick={()=>remove(acc.id)} style={{padding:'4px 10px',borderRadius:5,fontSize:12,cursor:'pointer',background:'rgba(255,69,96,.1)',border:'1px solid rgba(255,69,96,.3)',color:'#ff4560'}}>✕</button>
            )}
          </div>
        </div>
      ))}

      {/* Formulaire ajout */}
      {showAdd && section(
        <>
          <h3 style={{color:'#e2e8f0',margin:'0 0 16px',fontSize:14}}>Nouveau compte FTMO</h3>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
            {inp('Nom du compte *','name','Ex: FTMO Challenge 10k')}
            {inp('Label','label','Challenge / Funded')}
            <div style={{display:'flex',flexDirection:'column',gap:4}}>
              <label style={{color:'#64748b',fontSize:11}}>Type</label>
              <select value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value,host:e.target.value==='live'?'live.ctraderapi.com':'demo.ctraderapi.com'}))}
                style={{padding:'6px 10px',borderRadius:6,background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.12)',color:'#e2e8f0',fontSize:12}}>
                <option value="demo">Demo (Challenge)</option>
                <option value="live">Live (Funded)</option>
              </select>
            </div>
            {inp('Account ID *','accountId','46790097')}
            {inp('Client ID *','clientId','23937_aYYGSZ...')}
            {inp('Client Secret *','secret','oh3FyGW...')}
            {inp('Access Token *','token','DiWYRq...')}
            {inp('Refresh Token','refresh','(recommandé)')}
          </div>
          <button onClick={addAccount} style={{padding:'7px 20px',borderRadius:6,fontSize:12,cursor:'pointer',fontWeight:600,background:'rgba(0,217,126,.2)',border:'1px solid #00d97e',color:'#00d97e'}}>
            ✅ Ajouter ce compte
          </button>
        </>
      )}

      {section(
        <>
          <h3 style={{color:'#94a3b8',margin:'0 0 10px',fontSize:12,fontWeight:700,letterSpacing:'.5px',textTransform:'uppercase'}}>💡 Fonctionnement multi-compte</h3>
          <p style={{color:'#64748b',fontSize:12,margin:'0 0 6px'}}>Chaque compte FTMO a ses propres credentials cTrader. Vous pouvez switcher d\'un compte à l\'autre depuis le header du dashboard.</p>
          <p style={{color:'#64748b',fontSize:12,margin:0}}>Cas d\'usage typique : <span style={{color:'#94a3b8'}}>un compte Challenge 10k + un compte Funded 100k</span>. Les ordres auto vont toujours sur le compte actif.</p>
        </>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// ANALYTICS PAGE (inchangé, condensé)
// ════════════════════════════════════════════════════════════════
function AnalyticsPage({ token }) {
  const [data,setData]=useState(null); const [days,setDays]=useState(30)
  const hdr={'Authorization':'Bearer '+token}
  useEffect(()=>{fetch(`/api/analytics?days=${days}`,{headers:hdr}).then(r=>r.ok?r.json():null).then(d=>setData(d)).catch(()=>{});},[days])
  if(!data) return <div style={{color:'#64748b',padding:40,textAlign:'center'}}>Chargement...</div>
  const card=(children,title,flex='1 1 340px')=>(
    <div style={{flex,minWidth:280,background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.08)',borderRadius:10,padding:'16px',marginBottom:12}}>
      {title&&<div style={{color:'#94a3b8',fontSize:11,fontWeight:700,letterSpacing:'.5px',textTransform:'uppercase',marginBottom:12}}>{title}</div>}
      {children}
    </div>
  )
  return (
    <div style={{paddingBottom:40}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
        <h2 style={{color:'#e2e8f0',margin:0,fontSize:18}}>📊 Analytics — {data.totalSignals} signaux</h2>
        <div style={{display:'flex',gap:6}}>{[7,14,30,60].map(d=><button key={d} onClick={()=>setDays(d)} style={{padding:'4px 12px',borderRadius:6,fontSize:12,cursor:'pointer',background:days===d?'rgba(59,130,246,.25)':'rgba(255,255,255,.05)',border:`1px solid ${days===d?'#3b82f6':'rgba(255,255,255,.1)'}`,color:days===d?'#3b82f6':'#94a3b8'}}>{d}j</button>)}</div>
      </div>
      <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:16}}>
        {[{l:'Total',v:data.totalSignals,c:'#94a3b8'},{l:'Auto OK',v:`${data.autoOkTotal} (${data.autoOkRate}%)`,c:'#00d97e'}].map(k=>(
          <div key={k.l} style={{flex:'1 1 150px',background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.08)',borderRadius:8,padding:'12px 16px'}}>
            <div style={{fontSize:22,fontWeight:700,color:k.c,fontFamily:'var(--mono)'}}>{k.v}</div>
            <div style={{fontSize:11,color:'#64748b',marginTop:4}}>{k.l}</div>
          </div>
        ))}
      </div>
      <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
        {card(<ResponsiveContainer width="100%" height={200}><LineChart data={data.equityCurve}><CartesianGrid strokeDasharray="3 3" stroke="#1E293B"/><XAxis dataKey="date" tick={{fill:'#64748b',fontSize:10}} tickFormatter={d=>d.slice(5)}/><YAxis tick={{fill:'#64748b',fontSize:10}} width={65} tickFormatter={v=>`$${v.toLocaleString()}`}/><Tooltip contentStyle={tt}/><Line type="monotone" dataKey="equity" stroke="#00d97e" strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer>,'💹 Capital simulé','1 1 100%')}
        {card(<ResponsiveContainer width="100%" height={180}><BarChart data={data.rrDistribution} barSize={28}><CartesianGrid strokeDasharray="3 3" stroke="#1E293B"/><XAxis dataKey="range" tick={{fill:'#64748b',fontSize:11}}/><YAxis tick={{fill:'#64748b',fontSize:10}}/><Tooltip contentStyle={tt}/><Bar dataKey="count" radius={[4,4,0,0]}>{data.rrDistribution.map((_,i)=><Cell key={i} fill={i<2?'#ff4560':i<4?'#f5a623':'#00d97e'}/>)}</Bar></BarChart></ResponsiveContainer>,'📐 Distribution R:R')}
        {card(<div><div style={{display:'grid',gridTemplateColumns:'repeat(24,1fr)',gap:2}}>{data.hourData.map(h=>{const intensity=Math.min(1,h.count/Math.max(...data.hourData.map(x=>x.count),1));const isActive=h.hour>=7&&h.hour<12||h.hour>=13&&h.hour<17;return<div key={h.hour} title={`${h.hour}h UTC — ${h.count} signaux`} style={{aspectRatio:'1',borderRadius:3,background:isActive?`rgba(0,217,126,${0.15+intensity*0.75})`:`rgba(255,255,255,${intensity*0.2})`}}/>})}</div><div style={{marginTop:8,fontSize:10,color:'#64748b'}}>0h ─── 23h UTC | <span style={{color:'#00d97e'}}>■ London/NY</span></div></div>,'🕐 Heatmap par heure')}
        {card(<ResponsiveContainer width="100%" height={220}><BarChart data={data.topPairs} layout="vertical" barSize={10}><CartesianGrid strokeDasharray="3 3" stroke="#1E293B"/><XAxis type="number" tick={{fill:'#64748b',fontSize:10}}/><YAxis type="category" dataKey="pair" tick={{fill:'#94a3b8',fontSize:11}} width={55}/><Tooltip contentStyle={tt}/><Bar dataKey="autoOk" fill="#00d97e" name="Auto OK" stackId="a"/><Bar dataKey="total" fill="#1E293B" name="Total" stackId="b"/></BarChart></ResponsiveContainer>,'🏆 Top paires')}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// JOURNAL PAGE (condensé)
// ════════════════════════════════════════════════════════════════
function JournalPage({ token }) {
  const [entries,setEntries]=useState([]); const [stats,setStats]=useState(null); const [editing,setEditing]=useState(null); const [editData,setEditData]=useState({})
  const hdr={'Authorization':'Bearer '+token,'Content-Type':'application/json'}
  const load=()=>fetch('/api/journal',{headers:hdr}).then(r=>r.ok?r.json():null).then(d=>{if(d){setEntries(d.entries||[]);setStats(d.stats||null)}}).catch(()=>{})
  useEffect(()=>{load()},[])
  const saveEdit=async(id)=>{await fetch(`/api/journal/${id}`,{method:'PUT',headers:hdr,body:JSON.stringify(editData)});setEditing(null);load()}
  const oc=o=>o==='win'?'#00d97e':o==='loss'?'#ff4560':o==='be'?'#f5a623':'#64748b'
  const ol=o=>o==='win'?'✅ Win':o==='loss'?'❌ Loss':o==='be'?'➡️ BE':'—'
  return (
    <div style={{paddingBottom:40}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
        <h2 style={{color:'#e2e8f0',margin:0,fontSize:18}}>📓 Journal de trading</h2>
        <button onClick={()=>{const a=document.createElement('a');a.href='/api/journal/export/csv';a.download=`journal_${new Date().toISOString().slice(0,10)}.csv`;a.click()}} style={{padding:'6px 16px',borderRadius:6,fontSize:12,cursor:'pointer',background:'rgba(59,130,246,.15)',border:'1px solid rgba(59,130,246,.3)',color:'#3b82f6',fontWeight:600}}>⬇️ Export CSV</button>
      </div>
      {stats&&<div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:16}}>{[{l:'Exécutés',v:stats.executed,c:'#94a3b8'},{l:'Wins',v:stats.wins,c:'#00d97e'},{l:'Losses',v:stats.losses,c:'#ff4560'},{l:'Winrate',v:`${stats.winRate}%`,c:stats.winRate>=50?'#00d97e':'#ff4560'},{l:'P&L',v:`$${stats.totalPnl}`,c:stats.totalPnl>=0?'#00d97e':'#ff4560'}].map(k=><div key={k.l} style={{flex:'1 1 100px',background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.08)',borderRadius:8,padding:'10px 14px'}}><div style={{fontSize:18,fontWeight:700,color:k.c,fontFamily:'var(--mono)'}}>{k.v}</div><div style={{fontSize:10,color:'#64748b',marginTop:3}}>{k.l}</div></div>)}</div>}
      <div style={{background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.08)',borderRadius:10,overflow:'hidden'}}>
        <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
          <thead><tr style={{background:'rgba(0,0,0,.25)'}}>{['Date','Paire','Dir.','Lots','Entry','R:R','Score','Outcome','P&L','Notes',''].map(h=><th key={h} style={{padding:'9px 12px',textAlign:'left',color:'#64748b',fontWeight:600,fontSize:11,borderBottom:'1px solid rgba(255,255,255,.08)'}}>{h}</th>)}</tr></thead>
          <tbody>{entries.length===0?<tr><td colSpan={11} style={{padding:24,textAlign:'center',color:'#64748b'}}>Aucun trade enregistré — les ordres auto sont loggés automatiquement</td></tr>:entries.map((e,i)=>(
            <tr key={e.id} style={{borderBottom:'1px solid rgba(255,255,255,.04)',background:i%2===0?'transparent':'rgba(255,255,255,.01)'}}>
              <td style={{padding:'7px 12px',color:'#64748b',fontSize:10,fontFamily:'var(--mono)'}}>{new Date(e.executedAt).toLocaleDateString('fr-FR')}</td>
              <td style={{padding:'7px 12px',color:'#e2e8f0',fontWeight:600}}>{e.pair}</td>
              <td style={{padding:'7px 12px',color:e.action==='BUY'?'#00d97e':'#ff4560',fontWeight:700}}>{e.action==='BUY'?'▲':'▼'}</td>
              <td style={{padding:'7px 12px',fontFamily:'var(--mono)'}}>{e.lots}L</td>
              <td style={{padding:'7px 12px',fontFamily:'var(--mono)',fontSize:11}}>{e.entryPrice||'—'}</td>
              <td style={{padding:'7px 12px',color:'#f5a623'}}>{e.rr?`1:${e.rr}`:'—'}</td>
              <td style={{padding:'7px 12px'}}>{e.score?<span style={{color:e.score>=80?'#00d97e':e.score>=60?'#f5a623':'#ff4560',fontFamily:'var(--mono)',fontWeight:600}}>{e.score}</span>:'—'}</td>
              <td style={{padding:'7px 12px'}}>{editing===e.id?<select value={editData.outcome||''} onChange={ev=>setEditData(p=>({...p,outcome:ev.target.value}))} style={{background:'#1E293B',border:'1px solid #334155',color:'#e2e8f0',borderRadius:4,padding:'2px 4px',fontSize:11}}><option value="">—</option><option value="win">✅ Win</option><option value="loss">❌ Loss</option><option value="be">➡️ BE</option></select>:<span style={{color:oc(e.outcome),fontWeight:600,fontSize:11}}>{ol(e.outcome)}</span>}</td>
              <td style={{padding:'7px 12px'}}>{editing===e.id?<input type="number" value={editData.pnlUSD||''} onChange={ev=>setEditData(p=>({...p,pnlUSD:ev.target.value}))} style={{width:70,background:'#1E293B',border:'1px solid #334155',color:'#e2e8f0',borderRadius:4,padding:'2px 6px',fontSize:11}}/>:<span style={{color:e.pnlUSD>0?'#00d97e':e.pnlUSD<0?'#ff4560':'#64748b',fontFamily:'var(--mono)',fontWeight:600}}>{e.pnlUSD!==null?`$${e.pnlUSD}`:'—'}</span>}</td>
              <td style={{padding:'7px 12px',maxWidth:160}}>{editing===e.id?<input value={editData.notes||''} onChange={ev=>setEditData(p=>({...p,notes:ev.target.value}))} style={{width:'100%',background:'#1E293B',border:'1px solid #334155',color:'#e2e8f0',borderRadius:4,padding:'2px 6px',fontSize:11}}/>:<span style={{color:'#64748b',fontSize:11}}>{e.notes||'—'}</span>}</td>
              <td style={{padding:'7px 12px'}}>{editing===e.id?<><button onClick={()=>saveEdit(e.id)} style={{padding:'2px 8px',borderRadius:4,fontSize:11,background:'rgba(0,217,126,.2)',border:'1px solid #00d97e',color:'#00d97e',cursor:'pointer',marginRight:4}}>✓</button><button onClick={()=>setEditing(null)} style={{padding:'2px 8px',borderRadius:4,fontSize:11,background:'rgba(255,69,96,.1)',border:'1px solid #ff4560',color:'#ff4560',cursor:'pointer'}}>✗</button></>:<button onClick={()=>{setEditing(e.id);setEditData({notes:e.notes||'',outcome:e.outcome||'',pnlUSD:e.pnlUSD||''})}} style={{padding:'2px 8px',borderRadius:4,fontSize:11,background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.15)',color:'#94a3b8',cursor:'pointer'}}>✏️</button>}</td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ════════════════════════════════════════════════════════════════
function Dashboard({ token, onLogout }) {
  const [tab,        setTab]        = useState('dashboard')
  const [states,     setStates]     = useState(()=>{const s={};PAIRS.forEach(p=>{s[p]=empty(p)});return s})
  const [history,    setHistory]    = useState([])
  const [strategies, setStrategies] = useState([])
  const [activeStrat,setActiveStrat]= useState(null)
  const [wsStatus,   setWs]         = useState('connecting')
  const [ctrader,    setCtrader]    = useState(null)
  const [filter,     setFilter]     = useState('ALL')
  const [autoMode,   setAutoMode]   = useState(true)
  const [stratModes, setStratModes] = useState({})
  const [positions,  setPositions]  = useState([])
  const [accounts,   setAccounts]   = useState([])
  const [activeAcc,  setActiveAcc]  = useState(null)
  const wsRef = useRef(null)
  const push  = usePush()
  const hdr   = {'Authorization':'Bearer '+token}

  useEffect(()=>{
    fetch('/api/automode',{headers:hdr}).then(r=>r.ok?r.json():null).then(d=>{if(d){setAutoMode(d.autoMode);setStratModes(d.strategyModes||{})}}).catch(()=>{})
    fetch('/api/positions',{headers:hdr}).then(r=>r.ok?r.json():null).then(d=>d&&setPositions(d.positions||[])).catch(()=>{})
    fetch('/api/accounts',{headers:hdr}).then(r=>r.ok?r.json():null).then(d=>{if(d){setAccounts(d.accounts||[]);setActiveAcc(d.activeId)}}).catch(()=>{})
  },[])

  const loadStrategies=useCallback(async()=>{
    try{const r=await fetch('/api/strategies',{headers:hdr});if(r.status===401){onLogout();return}
    const strats=await r.json();setStrategies(strats);const a=strats.find(s=>s.active)||strats[0];if(a)setActiveStrat(a.id);return a}catch{}
  },[token])
  const loadPairs=useCallback(async(id)=>{if(!id)return;try{const r=await fetch(`/api/states?strategy=${id}`,{headers:hdr});if(r.ok)setStates(await r.json())}catch{}},[token])
  const loadHistory=useCallback(async(id)=>{if(!id)return;try{const r=await fetch(`/api/history?strategy=${id}&limit=50`,{headers:hdr});if(r.ok)setHistory(await r.json())}catch{}},[token])
  const switchStrategy=useCallback(async(id)=>{setActiveStrat(id);const s={};PAIRS.forEach(p=>{s[p]=empty(p)});setStates(s);setHistory([]);setFilter('ALL');await loadPairs(id);await loadHistory(id)},[loadPairs,loadHistory])

  const connectWS=useCallback(()=>{
    const ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${window.location.host}/ws?token=${encodeURIComponent(token)}`)
    wsRef.current=ws
    ws.onopen=()=>setWs('connected')
    ws.onclose=()=>{setWs('disconnected');setTimeout(connectWS,4000)}
    ws.onerror=()=>setWs('error')
    ws.onmessage=e=>{
      try{
        const m=JSON.parse(e.data)
        if(m.type==='init'){setStates(m.states||{});setHistory(m.history||[]);if(m.strategies)setStrategies(m.strategies);if(m.activeStrat)setActiveStrat(m.activeStrat.id);if(typeof m.autoMode==='boolean')setAutoMode(m.autoMode);if(m.strategyAutoModes)setStratModes(m.strategyAutoModes);if(m.accounts)setAccounts(m.accounts);if(m.activeAccount)setActiveAcc(m.activeAccount)}
        if(m.type==='signal'&&m.stratId)setActiveStrat(prev=>{if(m.stratId===prev)setStates(p=>({...p,[m.state.pair]:m.state}));return prev})
        if(m.type==='strategy_changed'){setStrategies(m.strategies||[]);const a=m.strategies?.find(s=>s.active);if(a)switchStrategy(a.id)}
        if(m.type==='new_signal')setHistory(prev=>[m.entry,...prev].slice(0,50))
        if(m.type==='pairs_reset')setActiveStrat(prev=>{if(m.stratId===prev){const s={};PAIRS.forEach(p=>{s[p]=empty(p)});setStates(s)}return prev})
        if(m.type==='automode_changed')setAutoMode(m.autoMode)
        if(m.type==='strat_automode_changed')setStratModes(prev=>({...prev,[m.stratId]:{enabled:m.enabled,reason:m.reason}}))
        if(m.type==='positions_update')setPositions(m.positions||[])
        if(m.type==='account_changed'){setActiveAcc(m.accountId);fetch('/api/accounts',{headers:hdr}).then(r=>r.ok?r.json():null).then(d=>d&&setAccounts(d.accounts||[])).catch(()=>{})}
        if(m.type==='push_event')push.send(m.title,m.body)
        if(m.type==='drawdown_alert')push.send(`🚨 Drawdown Alert`,`${m.alertType}: ${m.dailyDD||m.totalDD}%`)
      }catch{}
    }
  },[token,switchStrategy,push])

  useEffect(()=>{
    const init=async()=>{const a=await loadStrategies();if(a){await loadPairs(a.id);await loadHistory(a.id)}connectWS()}
    init()
    const poll=setInterval(()=>fetch('/api/ctrader',{headers:hdr}).then(r=>r.status===401?onLogout():r.json()).then(d=>d&&setCtrader(d)).catch(()=>{}),6000)
    return()=>{wsRef.current?.close();clearInterval(poll)}
  },[])

  const all=Object.values(states), getAction=s=>s.ltf?.action||s.htf?.action||s.htf?.direction||s.direction
  const sorted=PAIRS.map(p=>states[p]||empty(p)).filter(s=>{const a=getAction(s);if(filter==='BUY')return a==='BUY';if(filter==='SELL')return a==='SELL';if(filter==='SIGNAL')return s.hasSignal;if(filter==='LTF')return!!s.ltf;return true}).sort((a,b)=>{if(a.ltf&&!b.ltf)return-1;if(!a.ltf&&b.ltf)return 1;return Math.max(b.htf?.prob||0,b.ltf?.prob||0)-Math.max(a.htf?.prob||0,a.ltf?.prob||0)})

  const activeColor=strategies.find(s=>s.id===activeStrat)?.color||'#3b82f6'
  const wsColor={connected:'#00d97e',disconnected:'#ff4560',connecting:'#f5a623',error:'#ff4560'}[wsStatus]||'#64748b'
  const ctColor=ctrader?.ready?'#00d97e':ctrader?.simMode?'#f5a623':'#ff4560'

  const tabs=[{id:'dashboard',l:'📈 Dashboard'},{id:'analytics',l:'📊 Analytics'},{id:'backtest',l:'🔬 Backtest'},{id:'journal',l:'📓 Journal'},{id:'accounts',l:'🏦 Comptes'}]

  const hBadge=h=>{
    if(h.signal==='SIGNAL_TRES_FORT_15M')return{cls:'ltf',txt:'⚡ '+(h.entry_type||'15M')}
    if(h.signal?.startsWith('NEXUS'))return{cls:'ltf',txt:'🔵 NEXUS'}
    if(h.quality==='EXCELLENT')return{cls:'exc',txt:'EXCELLENT'}
    if(h.quality==='BON')return{cls:'bon',txt:'BON'}
    return{cls:'def',txt:h.quality||'—'}
  }

  return (
    <div className="app">
      {/* HEADER */}
      <div className="hdr">
        <div className="hdr-brand">
          <div className="hdr-logo" style={{background:`linear-gradient(135deg,${activeColor}88,${activeColor})`}}>FX</div>
          <div><div className="hdr-title">ICT Trading Dashboard</div><div className="hdr-sub">FTMO · cTrader · 28 paires Forex</div></div>
        </div>
        <div className="hdr-right">
          <HeaderPanel token={token} autoMode={autoMode} setAutoMode={setAutoMode} accounts={accounts} activeAccount={activeAcc} setActiveAccount={setActiveAcc}/>
          <div className="badge" style={{borderColor:wsColor,color:wsColor}}><div className="dot" style={{background:wsColor}}/>{wsStatus}</div>
          <div className="badge" style={{borderColor:ctColor,color:ctColor}}><div className="dot" style={{background:ctColor}}/>{ctrader?.ready?`cTrader ${ctrader.mode==='demo'?'Demo':'Live'}`:ctrader?.simMode?'Simulation':'cTrader ✗'}</div>
          <button onClick={onLogout} style={{padding:'4px 12px',borderRadius:6,background:'rgba(255,69,96,.1)',border:'1px solid rgba(255,69,96,.3)',color:'#ff4560',fontSize:11,cursor:'pointer'}}>Déconnexion</button>
        </div>
      </div>

      {/* TABS NAV */}
      <div style={{display:'flex',gap:3,marginBottom:14,borderBottom:'1px solid rgba(255,255,255,.07)'}}>
        {tabs.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{padding:'7px 16px',borderRadius:'6px 6px 0 0',fontSize:12,cursor:'pointer',fontWeight:600,border:'1px solid rgba(255,255,255,.07)',borderBottom:'none',background:tab===t.id?'rgba(255,255,255,.05)':'transparent',color:tab===t.id?'#e2e8f0':'#64748b',borderBottom:tab===t.id?`2px solid ${activeColor}`:'2px solid transparent'}}>{t.l}</button>)}
      </div>

      {/* TAB CONTENT */}
      {tab==='dashboard' && (
        <>
          {!autoMode&&<div style={{background:'rgba(255,69,96,.08)',border:'1px solid rgba(255,69,96,.25)',borderRadius:8,padding:'10px 18px',marginBottom:12,color:'#ff4560',fontSize:13,fontWeight:600}}>🔴 AutoBot global désactivé</div>}
          <DrawdownPanel token={token}/>
          <StrategyAutoModes token={token} strategies={strategies} stratModes={stratModes} setStratModes={setStratModes}/>
          {strategies.length>0&&<StrategyManager strategies={strategies} activeStratId={activeStrat} token={token} onActivate={switchStrategy} onUpdate={async()=>{await loadStrategies();if(activeStrat)loadPairs(activeStrat)}}/>}
          <PositionsPanel token={token} positions={positions}/>
          <div className="stats">
            {[{val:all.filter(s=>getAction(s)==='BUY').length,lbl:'BUY actifs',color:'#00d97e',bc:'rgba(0,217,126,.15)'},{val:all.filter(s=>getAction(s)==='SELL').length,lbl:'SELL actifs',color:'#ff4560',bc:'rgba(255,69,96,.15)'},{val:all.filter(s=>s.ltf).length,lbl:'⚡ Très fort 15M',color:'#f5a623',bc:'rgba(245,166,35,.15)'},{val:all.filter(s=>s.hasSignal).length,lbl:'Total signaux',color:'#94a3b8',bc:'rgba(255,255,255,.06)'}].map(s=><div key={s.lbl} className="stat-card" style={{borderColor:s.bc}}><span className="stat-val" style={{color:s.color}}>{s.val}</span><span className="stat-lbl">{s.lbl}</span></div>)}
          </div>
          <div className="filters">
            {[{k:'ALL',l:'Toutes'},{k:'SIGNAL',l:'Signaux actifs'},{k:'LTF',l:'⚡ 15M'},{k:'BUY',l:'▲ BUY'},{k:'SELL',l:'▼ SELL'}].map(f=><button key={f.k} className={`filter-btn ${filter===f.k?'active':''}`} onClick={()=>setFilter(f.k)}>{f.l}</button>)}
            <button className="filter-btn test-btn" onClick={()=>fetch(`/api/test?strategy=${activeStrat}`,{headers:hdr}).then(()=>loadPairs(activeStrat))}>◎ Test</button>
          </div>
          <div className="section-title" style={{color:activeColor}}>{strategies.find(s=>s.id===activeStrat)?.name||'Paires'} — {sorted.filter(s=>s.hasSignal).length} actifs</div>
          <div className="grid">{sorted.map(s=><PairTile key={s.pair} state={s}/>)}</div>
          {history.length>0&&<div className="history-wrap">
            <div className="history-head">Historique</div>
            <table className="htable"><thead><tr><th>Paire</th><th>Action</th><th>TF</th><th>Entry</th><th>SL</th><th>TP</th><th>R:R</th><th>Score</th><th>Type</th><th>Heure</th></tr></thead>
            <tbody>{history.slice(0,20).map((h,i)=>{const b=hBadge(h);return<tr key={i}><td style={{fontWeight:600,color:'#e2e8f0'}}>{h.pair}</td><td className={h.action==='BUY'?'h-buy':'h-sell'}>{h.action}</td><td style={{color:'#64748b'}}>{h.tf}M</td><td style={{fontFamily:'var(--mono)',fontSize:11}}>{h.price}</td><td style={{color:'#ff4560',fontFamily:'var(--mono)',fontSize:11}}>{h.sl}</td><td style={{color:'#00d97e',fontFamily:'var(--mono)',fontSize:11}}>{h.tp_reel||h.tp}</td><td style={{color:'#f5a623'}}>{h.rr_reel?`1:${h.rr_reel}`:'—'}</td><td>{h.score?<span style={{color:h.score>=80?'#00d97e':h.score>=60?'#f5a623':'#ff4560',fontFamily:'var(--mono)',fontWeight:600}}>{h.score}/100</span>:'—'}</td><td><span className={`h-badge ${b.cls}`}>{b.txt}</span></td><td style={{color:'#64748b'}}>{h.receivedAt?new Date(h.receivedAt).toLocaleTimeString('fr-FR'):''}</td></tr>})}</tbody>
            </table>
          </div>}
        </>
      )}
      {tab==='analytics' && <AnalyticsPage token={token}/>}
      {tab==='backtest'  && <BacktestPage  token={token}/>}
      {tab==='journal'   && <JournalPage   token={token}/>}
      {tab==='accounts'  && <AccountsPage  token={token} accounts={accounts} setAccounts={setAccounts} activeAccount={activeAcc} setActiveAccount={setActiveAcc}/>}
    </div>
  )
}

export default function App() {
  const [token,setToken]=useState(()=>localStorage.getItem('ict_token')||null)
  const logout=()=>{localStorage.removeItem('ict_token');setToken(null)}
  if(!token)return<Login onAuth={setToken}/>
  return<Dashboard token={token} onLogout={logout}/>
}
