CREATE TABLE daily_performance_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    performance_date DATE NOT NULL,
    total_portfolio_value NUMERIC(19, 2) NOT NULL,
    cash_balance NUMERIC(19, 2) NOT NULL,
    holdings_market_value NUMERIC(19, 2) NOT NULL,
    realized_pnl NUMERIC(19, 2) NOT NULL DEFAULT 0,
    unrealized_pnl NUMERIC(19, 2) NOT NULL DEFAULT 0,
    net_cash_flow NUMERIC(19, 2) NOT NULL DEFAULT 0,
    period_return_percent NUMERIC(19, 2) NOT NULL DEFAULT 0,
    cumulative_twr_percent NUMERIC(19, 2) NOT NULL DEFAULT 0,
    cumulative_mwr_percent NUMERIC(19, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_daily_performance_snapshots_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX ux_daily_performance_snapshots_user_date
    ON daily_performance_snapshots (user_id, performance_date);

CREATE INDEX ix_daily_performance_snapshots_user_date
    ON daily_performance_snapshots (user_id, performance_date DESC);
