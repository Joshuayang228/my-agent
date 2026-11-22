import { getDatabase } from '../../../storage/database'

let initializedLifeDbs = new WeakSet<object>()

/**
 * 统一初始化 Companion 领域生活与成长持久化表结构。
 *
 * 背景：此前各生活与成长模块（assets / inner-thoughts / keepsakes / gifting / vulnerability / chat-resonance /
 * travel-progression / autonomous-dressing / mutable-store / reflection-log 等）各自在业务文件内重复执行
 * CREATE TABLE / ALTER TABLE，破坏了“Core 统一拥有持久化 Schema”的分层边界，也造成每次读写的高频 DDL 开销。
 * 设计意图：将全部生活与成长领域表收敛到本模块一次性初始化，并以 WeakSet<Database> + sqlite_master 哨兵守卫去重。
 * 关键约束：仅负责表与索引创建，绝不夹带业务数据播种或 persist()；所有列与约束必须与既有各表完全兼容。
 */
export async function ensureLifeSchema(): Promise<void> {
  const db = await getDatabase()
  if (initializedLifeDbs.has(db)) {
    const sentinel = db.exec("SELECT 1 FROM sqlite_master WHERE type='table' AND name='companion_keepsakes' LIMIT 1")
    if (sentinel.length > 0 && sentinel[0].values.length > 0) return
  }

  // 1. 核心生活时间线、事件、动态、互动与关系情绪表
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

  // 2. 生活资产与播种标记表
  db.run(`
    CREATE TABLE IF NOT EXISTS companion_assets (
      id               TEXT PRIMARY KEY,
      role_id          TEXT NOT NULL,
      kind             TEXT NOT NULL,
      name             TEXT NOT NULL,
      payload_json     TEXT NOT NULL DEFAULT '{}',
      acquired_at      INTEGER NOT NULL,
      source_event_id  TEXT
    )
  `)
  try {
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_companion_assets_role_kind
        ON companion_assets(role_id, kind)
    `)
  } catch { /* 兼容仅含精简列的轻量测试夹具 */ }
  db.run(`
    CREATE TABLE IF NOT EXISTS companion_asset_seeds (
      role_id TEXT NOT NULL,
      kind    TEXT NOT NULL,
      PRIMARY KEY (role_id, kind)
    )
  `)

  // 3. 扩展生活领域表（穿搭、心愿共鸣、共同决策、收礼、日记、材料观察、自发冲动、航程、脆弱心境）
  db.run(`
    CREATE TABLE IF NOT EXISTS companion_autonomous_dressings (
      id             TEXT PRIMARY KEY,
      role_id        TEXT NOT NULL,
      asset_id       TEXT NOT NULL,
      outfit_name    TEXT NOT NULL,
      trigger_reason TEXT NOT NULL,
      outfit_version INTEGER NOT NULL,
      created_at     INTEGER NOT NULL
    )
  `)
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_autonomous_dressings_role_created
      ON companion_autonomous_dressings(role_id, created_at DESC)
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS companion_life_resonances (
      id                    TEXT PRIMARY KEY,
      role_id               TEXT NOT NULL,
      session_id            TEXT NOT NULL,
      kind                  TEXT NOT NULL,
      title                 TEXT NOT NULL,
      target_name           TEXT NOT NULL,
      user_quote            TEXT NOT NULL,
      reason                TEXT NOT NULL,
      culture_type          TEXT,
      status                TEXT NOT NULL DEFAULT 'active',
      created_at            INTEGER NOT NULL,
      absorbed_at           INTEGER,
      completed_at          INTEGER,
      feedback_text         TEXT,
      feedback_delivered_at INTEGER,
      asset_id              TEXT
    )
  `)
  try { db.run('ALTER TABLE companion_life_resonances ADD COLUMN completed_at INTEGER') } catch { /* existing */ }
  try { db.run('ALTER TABLE companion_life_resonances ADD COLUMN feedback_text TEXT') } catch { /* existing */ }
  try { db.run('ALTER TABLE companion_life_resonances ADD COLUMN feedback_delivered_at INTEGER') } catch { /* existing */ }
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_companion_resonances_role_status
      ON companion_life_resonances(role_id, status, created_at DESC)
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS companion_co_decisions (
      id                    TEXT PRIMARY KEY,
      role_id               TEXT NOT NULL,
      title                 TEXT NOT NULL,
      dilemma               TEXT NOT NULL,
      options_json          TEXT NOT NULL,
      status                TEXT NOT NULL DEFAULT 'pending',
      selected_option_id    TEXT,
      selected_option_label TEXT,
      companion_reaction    TEXT,
      created_at            INTEGER NOT NULL,
      resolved_at           INTEGER,
      absorbed_in_script    INTEGER NOT NULL DEFAULT 0
    )
  `)
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_co_decisions_role_status
      ON companion_co_decisions (role_id, status, created_at)
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS companion_received_gifts (
      id                 TEXT PRIMARY KEY,
      role_id            TEXT NOT NULL,
      gift_key           TEXT NOT NULL,
      gift_name          TEXT NOT NULL,
      category           TEXT NOT NULL,
      user_note          TEXT,
      companion_reaction TEXT NOT NULL,
      vitals_buff_json   TEXT,
      giver_name         TEXT,
      created_at         INTEGER NOT NULL
    )
  `)
  try { db.run('ALTER TABLE companion_received_gifts ADD COLUMN giver_name TEXT') } catch { /* 列已存在 */ }
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_companion_received_gifts_role_time
      ON companion_received_gifts(role_id, created_at DESC)
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS companion_inner_thoughts (
      id           TEXT PRIMARY KEY,
      role_id      TEXT NOT NULL,
      title        TEXT NOT NULL,
      content      TEXT NOT NULL,
      mood         TEXT,
      weather      TEXT,
      location     TEXT,
      activity     TEXT,
      is_favorite  INTEGER DEFAULT 0,
      created_at   INTEGER NOT NULL,
      thought_type TEXT NOT NULL DEFAULT 'general',
      epiphany     TEXT,
      source_type  TEXT NOT NULL DEFAULT 'legacy-inner-thought',
      source_id    TEXT,
      trace_id     TEXT
    )
  `)
  try { db.run("ALTER TABLE companion_inner_thoughts ADD COLUMN thought_type TEXT NOT NULL DEFAULT 'general'") } catch { /* 列已存在 */ }
  try { db.run('ALTER TABLE companion_inner_thoughts ADD COLUMN epiphany TEXT') } catch { /* 列已存在 */ }
  try { db.run("ALTER TABLE companion_inner_thoughts ADD COLUMN source_type TEXT NOT NULL DEFAULT 'legacy-inner-thought'") } catch { /* 列已存在 */ }
  try { db.run('ALTER TABLE companion_inner_thoughts ADD COLUMN source_id TEXT') } catch { /* 列已存在 */ }
  try { db.run('ALTER TABLE companion_inner_thoughts ADD COLUMN trace_id TEXT') } catch { /* 列已存在 */ }
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_companion_inner_thoughts_role_time
      ON companion_inner_thoughts(role_id, created_at DESC)
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS companion_material_observation_attempts (
      id           TEXT PRIMARY KEY,
      role_id      TEXT NOT NULL,
      session_id   TEXT NOT NULL,
      message_id   TEXT NOT NULL,
      image_index  INTEGER NOT NULL,
      source       TEXT NOT NULL,
      status       TEXT NOT NULL,
      reason       TEXT NOT NULL,
      attempted_at INTEGER NOT NULL,
      completed_at INTEGER
    )
  `)
  db.run('CREATE INDEX IF NOT EXISTS idx_companion_material_observation_role_time ON companion_material_observation_attempts(role_id, attempted_at DESC)')

  db.run(`
    CREATE TABLE IF NOT EXISTS companion_spontaneous_impulses (
      id           TEXT PRIMARY KEY,
      role_id      TEXT NOT NULL,
      session_id   TEXT NOT NULL,
      message_id   TEXT NOT NULL,
      impulse_text TEXT NOT NULL,
      topic_kind   TEXT NOT NULL,
      context_hint TEXT NOT NULL,
      created_at   INTEGER NOT NULL
    )
  `)
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_companion_impulses_role_time
      ON companion_spontaneous_impulses(role_id, created_at DESC)
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS companion_travel_progressions (
      id             TEXT PRIMARY KEY,
      role_id        TEXT NOT NULL,
      trip_id        TEXT NOT NULL,
      stop_id        TEXT NOT NULL,
      stop_name      TEXT NOT NULL,
      stop_date      TEXT NOT NULL,
      story          TEXT NOT NULL,
      trigger_reason TEXT NOT NULL,
      created_at     INTEGER NOT NULL
    )
  `)
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_travel_progressions_role_created
      ON companion_travel_progressions(role_id, created_at DESC)
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS companion_vulnerability_moments (
      id                  TEXT PRIMARY KEY,
      role_id             TEXT NOT NULL,
      title               TEXT NOT NULL,
      mood_state          TEXT NOT NULL,
      trigger_context     TEXT NOT NULL,
      vulnerability_text  TEXT NOT NULL,
      comfort_prompt_hint TEXT,
      status              TEXT NOT NULL DEFAULT 'active',
      comfort_text        TEXT,
      companion_reaction  TEXT,
      created_at          INTEGER NOT NULL,
      comforted_at        INTEGER
    )
  `)
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_vulnerability_role_status
      ON companion_vulnerability_moments(role_id, status)
  `)

  // 4. 成长与羁绊领域表（可变人格、反思日志、专属信物）
  db.run(`
    CREATE TABLE IF NOT EXISTS companion_mutable (
      role_id    TEXT PRIMARY KEY,
      body       TEXT NOT NULL,
      version    INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS companion_mutable_versions (
      id         TEXT PRIMARY KEY,
      role_id    TEXT NOT NULL,
      version    INTEGER NOT NULL,
      body       TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      summary    TEXT NOT NULL DEFAULT '',
      UNIQUE(role_id, version)
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS companion_reflection_state (
      role_id     TEXT PRIMARY KEY,
      last_run_at INTEGER NOT NULL DEFAULT 0,
      runs_json   TEXT NOT NULL DEFAULT '[]',
      updated_at  INTEGER NOT NULL
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS companion_keepsakes (
      id           TEXT PRIMARY KEY,
      role_id      TEXT NOT NULL,
      name         TEXT NOT NULL,
      description  TEXT NOT NULL,
      lore         TEXT NOT NULL,
      gift_message TEXT NOT NULL,
      gift_reason  TEXT NOT NULL,
      icon_name    TEXT NOT NULL,
      image_url    TEXT,
      acquired_at  INTEGER NOT NULL
    )
  `)
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_companion_keepsakes_role_time
      ON companion_keepsakes(role_id, acquired_at DESC)
  `)

  initializedLifeDbs.add(db)
}

export function resetLifeSchemaForTesting(): void {
  initializedLifeDbs = new WeakSet<object>()
}
