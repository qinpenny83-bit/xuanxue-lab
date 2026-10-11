// 案件做题走查：小白完整破案 #001（5 道挑战），记录每步反馈与卡点
import { chromium } from 'playwright-core'
import fs from 'node:fs'

const EXE = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = 'http://localhost:5178/'
const OUT = 'scripts/case-log.txt'

const lines = []
function log(msg) {
  const t = `[${new Date().toISOString().slice(11, 19)}] ${msg}`
  lines.push(t)
  console.log(t)
}
function snap(title, text) {
  const t = text.replace(/\n{3,}/g, '\n\n').trim()
  lines.push(`\n========== ${title} ==========\n${t}\n`)
}

const browser = await chromium.launch({ executablePath: EXE, headless: true })
const page = await browser.newPage()
const consoleErrors = []
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message))

async function bodyText() {
  return page.evaluate(() => {
    const t = (document.body.innerText || '').trim()
    const nav = ['首页', '地图', '求学', '必背', '课堂', '卦档', '术语', '案例', '易工坊', '实验', '工具', '推理实验', '怀疑', '命盘', '成长', '词典']
    const arr = t.split('\n').map((l) => l.trim()).filter((l) => l)
    let cut = 0
    for (let i = 0; i < arr.length; i++) {
      if (nav.includes(arr[i]) && i > 0) { cut = i + 1; break }
    }
    return arr.slice(cut).join('\n')
  })
}

try {
  await page.goto(BASE, { timeout: 15000 })
  await page.waitForTimeout(1200)
  await page.locator('button,a').filter({ hasText: /^🌱\s*我完全不懂玄学/ }).first().click().catch(() => {})
  await page.waitForTimeout(400)
  await page.locator('button,a').filter({ hasText: /^开始我的学习/ }).first().click().catch(() => {})
  await page.waitForTimeout(1600)

  // 进入案例馆 → 案件 #001
  await page.evaluate(() => { window.location.hash = '/cases' })
  await page.waitForTimeout(1200)
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button,a')].find((el) => /案件 #001/.test(el.innerText || ''))
    if (b) b.click()
  })
  await page.waitForTimeout(1200)
  const detail = await bodyText()
  snap('① 案件详情', detail.slice(0, 500))

  // 开始推理
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button,a')].find((el) => /开始推理/.test(el.innerText || ''))
    if (b) b.click()
  })
  await page.waitForTimeout(1000)

  // 做题循环（最多 40 步）
  for (let i = 0; i < 40; i++) {
    const before = await bodyText()
    if (/破案完成|案件完成|恭喜|🎉/.test(before) && /完成/.test(before)) { snap('③ 破案完成', before.slice(0, 500)); break }
    if (i % 2 === 0 || i < 6) snap(`② 第${i}步`, before.slice(0, 450))

    const action = await page.evaluate(() => {
      // selfreflect 文本框
      const ta = document.querySelector('textarea')
      if (ta && !ta.disabled && !ta.value.trim()) {
        ta.value = '我的判断：先看证据链，不下结论。'
        ta.dispatchEvent(new Event('input', { bubbles: true }))
        return '填文本框'
      }
      const btns = [...document.querySelectorAll('button')].filter((el) => el.offsetParent !== null && !el.disabled)
      // 推进类（「查看评分/结果」优先——它出现说明本挑战已答完）
      const view = btns.find((b) => /^查看评分|^查看结果|^查看我的|^查看分析/.test((b.innerText || '').trim()))
      if (view) { view.click(); return `查看：${(view.innerText || '').trim().slice(0, 14)}` }
      const adv = btns.find((b) => /^(继续|下一步|完成|提交|确定|确认|保存|再来|下一题|下一挑战|开始)/.test((b.innerText || '').trim()) && !/^[A-D][\s\u3000]/.test((b.innerText || '').trim()))
      if (adv) { adv.click(); return `推进：${(adv.innerText || '').trim().slice(0, 16)}` }
      // 勾选题：点 evidence-chip / checkbox（确认按钮在勾选后才启用）
      const chip = btns.find((b) => b.classList.contains('evidence-chip') || b.classList.contains('confidence'))
      if (chip) { chip.click(); return `点chip：${(chip.innerText || '').trim().slice(0, 12)}` }
      const check = document.querySelector('input[type="checkbox"], input[type="radio"], input[type="range"]')
      if (check && !check.disabled) { check.click(); return '勾选/滑杆' }
      // 选项（字母开头或 option 类）
      const opt = btns.find((b) => b.classList.contains('option') || /^[A-D][\s\u3000]/.test((b.innerText || '').trim()))
      if (opt) { opt.click(); return `选项：${(opt.innerText || '').trim().slice(0, 22)}` }
      return null
    })
    if (!action) { log(`第 ${i} 步：无可用按钮，停止`); snap('⚠ 卡住页', before.slice(0, 400)); break }
    await page.waitForTimeout(900)
    const after = await bodyText()
    if (after === before) { log(`第 ${i} 步：点了「${action}」页面无变化`) }
  }

  log(`\n控制台错误 ${consoleErrors.length} 条：`)
  consoleErrors.slice(0, 15).forEach((e) => log('  ' + e))
} catch (e) {
  log('FATAL: ' + e.message)
} finally {
  fs.writeFileSync(OUT, lines.join('\n'), 'utf8')
  await browser.close()
  log(`\n日志已写入 ${OUT}`)
}
