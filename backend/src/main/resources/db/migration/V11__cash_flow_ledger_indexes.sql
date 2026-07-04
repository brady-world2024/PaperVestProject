CREATE INDEX ix_cash_ledger_external_flow_user_type_created_at
    ON cash_ledger_entries (user_id, entry_type, created_at DESC)
    WHERE entry_type IN ('DEPOSIT', 'WITHDRAWAL');
