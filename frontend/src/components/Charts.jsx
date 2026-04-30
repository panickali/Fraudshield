import React from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts'
import { Panel, PanelHeader } from './ui.jsx'

const COLORS = {
  low: '#00ff9d', medium: '#ffb700', high: '#ff8c00', critical: '#ff3b5c'
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg-elevated)', border: '1px solid var(--border-glow)',
      borderRadius: 6, padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 11
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color || 'var(--cyan)' }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed ? p.value.toFixed(3) : p.value : p.value}
        </div>
      ))}
    </div>
  )
}

export function HourlyChart({ data }) {
  const formatted = (data || []).map(d => ({
    ...d,
    hour: new Date(d.hour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }))

  return (
    <Panel style={{ padding: '16px' }}>
      <PanelHeader label="TRANSACTION VOLUME · 24H" sub="total vs fraud detected" />
      <div style={{ height: 160, marginTop: 12 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={formatted} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
            <defs>
              <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00c8ff" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#00c8ff" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="fraudGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ff3b5c" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#ff3b5c" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="hour" tick={{ fill: '#3a6480', fontSize: 9, fontFamily: 'Space Mono' }} tickLine={false} axisLine={false} interval={2} />
            <YAxis tick={{ fill: '#3a6480', fontSize: 9, fontFamily: 'Space Mono' }} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="total" stroke="#00c8ff" strokeWidth={1.5} fill="url(#totalGrad)" name="total" />
            <Area type="monotone" dataKey="fraud" stroke="#ff3b5c" strokeWidth={1.5} fill="url(#fraudGrad)" name="fraud" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  )
}

export function ScoreDistChart({ data }) {
  const ordered = ['low', 'medium', 'high', 'critical'].map(bucket => {
    const found = (data || []).find(d => d.bucket === bucket)
    return { bucket, count: found ? Number(found.count) : 0 }
  })

  return (
    <Panel style={{ padding: '16px' }}>
      <PanelHeader label="RISK DISTRIBUTION · 24H" />
      <div style={{ height: 160, marginTop: 12 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={ordered} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
            <XAxis dataKey="bucket" tick={{ fill: '#3a6480', fontSize: 9, fontFamily: 'Space Mono' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: '#3a6480', fontSize: 9, fontFamily: 'Space Mono' }} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" radius={[3,3,0,0]} name="transactions">
              {ordered.map(entry => (
                <Cell key={entry.bucket} fill={COLORS[entry.bucket]} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  )
}

export function CategoryChart({ data }) {
  const sorted = [...(data || [])].sort((a, b) => b.fraud_count - a.fraud_count).slice(0, 6)

  return (
    <Panel style={{ padding: '16px' }}>
      <PanelHeader label="MERCHANT CATEGORY RISK" />
      <div style={{ marginTop: 12 }}>
        {sorted.map((cat, i) => {
          const fraudRate = cat.count > 0 ? cat.fraud_count / cat.count : 0
          const color = fraudRate > 0.3 ? 'var(--red)'
            : fraudRate > 0.15 ? '#ff8c00'
            : fraudRate > 0.05 ? 'var(--amber)'
            : 'var(--green)'
          return (
            <div key={cat.merchant_category} style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
              animation: `fade-in-up ${0.1 + i * 0.05}s ease both`
            }}>
              <div style={{
                width: 90, fontSize: 10, fontFamily: 'var(--font-mono)',
                color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap'
              }}>
                {cat.merchant_category}
              </div>
              <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                <div style={{
                  width: `${fraudRate * 100}%`, height: '100%',
                  background: `linear-gradient(90deg, ${color}88, ${color})`,
                  boxShadow: `0 0 6px ${color}66`, borderRadius: 3,
                  transition: 'width 0.6s ease', minWidth: fraudRate > 0 ? 4 : 0
                }}/>
              </div>
              <div style={{
                width: 40, textAlign: 'right', fontSize: 10,
                fontFamily: 'var(--font-mono)', color
              }}>
                {(fraudRate * 100).toFixed(1)}%
              </div>
              <div style={{ width: 28, textAlign: 'right', fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {cat.fraud_count}
              </div>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

export function TopUsersPanel({ data }) {
  return (
    <Panel style={{ padding: '16px' }}>
      <PanelHeader label="TOP FLAGGED USERS · 24H" />
      <div style={{ marginTop: 12 }}>
        {(data || []).map((u, i) => (
          <div key={u.user_id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 0', borderBottom: '1px solid var(--border-dim)',
            animation: `fade-in-up ${0.1 + i * 0.06}s ease both`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 18, height: 18, borderRadius: '50%', background: 'var(--red-dim)',
                border: '1px solid rgba(255,59,92,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--red)', flexShrink: 0
              }}>{i+1}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--cyan)' }}>
                {u.user_id}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {u.flag_count} flags
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 11,
                color: u.max_score > 0.85 ? 'var(--red)' : u.max_score > 0.6 ? '#ff8c00' : 'var(--amber)'
              }}>
                {(u.max_score * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        ))}
        {(!data || data.length === 0) && (
          <div style={{
            textAlign: 'center', padding: 24, color: 'var(--text-ghost)',
            fontFamily: 'var(--font-mono)', fontSize: 10
          }}>NO FLAGGED USERS</div>
        )}
      </div>
    </Panel>
  )
}
