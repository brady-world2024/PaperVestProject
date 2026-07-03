CREATE TABLE order_execution_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    user_id UUID NOT NULL,
    symbol VARCHAR(16) NOT NULL,
    side VARCHAR(16) NOT NULL,
    order_type VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL,
    trigger_price NUMERIC(19, 4) NOT NULL,
    execution_price NUMERIC(19, 4) NOT NULL,
    quote_timestamp TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    consumed_at TIMESTAMPTZ,
    last_publish_error TEXT,
    publish_attempt_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT fk_order_execution_requests_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
    CONSTRAINT fk_order_execution_requests_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX ux_order_execution_requests_order_id ON order_execution_requests (order_id);
CREATE INDEX ix_order_execution_requests_status_created_at ON order_execution_requests (status, created_at ASC);
CREATE INDEX ix_order_execution_requests_order_status ON order_execution_requests (order_id, status);
