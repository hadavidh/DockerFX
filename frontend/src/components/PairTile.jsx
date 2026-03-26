import { useState } from 'react'
import OrderModal from './OrderModal'

const C = {
  buy:  { accent:'#00d97e', border:'rgba(0,217,126,.35)', glow:'rgba(0,217,126,.12)',  pulse:'pulse-green' },
  sell: { accent:'#ff4560', border:'rgba(255,69,96,.35)',  glow:'rgba(255,69,96,.12)',  pulse:'pulse-red'   },
  ltf:  { accent:'#f5a623', border:'rgba(245,166,35,.5)',  glow:'rgba(245,166,35,.15)', pulse:'pulse-gold'  },
  ema:  { accent:'#ff6b35', border:'rgba(255,107,53,.4)',  glow:'rgba(255,107,53,.12)', pulse:'pulse-green' },
  none: { accent:'#1e293b', border:'rgba(255,255,255,.06)',glow:'transparent',          pulse:''            },
}

function getTheme(action, signal) {
  if (signal === 'SIGNAL_TRES_FORT_15M') return C.ltf
  if (signal === 'EMA200_REJECTION')     return C.ema
  if (action === 'BUY')  return C.buy
  if (action === 'SELL') return C.sell
  return C.none
}

function qualLabel(quality, signal) {
  if (signal === 'SIGNAL_TRES_FORT_15M') return '⚡ TRÈS FORT'
  if (signal === 'EMA200_REJECTION')     return '◈ EMA 200'
  const map = { EXCELLENT:'🔥 EXCELLENT', BON:'✓ BON', MOYEN:'~ MOYEN', FAIBLE:'↓ FAIBLE' }
  return map[quality] || quality || '—'
}

function SigBlock({ data, isLtf, onOrder }) {
  if (!data) return null
  const action      = data.action     || data.direction || 'NEUTRAL'
  const prob        = data.prob       || 0
  const quality     = data.quality    || ''
  const signal      = data.signal     || ''
  const price       = data.price      || null
  const sl          = data.sl         || null
  const tp          = data.tp         || null
  const tf          = data.tf         || '240'
  const entry_type  = data.entry_type || null
  const receivedAt  = data.receivedAt || data.lastUpdate || null
  const isBuy       = action === 'BUY'
  const theme       = getTheme(action, signal)
  const a           = theme.accent

  const fmtTime = receivedAt
    ? new Date(receivedAt).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit', second:'2-digit' })
    : null

  const tfLabel = isLtf ? '⚡ 15M' : signal === 'EMA200_REJECTION' ? 'EMA200' : `${tf}H`

  return (
    <div className={`sig-block ${isLtf ? 'sig-block-ltf' : ''}`}>
      {/* Row 1: TF pill + direction pill */}
      <div className="sig-row1">
        <span className="tf-pill" style={{ color:a, borderColor:`${a}44`, background:`${a}0f` }}>
          {tfLabel}
        </span>
        <span className="dir-pill" style={{ color:a, borderColor:`${a}44`, background:`${a}0f` }}>
          {isBuy ? '▲ BUY' : '▼ SELL'}
        </span>
      </div>

      {/* Probability */}
      <div className="prob-row">
        <span className="prob-val" style={{ color:a }}>{prob}%</span>
        <span className="prob-lbl" style={{ color:a }}>{qualLabel(quality, signal)}</span>
      </div>

      {/* Bar */}
      <div className="sig-bar">
        <div className="sig-bar-fill" style={{ width:`${prob}%`, background:`linear-gradient(90deg,${a}88,${a})` }}/>
      </div>

      {/* Entry type */}
      {isLtf && entry_type && <div className="entry-type">{entry_type}</div>}

      {/* Prices */}
      {price && (
        <div style={{ fontFamily:'var(--mono)', fontSize:10, marginBottom:7 }}>
          <div style={{ color:'#64748b' }}>Entry <span style={{ color:'#94a3b8' }}>{price}</span></div>
          {sl && <div>SL    <span className="price-sl">{sl}</span></div>}
          {tp && <div>TP    <span className="price-tp">{tp}</span></div>}
        </div>
      )}

      {fmtTime && <div className="sig-time">{fmtTime}</div>}

      {/* Button */}
      {(action === 'BUY' || action === 'SELL') && (
        <button className="order-btn"
          style={{ color:a, borderColor:`${a}55`, background:`${a}0d` }}
          onMouseOver={e => e.currentTarget.style.background=`${a}1f`}
          onMouseOut={e  => e.currentTarget.style.background=`${a}0d`}
          onClick={() => onOrder(data)}>
          {isBuy ? '▲' : '▼'} {isLtf ? 'Ordre précis 15M' : "Envoyer l'ordre"}
        </button>
      )}
    </div>
  )
}

export default function PairTile({ state }) {
  if (!state) return null
  const pair = state.pair || ''
  const base  = pair.slice(0,3)
  const quote = pair.slice(3,6)

  const htf = state.htf || (state.hasSignal && state.direction && state.direction !== 'NEUTRAL' ? {
    action: state.direction, prob: state.prob, quality: state.quality,
    signal: state.signal, price: state.price, sl: state.sl, tp: state.tp,
    tf: state.tf, receivedAt: state.lastUpdate,
  } : null)
  const ltf       = state.ltf || null
  const hasSignal = !!(htf || ltf)

  // Theme from top-priority signal
  const topSignal = ltf || htf
  const theme = topSignal ? getTheme(topSignal.action || topSignal.direction, topSignal.signal) : C.none

  const [modal, setModal]         = useState(false)
  const [modalData, setModalData] = useState(null)
  const openOrder = d => { setModalData(d); setModal(true) }

  return (
    <>
      <div className={`card ${hasSignal ? 'active ' + theme.pulse : ''}`}
        style={{
          borderColor: hasSignal ? theme.border : 'rgba(255,255,255,.06)',
          boxShadow:   hasSignal ? `0 0 20px ${theme.glow}` : 'none',
        }}>
        {/* Top accent line */}
        {hasSignal && (
          <div style={{ position:'absolute', top:0, left:0, right:0, height:2,
            background:`linear-gradient(90deg,transparent,${theme.accent},transparent)`,
            borderRadius:'12px 12px 0 0' }}/>
        )}

        {/* Header */}
        <div className="card-header">
          <div>
            <span className="pair-name">{base}</span>
            <span className="pair-quote">/{quote}</span>
          </div>
          {ltf && (
            <span style={{ fontSize:9, fontWeight:700, color:'#f5a623',
              background:'rgba(245,166,35,.12)', border:'1px solid rgba(245,166,35,.3)',
              borderRadius:20, padding:'2px 6px', letterSpacing:'.5px' }}>
              ⚡ DOUBLE
            </span>
          )}
        </div>

        {hasSignal ? (
          <>
            <SigBlock data={htf} isLtf={false} onOrder={openOrder}/>
            {ltf && <SigBlock data={ltf} isLtf={true} onOrder={openOrder}/>}
          </>
        ) : (
          <div className="waiting">
            <span className="waiting-dot"/><span className="waiting-dot"/><span className="waiting-dot"/>
          </div>
        )}
      </div>

      {modal && modalData && (
        <OrderModal
          state={{ pair,
            signal     : modalData.action || modalData.direction,
            probability: modalData.prob,
            entry: modalData.price, sl: modalData.sl, tp: modalData.tp,
            isLtf : modalData.signal === 'SIGNAL_TRES_FORT_15M',
            entryType: modalData.entry_type,
          }}
          onClose={() => setModal(false)}
          onConfirm={() => setModal(false)}
        />
      )}
    </>
  )
}
