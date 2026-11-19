import { getDatabase } from '../../../storage/database'

let initializedLifeDbs = new WeakSet<object>()

export async function ensureLifeSchema(): Promise<void> {
  const db = await getDatabase()
  if (initializedLifeDbs.has(db)) {
    const sentinel = db.exec("SELECT 1 FROM sqlite_master WHERE type='table' AND name='companion_moment_media_attempts' LIMIT 1")
    if (sentinel.length > 0 && sentinel[0].values.length > 0) return
  }
  db.run('CREATE TABLE IF NOT EXISTS companion_first_contact (role_id TEXT PRIMARY KEY, shown_at INTEGER NOT NULL)')
  db.run(`
    CREATE TABLE IF NOT EXISTS companion_day_scripts (
      id           TEXT PRIMARY KEY,
      role_id      TEXT NOT NULL,
      date         TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at   INTEGER NOT NULL,
      UNIQUE(role_id, date)
    )
  `)
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_companion_day_scripts_role_date
      ON companion_day_scripts(role_id, date)
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS companion_events (
      id            TEXT PRIMARY KEY,
      role_id       TEXT NOT NULL,
      scheduled_at  INTEGER NOT NULL,
      status        TEXT NOT NULL,
      type          TEXT NOT NULL,
      payload_json  TEXT NOT NULL,
      day_script_id TEXT
    )
  `)
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_companion_events_role_sched
      ON companion_events(role_id, scheduled_at)
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS companion_moments (
      id           TEXT PRIMARY KEY,
      role_id      TEXT NOT NULL,
      event_id     TEXT NOT NULL,
      published_at INTEGER NOT NULL,
      text         TEXT NOT NULL,
      meta_json    TEXT NOT NULL DEFAULT '{}'
    )
  `)
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_companion_moments_role_pub
      ON companion_moments(role_id, published_at DESC)
  `)
  db.run(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_companion_moments_event
      ON companion_moments(event_id)
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS companion_moment_user_interactions (
      id         TEXT PRIMARY KEY,
      moment_id  TEXT NOT NULL,
      role_id    TEXT NOT NULL,
      kind       TEXT NOT NULL,
      actor_id   TEXT NOT NULL,
      text       TEXT,
      created_at INTEGER NOT NULL
    )
  `)
  for (const column of [
    "ALTER TABLE companion_moment_user_interactions ADD COLUMN actor_type TEXT NOT NULL DEFAULT 'user'",
    'ALTER TABLE companion_moment_user_interactions ADD COLUMN actor_name TEXT',
    'ALTER TABLE companion_moment_user_interactions ADD COLUMN parent_interaction_id TEXT',
    'ALTER TABLE companion_moment_user_interactions ADD COLUMN reply_to_actor_name TEXT',
  ]) {
    try { db.run(column) } catch { /* 已升级的数据库 */ }
  }
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_companion_moment_user_role_moment
      ON companion_moment_user_interactions(role_id, moment_id, created_at)
  `)
  db.run(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_companion_moment_user_like
      ON companion_moment_user_interactions(moment_id, actor_id)
      WHERE kind = 'like'
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS companion_event_links (
      id            TEXT PRIMARY KEY,
      event_id      TEXT NOT NULL,
      role_id       TEXT NOT NULL,
      target_type   TEXT NOT NULL,
      target_id     TEXT NOT NULL,
      relation      TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at    INTEGER NOT NULL,
      UNIQUE(event_id, target_type, target_id, relation)
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS companion_relationship_state (
      role_id TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      phase TEXT NOT NULL DEFAULT 'familiar',
      signal INTEGER NOT NULL DEFAULT 0,
      note TEXT NOT NULL DEFAULT '',
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (role_id, subject_id)
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS companion_relationship_events (
      id TEXT PRIMARY KEY,
      role_id TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      phase TEXT NOT NULL,
      delta INTEGER NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      source_event_id TEXT,
      created_at INTEGER NOT NULL
    )
  `)
  db.run('CREATE INDEX IF NOT EXISTS idx_companion_relationship_events_role_time ON companion_relationship_events(role_id, created_at DESC)')
  db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_companion_relationship_events_source ON companion_relationship_events(role_id, source_event_id) WHERE source_event_id IS NOT NULL')
  db.run(`
    CREATE TABLE IF NOT EXISTS companion_emotion_events (
      id TEXT PRIMARY KEY,
      role_id TEXT NOT NULL,
      event_id TEXT,
      label TEXT NOT NULL,
      intensity INTEGER NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    )
  `)
  db.run('CREATE INDEX IF NOT EXISTS idx_companion_emotion_role_time ON companion_emotion_events(role_id, created_at DESC)')
  db.run(`
    CREATE TABLE IF NOT EXISTS companion_event_executions (
      id TEXT PRIMARY KEY,
      role_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      attempted_at INTEGER NOT NULL,
      action TEXT NOT NULL,
      reason TEXT NOT NULL,
      moment_id TEXT
    )
  `)
  db.run('CREATE INDEX IF NOT EXISTS idx_companion_event_exec_role_time ON companion_event_executions(role_id, attempted_at DESC)')
  db.run(`CREATE TABLE IF NOT EXISTS companion_moment_media (
    id TEXT PRIMARY KEY, role_id TEXT NOT NULL, event_id TEXT NOT NULL, moment_id TEXT NOT NULL,
    path TEXT NOT NULL, mime_type TEXT NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL,
    byte_length INTEGER NOT NULL, created_at INTEGER NOT NULL, UNIQUE(event_id, id)
  )`)
  db.run('CREATE INDEX IF NOT EXISTS idx_companion_moment_media_role_time ON companion_moment_media(role_id, created_at DESC)')
  db.run(`CREATE TABLE IF NOT EXISTS companion_moment_media_attempts (
    id TEXT PRIMARY KEY, role_id TEXT NOT NULL, event_id TEXT NOT NULL, moment_id TEXT,
    status TEXT NOT NULL, reason TEXT NOT NULL, image_id TEXT, attempted_at INTEGER NOT NULL, completed_at INTEGER
  )`)
  db.run('CREATE INDEX IF NOT EXISTS idx_companion_moment_media_attempts_role_time ON companion_moment_media_attempts(role_id, attempted_at DESC)')
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_companion_event_links_event
      ON companion_event_links(role_id, event_id)
  `)
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_companion_event_links_target
      ON companion_event_links(role_id, target_type, target_id)
  `)
  initializedLifeDbs.add(db)
}
