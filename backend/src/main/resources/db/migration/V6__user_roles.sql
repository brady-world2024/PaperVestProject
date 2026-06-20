ALTER TABLE users
    ADD COLUMN role VARCHAR(16) NOT NULL DEFAULT 'USER';

CREATE INDEX ix_users_role_created_at ON users (role, created_at DESC);
