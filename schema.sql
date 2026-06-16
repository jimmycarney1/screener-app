CREATE TABLE IF NOT EXISTS rsvps (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  coming     TEXT NOT NULL,                 -- 'yes' | 'no'
  competing  TEXT,                          -- 'yes' | 'no' | NULL
  days       TEXT NOT NULL DEFAULT '[]',    -- JSON array, e.g. ["wed","thu","fri"]
  note       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
