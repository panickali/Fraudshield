import React, { useState } from 'react'
import { usePolling } from '../hooks/usePolling.js'
import { api } from '../lib/api.js'
import { RiskBadge, ScoreBar, Flag, Panel, PanelHeader, MonoValue, Spinner, fmt, timeAgo } from './ui.jsx'

export default function AlertsPanel({ onSelectUser }) {
  const [filter, setFilter] = useState('')
  const [resolving, setResolving] = useState(null)

  const params = filter ? `severity=${filter}&status=open` : 'status=open'
  const { data, loading, refetch } = usePolling(() => api.alerts(params), 8000, [params])

  const resolve = async (alertId) => {
    setResolving(alertId)
    try {
      await api.resolveAlert(alertId)
      refetch()
    } catch {}
    setResolving(null)
  }

  const alerts = data?.alerts || []

  const filters = [
    { value: '', label: 'ALL' },
    { value: 'critical', label: 'CRITICAL' },
    { value: 'high', label: 'HIGH' },
    { value: 'medium', label: 'MEDIUM' },
  ]

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--bg-card)',
      border: '1px solid var(--border-dim)',
      borderRadius: 'var(--r-lg)', overflow: 'hidden'
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px', borderBottom: '1px solid var(--border-dim)', flexShrink: 0
      }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.15em',
            color: 'var(--red)', marginBottom: 2
          }}>OPEN ALERTS</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {data?.total ?? '—'} total · click to inspect user
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {filters.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              style={{
                padding: '4px 10px',
                borderRadius: 4,
                fontFamily: 'var(--font-mono)', fontSize: 9,
                letterSpacing: '0.1em',
                background: filter === f.value ? 'var(--red-dim)' : 'transparent',
                border: `1px solid ${filter === f.value ? 'rgba(255,59,92,0.4)' : 'var(--border-dim)'}`,
                color: filter === f.value ? 'var(--red)' : 'var(--text-muted)',
                transition: 'all 0.15s'
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ overflowY: 'auto', flex: 1 }}>
        {loading && alerts.length === 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <Spinner />
          </div>
        )}
        {!loading && alerts.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: 120, gap: 8,
            color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)', fontSize: 11
          }}>
            <span style={{ fontSize: 24 }}>✓</span>
            NO OPEN ALERTS
          </div>
        )}
        {alerts.map(a => (
          <AlertRow
            key={a.id}
            alert={a}
            onResolve={() => resolve(a.id)}
            resolving={resolving === a.id}
            onSelectUser={() => onSelectUser && onSelectUser(a.user_id)}
          />
        ))}
      </div>
    </div>
  )
}

function AlertRow({ alert, onResolve, resolving, onSelectUser }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '12px 18px',
        borderBottom: '1px solid var(--border-dim)',
        borderLeft: `2px solid ${alert.severity === 'critical' ? 'var(--red)' : '#ff8c00'}`,
        background: hovered ? 'var(--bg-elevated)' : 'transparent',
        transition: 'background 0.15s'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RiskBadge level={alert.severity} />
          <button
            onClick={onSelectUser}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 11,
              color: 'var(--cyan)', background: 'none', border: 'none',
              cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3
            }}
          >
            {alert.user_id}
          </button>
        </div>
        <MonoValue size={10} color="var(--text-muted)">
          {timeAgo(alert.created_at)}
        </MonoValue>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div>
          <MonoValue size={13} color="var(--text-primary)">{fmt(alert.amount)}</MonoValue>
          <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {alert.merchant_category}
          </span>
        </div>
        <ScoreBar score={alert.fraud_score || 0} width={80} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          {(alert.rule_flags || []).slice(0, 4).map(f => <Flag key={f} text={f} />)}
        </div>
        {hovered && (
          <button
            onClick={onResolve}
            disabled={resolving}
            style={{
              padding: '3px 12px', borderRadius: 4, fontSize: 10,
              fontFamily: 'var(--font-mono)', letterSpacing: '0.08em',
              background: 'var(--green-dim)', border: '1px solid rgba(0,255,157,0.3)',
              color: 'var(--green)', cursor: resolving ? 'wait' : 'pointer',
              opacity: resolving ? 0.5 : 1
            }}
          >
            {resolving ? '...' : 'RESOLVE ✓'}
          </button>
        )}
      </div>
    </div>
  )
}
