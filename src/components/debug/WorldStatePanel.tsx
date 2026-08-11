/**
 * Debug 世界态只读面板。
 *
 * 背景：世界快照字段较多，放在 DevPanel 壳内会掩盖顶层信息架构。
 * 设计意图：集中呈现身份、世界、计划/发布事件、剧本和记忆截面。
 * 关键约束：published 只表示已发布，不推断真实完成时间；不提供世界写操作。
 */

import type { ReactNode } from 'react'

export interface WorldSnapshot {
  role: { id: string; name: string; description: string; universeId: string }
  characterProfile: {
    schemaVersion: 1
    agePresentation: string
    birthday: string
    genderPresentation: string
    pronouns: string
    origin: string
    occupation: string
    background: string[]
    education: string[]
    careerHistory: string[]
    skills: string[]
    dailyRhythm: string[]
    interests: string[]
    dislikes: string[]
    habits: string[]
    flaws: string[]
    socialStyle: string[]
    valuesInPractice: string[]
    lifeAnchors: Array<{ period: string; title: string; summary: string }>
    appearance: {
      overall: string
      hair: string
      eyes: string
      build: string
      clothingStyle: string
      distinguishingFeatures: string[]
    }
    favorites: {
      foods: string[]
      drinks: string[]
      music: string[]
      books: string[]
      activities: string[]
      weather: string[]
      colors: string[]
    }
    selfAwareness: string
    expression: {
      warmth: number
      energy: number
      directness: number
      playfulness: number
      initiative: number
    }
  } | null
  worldDefaults: {
    schemaVersion: 1
    city: { id: string; name: string; fictional: boolean; description: string; climate: string }
    timezone: string
    district: string
    districtDescription: string
    home: {
      shortName: string
      residence: string
      surroundings: string
      interior: string
      layout: string
      view: string
      sensoryDetails: string[]
    }
    initialLocation: string
    mobility: { primary: string; alternatives: string[] }
    favoritePlaces: Array<{
      id: string
      name: string
      kind: string
      description: string
      travelMinutes: number
    }>
    possessions: Array<{
      id: string
      kind: string
      name: string
      description: string
      condition: string
    }>
    routines: { weekday: string[]; weekend: string[] }
    standingFacts: string[]
    initialState: {
      mood: number
      energy: number
      socialNeed: number
      currentLocation: string
      locationDetail: string
      currentActivity: string
      statusTags: string[]
    }
    rooms: Array<{ id: string; name: string; day: string; night: string }>
  } | null
  mutable: {
    body: string
    truncated: boolean
    version: number | null
    updatedAt: number | null
    source: 'override' | 'pack-default'
  }
  world: {
    schemaVersion: 1
    home: string
    timezone: string
    situation: string
    mood: number
    energy: number
    socialNeed: number
    currentLocation: string
    locationDetail: string
    currentActivity: string
    statusTags: string[]
    updatedAt: number
  } | null
  life: {
    pausedAt: number | null
    lastTickAt: number
    catchupSummary: string
    catchupTruncated: boolean
  } | null
  dayScript: {
    date: string
    id: string
    theme: string
    slots: Array<{
      hour: number
      minute: number
      type: string
      activity: string
      mood: string
      location: string
    }>
    slotsTruncated: boolean
  } | null
  events: Array<{
    id: string
    scheduledAt: number
    status: 'planned' | 'published'
    type: string
    activity: string
    mood: string
    location: string
  }>
  eventsTruncated: boolean
  moments: Array<{ id: string; publishedAt: number; text: string }>
  momentsTruncated: boolean
  profile: { identity: string; workflow: string; voice: string } | null
  memories: Array<{ id: string; category: string; content: string; updatedAt: number }>
  memoriesTruncated: boolean
  generatedAt: number
}

export function WorldStatePanel({ snap, error }: { snap: WorldSnapshot | null; error: string }) {
  if (error) {
    return <p className="text-xs" style={{ color: 'var(--danger, #c44)' }}>{error}</p>
  }
  if (!snap) {
    return <div className="text-sm" style={{ color: 'var(--text-muted)' }}>加载中…（需要 Electron）</div>
  }

  const fmt = (ms: number) =>
    ms ? new Date(ms).toLocaleString('zh-CN', { hour12: false }) : '—'

  return (
    <div className="space-y-4" data-testid="world-snapshot">
      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
        只读透视：它以为自己是谁、在哪、今天计划与发布了什么。已截断长字段；不含 API Key。
        <span className="ml-2 font-mono">@{fmt(snap.generatedAt)}</span>
      </p>

      <Section title={`计划 / 发布状态时间线${snap.eventsTruncated ? '（最近 30 条）' : ''}`}>
        {snap.events.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>暂无 planned / published 事件</p>
        ) : (
          <div className="space-y-1.5">
            {snap.events.map((event) => (
              <div
                key={event.id}
                className="grid gap-1 rounded border px-2.5 py-2 text-[11px] sm:grid-cols-[150px_68px_minmax(0,1fr)] sm:items-center"
                style={{
                  borderColor: 'var(--border-color)',
                  background: event.status === 'published'
                    ? 'color-mix(in srgb, var(--success) 8%, transparent)'
                    : 'color-mix(in srgb, var(--warning) 8%, transparent)',
                }}
              >
                <span className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>{fmt(event.scheduledAt)}</span>
                <span style={{ color: event.status === 'published' ? 'var(--success)' : 'var(--warning)' }}>
                  {event.status === 'published' ? '已发布' : '计划中'}
                </span>
                <span className="min-w-0 break-words" style={{ color: 'var(--text-primary)' }}>
                  {event.activity || '（无活动描述）'}
                  <span style={{ color: 'var(--text-muted)' }}>
                    {[event.location, event.mood, event.type].filter(Boolean).map((value) => ` · ${value}`).join('')}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="角色档案（Role Pack）">
        {snap.characterProfile ? (
          <>
            <KV label="年龄感" value={snap.characterProfile.agePresentation || '—'} />
            <KV label="生日" value={snap.characterProfile.birthday || '—'} />
            <KV label="性别气质" value={snap.characterProfile.genderPresentation || '—'} />
            <KV label="成长背景" value={snap.characterProfile.origin || '—'} />
            <KV label="当前身份" value={snap.characterProfile.occupation || '—'} />
            <KV label="教育" value={snap.characterProfile.education.join('；') || '—'} />
            <KV label="职业经历" value={snap.characterProfile.careerHistory.join('；') || '—'} />
            <KV label="能力" value={snap.characterProfile.skills.join('；') || '—'} />
            <KV label="表达基线" value={[
              `温暖 ${snap.characterProfile.expression.warmth}`,
              `能量 ${snap.characterProfile.expression.energy}`,
              `直接 ${snap.characterProfile.expression.directness}`,
              `玩闹 ${snap.characterProfile.expression.playfulness}`,
              `主动 ${snap.characterProfile.expression.initiative}`,
            ].join(' · ')} mono />
            <KV label="日常节奏" value={snap.characterProfile.dailyRhythm.join('；') || '—'} />
            <KV label="兴趣" value={snap.characterProfile.interests.join('；') || '—'} />
            <KV label="不喜欢" value={snap.characterProfile.dislikes.join('；') || '—'} />
            <KV label="习惯" value={snap.characterProfile.habits.join('；') || '—'} />
            <KV label="可控缺点" value={snap.characterProfile.flaws.join('；') || '—'} />
            <KV label="社交方式" value={snap.characterProfile.socialStyle.join('；') || '—'} />
            <KV label="价值实践" value={snap.characterProfile.valuesInPractice.join('；') || '—'} />
            <KV label="人生锚点" value={snap.characterProfile.lifeAnchors.map((anchor) => `${anchor.period}·${anchor.title}：${anchor.summary}`).join('；') || '—'} />
            <KV label="外观" value={[
              snap.characterProfile.appearance.overall,
              snap.characterProfile.appearance.hair,
              snap.characterProfile.appearance.eyes,
              snap.characterProfile.appearance.build,
              snap.characterProfile.appearance.clothingStyle,
              ...snap.characterProfile.appearance.distinguishingFeatures,
            ].join('；')} />
            <KV label="偏好" value={[
              `食物：${snap.characterProfile.favorites.foods.join('、')}`,
              `饮品：${snap.characterProfile.favorites.drinks.join('、')}`,
              `音乐：${snap.characterProfile.favorites.music.join('、')}`,
              `阅读：${snap.characterProfile.favorites.books.join('、')}`,
              `活动：${snap.characterProfile.favorites.activities.join('、')}`,
              `天气：${snap.characterProfile.favorites.weather.join('、')}`,
              `颜色：${snap.characterProfile.favorites.colors.join('、')}`,
            ].join('；')} />
            <KV label="身份边界" value={snap.characterProfile.selfAwareness || '—'} />
          </>
        ) : (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>当前角色尚无 profile.json</p>
        )}
      </Section>

      <Section title="默认世界（Role Pack）">
        {snap.worldDefaults ? (
          <>
            <KV label="城市" value={`${snap.worldDefaults.city.name}${snap.worldDefaults.city.fictional ? '（虚构）' : ''}`} />
            <KV label="城市描述" value={snap.worldDefaults.city.description || '—'} />
            <KV label="气候" value={snap.worldDefaults.city.climate || '—'} />
            <KV label="片区" value={snap.worldDefaults.district || '—'} />
            <KV label="片区描述" value={snap.worldDefaults.districtDescription || '—'} />
            <KV label="居所" value={snap.worldDefaults.home.shortName || '—'} />
            <KV label="住所描述" value={snap.worldDefaults.home.residence || '—'} />
            <KV label="周边" value={snap.worldDefaults.home.surroundings || '—'} />
            <KV label="室内" value={snap.worldDefaults.home.interior || '—'} />
            <KV label="户型" value={snap.worldDefaults.home.layout || '—'} />
            <KV label="窗外" value={snap.worldDefaults.home.view || '—'} />
            <KV label="感官细节" value={snap.worldDefaults.home.sensoryDetails.join('；') || '—'} />
            <KV label="初始地点" value={snap.worldDefaults.initialLocation || '—'} />
            <KV label="交通" value={[snap.worldDefaults.mobility.primary, ...snap.worldDefaults.mobility.alternatives].join('；')} />
            <KV label="常去地点" value={snap.worldDefaults.favoritePlaces.map((place) => `${place.name}（${place.kind}，${place.travelMinutes} 分钟）`).join('；') || '—'} />
            <KV label="初始物品" value={snap.worldDefaults.possessions.map((item) => `${item.name}（${item.condition}）`).join('；') || '—'} />
            <KV label="工作日" value={snap.worldDefaults.routines.weekday.join('；') || '—'} />
            <KV label="周末" value={snap.worldDefaults.routines.weekend.join('；') || '—'} />
            <KV label="长期世界事实" value={snap.worldDefaults.standingFacts.join('；') || '—'} />
            <KV label="房间场景" value={snap.worldDefaults.rooms.map((room) => room.name).join('、') || '—'} />
          </>
        ) : (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>当前角色尚无 world.default.json</p>
        )}
      </Section>

      <Section title="活跃主角">
        <KV label="id" value={snap.role.id} mono />
        <KV label="name" value={snap.role.name} />
        <KV label="universe" value={snap.role.universeId} mono />
        <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>{snap.role.description}</p>
      </Section>

      <Section title={`MUTABLE（${snap.mutable.source}${snap.mutable.version != null ? ` · v${snap.mutable.version}` : ''}）`}>
        {snap.mutable.truncated && <p className="mb-1 text-[10px] text-amber-500">正文已截断</p>}
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded border p-2 font-mono text-[11px]" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
          {snap.mutable.body || '（空）'}
        </pre>
      </Section>

      <Section title="世界薄片">
        {!snap.world ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>尚无 role_state</p>
        ) : (
          <>
            <KV label="home" value={snap.world.home} />
            <KV label="timezone" value={snap.world.timezone} mono />
            <KV label="mood" value={`${snap.world.mood}/100`} mono />
            <KV label="energy" value={`${snap.world.energy}/100`} mono />
            <KV label="socialNeed" value={`${snap.world.socialNeed}/100`} mono />
            <KV label="location" value={snap.world.currentLocation || '—'} />
            <KV label="locationDetail" value={snap.world.locationDetail || '—'} />
            <KV label="activity" value={snap.world.currentActivity || '—'} />
            <KV label="tags" value={snap.world.statusTags.join('、') || '—'} />
            <KV label="situation" value={snap.world.situation || '—'} />
            <KV label="updated" value={fmt(snap.world.updatedAt)} mono />
          </>
        )}
      </Section>

      <Section title="生活引擎">
        {!snap.life ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>—</p>
        ) : (
          <>
            <KV label="pausedAt" value={snap.life.pausedAt ? fmt(snap.life.pausedAt) : '（活跃）'} mono />
            <KV label="lastTickAt" value={fmt(snap.life.lastTickAt)} mono />
            {snap.life.catchupTruncated && <p className="mb-1 text-[10px] text-amber-500">catchup 已截断</p>}
            <pre className="max-h-28 overflow-auto whitespace-pre-wrap rounded border p-2 text-[11px]" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
              {snap.life.catchupSummary || '（无 catchup）'}
            </pre>
          </>
        )}
      </Section>

      <Section title={`今日剧本${snap.dayScript ? ` · ${snap.dayScript.date}` : ''}`}>
        {!snap.dayScript ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>今日尚无 day_script</p>
        ) : (
          <>
            <KV label="theme" value={snap.dayScript.theme || '—'} />
            {snap.dayScript.slotsTruncated && <p className="mb-1 text-[10px] text-amber-500">槽位已截断</p>}
            <div className="space-y-1">
              {snap.dayScript.slots.map((slot, index) => (
                <div key={`${slot.hour}:${slot.minute}:${index}`} className="rounded border px-2 py-1.5 text-[11px]" style={{ borderColor: 'var(--border-color)' }}>
                  <span className="font-mono" style={{ color: 'var(--text-muted)' }}>
                    {String(slot.hour).padStart(2, '0')}:{String(slot.minute).padStart(2, '0')}
                  </span>{' '}
                  <span style={{ color: 'var(--text-primary)' }}>{slot.activity}</span>
                  <span style={{ color: 'var(--text-muted)' }}> · {slot.mood} · {slot.location} · {slot.type}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </Section>

      <Section title={`近 Moments${snap.momentsTruncated ? '（已截断）' : ''}`}>
        {snap.moments.length === 0 ? <Empty /> : (
          <div className="space-y-1">
            {snap.moments.map((moment) => (
              <div key={moment.id} className="rounded border px-2 py-1.5 text-[11px]" style={{ borderColor: 'var(--border-color)' }}>
                <div className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>{fmt(moment.publishedAt)}</div>
                <div style={{ color: 'var(--text-secondary)' }}>{moment.text}</div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="用户画像（L3）">
        {!snap.profile ? <p className="text-xs" style={{ color: 'var(--text-muted)' }}>无画像</p> : (
          <>
            <KV label="identity" value={snap.profile.identity || '—'} />
            <KV label="workflow" value={snap.profile.workflow || '—'} />
            <KV label="voice" value={snap.profile.voice || '—'} />
          </>
        )}
      </Section>

      <Section title={`近记忆${snap.memoriesTruncated ? '（已截断）' : ''}`}>
        {snap.memories.length === 0 ? <Empty /> : (
          <div className="space-y-1">
            {snap.memories.map((memory) => (
              <div key={memory.id} className="flex gap-2 rounded border px-2 py-1 text-[11px]" style={{ borderColor: 'var(--border-color)' }}>
                <span className="shrink-0 font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>{memory.category}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{memory.content}</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        {title}
      </h3>
      <div className="theme-card rounded-lg border p-3" style={{ borderColor: 'var(--border-color)' }}>
        {children}
      </div>
    </section>
  )
}

function KV({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-2 text-xs leading-relaxed">
      <span className="w-20 shrink-0" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className={mono ? 'break-all font-mono' : 'break-words'} style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  )
}

function Empty() {
  return <p className="text-xs" style={{ color: 'var(--text-muted)' }}>暂无</p>
}
