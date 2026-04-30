import React, { useState, useEffect } from 'react'
import { api } from '../lib/api.js'
import { RiskBadge, ScoreBar, Flag, MonoValue, Spinner, fmt } from './ui.jsx'

export default function UserDrawer({ userId, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    setError(null)
    api.userRisk(userId)
      .then(setData)
      .catch(e => setError('User not found or no transaction history'))
      .finally(() => setLoading(false))
  }, [userId])

  if (!userId) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(2,4,8,0.7)',
          zIndex: 100, animation: 'fade-in-up 0.15s ease'
        }}
      />
      {/* Drawer */}
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: 420,
        background: 'var(--bg-panel)', borderLeft: '1px solid var(--border-glow)',
        boxShadow: '-20px 0 60px rgba(0,200,255,0.08)',
        zIndex: 101, overflowY: 'auto',
        animation: 'slide-in-right 0.25s ease'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 24px 16px',
          borderBottom: '1px solid var(--border-dim)',
          position: 'sticky', top: 0, background: 'var(--bg-panel)', zIndex: 1
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.18em',
                color: 'var(--cyan)', marginBottom: 6
              }}>USER RISK PROFILE</div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700,
                color: 'var(--text-primary)'
              }}>{userId}</div>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: 6,
                background: 'var(--bg-elevated)', border: '1px solid var(--border-dim)',
                color: 'var(--text-secondary)', fontSize: 16, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >✕</button>
          </div>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
              <Spinner />
            </div>
          )}

          {error && (
            <div style={{
              padding: 20, borderRadius: 8,
              background: 'var(--red-dim)', border: '1px solid rgba(255,59,92,0.2)',
              color: 'var(--red)', fontFamily: 'var(--font-mono)', fontSize: 12
            }}>{error}</div>
          )}

          {data && (
            <>
              {/* Risk score hero */}
              <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-dim)',
                borderRadius: 12, padding: '24px', marginBottom: 16, textAlign: 'center'
              }}>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.15em',
                  color: 'var(--text-muted)', marginBottom: 12
                }}>30-DAY RISK SCORE</div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 52, fontWeight: 700,
                  lineHeight: 1, marginBottom: 12,
                  color: data.risk_score_30d > 0.85 ? 'var(--red)'
                    : data.risk_score_30d > 0.6 ? '#ff8c00'
                    : data.risk_score_30d > 0.3 ? 'var(--amber)'
                    : 'var(--green)',
                  textShadow: `0 0 30px currentColor`
                }}>
                  {(data.risk_score_30d * 100).toFixed(1)}
                  <span style={{ fontSize: 22, opacity: 0.6 }}>%</span>
                </div>
                <RiskBadge level={data.risk_tier} size="lg" />
              </div>

              {/* Stats grid */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr',
                gap: 10, marginBottom: 16
              }}>
                {[
                  { label: 'Transactions (30d)', value: data.txn_count_30d },
                  { label: 'Flagged', value: data.flagged_count_30d, color: data.flagged_count_30d > 0 ? 'var(--red)' : 'var(--green)' },
                  { label: 'Total Volume', value: fmt(data.total_amount_30d) },
                  { label: 'Avg Amount', value: fmt(data.avg_amount_30d) },
                  { label: 'Max Score', value: `${(data.max_score_30d * 100).toFixed(1)}%`, color: data.max_score_30d > 0.85 ? 'var(--red)' : 'var(--amber)' },
                ].map(stat => (
                  <div key={stat.label} style={{
                    background: 'var(--bg-card)', border: '1px solid var(--border-dim)',
                    borderRadius: 8, padding: '12px 14px'
                  }}>
                    <div style={{
                      fontSize: 10, color: 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)', marginBottom: 4
                    }}>{stat.label}</div>
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700,
                      color: stat.color || 'var(--text-primary)'
                    }}>{stat.value}</div>
                  </div>
                ))}
              </div>

              {/* Score bar */}
              <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-dim)',
                borderRadius: 8, padding: '14px 16px', marginBottom: 16
              }}>
                <div style={{
                  fontSize: 10, color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)', marginBottom: 10
                }}>FRAUD PROBABILITY</div>
                <ScoreBar score={data.risk_score_30d} width={320} />
                <div style={{
                  display: 'flex', justifyContent: 'space-between', marginTop: 6,
                  fontSize: 9, color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)'
                }}>
                  <span>LOW RISK</span><span>CRITICAL</span>
                </div>
              </div>

              {/* Last transaction */}
              {data.last_txn_at && (
                <div style={{
                  fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
                  padding: '10px 14px', background: 'var(--bg-card)',
                  border: '1px solid var(--border-dim)', borderRadius: 8
                }}>
                  LAST TXN: {new Date(data.last_txn_at).toLocaleString()}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
