CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ux_users_email UNIQUE (email)
);

CREATE TABLE user_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    initial_cash NUMERIC(19, 2) NOT NULL,
    cash_balance NUMERIC(19, 2) NOT NULL,
    realized_pnl NUMERIC(19, 2) NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_user_accounts_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT ux_user_accounts_user UNIQUE (user_id)
);

CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    device_name VARCHAR(120),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT ux_refresh_tokens_hash UNIQUE (token_hash)
);

CREATE TABLE holdings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    symbol VARCHAR(16) NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    quantity NUMERIC(19, 4) NOT NULL,
    average_cost NUMERIC(19, 4) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_holdings_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT ux_holdings_user_symbol UNIQUE (user_id, symbol)
);

CREATE TABLE trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    symbol VARCHAR(16) NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    side VARCHAR(16) NOT NULL,
    quantity NUMERIC(19, 4) NOT NULL,
    executed_price NUMERIC(19, 4) NOT NULL,
    gross_amount NUMERIC(19, 2) NOT NULL,
    realized_pnl NUMERIC(19, 2) NOT NULL DEFAULT 0,
    cash_balance_after_trade NUMERIC(19, 2) NOT NULL,
    idempotency_key VARCHAR(120),
    executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_trades_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE watchlist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    symbol VARCHAR(16) NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_watchlist_items_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT ux_watchlist_items_user_symbol UNIQUE (user_id, symbol)
);

CREATE INDEX ix_refresh_tokens_user_id ON refresh_tokens (user_id);
CREATE INDEX ix_refresh_tokens_expires_at ON refresh_tokens (expires_at);
CREATE INDEX ix_holdings_user_id ON holdings (user_id);
CREATE INDEX ix_trades_user_id_executed_at ON trades (user_id, executed_at DESC);
CREATE INDEX ix_watchlist_items_user_id_created_at ON watchlist_items (user_id, created_at DESC);
CREATE UNIQUE INDEX ux_trades_user_idempotency_key ON trades (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
