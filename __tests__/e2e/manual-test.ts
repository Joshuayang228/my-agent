/**
 * 手动 E2E 测试脚本 — 连接运行中的 Electron 应用
 * 
 * 使用方式：npx tsx __tests__/e2e/manual-test.ts
 */
import { chromium } from 'playwright'

async function runTests() {
  const bugs: string[] = []
  const passed: string[] = []

  const browser = await chromium.connectOverCDP('http://localhost:9222')
  const contexts = browser.contexts()
  const context = contexts[0]
  const pages = context.pages()
  const page = pages.find(p => p.url().includes('localhost:5173'))!

  console.log(`\n🔗 Connected to Electron app: ${page.url()}\n`)

  // ── Test 1: 基础 UI ──
  console.log('📋 Test 1: 基础 UI 检查...')
  try {
    const title = await page.locator('h1').textContent()
    if (title !== 'My Agent') throw new Error(`标题不正确: ${title}`)
    
    const textarea = page.locator('textarea')
    if (!await textarea.isVisible()) throw new Error('输入框不可见')
    
    passed.push('✅ Test 1: 基础 UI 正常')
  } catch (e: any) {
    bugs.push(`❌ Test 1: 基础 UI — ${e.message}`)
  }

  // ── Test 2: 侧边栏折叠 ──
  console.log('📋 Test 2: 侧边栏折叠...')
  try {
    const sidebarText = page.locator('text=会话列表')
    if (!await sidebarText.isVisible()) throw new Error('会话列表标题不可见')
    
    await page.click('button:has-text("☰")')
    await page.waitForTimeout(300)
    if (await sidebarText.isVisible()) throw new Error('折叠后侧边栏仍可见')
    
    await page.click('button:has-text("☰")')
    await page.waitForTimeout(300)
    if (!await sidebarText.isVisible()) throw new Error('展开后侧边栏不可见')

    passed.push('✅ Test 2: 侧边栏折叠正常')
  } catch (e: any) {
    bugs.push(`❌ Test 2: 侧边栏 — ${e.message}`)
  }

  // ── Test 3: 设置面板 ──
  console.log('📋 Test 3: 设置面板...')
  try {
    await page.click('button[title="设置"]')
    await page.waitForTimeout(500)
    
    const settingsTitle = page.locator('h2:has-text("设置")')
    if (!await settingsTitle.isVisible()) throw new Error('设置面板未打开')
    
    const personaSection = page.locator('text=人格模板')
    const hasPersona = await personaSection.isVisible().catch(() => false)
    if (!hasPersona) bugs.push('⚠️ Test 3a: 设置面板中人格模板区域缺失')
    else passed.push('✅ Test 3a: 人格模板可见')

    const apiKeyInput = page.locator('input[placeholder="sk-..."]')
    const apiKeyValue = await apiKeyInput.inputValue()
    if (!apiKeyValue) bugs.push('⚠️ Test 3b: API Key 未加载')
    else passed.push('✅ Test 3b: API Key 已加载')

    await page.click('button:has-text("取消")')
    await page.waitForTimeout(300)
    
    passed.push('✅ Test 3: 设置面板基础功能正常')
  } catch (e: any) {
    bugs.push(`❌ Test 3: 设置面板 — ${e.message}`)
    try { await page.click('button:has-text("取消")') } catch {}
  }

  // ── Test 4: 发送消息 + 流式响应 ──
  console.log('📋 Test 4: 发送消息 + 流式响应...')
  try {
    const textarea = page.locator('textarea')
    await textarea.fill('请用一句话回答：1+1等于多少？')
    await page.click('button:has-text("发送")')
    console.log('   消息已发送，等待响应...')
    
    // 等用户消息显示
    await page.waitForSelector('[data-testid="chat-messages"] .justify-end', { timeout: 5000 })
    passed.push('✅ Test 4a: 用户消息已显示')
    
    // 等 AI 回复出现（.justify-start 里有文字）
    await page.waitForSelector('[data-testid="chat-messages"] .justify-start', { timeout: 30000 })
    
    // 等回复有实际内容
    await page.waitForFunction(
      () => {
        const bubble = document.querySelector('[data-testid="chat-messages"] .justify-start .markdown-body')
        return bubble && bubble.textContent && bubble.textContent.length > 2
      },
      { timeout: 30000 }
    )
    passed.push('✅ Test 4b: AI 流式回复成功')

    // 等完成（textarea 可用）
    await page.waitForFunction(
      () => !(document.querySelector('textarea') as HTMLTextAreaElement)?.disabled,
      { timeout: 15000 }
    )

    const chatContent = await page.locator('[data-testid="chat-messages"]').textContent()
    if (chatContent && chatContent.includes('2')) {
      passed.push('✅ Test 4c: 回复内容正确（包含 2）')
    } else {
      bugs.push(`⚠️ Test 4c: 回复可能不正确`)
      console.log('   Content:', chatContent?.slice(0, 200))
    }
  } catch (e: any) {
    bugs.push(`❌ Test 4: 发送消息 — ${e.message}`)
    // Debug dump
    const html = await page.evaluate(() => {
      const c = document.querySelector('[data-testid="chat-messages"]')
      return c?.innerHTML?.slice(0, 500) || 'NO CHAT AREA'
    }).catch(() => 'eval failed')
    console.log('   DEBUG:', html)
    // 等 textarea 恢复
    await page.waitForFunction(
      () => !(document.querySelector('textarea') as HTMLTextAreaElement)?.disabled,
      { timeout: 10000 }
    ).catch(() => {})
  }

  // ── Test 5: 工具调用 ──
  console.log('📋 Test 5: 工具调用...')
  try {
    await page.waitForFunction(
      () => !(document.querySelector('textarea') as HTMLTextAreaElement)?.disabled,
      { timeout: 5000 }
    )
    
    const textarea = page.locator('textarea')
    await textarea.fill('请调用 get_current_time 工具，告诉我现在几点了')
    await page.click('button:has-text("发送")')
    console.log('   工具调用消息已发送...')

    // 等 get_current_time 出现在页面上（工具调用 UI）
    await page.waitForSelector('text=get_current_time', { timeout: 30000 })
    passed.push('✅ Test 5a: 工具调用已触发')

    await page.waitForFunction(
      () => !(document.querySelector('textarea') as HTMLTextAreaElement)?.disabled,
      { timeout: 30000 }
    )
    passed.push('✅ Test 5b: 工具调用完成')
  } catch (e: any) {
    bugs.push(`❌ Test 5: 工具调用 — ${e.message}`)
    await page.waitForFunction(
      () => !(document.querySelector('textarea') as HTMLTextAreaElement)?.disabled,
      { timeout: 10000 }
    ).catch(() => {})
  }

  // ── Test 6: 新建会话 ──
  console.log('📋 Test 6: 新建会话...')
  try {
    await page.click('button:has-text("+ 新建")')
    await page.waitForTimeout(500)
    
    const welcomeText = page.locator('text=输入消息开始对话')
    if (await welcomeText.isVisible()) {
      passed.push('✅ Test 6: 新建会话成功')
    } else {
      bugs.push('⚠️ Test 6: 新建会话后未显示欢迎页面')
    }
  } catch (e: any) {
    bugs.push(`❌ Test 6: 新建会话 — ${e.message}`)
  }

  // ── Test 7: 会话切换 ──
  console.log('📋 Test 7: 会话切换...')
  try {
    const sessionItems = page.locator('.cursor-pointer.rounded-lg.px-3')
    const count = await sessionItems.count()
    console.log(`   找到 ${count} 个会话`)
    if (count < 2) {
      bugs.push(`⚠️ Test 7: 只有 ${count} 个会话，预期至少 2 个`)
    } else {
      // 点击包含之前对话的会话
      const target = sessionItems.filter({ hasText: '1+1' }).first()
      if (await target.isVisible().catch(() => false)) {
        await target.click()
        await page.waitForTimeout(1000)
        
        const hasMsg = await page.locator('[data-testid="chat-messages"]').textContent()
        if (hasMsg && hasMsg.includes('1+1')) {
          passed.push('✅ Test 7: 会话切换 + 历史加载正常')
        } else {
          bugs.push('⚠️ Test 7: 切换会话后历史消息未加载')
        }
      } else {
        const titles = await sessionItems.allTextContents()
        bugs.push(`⚠️ Test 7: 找不到含"1+1"的会话。现有: ${titles.join(', ')}`)
      }
    }
  } catch (e: any) {
    bugs.push(`❌ Test 7: 会话切换 — ${e.message}`)
  }

  // ── Test 8: 停止按钮 ──
  console.log('📋 Test 8: 停止按钮...')
  try {
    // 先确保在新会话
    await page.click('button:has-text("+ 新建")')
    await page.waitForTimeout(500)
    
    const textarea = page.locator('textarea')
    await textarea.fill('写一篇关于人工智能的500字文章')
    await page.click('button:has-text("发送")')
    
    const stopBtn = page.locator('button:has-text("停止")')
    await stopBtn.waitFor({ timeout: 15000 })
    passed.push('✅ Test 8a: 停止按钮已出现')
    
    await page.waitForTimeout(1000)
    await stopBtn.click()
    
    await page.waitForFunction(
      () => !(document.querySelector('textarea') as HTMLTextAreaElement)?.disabled,
      { timeout: 10000 }
    )
    passed.push('✅ Test 8b: 停止后 UI 恢复正常')
  } catch (e: any) {
    bugs.push(`❌ Test 8: 停止按钮 — ${e.message}`)
  }

  // ── 输出结果 ──
  console.log('\n' + '='.repeat(60))
  console.log('📊 测试报告')
  console.log('='.repeat(60))
  
  console.log(`\n✅ 通过 (${passed.length}):`)
  passed.forEach(p => console.log(`  ${p}`))
  
  if (bugs.length > 0) {
    console.log(`\n❌ 问题 (${bugs.length}):`)
    bugs.forEach(b => console.log(`  ${b}`))
  } else {
    console.log('\n🎉 全部通过！没有发现 Bug')
  }

  console.log('\n' + '='.repeat(60))
  
  await browser.close()
}

runTests().catch(console.error)
