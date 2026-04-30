-- FraudShield Database Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tenants
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(128) NOT NULL,
    api_key VARCHAR(64) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions (partitioned by month conceptually)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id VARCHAR(64) UNIQUE NOT NULL,
    tenant_id UUID REFERENCES tenants(id),
    user_id VARCHAR(64) NOT NULL,
    amount NUMERIC(14,2) NOT NULL,
    currency CHAR(3) DEFAULT 'INR',
    merchant_id VARCHAR(64),
    merchant_category VARCHAR(64),
    device_id VARCHAR(128),
    ip_address VARCHAR(45),
    lat NUMERIC(9,6),
    lon NUMERIC(9,6),
    fraud_score NUMERIC(4,3),
    risk_level VARCHAR(10),
    decision VARCHAR(10),
    rule_flags TEXT[],
    model_version VARCHAR(20) DEFAULT 'rf_v1',
    processing_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_txn_user ON transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_txn_tenant ON transactions(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_txn_score ON transactions(fraud_score) WHERE fraud_score > 0.6;
CREATE INDEX IF NOT EXISTS idx_txn_created ON transactions(created_at DESC);

-- Alerts
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id VARCHAR(64) REFERENCES transactions(transaction_id),
    tenant_id UUID REFERENCES tenants(id),
    user_id VARCHAR(64),
    severity VARCHAR(10) NOT NULL,
    status VARCHAR(10) DEFAULT 'open',
    fraud_score NUMERIC(4,3),
    rule_flags TEXT[],
    amount NUMERIC(14,2),
    merchant_category VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_alert_tenant ON alerts(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_status ON alerts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_severity ON alerts(severity, created_at DESC);

-- User risk profiles
CREATE TABLE IF NOT EXISTS user_risk_profiles (
    user_id VARCHAR(64) NOT NULL,
    tenant_id UUID REFERENCES tenants(id),
    risk_score_30d NUMERIC(4,3) DEFAULT 0,
    risk_tier VARCHAR(10) DEFAULT 'low',
    txn_count_30d INTEGER DEFAULT 0,
    flagged_count_30d INTEGER DEFAULT 0,
    total_amount_30d NUMERIC(16,2) DEFAULT 0,
    avg_amount_30d NUMERIC(14,2) DEFAULT 0,
    top_flags TEXT[],
    last_txn_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, tenant_id)
);

-- Fraud pattern rules
CREATE TABLE IF NOT EXISTS fraud_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(64) UNIQUE NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT true,
    threshold NUMERIC(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default tenant
INSERT INTO tenants (id, name, api_key) VALUES
('00000000-0000-0000-0000-000000000001', 'Demo Bank', 'demo_key_fraudshield_2024')
ON CONFLICT DO NOTHING;

-- Insert default rules
INSERT INTO fraud_rules (name, description, threshold) VALUES
('velocity_1min', 'More than 5 transactions per minute per user', 5),
('high_amount', 'Transaction amount exceeds 50000 INR', 50000),
('new_merchant', 'First time transaction with this merchant', NULL),
('geo_anomaly', 'Transaction location > 500km from last transaction', 500),
('night_transaction', 'Transaction between 1am and 5am', NULL),
('foreign_ip', 'IP address from outside home country', NULL)
ON CONFLICT DO NOTHING;

-- Stats view for dashboard
CREATE OR REPLACE VIEW dashboard_stats AS
SELECT
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as txn_24h,
    COUNT(*) FILTER (WHERE fraud_score > 0.6 AND created_at > NOW() - INTERVAL '24 hours') as fraud_24h,
    ROUND(AVG(fraud_score) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours'), 3) as avg_score_24h,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as txn_1h,
    SUM(amount) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as volume_24h,
    COUNT(*) FILTER (WHERE risk_level = 'critical' AND created_at > NOW() - INTERVAL '24 hours') as critical_24h
FROM transactions;
