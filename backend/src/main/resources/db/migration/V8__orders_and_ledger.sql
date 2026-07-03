ALTER TABLE user_accounts
    ADD COLUMN reserved_cash_balance NUMERIC(19, 2) NOT NULL DEFAULT 0;

ALTER TABLE holdings
    ADD COLUMN reserved_quantity NUMERIC(19, 4) NOT NULL DEFAULT 0;

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    symbol VARCHAR(16) NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    side VARCHAR(16) NOT NULL,
    order_type VARCHAR(32) NOT NULL,
    time_in_force VARCHAR(16) NOT NULL,
    status VARCHAR(32) NOT NULL,
    source VARCHAR(32) NOT NULL,
    source_ref_id UUID,
    requested_quantity NUMERIC(19, 4) NOT NULL,
    filled_quantity NUMERIC(19, 4) NOT NULL DEFAULT 0,
    limit_price NUMERIC(19, 4),
    stop_price NUMERIC(19, 4),
    estimated_gross_amount NUMERIC(19, 2),
    reserved_cash_amount NUMERIC(19, 2) NOT NULL DEFAULT 0,
    reserved_quantity NUMERIC(19, 4) NOT NULL DEFAULT 0,
    idempotency_key VARCHAR(120),
    rejection_code VARCHAR(64),
    rejection_message VARCHAR(255),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    accepted_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE order_status_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    from_status VARCHAR(32),
    to_status VARCHAR(32) NOT NULL,
    reason_code VARCHAR(64),
    reason_message VARCHAR(255),
    metadata_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_order_status_events_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
);

CREATE TABLE cash_ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    order_id UUID,
    trade_id UUID,
    entry_type VARCHAR(32) NOT NULL,
    amount NUMERIC(19, 2) NOT NULL,
    cash_balance_after NUMERIC(19, 2) NOT NULL,
    reserved_cash_after NUMERIC(19, 2) NOT NULL,
    idempotency_key VARCHAR(180),
    memo VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_cash_ledger_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_cash_ledger_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE SET NULL,
    CONSTRAINT fk_cash_ledger_trade FOREIGN KEY (trade_id) REFERENCES trades (id) ON DELETE SET NULL
);

CREATE TABLE position_ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    symbol VARCHAR(16) NOT NULL,
    order_id UUID,
    trade_id UUID,
    entry_type VARCHAR(32) NOT NULL,
    quantity_delta NUMERIC(19, 4) NOT NULL,
    quantity_after NUMERIC(19, 4) NOT NULL,
    reserved_quantity_after NUMERIC(19, 4) NOT NULL,
    idempotency_key VARCHAR(180),
    memo VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_position_ledger_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_position_ledger_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE SET NULL,
    CONSTRAINT fk_position_ledger_trade FOREIGN KEY (trade_id) REFERENCES trades (id) ON DELETE SET NULL
);

ALTER TABLE trades
    ADD COLUMN order_id UUID,
    ADD CONSTRAINT fk_trades_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE SET NULL;

CREATE INDEX ix_orders_user_id_created_at ON orders (user_id, created_at DESC);
CREATE INDEX ix_orders_user_id_status_created_at ON orders (user_id, status, created_at DESC);
CREATE INDEX ix_orders_status_symbol_created_at ON orders (status, symbol, created_at ASC);
CREATE UNIQUE INDEX ux_orders_user_idempotency_key ON orders (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX ix_order_status_events_order_created_at ON order_status_events (order_id, created_at ASC);
CREATE INDEX ix_cash_ledger_user_created_at ON cash_ledger_entries (user_id, created_at DESC);
CREATE INDEX ix_cash_ledger_order_created_at ON cash_ledger_entries (order_id, created_at ASC);
CREATE UNIQUE INDEX ux_cash_ledger_idempotency_key ON cash_ledger_entries (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX ix_position_ledger_user_symbol_created_at ON position_ledger_entries (user_id, symbol, created_at DESC);
CREATE INDEX ix_position_ledger_order_created_at ON position_ledger_entries (order_id, created_at ASC);
CREATE UNIQUE INDEX ux_position_ledger_idempotency_key ON position_ledger_entries (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX ix_trades_order_id ON trades (order_id);
