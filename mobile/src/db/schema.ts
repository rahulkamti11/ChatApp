import * as SQLite from 'expo-sqlite';

export async function initLocalDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    -- 1. Full local message history
    CREATE TABLE IF NOT EXISTS local_messages (
        id                TEXT        PRIMARY KEY,
        conversation_id   TEXT        NOT NULL,
        sender_id         TEXT        NOT NULL,
        sequence          INTEGER     NOT NULL,
        type              TEXT        NOT NULL DEFAULT 'text',
        content           TEXT,
        media_url         TEXT,
        media_local_path  TEXT,
        media_metadata    TEXT,
        reply_to_id       TEXT,
        reactions         TEXT,
        status            TEXT        NOT NULL DEFAULT 'pending',
        is_edited         INTEGER     NOT NULL DEFAULT 0,
        edited_at         TEXT,
        is_deleted        INTEGER     NOT NULL DEFAULT 0,
        disappear_mode    TEXT,
        disappear_at      TEXT,
        created_at        TEXT        NOT NULL
    );

    -- 2. Conversation metadata
    CREATE TABLE IF NOT EXISTS local_conversations (
        id                      TEXT        PRIMARY KEY,
        type                    TEXT        NOT NULL DEFAULT 'direct',
        other_user_id           TEXT,
        other_display_name      TEXT,
        other_username          TEXT,
        other_avatar_url        TEXT,
        last_message_preview    TEXT,
        last_message_at         TEXT,
        last_sequence           INTEGER     NOT NULL DEFAULT 0,
        last_delivered_sequence  INTEGER     NOT NULL DEFAULT 0,
        unread_count            INTEGER     NOT NULL DEFAULT 0,
        disappear_mode          TEXT,
        is_pinned               INTEGER     NOT NULL DEFAULT 0,
        updated_at              TEXT
    );

    -- 3. Cached contacts
    CREATE TABLE IF NOT EXISTS local_contacts (
        id                TEXT        PRIMARY KEY,
        user_id           TEXT        NOT NULL,
        display_name      TEXT,
        username          TEXT,
        virtual_number    TEXT,
        avatar_url        TEXT,
        is_blocked        INTEGER     NOT NULL DEFAULT 0,
        is_muted          INTEGER     NOT NULL DEFAULT 0,
        updated_at        TEXT
    );

    -- 4. Starred messages
    CREATE TABLE IF NOT EXISTS local_starred_messages (
        message_id        TEXT        PRIMARY KEY,
        conversation_id   TEXT        NOT NULL,
        starred_at        TEXT        NOT NULL
    );

    -- 5. Unsent draft replies
    CREATE TABLE IF NOT EXISTS local_draft_replies (
        conversation_id   TEXT        PRIMARY KEY,
        reply_to_id       TEXT,
        draft_text        TEXT        NOT NULL,
        updated_at        TEXT        NOT NULL
    );

    -- 6. Local media cache
    CREATE TABLE IF NOT EXISTS local_media_cache (
        media_url         TEXT        PRIMARY KEY,
        local_file_path   TEXT        NOT NULL,
        file_size_bytes   INTEGER,
        downloaded_at     TEXT        NOT NULL
    );

    -- 7. Hidden chats
    CREATE TABLE IF NOT EXISTS local_hidden_chats (
        conversation_id   TEXT        PRIMARY KEY,
        hidden_at         TEXT        NOT NULL
    );

    -- 8. Local settings key-value store
    CREATE TABLE IF NOT EXISTS local_settings (
        key               TEXT        PRIMARY KEY,
        value             TEXT        NOT NULL
    );

    -- 9. Saved messages notebook
    CREATE TABLE IF NOT EXISTS local_saved_messages (
        id                TEXT        PRIMARY KEY,
        type              TEXT        NOT NULL,
        content           TEXT,
        media_url         TEXT,
        media_local_path  TEXT,
        source_message_id TEXT,
        created_at        TEXT        NOT NULL
    );

    -- INDEXES
    CREATE INDEX IF NOT EXISTS idx_local_msg_conv_seq     ON local_messages(conversation_id, sequence);
    CREATE INDEX IF NOT EXISTS idx_local_msg_disappear    ON local_messages(disappear_at);
    CREATE INDEX IF NOT EXISTS idx_local_conv_updated     ON local_conversations(last_message_at DESC);
    CREATE INDEX IF NOT EXISTS idx_local_contacts_user    ON local_contacts(user_id);
  `);
}
