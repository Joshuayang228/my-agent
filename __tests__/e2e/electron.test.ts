/**
 * 可选外部模型验收：TEST_LLM_API_KEY / TEST_LLM_BASE_URL / TEST_LLM_MODEL。
 * 每项从独立数据目录和正式模型表单开始；无 Key 跳过，不读取开发者现有设置。
 * 运行前须明确费用授权。回环协议夹具可验证脚本，但不等同于真实供应商质量验收。
 */
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AgentStreamEvent } from '../../src/shared/types'

const API_KEY = process.env.TEST_LLM_API_KEY || ''
const BASE_URL = process.env.TEST_LLM_BASE_URL || 'https://api.deepseek.com'
const MODEL = process.env.TEST_LLM_MODEL || 'deepseek-chat'

type ObservedWindow = Window & { __externalModelEvents: AgentStreamEvent[]; __externalModelOff: () => void }
let electronApp: ElectronApplication | undefined
let page: Page
let userDataDir = ''

test.beforeEach(async () => {
  test.skip(!API_KEY, '未配置 TEST_LLM_API_KEY，不运行外部模型验收')
  test.setTimeout(120_000)
  userDataDir = await mkdtemp(path.join(os.tmpdir(), 'my-agent-external-model-'))
  electronApp = await electron.launch({
    args: [fileURLToPath(new URL('../../dist-electron/index.js', import.meta.url)), '--user-data-dir=' + userDataDir, '--no-sandbox'],
    env: { ...process.env, NODE_ENV: 'production', LLM_API_KEY: '', LLM_BASE_URL: '', LLM_MODEL: '' },
  })
  page = await electronApp.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await expect(page.getByTestId('settings-panel')).toBeVisible()
  await page.getByTestId('settings-nav-model').click()
  await page.getByRole('button', { name: '添加连接', exact: true }).click()
  const form = page.getByTestId('model-connection-form')
  await form.getByRole('radio', { name: '自定义连接', exact: true }).click()
  await form.getByLabel('连接名称', { exact: true }).fill('外部模型验收')
  await form.getByLabel('连接适配器', { exact: true }).selectOption('openai-compatible')
  await form.getByLabel('Base URL', { exact: true }).fill(BASE_URL)
  await form.getByLabel('API Key', { exact: true }).fill(API_KEY)
  await form.getByRole('button', { name: '保存连接', exact: true }).click()
  const input = page.getByRole('textbox', { name: '手动添加模型 外部模型验收', exact: true })
  await expect(input).toBeVisible({ timeout: 20_000 })
  await input.fill(MODEL)
  await input.press('Enter')
  await page.getByLabel('添加主对话模型').selectOption({ label: '外部模型验收 · ' + MODEL })
  await expect.poll(() => page.evaluate(async () => (await window.electronAPI.settings.get()).llmConnectionReady)).toBe('true')
  await page.getByTestId('settings-back').click()
  await expect(page.getByTestId('chat-current-model')).toHaveText(MODEL)
  await page.evaluate(() => {
    const target = window as ObservedWindow
    target.__externalModelEvents = []
    target.__externalModelOff = window.electronAPI.chat.onEvent(event => target.__externalModelEvents.push(event))
  })
})

test.afterEach(async () => {
  try {
    if (electronApp) {
      await page?.evaluate(() => (window as ObservedWindow).__externalModelOff?.()).catch(() => undefined)
      await electronApp.close()
    }
  } finally {
    electronApp = undefined
    if (userDataDir) await rm(userDataDir, { recursive: true, force: true })
    userDataDir = ''
  }
})

async function send(text: string) {
  await page.evaluate(() => { (window as ObservedWindow).__externalModelEvents = [] })
  await page.getByPlaceholder(/和.*说说/).fill(text)
  await page.getByRole('button', { name: '发送', exact: true }).click()
  await expect(page.getByTestId('chat-messages').getByText(text, { exact: true })).toBeVisible()
}

async function events(): Promise<AgentStreamEvent[]> {
  return page.evaluate(() => (window as ObservedWindow).__externalModelEvents)
}

async function completedReply(): Promise<string> {
  await expect.poll(async () => (await events()).filter(event => event.type === 'done').length, { timeout: 60_000 }).toBe(1)
  const received = await events()
  expect(received.filter(event => event.type === 'error')).toEqual([])
  expect(received.find(event => event.type === 'done')).toMatchObject({ reason: 'completed' })
  const text = received.filter(event => event.type === 'text').map(event => event.content).join('')
  expect(text.trim()).not.toBe('')
  return text
}

test.describe('Electron 真实对话', () => {
  test('配置 API Key 并发送消息获得回复', async () => {
    await send('请只用一个阿拉伯数字回答：1+1等于几？')
    expect(await completedReply()).toContain('2')
    await expect(page.getByTestId('chat-messages')).toContainText('2')
  })

  test('工具调用：获取当前时间', async () => {
    await send('请调用 get_current_time 工具告诉我现在几点了')
    await completedReply()
    const result = (await events()).find(event => event.type === 'tool_end' && event.name === 'get_current_time')
    expect(result).toBeDefined()
    expect(result).toMatchObject({ name: 'get_current_time' })
    if (result?.type !== 'tool_end') throw new Error('没有真实工具完成事件')
    expect(result.isError).not.toBe(true)
    expect(result.result).toContain('当前时间')
  })

  test('停止按钮可中断流式响应', async () => {
    await send('写一篇500字的文章，主题是人工智能的未来')
    const stop = page.getByRole('button', { name: '停止', exact: true })
    await expect(stop).toBeVisible({ timeout: 30_000 })
    await stop.click()
    await expect.poll(async () => (await events()).find(event => event.type === 'done'), { timeout: 10_000 }).toMatchObject({ reason: 'aborted' })
    await expect(page.getByRole('button', { name: '发送', exact: true })).toBeVisible()
    await expect(page.getByPlaceholder(/和.*说说/)).toBeEnabled()
  })

  test('多轮对话上下文保持', async () => {
    await send('我叫小明，请记住我的名字')
    await completedReply()
    await send('我叫什么名字？')
    expect(await completedReply()).toContain('小明')
  })
})
