import { useState, useEffect, useRef, useCallback } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import PairTile from './components/PairTile'
import Login from './components/Login'
import StrategyManager from './components/StrategyManager'
import './App.css'


// ── Version injectée au build par Vite (VITE_APP_VERSION=vX.X.X) ──
const APP_VERSION = import.meta.env.VITE_APP_VERSION || 'dev'

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
    <div
      data-testid="header-panel"
      style={{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}}>

      {/* Sélecteur de compte */}
      {accounts.length > 1 && (
        <select
          data-testid="account-selector"
          value={activeAccount||''}
          onChange={e=>switchAccount(e.target.value)}
          style={{padding:'4px 8px',borderRadius:6,background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.15)',color:'#e2e8f0',fontSize:12,cursor:'pointer'}}>
          {accounts.map(a=>(
            <option
              data-testid={`account-option-${a.id}`}
              key={a.id}
              value={a.id}
              style={{background:'#0F172A'}}>
              {a.name} {a.connected?'✅':'⚠️'}
            </option>
          ))}
        </select>
      )}

      {/* Balance + drawdown */}
      {balance?.balance != null && (
        <div
          data-testid="balance-display"
          style={{display:'flex',alignItems:'center',gap:'6px',padding:'4px 10px',borderRadius:6,background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)',fontSize:11,fontFamily:'var(--mono)'}}>
          <span style={{color:'#f5a623'}}>💰</span>
          <span
            data-testid="balance-amount"
            style={{color:'#e2e8f0',fontWeight:600}}>${balance.balance.toLocaleString('fr-FR',{maximumFractionDigits:0})}</span>
          <span style={{color:'#334155'}}>|</span>
          <span style={{color:'#94a3b8'}}>{balance.riskPercent}%=<span
            data-testid="balance-risk-usd"
            style={{color:'#00d97e',fontWeight:600}}>${balance.riskUSD}</span></span>
          {balance.dailyDD != null && (
            <>
              <span style={{color:'#334155'}}>|</span>
              <span
                data-testid="drawdown-badge"
                style={{color:ddColor,fontWeight:600}}>DD {balance.dailyDD}%</span>
            </>
          )}
          <span style={{color:'#334155'}}>|</span>
          <span
            data-testid="open-trades-counter"
            style={{color:balance.openTrades>=balance.maxOpenTrades?'#ff4560':'#94a3b8'}}>
            <span style={{color:balance.openTrades>=balance.maxOpenTrades?'#ff4560':'#00d97e',fontWeight:600}}>{balance.openTrades}/{balance.maxOpenTrades}</span>
          </span>
        </div>
      )}

      {/* AutoBot global */}
      <button
        data-testid="autobot-toggle-btn"
        onClick={toggle}
        disabled={loading}
        style={{
          display:'flex',alignItems:'center',gap:'6px',padding:'5px 14px',borderRadius:6,
          border:`1.5px solid ${autoMode?'#00d97e':'#ff4560'}`,
          background:autoMode?'rgba(0,217,126,.12)':'rgba(255,69,96,.12)',
          color:autoMode?'#00d97e':'#ff4560',cursor:'pointer',fontWeight:700,fontSize:12,fontFamily:'var(--sans)',whiteSpace:'nowrap',
        }}>
        🤖 AutoBot{' '}
        <span
          data-testid="autobot-status"
          style={{padding:'1px 6px',borderRadius:4,background:autoMode?'rgba(0,217,126,.25)':'rgba(255,69,96,.25)',fontSize:10,fontWeight:800}}>
          {autoMode?'● ON':'● OFF'}
        </span>
      </button>
    </div>
  )
}

// ── Positions panel ───────────────────────────────────────────────
function PositionsPanel({ token, positions }) {
  const [exp,setExp] = useState(true)
  const hdr = {'Authorization':'Bearer '+token}
  const fmt = ts => { if(!ts)return'—'; const ms=Date.now()-new Date(ts).getTime(),m=Math.floor(ms/60000),h=Math.floor(m/60),d=Math.floor(h/24); return d>0?`${d}j ${h%24}h`:h>0?`${h}h ${m%60}m`:`${m}m` }
  if(!positions?.length) return (
    <div
      data-testid="positions-panel-empty"
      style={{margin:'0 0 12px',padding:'10px 16px',borderRadius:8,background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.07)',color:'#64748b',fontSize:12}}>
      📊 Aucune position ouverte
    </div>
  )
  return (
    <div
      data-testid="positions-panel"
      style={{margin:'0 0 12px',borderRadius:8,background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.1)',overflow:'hidden'}}>
      <div
        data-testid="positions-toggle"
        style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 16px',cursor:'pointer',borderBottom:exp?'1px solid rgba(255,255,255,.06)':'none'}}
        onClick={()=>setExp(!exp)}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{color:'#f5a623'}}>📊</span>
          <span style={{color:'#e2e8f0',fontWeight:600,fontSize:13}}>Positions ouvertes</span>
          <span
            data-testid="positions-count"
            style={{padding:'1px 8px',borderRadius:10,background:'rgba(245,166,35,.2)',color:'#f5a623',fontSize:11,fontWeight:700}}>{positions.length}</span>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button
            data-testid="positions-refresh-btn"
            onClick={e=>{e.stopPropagation();fetch('/api/positions/refresh',{method:'POST',headers:hdr})}}
            style={{padding:'2px 8px',borderRadius:4,fontSize:11,border:'1px solid rgba(255,255,255,.15)',background:'rgba(255,255,255,.05)',color:'#94a3b8',cursor:'pointer'}}>↻</button>
          <span style={{color:'#64748b',fontSize:12}}>{exp?'▲':'▼'}</span>
        </div>
      </div>
      {exp && (
        <div style={{overflowX:'auto'}}>
          <table
            data-testid="positions-table"
            style={{width:'100%',borderCollapse:'collapse',fontSize:12,fontFamily:'var(--mono)'}}>
            <thead>
              <tr style={{background:'rgba(0,0,0,.2)'}}>
                {['Paire','Dir.','Lots','Entry','SL','TP','Durée'].map(h=>(
                  <th key={h} style={{padding:'7px 12px',textAlign:'left',color:'#64748b',fontWeight:600,fontSize:11,borderBottom:'1px solid rgba(255,255,255,.06)'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {positions.map((p,i)=>(
                <tr
                  data-testid={`position-row-${p.positionId}`}
                  key={p.positionId}
                  style={{borderBottom:'1px solid rgba(255,255,255,.04)',background:i%2===0?'transparent':'rgba(255,255,255,.01)'}}>
                  <td style={{padding:'7px 12px',color:'#e2e8f0',fontWeight:600}}>{p.symbol}</td>
                  <td style={{padding:'7px 12px',color:p.side==='BUY'?'#00d97e':'#ff4560',fontWeight:700}}>{p.side==='BUY'?'▲':'▼'} {p.side}</td>
                  <td style={{padding:'7px 12px',color:'#94a3b8'}}>{p.lots}L</td>
                  <td style={{padding:'7px 12px'}}>{p.openPrice?.toFixed(5)||'—'}</td>
                  <td style={{padding:'7px 12px',color:'#ff4560'}}>{p.stopLoss?.toFixed(5)||'—'}</td>
                  <td style={{padding:'7px 12px',color:'#00d97e'}}>{p.takeProfit?.toFixed(5)||'—'}</td>
                  <td style={{padding:'7px 12px',color:'#64748b'}}>{fmt(p.openTime)}</td>
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
    <div
      data-testid="strat-automodes-panel"
      style={{display:'flex',gap:8,flexWrap:'wrap',padding:'10px 16px',marginBottom:12,background:'rgba(255,255,255,.03)',borderRadius:8,border:'1px solid rgba(255,255,255,.08)'}}>
      <span style={{color:'#64748b',fontSize:11,fontWeight:700,alignSelf:'center',marginRight:4}}>AUTOBOT PAR STRATÉGIE :</span>
      {strategies.map(strat => {
        const am = stratModes[strat.id] || { enabled: true }
        return (
          <button
            data-testid={`strat-automode-btn-${strat.id}`}
            key={strat.id}
            onClick={() => toggle(strat.id, am.enabled)}
            style={{
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
    <div
      data-testid="drawdown-panel"
      style={{display:'flex',gap:12,padding:'10px 16px',marginBottom:12,background:'rgba(255,255,255,.03)',borderRadius:8,border:`1px solid ${color}33`,flexWrap:'wrap'}}>
      <span style={{color:'#64748b',fontSize:11,fontWeight:700,alignSelf:'center'}}>📉 DRAWDOWN :</span>
      {[
        {label:'Journalier', pct:pctDay,   max:maxDay,   testid:'drawdown-daily'},
        {label:'Total',      pct:pctTotal, max:maxTotal, testid:'drawdown-total'},
      ].map(d=>{
        const c = d.pct >= d.max*0.8 ? '#ff4560' : d.pct >= d.max*0.5 ? '#f5a623' : '#00d97e'
        const w = Math.min(100, (d.pct / d.max) * 100)
        return (
          <div
            data-testid={d.testid}
            key={d.label}
            style={{display:'flex',alignItems:'center',gap:8,flex:'1 1 200px',minWidth:160}}>
            <span style={{color:'#64748b',fontSize:11,whiteSpace:'nowrap'}}>{d.label}:</span>
            <div style={{flex:1,height:6,borderRadius:3,background:'rgba(255,255,255,.1)',overflow:'hidden'}}>
              <div style={{width:`${w}%`,height:'100%',background:c,borderRadius:3,transition:'width .5s'}}/>
            </div>
            <span
              data-testid={`${d.testid}-value`}
              style={{color:c,fontWeight:700,fontSize:12,fontFamily:'var(--mono)',whiteSpace:'nowrap'}}>{d.pct}% / {d.max}%</span>
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
    <div
      data-testid="backtest-page"
      style={{paddingBottom:40}}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:12}}>
        <div>
          <h2 style={{color:'#e2e8f0',margin:0,fontSize:18}}>🔬 Backtesting</h2>
          <p style={{color:'#64748b',margin:'6px 0 0',fontSize:12}}>Importez les résultats du Strategy Tester TradingView (.csv ou .json) pour visualiser les métriques.</p>
        </div>
        <div>
          <input
            data-testid="backtest-file-input"
            ref={fileRef}
            type="file"
            accept=".csv,.json"
            style={{display:'none'}}
            onChange={handleFile}/>
          <button
            data-testid="backtest-import-btn"
            onClick={()=>fileRef.current?.click()}
            style={{padding:'8px 20px',borderRadius:8,fontSize:13,cursor:'pointer',fontWeight:600,background:'rgba(59,130,246,.2)',border:'1px solid #3b82f6',color:'#3b82f6'}}>
            📂 Importer CSV / JSON
          </button>
        </div>
      </div>

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
      {error   && <div
        data-testid="backtest-error"
        style={{color:'#ff4560',padding:16,background:'rgba(255,69,96,.1)',borderRadius:8,marginBottom:16}}>{error}</div>}

      {result && (
        <div data-testid="backtest-results">
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
          <div style={{background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.08)',borderRadius:10,padding:'16px',marginBottom:12}}>
            <div style={{color:'#94a3b8',fontSize:11,fontWeight:700,letterSpacing:'.5px',textTransform:'uppercase',marginBottom:12}}>📈 Courbe d'équité</div>
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
          {result.trades.length > 0 && (
            <div style={{background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.08)',borderRadius:10,overflow:'hidden'}}>
              <div style={{padding:'12px 16px',borderBottom:'1px solid rgba(255,255,255,.06)',color:'#94a3b8',fontSize:11,fontWeight:700}}>
                LISTE DES TRADES ({result.trades.length} affichés)
              </div>
              <div style={{overflowX:'auto',maxHeight:300}}>
                <table
                  data-testid="backtest-trades-table"
                  style={{width:'100%',borderCollapse:'collapse',fontSize:12,fontFamily:'var(--mono)'}}>
                  <thead>
                    <tr style={{background:'rgba(0,0,0,.2)'}}>{['Date','Type','Prix','Qté','P&L','P&L cumulé'].map(h=><th key={h} style={{padding:'7px 12px',textAlign:'left',color:'#64748b',fontSize:11,borderBottom:'1px solid rgba(255,255,255,.06)'}}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {result.trades.slice(0,100).map((t,i)=>(
                      <tr key={i} style={{borderBottom:'1px solid rgba(255,255,255,.04)'}}>
                        <td style={{padding:'6px 12px',color:'#64748b'}}>{t.date.slice(0,16)}</td>
                        <td style={{padding:'6px 12px',color:t.type?.includes('Entry')?'#3b82f6':'#94a3b8'}}>{t.type}</td>
                        <td style={{padding:'6px 12px'}}>{t.price.toFixed(5)}</td>
                        <td style={{padding:'6px 12px'}}>{t.qty}</td>
                        <td style={{padding:'6px 12px',color:t.pnl>0?'#00d97e':t.pnl<0?'#ff4560':'#94a3b8'}}>{t.pnl>0?'+':''}{t.pnl?.toFixed(2)}</td>
                        <td style={{padding:'6px 12px',color:t.cumPnl>=0?'#00d97e':'#ff4560'}}>{t.cumPnl?.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// ACCOUNTS PAGE
// ════════════════════════════════════════════════════════════════
function AccountsPage({ token, accounts, setAccounts, activeAccount, setActiveAccount }) {
  const [showAdd, setShowAdd] = useState(false)
  const [form,    setForm]    = useState({name:'',label:'',type:'demo',host:'demo.ctraderapi.com',accountId:'',clientId:'',secret:'',token:'',refresh:''})
  const [msg,     setMsg]     = useState(null)
  const hdr = {'Authorization':'Bearer '+token,'Content-Type':'application/json'}

  const addAccount = async () => {
    const res  = await fetch('/api/accounts',{method:'POST',headers:hdr,body:JSON.stringify(form)})
    const data = await res.json()
    if (data.ok) { setMsg('Compte ajouté !'); setShowAdd(false); setAccounts(data.accounts||accounts) }
    else setMsg(data.error||'Erreur')
    setTimeout(()=>setMsg(null),3000)
  }

  const activate = async (id) => {
    await fetch(`/api/accounts/${id}/activate`,{method:'POST',headers:hdr})
    setActiveAccount(id)
  }

  const remove = async (id) => {
    const res  = await fetch(`/api/accounts/${id}`,{method:'DELETE',headers:hdr})
    const data = await res.json()
    if (data.ok) setAccounts(data.accounts||accounts)
  }

  const section = (children) => (
    <div style={{background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.08)',borderRadius:10,padding:'18px',marginBottom:14}}>
      {children}
    </div>
  )

  const inp = (label, key, placeholder='', type='text') => (
    <div style={{display:'flex',flexDirection:'column',gap:4}}>
      <label style={{color:'#64748b',fontSize:11}}>{label}</label>
      <input
        data-testid={`account-field-${key}`}
        type={type}
        value={form[key]||''}
        onChange={e=>setForm(p=>({...p,[key]:e.target.value}))}
        placeholder={placeholder}
        style={{padding:'6px 10px',borderRadius:6,background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.12)',color:'#e2e8f0',fontSize:12}}/>
    </div>
  )

  return (
    <div
      data-testid="accounts-page"
      style={{paddingBottom:40,maxWidth:720}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
        <h2 style={{color:'#e2e8f0',margin:0,fontSize:18}}>🏦 Comptes FTMO</h2>
        <button
          data-testid="accounts-add-btn"
          onClick={()=>setShowAdd(!showAdd)}
          style={{padding:'6px 16px',borderRadius:6,fontSize:12,cursor:'pointer',background:'rgba(59,130,246,.2)',border:'1px solid #3b82f6',color:'#3b82f6',fontWeight:600}}>
          {showAdd?'✕ Annuler':'+ Ajouter compte'}
        </button>
      </div>

      {msg && (
        <div
          data-testid="accounts-msg"
          style={{padding:'8px 16px',borderRadius:6,marginBottom:12,background:'rgba(0,217,126,.1)',border:'1px solid rgba(0,217,126,.3)',color:'#00d97e',fontSize:12}}>{msg}</div>
      )}

      {/* Liste des comptes */}
      {accounts.map(acc=>(
        <div
          data-testid={`account-card-${acc.id}`}
          key={acc.id}
          style={{
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
              <button
                data-testid={`account-activate-btn-${acc.id}`}
                onClick={()=>activate(acc.id)}
                style={{padding:'4px 14px',borderRadius:5,fontSize:12,cursor:'pointer',background:'rgba(59,130,246,.2)',border:'1px solid #3b82f6',color:'#3b82f6',fontWeight:600}}>
                Activer
              </button>
            )}
            {acc.id === activeAccount && (
              <span
                data-testid={`account-active-badge-${acc.id}`}
                style={{color:'#3b82f6',fontSize:12,fontWeight:600,padding:'4px 0'}}>✅ Actif</span>
            )}
            {acc.id !== 'default' && (
              <button
                data-testid={`account-remove-btn-${acc.id}`}
                onClick={()=>remove(acc.id)}
                style={{padding:'4px 10px',borderRadius:5,fontSize:12,cursor:'pointer',background:'rgba(255,69,96,.1)',border:'1px solid rgba(255,69,96,.3)',color:'#ff4560'}}>✕</button>
            )}
          </div>
        </div>
      ))}

      {/* Formulaire ajout */}
      {showAdd && section(
        <div data-testid="account-form">
          <h3 style={{color:'#e2e8f0',margin:'0 0 16px',fontSize:14}}>Nouveau compte FTMO</h3>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
            {inp('Nom du compte *','name','Ex: FTMO Challenge 10k')}
            {inp('Label','label','Challenge / Funded')}
            <div style={{display:'flex',flexDirection:'column',gap:4}}>
              <label style={{color:'#64748b',fontSize:11}}>Type</label>
              <select
                data-testid="account-field-type"
                value={form.type}
                onChange={e=>setForm(p=>({...p,type:e.target.value,host:e.target.value==='live'?'live.ctraderapi.com':'demo.ctraderapi.com'}))}
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
          <button
            data-testid="account-submit-btn"
            onClick={addAccount}
            style={{padding:'7px 20px',borderRadius:6,fontSize:12,cursor:'pointer',fontWeight:600,background:'rgba(0,217,126,.2)',border:'1px solid #00d97e',color:'#00d97e'}}>
            ✅ Ajouter ce compte
          </button>
        </div>
      )}

      {section(
        <>
          <h3 style={{color:'#94a3b8',margin:'0 0 10px',fontSize:12,fontWeight:700,letterSpacing:'.5px',textTransform:'uppercase'}}>💡 Fonctionnement multi-compte</h3>
          <p style={{color:'#64748b',fontSize:12,margin:'0 0 6px'}}>Chaque compte FTMO a ses propres credentials cTrader. Vous pouvez switcher d'un compte à l'autre depuis le header du dashboard.</p>
          <p style={{color:'#64748b',fontSize:12,margin:0}}>Cas d'usage typique : <span style={{color:'#94a3b8'}}>un compte Challenge 10k + un compte Funded 100k</span>. Les ordres auto vont toujours sur le compte actif.</p>
        </>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// ANALYTICS PAGE
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
    <div
      data-testid="analytics-page"
      style={{paddingBottom:40}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
        <h2 style={{color:'#e2e8f0',margin:0,fontSize:18}}>📊 Analytics — {data.totalSignals} signaux</h2>
        <div
          data-testid="analytics-days-selector"
          style={{display:'flex',gap:6}}>
          {[7,14,30,60].map(d=>(
            <button
              data-testid={`analytics-days-${d}`}
              key={d}
              onClick={()=>setDays(d)}
              style={{padding:'4px 12px',borderRadius:6,fontSize:12,cursor:'pointer',background:days===d?'rgba(59,130,246,.25)':'rgba(255,255,255,.05)',border:`1px solid ${days===d?'#3b82f6':'rgba(255,255,255,.1)'}`,color:days===d?'#3b82f6':'#94a3b8'}}>{d}j</button>
          ))}
        </div>
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
        {card(<ResponsiveContainer width="100%" height={220}><BarChart data={data.topPairs} layout="vertical" barSize={10}><CartesianGrid strokeDasharray="3 3" stroke="#1E293B"/><XAxis type="number" tick={{fill:'#64748b',fontSize:10}}/><YAxis type="category" dataKey="pair" tick={{fill:'#94a3b8',fontSize:11}} width={55}/><Tooltip contentStyle={tt}/><Bar dataKey="autoOk" fill="#00d97e" name="Auto OK" stackId="a"/><Bar dataKey="total" fill="#1E293B" name="Total" stackId="b"/></BarChart></ResponsiveContainer>,'🏆 Top paires')}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// JOURNAL PAGE
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
    <div
      data-testid="journal-page"
      style={{paddingBottom:40}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
        <h2 style={{color:'#e2e8f0',margin:0,fontSize:18}}>📓 Journal de trading</h2>
        <button
          data-testid="journal-export-csv-btn"
          onClick={()=>{const a=document.createElement('a');a.href='/api/journal/export/csv';a.download=`journal_${new Date().toISOString().slice(0,10)}.csv`;a.click()}}
          style={{padding:'6px 16px',borderRadius:6,fontSize:12,cursor:'pointer',background:'rgba(59,130,246,.15)',border:'1px solid rgba(59,130,246,.3)',color:'#3b82f6',fontWeight:600}}>⬇️ Export CSV</button>
      </div>
      {stats&&(
        <div
          data-testid="journal-stats"
          style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:16}}>
          {[{l:'Exécutés',v:stats.executed,c:'#94a3b8'},{l:'Wins',v:stats.wins,c:'#00d97e'},{l:'Losses',v:stats.losses,c:'#ff4560'},{l:'Winrate',v:`${stats.winRate}%`,c:stats.winRate>=50?'#00d97e':'#ff4560'},{l:'P&L',v:`$${stats.totalPnl}`,c:stats.totalPnl>=0?'#00d97e':'#ff4560'}].map(k=>(
            <div
              data-testid={`journal-stat-${k.l.toLowerCase()}`}
              key={k.l}
              style={{flex:'1 1 100px',background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.08)',borderRadius:8,padding:'10px 14px'}}>
              <div style={{fontSize:18,fontWeight:700,color:k.c,fontFamily:'var(--mono)'}}>{k.v}</div>
              <div style={{fontSize:10,color:'#64748b',marginTop:3}}>{k.l}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.08)',borderRadius:10,overflow:'hidden'}}>
        <div style={{overflowX:'auto'}}>
          <table
            data-testid="journal-table"
            style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead>
              <tr style={{background:'rgba(0,0,0,.25)'}}>
                {['Date','Paire','Dir.','Lots','Entry','R:R','Score','Outcome','P&L','Notes',''].map(h=>(
                  <th key={h} style={{padding:'9px 12px',textAlign:'left',color:'#64748b',fontWeight:600,fontSize:11,borderBottom:'1px solid rgba(255,255,255,.08)'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.length===0
                ? <tr><td colSpan={11} style={{padding:24,textAlign:'center',color:'#64748b'}}>Aucun trade enregistré — les ordres auto sont loggés automatiquement</td></tr>
                : entries.map((e,i)=>(
                  <tr
                    data-testid={`journal-row-${e.id}`}
                    key={e.id}
                    style={{borderBottom:'1px solid rgba(255,255,255,.04)',background:i%2===0?'transparent':'rgba(255,255,255,.01)'}}>
                    <td style={{padding:'7px 12px',color:'#64748b',fontSize:10,fontFamily:'var(--mono)'}}>{new Date(e.executedAt).toLocaleDateString('fr-FR')}</td>
                    <td style={{padding:'7px 12px',color:'#e2e8f0',fontWeight:600}}>{e.pair}</td>
                    <td style={{padding:'7px 12px',color:e.action==='BUY'?'#00d97e':'#ff4560',fontWeight:700}}>{e.action==='BUY'?'▲':'▼'}</td>
                    <td style={{padding:'7px 12px',fontFamily:'var(--mono)'}}>{e.lots}L</td>
                    <td style={{padding:'7px 12px',fontFamily:'var(--mono)',fontSize:11}}>{e.entryPrice||'—'}</td>
                    <td style={{padding:'7px 12px',color:'#f5a623'}}>{e.rr?`1:${e.rr}`:'—'}</td>
                    <td style={{padding:'7px 12px'}}>{e.score?<span style={{color:e.score>=80?'#00d97e':e.score>=60?'#f5a623':'#ff4560',fontFamily:'var(--mono)',fontWeight:600}}>{e.score}</span>:'—'}</td>
                    <td style={{padding:'7px 12px'}}>
                      {editing===e.id
                        ? <select
                            data-testid={`journal-outcome-select-${e.id}`}
                            value={editData.outcome||''}
                            onChange={ev=>setEditData(p=>({...p,outcome:ev.target.value}))}
                            style={{background:'#1E293B',border:'1px solid #334155',color:'#e2e8f0',borderRadius:4,padding:'2px 4px',fontSize:11}}>
                            <option value="">—</option>
                            <option value="win">✅ Win</option>
                            <option value="loss">❌ Loss</option>
                            <option value="be">➡️ BE</option>
                          </select>
                        : <span style={{color:oc(e.outcome),fontWeight:600,fontSize:11}}>{ol(e.outcome)}</span>
                      }
                    </td>
                    <td style={{padding:'7px 12px'}}>
                      {editing===e.id
                        ? <input
                            data-testid={`journal-pnl-input-${e.id}`}
                            type="number"
                            value={editData.pnlUSD||''}
                            onChange={ev=>setEditData(p=>({...p,pnlUSD:ev.target.value}))}
                            style={{width:70,background:'#1E293B',border:'1px solid #334155',color:'#e2e8f0',borderRadius:4,padding:'2px 6px',fontSize:11}}/>
                        : <span style={{color:e.pnlUSD>0?'#00d97e':e.pnlUSD<0?'#ff4560':'#64748b',fontFamily:'var(--mono)',fontWeight:600}}>{e.pnlUSD!==null?`$${e.pnlUSD}`:'—'}</span>
                      }
                    </td>
                    <td style={{padding:'7px 12px',maxWidth:160}}>
                      {editing===e.id
                        ? <input
                            data-testid={`journal-notes-input-${e.id}`}
                            value={editData.notes||''}
                            onChange={ev=>setEditData(p=>({...p,notes:ev.target.value}))}
                            style={{width:'100%',background:'#1E293B',border:'1px solid #334155',color:'#e2e8f0',borderRadius:4,padding:'2px 6px',fontSize:11}}/>
                        : <span style={{color:'#64748b',fontSize:11}}>{e.notes||'—'}</span>
                      }
                    </td>
                    <td style={{padding:'7px 12px'}}>
                      {editing===e.id
                        ? <>
                            <button
                              data-testid={`journal-save-btn-${e.id}`}
                              onClick={()=>saveEdit(e.id)}
                              style={{padding:'2px 8px',borderRadius:4,fontSize:11,background:'rgba(0,217,126,.2)',border:'1px solid #00d97e',color:'#00d97e',cursor:'pointer',marginRight:4}}>✓</button>
                            <button
                              data-testid={`journal-cancel-btn-${e.id}`}
                              onClick={()=>setEditing(null)}
                              style={{padding:'2px 8px',borderRadius:4,fontSize:11,background:'rgba(255,69,96,.1)',border:'1px solid #ff4560',color:'#ff4560',cursor:'pointer'}}>✗</button>
                          </>
                        : <button
                            data-testid={`journal-edit-btn-${e.id}`}
                            onClick={()=>{setEditing(e.id);setEditData({notes:e.notes||'',outcome:e.outcome||'',pnlUSD:e.pnlUSD||''})}}
                            style={{padding:'2px 8px',borderRadius:4,fontSize:11,background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.15)',color:'#94a3b8',cursor:'pointer'}}>✏️</button>
                      }
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
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
    <div
      data-testid="dashboard"
      className="app">

      {/* HEADER */}
      <div
        data-testid="app-header"
        className="hdr">
        <div className="hdr-brand">
          <img src="data:image/png;base64,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" alt="Docker FX" className="hdr-logo" style={{width:44,height:44,borderRadius:10,objectFit:'cover'}}/>
          <div>
            <div
              data-testid="header-title"
              className="hdr-title"
              style={{display:'flex',alignItems:'center',gap:8}}>
              Docker FX Dashboard
              <span style={{
                fontSize:11,fontWeight:600,color:'#64748B',
                background:'rgba(255,255,255,0.06)',
                border:'1px solid rgba(255,255,255,0.1)',
                borderRadius:4,padding:'1px 6px',
                letterSpacing:'0.3px',
                fontFamily:'var(--mono)',
              }}>{APP_VERSION}</span>
            </div>
            <div className="hdr-sub">FTMO · cTrader · 28 paires Forex</div>
          </div>
        </div>
        <div className="hdr-right">
          <HeaderPanel
            token={token}
            autoMode={autoMode}
            setAutoMode={setAutoMode}
            accounts={accounts}
            activeAccount={activeAcc}
            setActiveAccount={setActiveAcc}/>
          <div
            data-testid="websocket-badge"
            className="badge"
            style={{borderColor:wsColor,color:wsColor}}>
            <div className="dot" style={{background:wsColor}}/>{wsStatus}
          </div>
          <div
            data-testid="ctrader-badge"
            className="badge"
            style={{borderColor:ctColor,color:ctColor}}>
            <div className="dot" style={{background:ctColor}}/>{ctrader?.ready?`cTrader ${ctrader.mode==='demo'?'Demo':'Live'}`:ctrader?.simMode?'Simulation':'cTrader ✗'}
          </div>
          <button
            data-testid="logout-btn"
            onClick={onLogout}
            style={{padding:'4px 12px',borderRadius:6,background:'rgba(255,69,96,.1)',border:'1px solid rgba(255,69,96,.3)',color:'#ff4560',fontSize:11,cursor:'pointer'}}>
            Déconnexion
          </button>
        </div>
      </div>

      {/* TABS NAV */}
      <div
        data-testid="tabs-nav"
        style={{display:'flex',gap:3,marginBottom:14,borderBottom:'1px solid rgba(255,255,255,.07)'}}>
        {tabs.map(t=>(
          <button
            data-testid={`tab-${t.id}`}
            key={t.id}
            onClick={()=>setTab(t.id)}
            style={{padding:'7px 16px',borderRadius:'6px 6px 0 0',fontSize:12,cursor:'pointer',fontWeight:600,border:'1px solid rgba(255,255,255,.07)',borderBottom:'none',background:tab===t.id?'rgba(255,255,255,.05)':'transparent',color:tab===t.id?'#e2e8f0':'#64748b',borderBottom:tab===t.id?`2px solid ${activeColor}`:'2px solid transparent'}}>
            {t.l}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}
      {tab==='dashboard' && (
        <div data-testid="tab-content-dashboard">
          {!autoMode && (
            <div
              data-testid="automode-warning"
              style={{background:'rgba(255,69,96,.08)',border:'1px solid rgba(255,69,96,.25)',borderRadius:8,padding:'10px 18px',marginBottom:12,color:'#ff4560',fontSize:13,fontWeight:600}}>
              🔴 AutoBot global désactivé
            </div>
          )}
          <DrawdownPanel token={token}/>
          <StrategyAutoModes token={token} strategies={strategies} stratModes={stratModes} setStratModes={setStratModes}/>
          {strategies.length>0&&(
            <StrategyManager
              strategies={strategies}
              activeStratId={activeStrat}
              token={token}
              onActivate={switchStrategy}
              onUpdate={async()=>{await loadStrategies();if(activeStrat)loadPairs(activeStrat)}}/>
          )}
          <PositionsPanel token={token} positions={positions}/>

          {/* Stats */}
          <div
            data-testid="stats-panel"
            className="stats">
            {[
              {val:all.filter(s=>getAction(s)==='BUY').length, lbl:'BUY actifs',     color:'#00d97e',bc:'rgba(0,217,126,.15)',   testid:'stat-buy'},
              {val:all.filter(s=>getAction(s)==='SELL').length,lbl:'SELL actifs',    color:'#ff4560',bc:'rgba(255,69,96,.15)',    testid:'stat-sell'},
              {val:all.filter(s=>s.ltf).length,                lbl:'⚡ Très fort 15M',color:'#f5a623',bc:'rgba(245,166,35,.15)', testid:'stat-ltf'},
              {val:all.filter(s=>s.hasSignal).length,          lbl:'Total signaux',  color:'#94a3b8',bc:'rgba(255,255,255,.06)', testid:'stat-total'},
            ].map(s=>(
              <div
                data-testid={s.testid}
                key={s.lbl}
                className="stat-card"
                style={{borderColor:s.bc}}>
                <span className="stat-val" style={{color:s.color}}>{s.val}</span>
                <span className="stat-lbl">{s.lbl}</span>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div
            data-testid="filters-panel"
            className="filters">
            {[
              {k:'ALL',   l:'Toutes',       testid:'filter-all'},
              {k:'SIGNAL',l:'Signaux actifs',testid:'filter-signal'},
              {k:'LTF',   l:'⚡ 15M',       testid:'filter-ltf'},
              {k:'BUY',   l:'▲ BUY',        testid:'filter-buy'},
              {k:'SELL',  l:'▼ SELL',       testid:'filter-sell'},
            ].map(f=>(
              <button
                data-testid={f.testid}
                key={f.k}
                className={`filter-btn ${filter===f.k?'active':''}`}
                onClick={()=>setFilter(f.k)}>
                {f.l}
              </button>
            ))}
            <button
              data-testid="filter-test-btn"
              className="filter-btn test-btn"
              onClick={()=>fetch(`/api/test?strategy=${activeStrat}`,{headers:hdr}).then(()=>loadPairs(activeStrat))}>
              ◎ Test
            </button>
          </div>

          <div
            data-testid="pairs-section-title"
            className="section-title"
            style={{color:activeColor}}>
            {strategies.find(s=>s.id===activeStrat)?.name||'Paires'} — {sorted.filter(s=>s.hasSignal).length} actifs
          </div>

          {/* Pairs grid */}
          <div
            data-testid="pairs-grid"
            className="grid">
            {sorted.map(s=><PairTile key={s.pair} state={s}/>)}
          </div>

          {/* History */}
          {history.length>0 && (
            <div
              data-testid="history-wrap"
              className="history-wrap">
              <div className="history-head">Historique</div>
              <table
                data-testid="history-table"
                className="htable">
                <thead>
                  <tr>
                    <th>Paire</th><th>Action</th><th>TF</th><th>Entry</th>
                    <th>SL</th><th>TP</th><th>R:R</th><th>Score</th>
                    <th>Type</th><th>Heure</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice(0,20).map((h,i)=>{
                    const b=hBadge(h)
                    return (
                      <tr
                        data-testid={`history-row-${i}`}
                        key={i}>
                        <td style={{fontWeight:600,color:'#e2e8f0'}}>{h.pair}</td>
                        <td className={h.action==='BUY'?'h-buy':'h-sell'}>{h.action}</td>
                        <td style={{color:'#64748b'}}>{h.tf}M</td>
                        <td style={{fontFamily:'var(--mono)',fontSize:11}}>{h.price}</td>
                        <td style={{color:'#ff4560',fontFamily:'var(--mono)',fontSize:11}}>{h.sl}</td>
                        <td style={{color:'#00d97e',fontFamily:'var(--mono)',fontSize:11}}>{h.tp_reel||h.tp}</td>
                        <td style={{color:'#f5a623'}}>{h.rr_reel?`1:${h.rr_reel}`:'—'}</td>
                        <td>{h.score?<span style={{color:h.score>=80?'#00d97e':h.score>=60?'#f5a623':'#ff4560',fontFamily:'var(--mono)',fontWeight:600}}>{h.score}/100</span>:'—'}</td>
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
      )}

      {tab==='analytics' && <AnalyticsPage token={token}/>}
      {tab==='backtest'  && <BacktestPage  token={token}/>}
      {tab==='journal'   && <JournalPage   token={token}/>}
      {tab==='accounts'  && (
        <AccountsPage
          token={token}
          accounts={accounts}
          setAccounts={setAccounts}
          activeAccount={activeAcc}
          setActiveAccount={setActiveAcc}/>
      )}
    </div>
  )
}

export default function App() {
  const [token,setToken]=useState(()=>localStorage.getItem('ict_token')||null)
  const logout=()=>{localStorage.removeItem('ict_token');setToken(null)}
  if(!token)return<Login onAuth={setToken}/>
  return<Dashboard token={token} onLogout={logout}/>
}
