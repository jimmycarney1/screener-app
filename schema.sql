-- Invite / guest list (managed in the admin app)
CREATE TABLE IF NOT EXISTS guests (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  name_key   TEXT NOT NULL,                 -- normalized name for sign-in matching
  team       INTEGER,                       -- 1..8 or NULL (unassigned)
  is_captain INTEGER NOT NULL DEFAULT 0,    -- 1 if this guest is their team's captain
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_guests_name_key ON guests(name_key);

-- One RSVP per guest (linked by guest_id)
CREATE TABLE IF NOT EXISTS rsvps (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  guest_id   INTEGER UNIQUE REFERENCES guests(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  coming     TEXT NOT NULL,                 -- 'yes' | 'no'
  competing  TEXT,                          -- 'yes' | 'no' | NULL
  arrive     TEXT,                          -- 'wed' | 'thu' | 'fri' | NULL
  depart     TEXT,                          -- 'sat' | 'sun' | NULL
  note       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Admin "things to figure out" tracker
CREATE TABLE IF NOT EXISTS todos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  text       TEXT NOT NULL,
  done       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
