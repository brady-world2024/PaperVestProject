CREATE TABLE conditional_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    symbol VARCHAR(16) NOT NULL,
    side VARCHAR(16) NOT NULL,
    trigger_type VARCHAR(32) NOT NULL,
    target_price NUMERIC(19, 4) NOT NULL,
    quantity NUMERIC(19, 4) NOT NULL,
    status VARCHAR(32) NOT NULL,
    failure_code VARCHAR(64),
    failure_message VARCHAR(255),
    execution_key VARCHAR(160) NOT NULL,
    last_checked_price NUMERIC(19, 4),
    triggered_at TIMESTAMPTZ,
    executed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT fk_conditional_orders_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT ux_conditional_orders_execution_key UNIQUE (execution_key)
);

CREATE TABLE conditional_order_status_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conditional_order_id UUID NOT NULL,
    from_status VARCHAR(32),
    to_status VARCHAR(32) NOT NULL,
    reason_code VARCHAR(64),
    reason_message VARCHAR(255),
    metadata_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_conditional_order_events_order FOREIGN KEY (conditional_order_id) REFERENCES conditional_orders (id) ON DELETE CASCADE
);

ALTER TABLE trades
    ADD COLUMN execution_key VARCHAR(160);

CREATE INDEX ix_conditional_orders_user_id_created_at ON conditional_orders (user_id, created_at DESC);
CREATE INDEX ix_conditional_orders_status_symbol_created_at ON conditional_orders (status, symbol, created_at ASC);
CREATE INDEX ix_conditional_orders_created_at ON conditional_orders (created_at DESC);
CREATE INDEX ix_conditional_order_events_order_created_at ON conditional_order_status_events (conditional_order_id, created_at ASC);
CREATE UNIQUE INDEX ux_trades_execution_key ON trades (execution_key) WHERE execution_key IS NOT NULL;
