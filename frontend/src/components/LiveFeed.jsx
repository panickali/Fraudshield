import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useLiveStream } from '../hooks/usePolling.js'
import { RiskBadge, ScoreBar, Flag, MonoValue, GlowDot, fmt, timeAgo } from './ui.jsx'

export default function LiveFeed({ onSelect }) {
  const [events, setEvents] = useState([])
  const listRef = useRef(null)

  const onEvent = useCallback((evt) => {
    setEvents(prev => [evt, ...prev].slice(0, 60))
  }, [])

  const connected = useLiveStream(onEvent)

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0
    }
  }, [events.length])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--bg-card)',
      border: '1px solid var(--border-dim)',
      borderRadius: 'var(--r-lg)', overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px', borderBottom: '1px solid var(--border-dim)',
        flexShrink: 0
      }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.15em',
            color: 'var(--cyan)', marginBottom: 2
          }}>LIVE TRANSACTION FEED</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {events.length} events captured
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <GlowDot
            color={connected ? 'var(--green)' : 'var(--red)'}
            size={7}
            pulse={connected}
          />
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: connected ? 'var(--green)' : 'var(--red)'
          }}>
            {connected ? 'STREAMING' : 'RECONNECTING'}
          </span>
        </div>
      </div>

      {/* Feed */}
      <div ref={listRef} style={{ overflowY: 'auto', flex: 1 }}>
        {events.length === 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: 120, color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)',
            fontSize: 11
          }}>
            WAITING FOR EVENTS...
          </div>
        )}
        {events.map((e, i) => (
          <FeedRow key={e.transaction_id + i} event={e} isNew={i === 0} onSelect={onSelect} />
        ))}
      </div>
    </div>
  )
}

function FeedRow({ event, isNew, onSelect }) {
  const isBad = event.risk_level === 'high' || event.risk_level === 'critical'
  const accentColor = event.risk_level === 'critical' ? 'var(--red)'
    : event.risk_level === 'high' ? '#ff8c00'
    : event.risk_level === 'medium' ? 'var(--amber)'
    : 'var(--green)'

  return (
    <div
      onClick={() => onSelect && onSelect(event)}
      style={{
        padding: '10px 18px',
        borderBottom: '1px solid var(--border-dim)',
        borderLeft: `2px solid ${isBad ? accentColor : 'transparent'}`,
        cursor: 'pointer',
        transition: 'background 0.15s',
        animation: isNew ? 'fade-in-up 0.3s ease both' : 'none',
        background: isNew && isBad ? `${accentColor}06` : 'transparent'
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
      onMouseLeave={e => e.currentTarget.style.background = isNew && isBad ? `${accentColor}06` : 'transparent'}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RiskBadge level={event.risk_level} />
          <MonoValue size={11} color="var(--text-secondary)">
            {event.user_id}
          </MonoValue>
        </div>
        <MonoValue size={10} color="var(--text-muted)">
          {timeAgo(event.created_at)}
        </MonoValue>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
            color: 'var(--text-primary)'
          }}>
            {fmt(event.amount)}
          </span>
          <span style={{
            marginLeft: 8, fontSize: 10, color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)'
          }}>
            {event.merchant_category}
          </span>
        </div>
        <ScoreBar score={event.fraud_score || 0} width={80} />
      </div>
      {isBad && event.rule_flags?.length > 0 && (
        <div style={{ marginTop: 5 }}>
          {event.rule_flags.slice(0, 3).map(f => <Flag key={f} text={f} />)}
        </div>
      )}
    </div>
  )
}
