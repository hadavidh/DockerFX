import { useState } from 'react'

const PIP_VALUE = {
  USDJPY:9.1,EURJPY:9.1,GBPJPY:9.1,AUDJPY:9.1,NZDJPY:9.1,CADJPY:9.1,CHFJPY:9.1,
  AUDUSD:10,NZDUSD:10,EURUSD:10,GBPUSD:10,USDCHF:11,EURCHF:11,GBPCHF:11,
  AUDCHF:11,CADCHF:11,NZDCHF:11,USDCAD:7.4,EURCAD:7.4,GBPCAD:7.4,AUDCAD:7.4,
  NZDCAD:7.4,EURGBP:12.5,GBPAUD:6.5,GBPNZD:5.9,EURNZD:5.9,AUDNZD:5.9,
}

function calcLots(e, s, pair, risk=500) {
  const diff = Math.abs(parseFloat(e) - parseFloat(s))
  if (!diff||isNaN(diff)) return '1.00'
  const ps = (pair||'').includes('JPY') ? 0.01 : 0.0001
  const pv = PIP_VALUE[pair] || 10
  return Math.max(0.01, Math.round((risk/(diff/ps*pv))*100)/100).toFixed(2)
}

export default function OrderModal({ state, onClose, onConfirm }) {
  const { pair, signal, probability, entry, sl, tp, isLtf, entryType } = state
  const isBuy = signal === 'BUY'
  const dp    = (pair||'').includes('JPY') ? 3 : 5
  const accent = isLtf ? '#f5a623' : isBuy ? '#00d97e' : '#ff4560'

  const [form, setForm]     = useState({
    entry: entry ? parseFloat(entry).toFixed(dp) : '',
    sl:    sl    ? parseFloat(sl).toFixed(dp)    : '',
    tp:    tp    ? parseFloat(tp).toFixed(dp)    : '',
    lots:  entry&&sl ? calcLots(entry,sl,pair) : '1.00',
  })
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState(null)
  const [error,   setError]   = useState(null)

  const upd = (k,v) => {
    const n = {...form,[k]:v}
    if (k==='sl'||k==='entry') n.lots = calcLots(n.entry,n.sl,pair)
    setForm(n)
  }

  const ps      = (pair||'').includes('JPY') ? 0.01 : 0.0001
  const pv      = PIP_VALUE[pair] || 10
  const slPips  = Math.abs((parseFloat(form.entry)-parseFloat(form.sl))/ps)
  const tpPips  = Math.abs((parseFloat(form.entry)-parseFloat(form.tp))/ps)
  const riskUsd = slPips*parseFloat(form.lots)*pv
  const gainUsd = tpPips*parseFloat(form.lots)*pv
  const rr      = slPips>0 ? (tpPips/slPips).toFixed(2) : '—'

  const submit = async () => {
    setLoading(true); setError(null)
    try {
      const tok  = localStorage.getItem('ict_token')||''
      const res  = await fetch('/api/order',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},
        body:JSON.stringify({ symbol:pair, action:signal,
          lots:parseFloat(form.lots), sl:parseFloat(form.sl), tp:parseFloat(form.tp),
          comment:`ICT ${isLtf?'15M':'4H'} ${signal} ${pair}${entryType?' '+entryType:''}` })})
      const d = await res.json()
      if (d.ok) { setResult(d); onConfirm&&onConfirm(d) }
      else setError(d.error||'Erreur inconnue')
    } catch { setError('Impossible de joindre le backend') }
    setLoading(false)
  }

  return (
    <div
      data-testid="order-modal-overlay"
      className="overlay"
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div
        data-testid="order-modal"
        className="modal"
        style={{ borderColor:`${accent}40` }}>

        {/* Header */}
        <div
          data-testid="order-modal-header"
          className="modal-hdr"
          style={{ background:`${accent}08`, borderColor:`${accent}20` }}>
          <div>
            <div
              data-testid="order-modal-title"
              className="modal-title"
              style={{ color:accent }}>
              {isLtf?'⚡ ':isBuy?'▲ ':'▼ '}{signal} — {pair}
              {isLtf && <span style={{fontSize:11,marginLeft:6,opacity:.7,color:accent}}>TRÈS FORT 15M</span>}
            </div>
            <div
              data-testid="order-modal-subtitle"
              className="modal-sub">
              {probability}%{entryType ? ` · ${entryType}` : ''} · Envoyer vers FTMO
            </div>
          </div>
          <button
            data-testid="order-modal-close-btn"
            className="modal-close"
            onClick={onClose}>✕</button>
        </div>

        {!result ? (
          <div
            data-testid="order-modal-body"
            className="modal-body">
            {isLtf && (
              <div
                data-testid="order-ltf-info"
                className="ltf-info">
                ⚡ Signal 15min confirmé — SL serré, R:R optimisé
              </div>
            )}

            <div className="field-grid">
              <div className="field">
                <label>Entry</label>
                <input
                  data-testid="order-entry-input"
                  type="number"
                  step="any"
                  value={form.entry}
                  onChange={e=>upd('entry',e.target.value)}
                  style={{borderColor:`${accent}40`}}
                  onFocus={e=>e.target.style.borderColor=accent}
                  onBlur={e=>e.target.style.borderColor=`${accent}40`}/>
              </div>
              <div className="field">
                <label style={{color:accent}}>Lots</label>
                <input
                  data-testid="order-lots-input"
                  type="number"
                  step="any"
                  value={form.lots}
                  onChange={e=>upd('lots',e.target.value)}
                  style={{color:accent,fontWeight:700,borderColor:`${accent}40`}}
                  onFocus={e=>e.target.style.borderColor=accent}
                  onBlur={e=>e.target.style.borderColor=`${accent}40`}/>
              </div>
              <div className="field">
                <label style={{color:'#ff4560'}}>Stop Loss</label>
                <input
                  data-testid="order-sl-input"
                  type="number"
                  step="any"
                  value={form.sl}
                  onChange={e=>upd('sl',e.target.value)}
                  style={{borderColor:'rgba(255,69,96,.3)'}}
                  onFocus={e=>e.target.style.borderColor='#ff4560'}
                  onBlur={e=>e.target.style.borderColor='rgba(255,69,96,.3)'}/>
              </div>
              <div className="field">
                <label style={{color:'#00d97e'}}>Take Profit</label>
                <input
                  data-testid="order-tp-input"
                  type="number"
                  step="any"
                  value={form.tp}
                  onChange={e=>upd('tp',e.target.value)}
                  style={{borderColor:'rgba(0,217,126,.3)'}}
                  onFocus={e=>e.target.style.borderColor='#00d97e'}
                  onBlur={e=>e.target.style.borderColor='rgba(0,217,126,.3)'}/>
              </div>
            </div>

            {!isNaN(riskUsd)&&riskUsd>0 && (
              <div
                data-testid="order-risk-preview"
                className="risk-preview">
                <div>
                  <div
                    data-testid="order-risk-usd"
                    className="rp-val"
                    style={{color:'#ff4560'}}>${riskUsd.toFixed(0)}</div>
                  <div className="rp-lbl">Risque</div>
                </div>
                <div>
                  <div
                    data-testid="order-rr"
                    className="rp-val"
                    style={{color:'#f5a623'}}>1:{rr}</div>
                  <div className="rp-lbl">R:R</div>
                </div>
                <div>
                  <div
                    data-testid="order-gain-usd"
                    className="rp-val"
                    style={{color:'#00d97e'}}>${gainUsd.toFixed(0)}</div>
                  <div className="rp-lbl">Gain</div>
                </div>
              </div>
            )}

            {error && (
              <div
                data-testid="order-error-msg"
                className="error-box">{error}</div>
            )}

            <div className="modal-btns">
              <button
                data-testid="order-cancel-btn"
                className="btn-cancel"
                onClick={onClose}>Annuler</button>
              <button
                data-testid="order-confirm-btn"
                className="btn-confirm"
                disabled={loading}
                style={{ background:accent, color: isLtf?'#000':'#000' }}
                onClick={submit}>
                {loading ? '⏳ Envoi...' : `${isBuy?'▲':'▼'} ${isLtf?'Ordre précis 15M':'Envoyer vers FTMO'}`}
              </button>
            </div>
          </div>
        ) : (
          <div
            data-testid="order-success"
            className="modal-success">
            <div
              data-testid="order-success-icon"
              className="success-icon">{result.simulated?'🧪':'✅'}</div>
            <div
              data-testid="order-success-title"
              className="success-title"
              style={{color:result.simulated?'#f5a623':'#00d97e'}}>
              {result.simulated?'Simulation (mode test)':'Ordre exécuté sur FTMO'}
            </div>
            <div
              data-testid="order-success-details"
              className="success-details">
              🎫 Position ID : <span data-testid="order-position-id">{result.positionId}</span><br/>
              💱 Paire       : <span data-testid="order-success-pair">{result.symbol}</span><br/>
              📊 Direction   : <span data-testid="order-success-side" style={{color:accent}}>{result.side}</span><br/>
              📦 Lots        : <span data-testid="order-success-lots">{result.volume}</span><br/>
              💲 Prix exec.  : <span data-testid="order-success-price">{result.price}</span>
            </div>
            <button
              data-testid="order-success-close-btn"
              className="btn-confirm"
              style={{background:accent,color:'#000',width:'100%',padding:11,borderRadius:8,border:'none',fontWeight:700,cursor:'pointer'}}
              onClick={onClose}>
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
