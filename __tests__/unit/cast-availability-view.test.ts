import { describe, expect, it } from "vitest"
import {
  describeCastAvailability,
  describeCastAvailabilityWhileLoading,
  isCastAvailabilitySnapshot,
} from "../../src/shared/cast-availability-view"

describe("cast availability view", () => {
  it("available presence becomes a list-friendly label without hiding the open-chat path", () => {
    const view = describeCastAvailability({
      available: true,
      roleId: "chen",
      name: "陈晨",
      presence: "加班（公司）",
    })
    expect(view).toEqual({ label: "方便开聊", detail: "此刻：加班（公司）", tone: "available" })
  })

  it("busy reason, alternative and presence stay on the card copy", () => {
    const view = describeCastAvailability({
      available: false,
      roleId: "chen",
      name: "陈晨",
      reason: "陈晨说：手头正忙着收尾一件事",
      alternative: "要不改今天 19 点？",
      presence: "开会",
    })
    expect(view.tone).toBe("busy")
    expect(view.label).toBe("现在忙碌")
    expect(view.detail).toContain("手头正忙着收尾一件事")
    expect(view.detail).toContain("要不改今天 19 点？")
    expect(view.detail).toContain("此刻：开会")
  })

  it("failed or missing IPC must not look free, while loading keeps a reserved unknown state", () => {
    expect(isCastAvailabilitySnapshot({ ok: false, error: "UNKNOWN_ROLE" })).toBe(false)
    expect(describeCastAvailability(null)).toEqual({
      label: "状态未读到",
      detail: "开聊时会再确认一次。",
      tone: "unknown",
    })
    expect(describeCastAvailabilityWhileLoading(undefined, true)).toEqual({
      label: "正在查看忙闲",
      detail: "开聊前会再确认一次。",
      tone: "unknown",
    })
  })
})
