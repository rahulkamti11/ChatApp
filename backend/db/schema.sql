-- 1. users
CREATE TABLE IF NOT EXISTS users (
    id                    TEXT        PRIMARY KEY,
    virtual_number        TEXT        NOT NULL UNIQUE,
    username              TEXT        UNIQUE,
    display_name          TEXT        NOT NULL,
    avatar_url            TEXT,
    status_bio            TEXT        DEFAULT 'Hey there! I am using Qwink',
    password_hash         TEXT        NOT NULL,
    identity_public_key   TEXT,
    show_virtual_number   INTEGER     NOT NULL DEFAULT 1,
    show_last_seen        INTEGER     NOT NULL DEFAULT 1,
    show_read_receipts    INTEGER     NOT NULL DEFAULT 1,
    cloud_sync_enabled    INTEGER     NOT NULL DEFAULT 0,
    is_online             INTEGER     NOT NULL DEFAULT 0,
    last_seen_at          TEXT        DEFAULT (datetime('now')),
    fcm_token             TEXT,
    created_at            TEXT        NOT NULL DEFAULT (datetime('now')),
    updated_at            TEXT        NOT NULL DEFAULT (datetime('now'))
);

-- 2. virtual_numbers
CREATE TABLE IF NOT EXISTS virtual_numbers (
    phone_number      TEXT        PRIMARY KEY,
    status            TEXT        NOT NULL DEFAULT 'available',
    assigned_user_id  TEXT        REFERENCES users(id) ON DELETE SET NULL,
    assigned_at       TEXT,
    created_at        TEXT        NOT NULL DEFAULT (datetime('now'))
);

-- 3. contacts
CREATE TABLE IF NOT EXISTS contacts (
    id                TEXT        PRIMARY KEY,
    owner_user_id     TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_user_id   TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    custom_name       TEXT,
    is_blocked        INTEGER     NOT NULL DEFAULT 0,
    is_muted          INTEGER     NOT NULL DEFAULT 0,
    created_at        TEXT        NOT NULL DEFAULT (datetime('now')),
    UNIQUE(owner_user_id, contact_user_id)
);

-- 4. conversations
CREATE TABLE IF NOT EXISTS conversations (
    id                    TEXT        PRIMARY KEY,
    type                  TEXT        NOT NULL DEFAULT 'direct' CHECK(type IN ('direct','group')),
    title                 TEXT,
    avatar_url            TEXT,
    created_by            TEXT        REFERENCES users(id),
    current_sequence      INTEGER     NOT NULL DEFAULT 0,
    disappear_mode        TEXT        DEFAULT NULL CHECK(disappear_mode IN (NULL,'instant','24h','7d','30d')),
    last_message_preview  TEXT,
    last_message_at       TEXT,
    created_at            TEXT        NOT NULL DEFAULT (datetime('now')),
    updated_at            TEXT        NOT NULL DEFAULT (datetime('now'))
);

-- 5. conversation_members
CREATE TABLE IF NOT EXISTS conversation_members (
    id                      TEXT        PRIMARY KEY,
    conversation_id         TEXT        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id                 TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role                    TEXT        NOT NULL DEFAULT 'member' CHECK(role IN ('owner','admin','member')),
    last_read_sequence      INTEGER     NOT NULL DEFAULT 0,
    last_delivered_sequence  INTEGER     NOT NULL DEFAULT 0,
    is_hidden               INTEGER     NOT NULL DEFAULT 0,
    is_pinned               INTEGER     NOT NULL DEFAULT 0,
    mute_until              TEXT,
    joined_at               TEXT        NOT NULL DEFAULT (datetime('now')),
    UNIQUE(conversation_id, user_id)
);

-- 6. pending_messages
CREATE TABLE IF NOT EXISTS pending_messages (
    id                TEXT        PRIMARY KEY,
    conversation_id   TEXT        NOT NULL,
    sender_id         TEXT        NOT NULL REFERENCES users(id),
    recipient_id      TEXT        NOT NULL REFERENCES users(id),
    sequence          INTEGER     NOT NULL,
    encrypted_payload TEXT        NOT NULL,
    retry_count       INTEGER     NOT NULL DEFAULT 0,
    expires_at        TEXT,
    created_at        TEXT        NOT NULL DEFAULT (datetime('now'))
);

-- 7. cloud_sync_messages
CREATE TABLE IF NOT EXISTS cloud_sync_messages (
    id                TEXT        PRIMARY KEY,
    conversation_id   TEXT        NOT NULL,
    sender_id         TEXT        NOT NULL REFERENCES users(id),
    sequence          INTEGER     NOT NULL,
    type              TEXT        NOT NULL CHECK(type IN ('text','image','video','audio','gif','document','system')),
    content           TEXT,
    media_url         TEXT,
    media_metadata    TEXT,
    reply_to_id       TEXT,
    is_edited         INTEGER     NOT NULL DEFAULT 0,
    edited_at         TEXT,
    is_deleted        INTEGER     NOT NULL DEFAULT 0,
    disappear_mode    TEXT        DEFAULT NULL,
    disappear_at      TEXT,
    created_at        TEXT        NOT NULL DEFAULT (datetime('now'))
);

-- 8. message_reactions
CREATE TABLE IF NOT EXISTS message_reactions (
    id            TEXT        PRIMARY KEY,
    message_id    TEXT        NOT NULL,
    user_id       TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji         TEXT        NOT NULL,
    created_at    TEXT        NOT NULL DEFAULT (datetime('now')),
    UNIQUE(message_id, user_id, emoji)
);

-- 9. user_prekeys
CREATE TABLE IF NOT EXISTS user_prekeys (
    id            TEXT        PRIMARY KEY,
    user_id       TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_id        INTEGER     NOT NULL,
    public_key    TEXT        NOT NULL,
    is_used       INTEGER     NOT NULL DEFAULT 0,
    created_at    TEXT        NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, key_id)
);

-- 10. call_logs
CREATE TABLE IF NOT EXISTS call_logs (
    id                TEXT        PRIMARY KEY,
    caller_id         TEXT        NOT NULL REFERENCES users(id),
    receiver_id       TEXT        NOT NULL REFERENCES users(id),
    call_type         TEXT        NOT NULL CHECK(call_type IN ('audio','video')),
    status            TEXT        NOT NULL CHECK(status IN ('ringing','answered','missed','declined','busy','failed')),
    duration_seconds  INTEGER     NOT NULL DEFAULT 0,
    started_at        TEXT        NOT NULL DEFAULT (datetime('now')),
    ended_at          TEXT
);

-- 11. saved_messages
CREATE TABLE IF NOT EXISTS saved_messages (
    id                  TEXT        PRIMARY KEY,
    user_id             TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type                TEXT        NOT NULL CHECK(type IN ('text','image','video','audio','document','link')),
    content             TEXT,
    media_url           TEXT,
    source_message_id   TEXT,
    created_at          TEXT        NOT NULL DEFAULT (datetime('now'))
);

-- 12. delivery_receipts
CREATE TABLE IF NOT EXISTS delivery_receipts (
    id                TEXT        PRIMARY KEY,
    message_id        TEXT        NOT NULL,
    conversation_id   TEXT        NOT NULL,
    recipient_id      TEXT        NOT NULL REFERENCES users(id),
    status            TEXT        NOT NULL DEFAULT 'sent' CHECK(status IN ('sent','delivered','read')),
    sent_at           TEXT        NOT NULL DEFAULT (datetime('now')),
    delivered_at      TEXT,
    read_at           TEXT
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_conv_members_user        ON conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_last_message        ON conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_pending_recipient        ON pending_messages(recipient_id, created_at);
CREATE INDEX IF NOT EXISTS idx_users_username           ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_virtual_number     ON users(virtual_number);
CREATE INDEX IF NOT EXISTS idx_cloud_sync_conv_seq      ON cloud_sync_messages(conversation_id, sequence);
CREATE INDEX IF NOT EXISTS idx_receipts_message         ON delivery_receipts(message_id);
CREATE INDEX IF NOT EXISTS idx_receipts_recipient       ON delivery_receipts(recipient_id, status);
CREATE INDEX IF NOT EXISTS idx_call_logs_caller         ON call_logs(caller_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_receiver       ON call_logs(receiver_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_messages_user      ON saved_messages(user_id, created_at DESC);
