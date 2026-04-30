import React from 'react'
import { fmt, fmtNum, GlowDot } from './ui.jsx'

function StatCard({ label, value, sub, color = 'var(--cyan)', icon, trend }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-dim)',
      borderTop: `2px solid ${color}`,
      borderRadius: 'var(--r-lg)',
      padding: '16px 20px',
      position: 'relative',
      overflow: 'hidden',
      animation: 'fade-in-up 0.4s ease both'
    }}>
      <div style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
        background: `radial-gradient(ellipse at top right, ${color}08 0%, transparent 60%)`,
        pointerEvents: 'none'
      }}/>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.18em',
        color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase'
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 700,
        color, lineHeight: 1, marginBottom: 6,
        textShadow: `0 0 20px ${color}55`
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>
      )}
    </div>
  )
}

export default function StatCards({ data }) {
  if (!data) return null
  const s = data.summary || {}
  const fraudRate = s.txn_24h > 0
    ? ((s.fraud_24h / s.txn_24h) * 100).toFixed(1)
    : '0.0'

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(5, 1fr)',
      gap: 12
    }}>
      <StatCard
        label="Transactions · 24H"
        value={fmtNum(s.txn_24h) || '0'}
        sub={`${fmtNum(s.txn_1h) || 0} in last hour`}
        color="var(--cyan)"
      />
      <StatCard
        label="Volume · 24H"
        value={fmt(s.volume_24h) || '₹0'}
        sub="total processed value"
        color="var(--green)"
      />
      <StatCard
        label="Fraud Rate · 24H"
        value={`${fraudRate}%`}
        sub={`${fmtNum(s.fraud_24h) || 0} flagged transactions`}
        color={parseFloat(fraudRate) > 5 ? 'var(--red)' : 'var(--amber)'}
      />
      <StatCard
        label="Critical Alerts"
        value={fmtNum(s.critical_24h) || '0'}
        sub="severity: critical"
        color="var(--red)"
      />
      <StatCard
        label="Avg Risk Score"
        value={s.avg_score_24h ? (s.avg_score_24h * 100).toFixed(1) + '%' : '—'}
        sub="24h rolling average"
        color="var(--purple)"
      />
    </div>
  )
}
