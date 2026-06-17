CREATE TABLE portfolio_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    total_portfolio_value NUMERIC(19, 2) NOT NULL,
    cash_balance NUMERIC(19, 2) NOT NULL,
    holdings_market_value NUMERIC(19, 2) NOT NULL,
    realized_pnl NUMERIC(19, 2) NOT NULL DEFAULT 0,
    unrealized_pnl NUMERIC(19, 2) NOT NULL DEFAULT 0,
    snapshot_source VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_portfolio_snapshots_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_portfolio_snapshots_user_id_created_at
    ON portfolio_snapshots (user_id, created_at DESC);
