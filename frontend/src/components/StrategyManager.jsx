import { useState } from 'react'

const COLORS = ['#3b82f6','#00d97e','#f5a623','#ff4560','#a855f7','#06b6d4','#f43f5e','#84cc16']

function StatPill({ val, label, color }) {
  return (
    <div style={{ textAlign:'center', padding:'8px 12px' }}>
      <div style={{ fontSize:20, fontWeight:700, color, fontFamily:'var(--mono)' }}>{val}</div>
      <div style={{ fontSize:9, color:'#64748b', textTransform:'uppercase', letterSpacing:'.5px', marginTop:2 }}>{label}</div>
    </div>
  )
}

// ── Formulaire création / édition ────────────────────────────────
function StrategyForm({ initial, onSave, onCancel, token }) {
  const [form, setForm] = useState(initial || { name:'', description:'', color:'#3b82f6', tf:'4H' })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const upd = (k,v) => setForm(f => ({...f, [k]:v}))

  const submit = async () => {
    if (!form.name.trim()) return setError('Le nom est requis')
    setLoading(true); setError(null)
    const method  = initial ? 'PUT' : 'POST'
    const url     = initial ? `/api/strategies/${initial.id}` : '/api/strategies'
    const res     = await fetch(url, { method, headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body:JSON.stringify(form) })
    const data    = await res.json()
    setLoading(false)
    if (data.error) return setError(data.error)
    onSave(data)
  }

  return (
    <div style={{ background:'#111827', border:'1px solid rgba(255,255,255,.1)', borderRadius:12, padding:20 }}>
      <div style={{ fontSize:14, fontWeight:600, color:'#e2e8f0', marginBottom:16 }}>
        {initial ? '✏️ Modifier la stratégie' : '+ Nouvelle stratégie'}
      </div>

      {/* Nom */}
      <div style={{ marginBottom:12 }}>
        <label style={{ display:'block', fontSize:10, color:'#64748b', marginBottom:4, letterSpacing:'.8px', textTransform:'uppercase' }}>Nom *</label>
        <input value={form.name} onChange={e=>upd('name',e.target.value)} placeholder="Ex: ICT AutoBot v1"
          style={{ width:'100%', padding:'9px 12px', borderRadius:7, background:'#0d1420',
            border:'1px solid rgba(255,255,255,.08)', color:'#e2e8f0', fontFamily:'var(--sans)',
            fontSize:13, outline:'none', boxSizing:'border-box' }}/>
      </div>

      {/* Description */}
      <div style={{ marginBottom:12 }}>
        <label style={{ display:'block', fontSize:10, color:'#64748b', marginBottom:4, letterSpacing:'.8px', textTransform:'uppercase' }}>Description</label>
        <input value={form.description} onChange={e=>upd('description',e.target.value)} placeholder="Ex: Triple EMA + RSI + Filtre Obstacles"
          style={{ width:'100%', padding:'9px 12px', borderRadius:7, background:'#0d1420',
            border:'1px solid rgba(255,255,255,.08)', color:'#e2e8f0', fontFamily:'var(--sans)',
            fontSize:13, outline:'none', boxSizing:'border-box' }}/>
      </div>

      {/* Timeframe + Couleur */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
        <div>
          <label style={{ display:'block', fontSize:10, color:'#64748b', marginBottom:4, letterSpacing:'.8px', textTransform:'uppercase' }}>Timeframe</label>
          <select value={form.tf} onChange={e=>upd('tf',e.target.value)}
            style={{ width:'100%', padding:'9px 12px', borderRadius:7, background:'#0d1420',
              border:'1px solid rgba(255,255,255,.08)', color:'#e2e8f0',
              fontFamily:'var(--sans)', fontSize:13, outline:'none' }}>
            {['1M','5M','15M','1H','4H','4H + 15M','D','W'].map(t=><option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display:'block', fontSize:10, color:'#64748b', marginBottom:4, letterSpacing:'.8px', textTransform:'uppercase' }}>Couleur</label>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', paddingTop:4 }}>
            {COLORS.map(c => (
              <div key={c} onClick={()=>upd('color',c)} style={{
                width:24, height:24, borderRadius:'50%', background:c, cursor:'pointer',
                border: form.color===c ? '2px solid #fff' : '2px solid transparent',
                transition:'transform .1s', transform: form.color===c ? 'scale(1.2)' : 'scale(1)',
              }}/>
            ))}
          </div>
        </div>
      </div>

      {error && <div style={{ background:'rgba(255,69,96,.1)', border:'1px solid rgba(255,69,96,.2)', borderRadius:7, padding:'7px 12px', marginBottom:12, fontSize:12, color:'#ff4560' }}>{error}</div>}

      <div style={{ display:'flex', gap:8 }}>
        <button onClick={onCancel} style={{ flex:1, padding:'9px', borderRadius:7, background:'#0d1420', border:'1px solid rgba(255,255,255,.08)', color:'#64748b', cursor:'pointer', fontSize:13, fontFamily:'var(--sans)' }}>Annuler</button>
        <button onClick={submit} disabled={loading} style={{ flex:2, padding:'9px', borderRadius:7, background:form.color, border:'none', color:'#000', fontWeight:700, cursor:'pointer', fontSize:13, fontFamily:'var(--sans)', opacity:loading?.6:1 }}>
          {loading ? '⏳...' : initial ? 'Enregistrer' : 'Créer la stratégie'}
        </button>
      </div>
    </div>
  )
}

// ── Stats backtesting ─────────────────────────────────────────────
function BacktestStats({ stratId, token }) {
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [period,  setPeriod]  = useState('7d')

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/stats/${stratId}`, { headers:{'Authorization':'Bearer '+token} })
      setStats(await r.json())
    } catch {}
    setLoading(false)
  }

  if (!stats && !loading) return (
    <button onClick={load} style={{ width:'100%', padding:'8px', borderRadius:7, background:'rgba(59,130,246,.1)', border:'1px solid rgba(59,130,246,.2)', color:'#3b82f6', cursor:'pointer', fontSize:12, fontFamily:'var(--sans)' }}>
      📊 Voir les stats backtesting
    </button>
  )

  if (loading) return <div style={{ textAlign:'center', padding:12, color:'#64748b', fontSize:12 }}>Chargement...</div>

  const d = period === '7d'
    ? { sig: stats.signals_7d,  buy: stats.buy_7d,  sell: stats.sell_7d || (stats.signals_7d - stats.buy_7d), exc: stats.excellent_7d }
    : period === '30d'
    ? { sig: stats.signals_30d, buy: Math.round(stats.signals_30d * (stats.buy_7d / Math.max(stats.signals_7d,1))), sell: 0, exc: 0 }
    : { sig: stats.signals_60d, buy: 0, sell: 0, exc: 0 }

  return (
    <div style={{ background:'rgba(59,130,246,.04)', border:'1px solid rgba(59,130,246,.12)', borderRadius:10, padding:14 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <div style={{ fontSize:12, fontWeight:600, color:'#94a3b8' }}>📊 Backtesting</div>
        <div style={{ display:'flex', gap:4 }}>
          {['7d','30d','60d'].map(p=>(
            <button key={p} onClick={()=>setPeriod(p)} style={{
              padding:'3px 8px', borderRadius:5, fontSize:10, cursor:'pointer', fontFamily:'var(--sans)',
              background: period===p ? '#3b82f6' : 'transparent',
              border: `1px solid ${period===p ? '#3b82f6' : 'rgba(255,255,255,.08)'}`,
              color: period===p ? '#fff' : '#64748b',
            }}>{p}</button>
          ))}
          <button onClick={load} style={{ padding:'3px 8px', borderRadius:5, fontSize:10, cursor:'pointer', background:'transparent', border:'1px solid rgba(255,255,255,.08)', color:'#64748b', fontFamily:'var(--sans)' }}>↻</button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', borderRadius:8, overflow:'hidden', border:'1px solid rgba(255,255,255,.06)' }}>
        <StatPill val={d.sig}  label="Signaux"   color="#94a3b8"/>
        <StatPill val={d.buy}  label="BUY"       color="#00d97e"/>
        <StatPill val={d.sell} label="SELL"      color="#ff4560"/>
        <StatPill val={d.exc}  label="Excellents" color="#f5a623"/>
      </div>

      {stats.top_pairs?.length > 0 && (
        <div style={{ marginTop:12 }}>
          <div style={{ fontSize:10, color:'#64748b', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:6 }}>Top paires (60j)</div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {stats.top_pairs.map(p => (
              <div key={p.pair} style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.06)', borderRadius:6, padding:'3px 9px', fontSize:11, fontFamily:'var(--mono)', color:'#94a3b8' }}>
                {p.pair} <span style={{ color:'#e2e8f0', fontWeight:600 }}>{p.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop:10, fontSize:10, color:'#475569' }}>
        Signaux actifs : <span style={{ color:'#94a3b8' }}>{stats.active_pairs}</span> paires
        &nbsp;·&nbsp; Historique : <span style={{ color:'#94a3b8' }}>{stats.signals_60d}</span> signaux (60j)
      </div>
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────
export default function StrategyManager({ strategies, activeStratId, onActivate, onUpdate, token }) {
  const [showForm,  setShowForm]  = useState(false)
  const [editStrat, setEditStrat] = useState(null)
  const [expanded,  setExpanded]  = useState(false)

  const active = strategies.find(s => s.id === activeStratId) || strategies[0]

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette stratégie ? Les signaux historiques seront conservés.')) return
    await fetch(`/api/strategies/${id}`, { method:'DELETE', headers:{'Authorization':'Bearer '+token} })
    onUpdate()
  }

  const handleActivate = async (id) => {
    if (id === activeStratId) return
    await fetch(`/api/strategies/${id}/activate`, { method:'POST', headers:{'Authorization':'Bearer '+token} })
    onActivate(id)
  }

  const handleReset = async () => {
    if (!confirm(`Remettre toutes les paires à zéro pour "${active.name}" ?`)) return
    await fetch(`/api/strategies/${activeStratId}/reset`, { method:'POST', headers:{'Authorization':'Bearer '+token} })
    onUpdate()
  }

  const handleSave = () => { setShowForm(false); setEditStrat(null); onUpdate() }

  return (
    <div style={{ background:'#0d1420', border:'1px solid rgba(255,255,255,.08)', borderRadius:12, marginBottom:16, overflow:'hidden' }}>
      {/* Header — toujours visible */}
      <div style={{ padding:'12px 16px', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
        {/* Indicateur couleur + nom stratégie active */}
        <div style={{ display:'flex', alignItems:'center', gap:8, flex:1, minWidth:0 }}>
          <div style={{ width:10, height:10, borderRadius:'50%', background:active?.color||'#3b82f6', flexShrink:0 }}/>
          <div style={{ fontSize:13, fontWeight:600, color:'#e2e8f0', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
            {active?.name || 'Aucune stratégie'}
          </div>
          {active?.description && (
            <div style={{ fontSize:11, color:'#475569', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              — {active.description}
            </div>
          )}
        </div>

        {/* Dropdown sélecteur */}
        <select value={activeStratId} onChange={e=>handleActivate(e.target.value)}
          style={{ padding:'6px 10px', borderRadius:7, background:'#111827',
            border:'1px solid rgba(255,255,255,.1)', color:'#e2e8f0',
            fontFamily:'var(--sans)', fontSize:12, cursor:'pointer', outline:'none' }}>
          {strategies.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        {/* Actions */}
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={()=>setExpanded(!expanded)} style={{
            padding:'5px 10px', borderRadius:7, background:'transparent',
            border:'1px solid rgba(255,255,255,.08)', color:'#64748b',
            cursor:'pointer', fontSize:12, fontFamily:'var(--sans)',
          }}>{expanded ? '▲ Réduire' : '▼ Gérer'}</button>
        </div>
      </div>

      {/* Panneau étendu */}
      {expanded && (
        <div style={{ borderTop:'1px solid rgba(255,255,255,.06)', padding:16, display:'flex', flexDirection:'column', gap:12 }}>

          {/* Liste des stratégies */}
          <div>
            <div style={{ fontSize:10, color:'#64748b', textTransform:'uppercase', letterSpacing:'.8px', marginBottom:8 }}>Stratégies disponibles</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {strategies.map(s => (
                <div key={s.id} style={{
                  display:'flex', alignItems:'center', gap:10, padding:'8px 12px',
                  borderRadius:8, background: s.id===activeStratId ? `${s.color}18` : 'rgba(255,255,255,.02)',
                  border:`1px solid ${s.id===activeStratId ? s.color+'44' : 'rgba(255,255,255,.06)'}`,
                }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:s.color, flexShrink:0 }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:600, color: s.id===activeStratId ? s.color : '#e2e8f0' }}>{s.name}</div>
                    <div style={{ fontSize:10, color:'#475569' }}>{s.tf} · {s.description}</div>
                  </div>
                  {s.id === activeStratId && (
                    <span style={{ fontSize:9, fontWeight:700, color:s.color, background:`${s.color}18`, border:`1px solid ${s.color}44`, borderRadius:20, padding:'2px 7px' }}>ACTIVE</span>
                  )}
                  <div style={{ display:'flex', gap:5 }}>
                    {s.id !== activeStratId && (
                      <button onClick={()=>handleActivate(s.id)} style={{ padding:'3px 9px', borderRadius:6, background:`${s.color}18`, border:`1px solid ${s.color}44`, color:s.color, cursor:'pointer', fontSize:11, fontFamily:'var(--sans)' }}>Activer</button>
                    )}
                    <button onClick={()=>{setEditStrat(s);setShowForm(true)}} style={{ padding:'3px 9px', borderRadius:6, background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)', color:'#94a3b8', cursor:'pointer', fontSize:11, fontFamily:'var(--sans)' }}>✏️</button>
                    {strategies.length > 1 && (
                      <button onClick={()=>handleDelete(s.id)} style={{ padding:'3px 9px', borderRadius:6, background:'rgba(255,69,96,.08)', border:'1px solid rgba(255,69,96,.2)', color:'#ff4560', cursor:'pointer', fontSize:11, fontFamily:'var(--sans)' }}>🗑</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions stratégie active */}
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={()=>{setEditStrat(null);setShowForm(true)}} style={{
              flex:1, padding:'8px', borderRadius:8,
              background:'rgba(59,130,246,.1)', border:'1px solid rgba(59,130,246,.2)',
              color:'#3b82f6', cursor:'pointer', fontSize:12, fontFamily:'var(--sans)',
            }}>+ Nouvelle stratégie</button>
            <button onClick={handleReset} style={{
              padding:'8px 14px', borderRadius:8,
              background:'rgba(255,69,96,.08)', border:'1px solid rgba(255,69,96,.2)',
              color:'#ff4560', cursor:'pointer', fontSize:12, fontFamily:'var(--sans)',
            }}>↺ Reset paires</button>
          </div>

          {/* Formulaire */}
          {showForm && (
            <StrategyForm
              initial={editStrat}
              token={token}
              onSave={handleSave}
              onCancel={()=>{setShowForm(false);setEditStrat(null)}}
            />
          )}

          {/* Stats backtesting */}
          <BacktestStats stratId={activeStratId} token={token}/>
        </div>
      )}
    </div>
  )
}
