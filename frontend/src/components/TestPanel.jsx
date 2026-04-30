import React, { useState } from 'react'
import { api } from '../lib/api.js'
import { RiskBadge, ScoreBar, Flag, MonoValue } from './ui.jsx'

const PRESETS = [
  {
    label: 'Normal Purchase',
    color: 'var(--green)',
    body: {
      user_id: 'usr_demo01', amount: 1299, merchant_category: 'grocery',
      merchant_id: 'merch_bigbazaar', device_id: 'dev_abc123',
      lat: 28.6139, lon: 77.209
    }
  },
  {
    label: 'Velocity Attack',
    color: 'var(--amber)',
    body: {
      user_id: 'usr_demo02', amount: 4999, merchant_category: 'electronics',
      merchant_id: 'merch_amazon01', device_id: 'dev_known01',
      lat: 19.076, lon: 72.877
    }
  },
  {
    label: 'Geo Anomaly + High Amount',
    color: 'var(--red)',
    body: {
      user_id: 'usr_demo03', amount: 89999, merchant_category: 'crypto_exchange',
      merchant_id: 'merch_newcrypto', device_id: 'dev_unknown_999',
      lat: 51.5074, lon: -0.1278
    }
  },
  {
    label: 'Night Transfer',
    color: '#ff8c00',
    body: {
      user_id: 'usr_demo04', amount: 45000, merchant_category: 'transfer',
      merchant_id: 'merch_intl_wire', device_id: 'dev_unknown_x',
      lat: 22.5726, lon: 88.363,
      timestamp: new Date(new Date().setHours(2, 30, 0, 0)).toISOString()
    }
  }
]

export default function TestPanel() {
  const [selected, setSelected] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [custom, setCustom] = useState({
    user_id: 'usr_test01',
    amount: '5000',
    merchant_category: 'retail',
    merchant_id: 'merch_test01',
    device_id: 'dev_test01',
    lat: '28.6139',
    lon: '77.2090'
  })

  const fire = async (body) => {
    setLoading(true)
    setResult(null)
    try {
      const r = await api.scoreTest({
        ...body,
        transaction_id: `txn_demo_${Date.now()}`,
        currency: 'INR',
        timestamp: body.timestamp || new Date().toISOString()
      })
      setResult(r)
    } catch (e) {
      setResult({ error: 'API error — is the backend running?' })
    }
    setLoading(false)
  }

  const cats = [
    'retail','food','electronics','travel','grocery','fuel',
    'healthcare','entertainment','utilities','crypto_exchange',
    'gambling','jewelry','atm','transfer'
  ]

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-dim)',
      borderRadius: 'var(--r-lg)', overflow: 'hidden', height: '100%',
      display: 'flex', flexDirection: 'column'
    }}>
      <div style={{
        padding: '14px 18px', borderBottom: '1px solid var(--border-dim)', flexShrink: 0
      }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.15em',
          color: 'var(--purple)', marginBottom: 2
        }}>TRANSACTION TESTER</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>fire test transactions in real time</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
        {/* Presets */}
        <div style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.12em',
            color: 'var(--text-muted)', marginBottom: 8
          }}>SCENARIO PRESETS</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => { setSelected(p.label); fire(p.body) }}
                style={{
                  padding: '10px 12px', borderRadius: 8, textAlign: 'left', cursor: 'pointer',
                  background: selected === p.label ? `${p.color}15` : 'var(--bg-elevated)',
                  border: `1px solid ${selected === p.label ? p.color + '55' : 'var(--border-dim)'}`,
                  color: p.color, fontFamily: 'var(--font-mono)', fontSize: 10,
                  letterSpacing: '0.05em', transition: 'all 0.15s',
                  lineHeight: 1.4
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom fields */}
        <div style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.12em',
            color: 'var(--text-muted)', marginBottom: 8
          }}>CUSTOM TRANSACTION</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            {[
              { key: 'user_id', label: 'User ID' },
              { key: 'amount', label: 'Amount (INR)' },
              { key: 'merchant_id', label: 'Merchant ID' },
              { key: 'device_id', label: 'Device ID' },
            ].map(f => (
              <div key={f.key}>
                <div style={{
                  fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)',
                  marginBottom: 3, letterSpacing: '0.08em'
                }}>{f.label}</div>
                <input
                  value={custom[f.key]}
                  onChange={e => setCustom(p => ({ ...p, [f.key]: e.target.value }))}
                  style={{
                    width: '100%', padding: '6px 10px', borderRadius: 4,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border-dim)',
                    color: 'var(--text-primary)', fontSize: 11, fontFamily: 'var(--font-mono)',
                    outline: 'none'
                  }}
                />
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{
              fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)',
              marginBottom: 3, letterSpacing: '0.08em'
            }}>MERCHANT CATEGORY</div>
            <select
              value={custom.merchant_category}
              onChange={e => setCustom(p => ({ ...p, merchant_category: e.target.value }))}
              style={{
                width: '100%', padding: '6px 10px', borderRadius: 4,
                background: 'var(--bg-elevated)', border: '1px solid var(--border-dim)',
                color: 'var(--text-primary)', fontSize: 11, fontFamily: 'var(--font-mono)',
                outline: 'none'
              }}
            >
              {cats.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            {[{ key: 'lat', label: 'Latitude' }, { key: 'lon', label: 'Longitude' }].map(f => (
              <div key={f.key}>
                <div style={{
                  fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)',
                  marginBottom: 3, letterSpacing: '0.08em'
                }}>{f.label}</div>
                <input
                  value={custom[f.key]}
                  onChange={e => setCustom(p => ({ ...p, [f.key]: e.target.value }))}
                  style={{
                    width: '100%', padding: '6px 10px', borderRadius: 4,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border-dim)',
                    color: 'var(--text-primary)', fontSize: 11, fontFamily: 'var(--font-mono)',
                    outline: 'none'
                  }}
                />
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              setSelected('custom')
              fire({
                ...custom,
                amount: parseFloat(custom.amount),
                lat: parseFloat(custom.lat),
                lon: parseFloat(custom.lon)
              })
            }}
            disabled={loading}
            style={{
              width: '100%', padding: '10px', borderRadius: 8, cursor: loading ? 'wait' : 'pointer',
              background: 'var(--purple-dim)', border: '1px solid rgba(180,95,255,0.35)',
              color: 'var(--purple)', fontFamily: 'var(--font-mono)', fontSize: 11,
              letterSpacing: '0.1em', transition: 'all 0.15s',
              opacity: loading ? 0.5 : 1
            }}
          >
            {loading ? 'SCORING...' : '▶ FIRE TRANSACTION'}
          </button>
        </div>

        {/* Result */}
        {result && (
          <div style={{
            borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-glow)',
            animation: 'fade-in-up 0.3s ease'
          }}>
            {result.error ? (
              <div style={{ padding: 14, background: 'var(--red-dim)', color: 'var(--red)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                {result.error}
              </div>
            ) : (
              <>
                <div style={{
                  padding: '12px 14px', background: 'var(--bg-elevated)',
                  borderBottom: '1px solid var(--border-dim)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <RiskBadge level={result.risk_level} size="lg" />
                    <MonoValue size={11} color="var(--text-muted)">{result.processing_ms}ms</MonoValue>
                  </div>
                  <ScoreBar score={result.fraud_score} width={280} />
                </div>
                <div style={{ padding: '12px 14px' }}>
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10
                  }}>
                    {[
                      { label: 'FRAUD SCORE', value: (result.fraud_score * 100).toFixed(1) + '%', color: result.fraud_score > 0.6 ? 'var(--red)' : 'var(--green)' },
                      { label: 'DECISION', value: result.decision?.toUpperCase(), color: result.decision === 'block' ? 'var(--red)' : result.decision === 'review' ? 'var(--amber)' : 'var(--green)' },
                    ].map(s => (
                      <div key={s.label}>
                        <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: 2 }}>{s.label}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: s.color }}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                  {result.rule_flags?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: 5 }}>TRIGGERED RULES</div>
                      {result.rule_flags.map(f => <Flag key={f} text={f} />)}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
