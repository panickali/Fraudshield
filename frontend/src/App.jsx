import React, { useState } from 'react'
import { usePolling } from './hooks/usePolling.js'
import { api } from './lib/api.js'
import StatCards from './components/StatCards.jsx'
import LiveFeed from './components/LiveFeed.jsx'
import AlertsPanel from './components/AlertsPanel.jsx'
import { HourlyChart, ScoreDistChart, CategoryChart, TopUsersPanel } from './components/Charts.jsx'
import UserDrawer from './components/UserDrawer.jsx'
import TestPanel from './components/TestPanel.jsx'
import { GlowDot, Spinner } from './components/ui.jsx'

const NAV_ITEMS = [
  { id: 'overview',      icon: '◈', label: 'Overview' },
  { id: 'live',          icon: '⬤', label: 'Live Feed' },
  { id: 'alerts',        icon: '⚠', label: 'Alerts' },
  { id: 'analytics',     icon: '▦', label: 'Analytics' },
  { id: 'test',          icon: '▷', label: 'Test Terminal' },
]

export default function App() {
  const [page, setPage] = useState('overview')
  const [selectedUser, setSelectedUser] = useState(null)
  const [selectedTxn, setSelectedTxn] = useState(null)

  const { data: stats, loading: statsLoading } = usePolling(() => api.stats(), 10000)

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: 'var(--bg-void)',
      backgroundImage: `
        radial-gradient(ellipse at 15% 50%, rgba(0,200,255,0.04) 0%, transparent 50%),
        radial-gradient(ellipse at 85% 20%, rgba(180,95,255,0.04) 0%, transparent 40%)
      `
    }}>

      {/* Sidebar */}
      <Sidebar page={page} setPage={setPage} stats={stats} />

      {/* Main content */}
      <main style={{
        flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column'
      }}>
        {/* Top bar */}
        <TopBar page={page} stats={stats} />

        {/* Page content */}
        <div style={{ flex: 1, overflow: 'hidden', padding: '0 20px 20px' }}>
          {page === 'overview' && (
            <OverviewPage
              stats={stats} loading={statsLoading}
              onSelectUser={setSelectedUser}
              onSelectTxn={setSelectedTxn}
            />
          )}
          {page === 'live' && (
            <LivePage onSelectTxn={setSelectedTxn} onSelectUser={setSelectedUser} />
          )}
          {page === 'alerts' && (
            <AlertsPage onSelectUser={setSelectedUser} />
          )}
          {page === 'analytics' && (
            <AnalyticsPage stats={stats} />
          )}
          {page === 'test' && (
            <TestPage />
          )}
        </div>
      </main>

      {/* User drawer */}
      {selectedUser && (
        <UserDrawer userId={selectedUser} onClose={() => setSelectedUser(null)} />
      )}
    </div>
  )
}

// ── Sidebar ────────────────────────────────────────────────────────────────────
function Sidebar({ page, setPage, stats }) {
  const criticalCount = stats?.summary?.critical_24h || 0

  return (
    <aside style={{
      width: 220, flexShrink: 0,
      background: 'var(--bg-deep)',
      borderRight: '1px solid var(--border-dim)',
      display: 'flex', flexDirection: 'column',
      padding: '0 0 20px'
    }}>
      {/* Logo */}
      <div style={{
        padding: '24px 20px 20px',
        borderBottom: '1px solid var(--border-dim)',
        marginBottom: 12
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, var(--cyan-dim), var(--purple-dim))',
            border: '1px solid var(--border-glow)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, animation: 'glow-pulse 3s ease-in-out infinite'
          }}>⬡</div>
          <div>
            <div style={{
              fontFamily: 'var(--font-display)', fontWeight: 800,
              fontSize: 15, color: 'var(--text-primary)', letterSpacing: '0.02em'
            }}>FRAUD<span style={{ color: 'var(--cyan)' }}>SHIELD</span></div>
          </div>
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)',
          letterSpacing: '0.15em'
        }}>NEURAL FRAUD INTELLIGENCE</div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '0 10px' }}>
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: 8, marginBottom: 2,
              background: page === item.id ? 'var(--cyan-dim)' : 'transparent',
              border: `1px solid ${page === item.id ? 'var(--border-glow)' : 'transparent'}`,
              color: page === item.id ? 'var(--cyan)' : 'var(--text-muted)',
              fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: page === item.id ? 600 : 400,
              cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
              position: 'relative'
            }}
            onMouseEnter={e => { if (page !== item.id) e.currentTarget.style.background = 'var(--bg-card)' }}
            onMouseLeave={e => { if (page !== item.id) e.currentTarget.style.background = 'transparent' }}
          >
            <span style={{ fontSize: 14, opacity: page === item.id ? 1 : 0.5 }}>{item.icon}</span>
            {item.label}
            {item.id === 'alerts' && criticalCount > 0 && (
              <span style={{
                marginLeft: 'auto', minWidth: 18, height: 18, borderRadius: 9,
                background: 'var(--red)', color: '#fff', fontSize: 9,
                fontFamily: 'var(--font-mono)', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 4px', boxShadow: '0 0 8px var(--red)'
              }}>{criticalCount}</span>
            )}
          </button>
        ))}
      </nav>

      {/* Footer info */}
      <div style={{
        padding: '12px 20px',
        borderTop: '1px solid var(--border-dim)'
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6
        }}>
          <GlowDot color="var(--green)" size={6} pulse />
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--green)',
            letterSpacing: '0.1em'
          }}>SYSTEM ONLINE</span>
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}>
          API KEY: demo_key_*****
        </div>
      </div>
    </aside>
  )
}

// ── Top bar ────────────────────────────────────────────────────────────────────
function TopBar({ page, stats }) {
  const now = new Date()
  const pageLabels = {
    overview: 'System Overview',
    live: 'Live Transaction Stream',
    alerts: 'Alert Management',
    analytics: 'Risk Analytics',
    test: 'Transaction Test Terminal'
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '16px 20px', flexShrink: 0,
      borderBottom: '1px solid var(--border-dim)'
    }}>
      <div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.15em',
          color: 'var(--text-muted)', marginBottom: 2
        }}>FRAUDSHIELD CONSOLE</div>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700,
          color: 'var(--text-primary)'
        }}>{pageLabels[page]}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--cyan)', letterSpacing: '0.08em'
          }}>
            {now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--text-muted)'
          }}>
            {now.toLocaleTimeString('en-IN')}
          </div>
        </div>
        <div style={{
          padding: '6px 14px', borderRadius: 6,
          background: 'var(--cyan-dim)', border: '1px solid var(--border-glow)',
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--cyan)'
        }}>
          RF_V1 · ACTIVE
        </div>
      </div>
    </div>
  )
}

// ── Pages ──────────────────────────────────────────────────────────────────────
function OverviewPage({ stats, loading, onSelectUser, onSelectTxn }) {
  if (loading && !stats) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60%' }}>
      <div style={{ textAlign: 'center' }}>
        <Spinner />
        <div style={{ marginTop: 12, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
          CONNECTING TO FRAUDSHIELD API...
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 16 }}>
      <StatCards data={stats} />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 340px', gap: 14, minHeight: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflow: 'hidden' }}>
          <HourlyChart data={stats?.hourly} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, flex: 1 }}>
            <ScoreDistChart data={stats?.score_distribution} />
            <TopUsersPanel data={stats?.top_flagged_users} />
          </div>
        </div>
        <div style={{ minHeight: 0 }}>
          <AlertsPanel onSelectUser={onSelectUser} />
        </div>
      </div>
    </div>
  )
}

function LivePage({ onSelectTxn, onSelectUser }) {
  return (
    <div style={{ height: '100%', display: 'grid', gridTemplateColumns: '1fr 340px', gap: 14, paddingTop: 16 }}>
      <LiveFeed onSelect={t => onSelectUser && onSelectUser(t.user_id)} />
      <AlertsPanel onSelectUser={onSelectUser} />
    </div>
  )
}

function AlertsPage({ onSelectUser }) {
  return (
    <div style={{ height: '100%', paddingTop: 16 }}>
      <AlertsPanel onSelectUser={onSelectUser} />
    </div>
  )
}

function AnalyticsPage({ stats }) {
  return (
    <div style={{ height: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 14, paddingTop: 16 }}>
      <HourlyChart data={stats?.hourly} />
      <ScoreDistChart data={stats?.score_distribution} />
      <CategoryChart data={stats?.category_breakdown} />
      <TopUsersPanel data={stats?.top_flagged_users} />
    </div>
  )
}

function TestPage() {
  return (
    <div style={{ height: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, paddingTop: 16 }}>
      <TestPanel />
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-dim)',
        borderRadius: 'var(--r-lg)', padding: 20, overflowY: 'auto'
      }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.15em',
          color: 'var(--cyan)', marginBottom: 16
        }}>API REFERENCE</div>
        <ApiDocs />
      </div>
    </div>
  )
}

function ApiDocs() {
  const endpoints = [
    {
      method: 'POST', path: '/v1/transaction',
      desc: 'Score a transaction in real time',
      color: '#00ff9d',
      body: `{
  "user_id": "usr_001",
  "amount": 14999,
  "merchant_category": "electronics",
  "merchant_id": "merch_xyz",
  "device_id": "dev_abc",
  "lat": 28.6139,
  "lon": 77.2090
}`
    },
    {
      method: 'GET', path: '/v1/alerts',
      desc: 'List open fraud alerts',
      color: 'var(--cyan)',
      body: `?severity=critical&status=open&page=1&limit=20`
    },
    {
      method: 'GET', path: '/v1/user-risk-score/:id',
      desc: 'Get 30-day user risk profile',
      color: 'var(--cyan)',
      body: null
    },
    {
      method: 'GET', path: '/v1/dashboard/stats',
      desc: 'Dashboard analytics summary',
      color: 'var(--cyan)',
      body: null
    },
    {
      method: 'PATCH', path: '/v1/alerts/:id/resolve',
      desc: 'Mark alert as resolved',
      color: 'var(--amber)',
      body: null
    },
    {
      method: 'GET', path: '/v1/stream',
      desc: 'SSE live transaction stream',
      color: 'var(--purple)',
      body: null
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        padding: '10px 12px', borderRadius: 6,
        background: 'rgba(0,200,255,0.05)', border: '1px solid var(--border-dim)',
        fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)'
      }}>
        Authorization: Bearer demo_key_fraudshield_2024
      </div>
      {endpoints.map(ep => (
        <div key={ep.path} style={{
          borderRadius: 8, overflow: 'hidden',
          border: '1px solid var(--border-dim)'
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', background: 'var(--bg-elevated)'
          }}>
            <span style={{
              padding: '2px 7px', borderRadius: 3, fontSize: 9,
              fontFamily: 'var(--font-mono)', fontWeight: 700,
              background: ep.method === 'POST' ? 'rgba(0,255,157,0.15)'
                : ep.method === 'PATCH' ? 'rgba(255,183,0,0.15)'
                : ep.method === 'GET' && ep.path.includes('stream') ? 'rgba(180,95,255,0.15)'
                : 'rgba(0,200,255,0.1)',
              color: ep.color, border: `1px solid ${ep.color}33`
            }}>{ep.method}</span>
            <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)' }}>
              {ep.path}
            </code>
          </div>
          <div style={{ padding: '8px 12px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: ep.body ? 8 : 0 }}>
              {ep.desc}
            </div>
            {ep.body && (
              <pre style={{
                fontFamily: 'var(--font-mono)', fontSize: 10,
                color: 'var(--text-secondary)', lineHeight: 1.7,
                background: 'var(--bg-void)', padding: '8px 10px',
                borderRadius: 4, margin: 0, overflow: 'auto'
              }}>{ep.body}</pre>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
