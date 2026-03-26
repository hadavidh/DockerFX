import './SignalHistory.css'

const PRIORITY_ORDER = { EXCELLENT: 0, BON: 1, MOYEN: 2, FAIBLE: 3, '-': 4 }

const QUALITY_META = {
  EXCELLENT : { emoji: '🔥', cls: 'q-excellent' },
  BON       : { emoji: '✅', cls: 'q-bon'       },
  MOYEN     : { emoji: '⚠️', cls: 'q-moyen'     },
  FAIBLE    : { emoji: '❌', cls: 'q-faible'     },
}

function formatTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit'
  })
}

export default function SignalHistory({ signals }) {
  if (!signals.length) {
    return (
      <div className="history-empty">
        <span>⏳</span>
        <p>Aucun signal reçu pour le moment.</p>
        <p className="history-empty-sub">
          Configure les alertes TradingView avec le webhook de ton VPS pour voir les signaux ici.
        </p>
      </div>
    )
  }

  // Trier : d'abord par qualité (EXCELLENT en premier), puis par date
  const sorted = [...signals].sort((a, b) => {
    const pA = PRIORITY_ORDER[a.quality] ?? 4
    const pB = PRIORITY_ORDER[b.quality] ?? 4
    if (pA !== pB) return pA - pB
    return new Date(b.receivedAt) - new Date(a.receivedAt)
  })

  return (
    <div className="history-wrap">
      <table className="history-table">
        <thead>
          <tr>
            <th>Priorité</th>
            <th>Heure</th>
            <th>Paire</th>
            <th>TF</th>
            <th>Direction</th>
            <th>Prob.</th>
            <th>Entrée</th>
            <th>Stop Loss</th>
            <th>Take Profit</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((sig, idx) => {
            const qm      = QUALITY_META[sig.quality] || QUALITY_META.FAIBLE
            const isBuy   = sig.action === 'BUY'
            const isFirst = idx === 0

            return (
              <tr
                key={`${sig.pair}-${sig.receivedAt}-${idx}`}
                className={`history-row ${isFirst ? 'row-new' : ''}`}
              >
                {/* Priorité */}
                <td>
                  <span className={`quality-badge ${qm.cls}`}>
                    {qm.emoji} {sig.quality}
                  </span>
                </td>

                {/* Heure */}
                <td className="td-time">{formatTime(sig.receivedAt)}</td>

                {/* Paire */}
                <td className="td-pair">{sig.pair}</td>

                {/* TF */}
                <td className="td-tf">
                  {sig.tf === '240' ? 'H4'
                   : sig.tf === '60'  ? 'H1'
                   : sig.tf === '15'  ? '15m'
                   : sig.tf === 'D'   ? '1D'
                   : sig.tf === 'W'   ? '1W'
                   : sig.tf + 'm'}
                </td>

                {/* Direction */}
                <td>
                  <span className={`dir-badge ${isBuy ? 'dir-buy' : 'dir-sell'}`}>
                    {isBuy ? '▲ BUY' : '▼ SELL'}
                  </span>
                </td>

                {/* Probabilité */}
                <td className="td-prob">
                  <div className="prob-cell">
                    <span className={`prob-num ${qm.cls}`}>{sig.prob}%</span>
                    <div className="mini-bar">
                      <div
                        className={`mini-bar-fill ${isBuy ? 'bar-buy' : 'bar-sell'}`}
                        style={{ width: `${sig.prob}%` }}
                      />
                    </div>
                  </div>
                </td>

                {/* Entrée / SL / TP */}
                <td className="td-price entry-val">{sig.price ?? '—'}</td>
                <td className="td-price sl-val">{sig.sl ?? '—'}</td>
                <td className="td-price tp-val">{sig.tp ?? '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
