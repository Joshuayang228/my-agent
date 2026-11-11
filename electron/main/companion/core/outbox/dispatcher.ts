import { BrowserWindow } from 'electron'
import { dispatchCompanionOutbox } from './outbox'

/**
 * 投递人物世界出站通知到渲染层。
 *
 * 背景：业务模块直接广播窗口事件时，通知没有重试记录，窗口暂时不可用会丢失用户可见状态。
 * 设计意图：窗口广播只保留在适配器，核心 Outbox 先落账，再由这里按消息状态投递，避免领域层依赖 Electron。
 * 关键约束：只向未销毁窗口发送，投递失败必须回写 failed 供下一轮重试，不能标记为 delivered。
 */
export async function dispatchCompanionWindowOutbox(limit = 20): Promise<number> {
  return dispatchCompanionOutbox({
    limit,
    deliver: async (message) => {
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) win.webContents.send(`companion:${message.kind}`, message.payload)
      }
    },
  })
}
