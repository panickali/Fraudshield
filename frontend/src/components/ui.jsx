import React from 'react'

export function RiskBadge({ level, size = 'sm' }) {
  const map = {
    low:      { color: 'var(--green)',  bg: 'var(--green-dim)',  label: 'LOW' },
    medium:   { color: 'var(--amber)',  bg: 'var(--amber-dim)',  label: 'MED' },
    high:     { color: '#ff8c00',       bg: 'rgba(255,140,0,0.12)', label: 'HIGH' },
    critical: { color: 'var(--red)',    bg: 'var(--red-dim)',    label: 'CRIT' },
  }
  const s = map[level] || map.low
  const pad = size === 'lg' ? '4px 12px' : '2px 7px'
  const fs  = size === 'lg' ? '12px' : '10px'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: pad, borderRadius: 3,
      background: s.bg, border: `1px solid ${s.color}33`,
      color: s.color, fontSize: fs, fontFamily: 'var(--font-mono)',
      fontWeight: 700, letterSpacing: '0.08em',
      textShadow: `0 0 8px ${s.color}88`
    }}>
      <span style={{
        width: size === 'lg' ? 7 : 5, height: size === 'lg' ? 7 : 5,
        borderRadius: '50%', background: s.color,
        boxShadow: `0 0 6px ${s.color}`
      }}/>
      {s.label}
    </span>
  )
}

export function ScoreBar({ score, width = 120 }) {
  const color = score < 0.3 ? 'var(--green)'
    : score < 0.6 ? 'var(--amber)'
    : score < 0.85 ? '#ff8c00'
    : 'var(--red)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width, height: 4, borderRadius: 2,
        background: 'var(--bg-elevated)', overflow: 'hidden'
      }}>
        <div style={{
          width: `${score * 100}%`, height: '100%',
          background: `linear-gradient(90deg, transparent, ${color})`,
          boxShadow: `0 0 6px ${color}`,
          transition: 'width 0.5s ease'
        }}/>
      </div>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 11,
        color, minWidth: 36, textAlign: 'right'
      }}>
        {(score * 100).toFixed(0)}%
      </span>
    </div>
  )
}

export function MonoValue({ children, color = 'var(--text-primary)', size = 14 }) {
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: size, color }}>
      {children}
    </span>
  )
}

export function GlowDot({ color = 'var(--cyan)', size = 8, pulse = false }) {
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: size, height: size }}>
      {pulse && <span style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: color, animation: 'pulse-ring 1.5s ease-out infinite'
      }}/>}
      <span style={{
        display: 'block', width: size, height: size, borderRadius: '50%',
        background: color, boxShadow: `0 0 8px ${color}`
      }}/>
    </span>
  )
}

export function Panel({ children, style = {}, glow = false }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: `1px solid ${glow ? 'var(--border-glow)' : 'var(--border-dim)'}`,
      borderRadius: 'var(--r-lg)',
      ...(glow ? { boxShadow: '0 0 20px rgba(0,200,255,0.05)' } : {}),
      ...style
    }}>
      {children}
    </div>
  )
}

export function PanelHeader({ label, sub, right }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 18px',
      borderBottom: '1px solid var(--border-dim)'
    }}>
      <div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.15em',
          color: 'var(--cyan)', marginBottom: 2
        }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub}</div>}
      </div>
      {right && <div>{right}</div>}
    </div>
  )
}

export function Spinner() {
  return (
    <div style={{
      width: 20, height: 20, borderRadius: '50%',
      border: '2px solid var(--border-dim)',
      borderTopColor: 'var(--cyan)',
      animation: 'spin 0.8s linear infinite'
    }}/>
  )
}

export function Flag({ text }) {
  return (
    <span style={{
      display: 'inline-block', padding: '1px 6px',
      background: 'var(--red-dim)', border: '1px solid rgba(255,59,92,0.25)',
      borderRadius: 3, fontSize: 9, fontFamily: 'var(--font-mono)',
      color: 'var(--red)', letterSpacing: '0.05em', marginRight: 4, marginBottom: 2
    }}>
      {text.replace(/_/g, ' ').toUpperCase()}
    </span>
  )
}

export function fmt(n) {
  if (n === null || n === undefined) return '—'
  if (n >= 1e7) return `₹${(n/1e7).toFixed(1)}Cr`
  if (n >= 1e5) return `₹${(n/1e5).toFixed(1)}L`
  if (n >= 1e3) return `₹${(n/1e3).toFixed(1)}K`
  return `₹${Number(n).toLocaleString('en-IN')}`
}

export function fmtNum(n) {
  if (!n && n !== 0) return '—'
  return Number(n).toLocaleString()
}

export function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s/60)}m ago`
  if (s < 86400) return `${Math.floor(s/3600)}h ago`
  return `${Math.floor(s/86400)}d ago`
}
