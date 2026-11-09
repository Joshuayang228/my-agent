import { useState } from 'react'
import {
  Activity,
  AlertCircle,
  BatteryWarning,
  CheckCircle2,
  Clock,
  Compass,
  Heart,
  Moon,
  Sparkles,
  Zap,
} from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { PlaygroundStateSwitcher } from './PlaygroundLayout'
import { WorldCandidateControls } from './WorldCandidateControls'
import type { HostCareEvent, HostPresenceStatus, ReplanResult } from '../../shared/types'

const SCENARIOS = [
  { id: 'replan-exhaustion', label: '因果重排：体力透支休养' },
  { id: 'replan-vulnerability', label: '因果重排：脆弱心境自愈' },
  { id: 'host-care-fatigue', label: '现实锚点：连续工作关切' },
  { id: 'host-care-latenight', label: '现实锚点：深夜熬夜劝睡' },
] as const

type ScenarioId = typeof SCENARIOS[number]['id']

const MOCK_REPLAN_EXHAUSTION: ReplanResult = {
  ok: true,
  roleId: 'luffy',
  replannedCount: 3,
  trigger: 'vitals_exhaustion',
  reason: '航海风暴后体力严重透支（精力仅剩 18），急需卧床修整',
  adjustedSlots: [
    {
      eventId: 'evt-rep-1',
      hour: 14,
      minute: 30,
      activity: '在船舱阴凉处裹着毯子大睡特睡（原定：甲板高强度体能特训）',
      mood: '疲惫恢复中',
      location: '医务室/船舱',
    },
    {
      eventId: 'evt-rep-2',
      hour: 17,
      minute: 0,
      activity: '大口喝下山治特调的热骨头浓汤补充能量（原定：攀爬主桅杆观望远方）',
      mood: '温饱安心',
      location: '厨房角落',
    },
    {
      eventId: 'evt-rep-3',
      hour: 20,
      minute: 15,
      activity: '坐在甲板台阶上发呆吹微风，听海浪声音（原定：举办甲板篝火喧闹宴会）',
      mood: '平静放松',
      location: '甲板阴凉处',
    },
  ],
}

const MOCK_REPLAN_VULNERABILITY: ReplanResult = {
  ok: true,
  roleId: 'luffy',
  replannedCount: 2,
  trigger: 'vulnerability',
  reason: '深夜思念故人与草帽誓言，陷入沉静感怀心境',
  adjustedSlots: [
    {
      eventId: 'evt-rep-4',
      hour: 19,
      minute: 0,
      activity: '一个人坐在羊头船首静静看海浪翻涌（原定：和乌索普在甲板钓鱼大叫）',
      mood: '沉静释怀',
      location: '梅利号船首',
    },
    {
      eventId: 'evt-rep-5',
      hour: 21,
      minute: 30,
      activity: '低头默默抚平草帽上的细小磨痕，凝视星空（原定：甲板烤肉宴会）',
      mood: '若有所思',
      location: '甲板角落',
    },
  ],
}

const MOCK_HOST_CARE_FATIGUE: HostCareEvent = {
  kind: 'fatigue_break',
  title: '休息一下吧！',
  message: '喂！你从刚才开始就一直坐在那一动不动的，键盘都要敲出火星啦！已经忙了整整 140 分钟了，快站起来伸个大大的懒腰，去吃点好吃的补充体力！',
  suggestedAction: '站起来大跳两下伸伸懒腰，去倒一杯温水！',
  continuousActiveMinutes: 140,
  triggeredAt: Date.now() - 5 * 60 * 1000,
}

const MOCK_HOST_CARE_LATENIGHT: HostCareEvent = {
  kind: 'late_night_sleep',
  title: '快去睡啦！',
  message: '哈欠……都这～么晚了你怎么还在忙啊！都凌晨快两点了！再不睡觉明天可就没力气去大海上冒险了，赶紧把电脑合上钻进被窝，明天我再陪你！',
  suggestedAction: '立刻合上屏幕，钻进温暖被窝呼呼大睡！',
  continuousActiveMinutes: 95,
  triggeredAt: Date.now() - 2 * 60 * 1000,
}

const MOCK_STATUS: HostPresenceStatus = {
  continuousActiveMinutes: 140,
  idleSeconds: 12,
  isLateNight: false,
  isFocusSession: true,
}

export function LifeCausalityCandidate() {
  const [scenario, setScenario] = useState<ScenarioId>('replan-exhaustion')
  const [acknowledged, setAcknowledged] = useState(false)

  const handleScenarioChange = (id: ScenarioId) => {
    setScenario(id)
    setAcknowledged(false)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <WorldCandidateControls>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
          <div className="flex items-center gap-2">
            <Compass size={18} className="text-amber-500" />
            <span className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
              人物世界引擎因果状态机与现实作息锚点
            </span>
          </div>
          <PlaygroundStateSwitcher
            items={SCENARIOS}
            value={scenario}
            onChange={(id) => handleScenarioChange(id as ScenarioId)}
            ariaLabel="选择生活因果或现实作息场景"
          />
        </div>
      </WorldCandidateControls>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6" data-testid="life-causality-candidate-viewport">
        {/* 场景 1 & 2：日内动态因果重编排 */}
        {(scenario === 'replan-exhaustion' || scenario === 'replan-vulnerability') && (
          <div className="mx-auto max-w-3xl space-y-5">
            <div
              className="rounded-xl border p-4 shadow-sm"
              style={{
                borderColor: scenario === 'replan-exhaustion' ? 'var(--color-amber-500, #F59E0B)' : 'var(--color-sky-500, #0EA5E9)',
                background: 'var(--bg-secondary)',
              }}
            >
              <div className="flex items-start gap-3">
                {scenario === 'replan-exhaustion' ? (
                  <BatteryWarning size={22} className="shrink-0 text-amber-500 mt-0.5" />
                ) : (
                  <Moon size={22} className="shrink-0 text-sky-400 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-bold" style={{ color: 'var(--text-primary)' }}>
                      {scenario === 'replan-exhaustion' ? '⚡ 突发生理透支 · 动态自愈重排' : '🌙 深夜情绪脆弱 · 沉静放空重排'}
                    </span>
                    <span
                      className="rounded px-2 py-0.5 text-[11px] font-medium"
                      style={{
                        background: 'color-mix(in srgb, var(--accent-primary) 15%, transparent)',
                        color: 'var(--accent-primary)',
                      }}
                    >
                      已自动重排 {scenario === 'replan-exhaustion' ? MOCK_REPLAN_EXHAUSTION.replannedCount : MOCK_REPLAN_VULNERABILITY.replannedCount} 个槽位
                    </span>
                  </div>
                  <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    <strong>重排诱因：</strong>
                    {scenario === 'replan-exhaustion' ? MOCK_REPLAN_EXHAUSTION.reason : MOCK_REPLAN_VULNERABILITY.reason}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-[13px] font-semibold tracking-wide uppercase text-muted-foreground flex items-center gap-1.5">
                <Clock size={14} />
                当日后续调整日程（带 causedBy 因果溯源标签）
              </h3>

              {(scenario === 'replan-exhaustion' ? MOCK_REPLAN_EXHAUSTION.adjustedSlots : MOCK_REPLAN_VULNERABILITY.adjustedSlots).map((slot, idx) => (
                <div
                  key={slot.eventId}
                  className="rounded-lg border p-3.5 transition-all"
                  style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card, var(--bg-secondary))' }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[13px] font-bold text-amber-500">
                      {String(slot.hour).padStart(2, '0')}:{String(slot.minute).padStart(2, '0')}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                        心情：{slot.mood}
                      </span>
                      {slot.location && (
                        <span className="text-[11px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
                          {slot.location}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-[14px] leading-relaxed font-medium" style={{ color: 'var(--text-primary)' }}>
                    {slot.activity}
                  </p>
                  <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-muted-foreground border-t pt-2" style={{ borderColor: 'var(--border-subtle)' }}>
                    <Sparkles size={12} className="text-amber-500" />
                    <span>因果溯源：由 <code>causedBy.{scenario === 'replan-exhaustion' ? 'vitals_exhaustion' : 'vulnerability'}</code> 触发，承接上午状态自愈</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 场景 3 & 4：宿主环境感知与现实关怀触达 */}
        {(scenario === 'host-care-fatigue' || scenario === 'host-care-latenight') && (
          <div className="mx-auto max-w-2xl space-y-5">
            {/* 宿主状态监控面板 */}
            <div className="rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Activity size={14} className="text-emerald-500" />
                  宿主非侵入式活跃度遥测（零隐私侵害）
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-500 font-medium">
                  powerMonitor: ACTIVE
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded border p-2.5" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="text-[11px] text-muted-foreground">连续专注工作</div>
                  <div className="text-[16px] font-bold text-amber-500 mt-0.5">
                    {scenario === 'host-care-fatigue' ? '140 分钟' : '95 分钟'}
                  </div>
                </div>
                <div className="rounded border p-2.5" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="text-[11px] text-muted-foreground">系统空闲时长</div>
                  <div className="text-[16px] font-bold text-emerald-500 mt-0.5">12 秒</div>
                </div>
                <div className="rounded border p-2.5" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="text-[11px] text-muted-foreground">本地当前时段</div>
                  <div className="text-[16px] font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>
                    {scenario === 'host-care-fatigue' ? '16:45 下午' : '01:45 凌晨'}
                  </div>
                </div>
                <div className="rounded border p-2.5" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="text-[11px] text-muted-foreground">关怀触发门阀</div>
                  <div className="text-[16px] font-bold text-sky-500 mt-0.5">已就绪</div>
                </div>
              </div>
            </div>

            {/* 伙伴第一人称关怀卡片 */}
            <div
              className="rounded-xl border p-5 shadow-md relative overflow-hidden"
              style={{
                borderColor: scenario === 'host-care-fatigue' ? 'var(--color-amber-500, #F59E0B)' : 'var(--color-indigo-500, #6366F1)',
                background: 'var(--bg-card, var(--bg-secondary))',
              }}
            >
              <div className="flex items-start gap-3.5">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-bold"
                  style={{ background: 'var(--color-amber-500, #F59E0B)', color: '#fff' }}
                >
                  路
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[15px] font-bold" style={{ color: 'var(--text-primary)' }}>
                      路飞 发来现实健康关切
                    </span>
                    <span className="text-[11px] text-muted-foreground">刚刚</span>
                  </div>

                  <p className="mt-2 text-[14px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                    {scenario === 'host-care-fatigue' ? MOCK_HOST_CARE_FATIGUE.message : MOCK_HOST_CARE_LATENIGHT.message}
                  </p>

                  <div className="mt-3.5 rounded-lg border p-3 flex items-center justify-between gap-3 bg-amber-500/5" style={{ borderColor: 'rgba(245, 158, 11, 0.25)' }}>
                    <div className="flex items-center gap-2">
                      <Zap size={16} className="text-amber-500 shrink-0" />
                      <span className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>
                        建议动作：{scenario === 'host-care-fatigue' ? MOCK_HOST_CARE_FATIGUE.suggestedAction : MOCK_HOST_CARE_LATENIGHT.suggestedAction}
                      </span>
                    </div>
                    <ActionButton
                      size="sm"
                      variant={acknowledged ? 'plain' : 'default'}
                      onClick={() => setAcknowledged(true)}
                    >
                      {acknowledged ? (
                        <>
                          <CheckCircle2 size={13} className="mr-1 text-emerald-500" />
                          已回应TA
                        </>
                      ) : (
                        <>
                          <Heart size={13} className="mr-1" />
                          收到，伸个懒腰
                        </>
                      )}
                    </ActionButton>
                  </div>
                </div>
              </div>
            </div>

            {/* 次日因果反哺说明 */}
            <div className="rounded-lg border p-3.5 text-[12px] leading-relaxed text-muted-foreground bg-muted/30" style={{ borderColor: 'var(--border-subtle)' }}>
              <span className="font-semibold text-foreground mr-1.5">🔗 次日生活因果同频：</span>
              {scenario === 'host-care-fatigue'
                ? '此段高专注工作将被记录于工作会话中，次日日剧本中角色会根据昨日辛劳在晨起打招呼中主动询问“昨天敲了一下午代码，今天肩膀还酸吗？”。'
                : '熬夜标志将写入 yesterdayNightWork，次日日剧本在规划时会调低剧烈活动频率，并在早晨温和劝慰“昨晚看你那么晚才睡，今天可别太拼啦”。'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
