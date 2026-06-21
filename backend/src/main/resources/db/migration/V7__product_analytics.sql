CREATE TABLE product_analytics_events
(
    id            UUID PRIMARY KEY,
    user_id       UUID REFERENCES users (id) ON DELETE SET NULL,
    source        VARCHAR(32)  NOT NULL,
    event_name    VARCHAR(64)  NOT NULL,
    path          VARCHAR(255),
    metadata_json JSONB,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX ix_product_analytics_events_user_id_created_at
    ON product_analytics_events (user_id, created_at DESC);

CREATE INDEX ix_product_analytics_events_event_name_created_at
    ON product_analytics_events (event_name, created_at DESC);

CREATE INDEX ix_product_analytics_events_path_created_at
    ON product_analytics_events (path, created_at DESC);
