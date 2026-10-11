// 进阶走查：连续学习路径 + 关键交互验证（小白能否一路学下去）
// 用法：node scripts/progress-walkthrough.mjs [输出文件]
import { chromium } from 'playwright-core'
import fs from 'node:fs'

const EXE = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = 'http://localhost:5178/'
const OUT = process.argv[2] || 'scripts/progress-log.txt'

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

async function go(route) {
  await page.evaluate((r) => { window.location.hash = r }, route)
  await page.waitForTimeout(1200)
}

async function clickBtnText(re) {
  const hit = await page.evaluate((re) => {
    const b = [...document.querySelectorAll('button,a')].find((el) => el.offsetParent !== null && new RegExp(re).test((el.innerText || '').trim()))
    if (!b) return null
    b.click()
    return (b.innerText || '').trim().slice(0, 30)
  }, re)
  await page.waitForTimeout(1000)
  return hit
}

async function doLessonStep() {
  return page.evaluate(() => {
    const ta = document.querySelector('textarea')
    if (ta && !ta.disabled && !ta.value.trim()) {
      ta.value = '我猜和整体结构有关。'
      ta.dispatchEvent(new Event('input', { bubbles: true }))
      return '填文本框'
    }
    const btns = [...document.querySelectorAll('button')].filter((el) => el.offsetParent !== null && !el.disabled)
    const adv = btns.find((b) => /^(继续|完成本课|我先猜猜看|来吧|现在就去|查看我的推理成长)/.test((b.innerText || '').trim()))
    if (adv) { adv.click(); return `点推进：${(adv.innerText || '').trim().slice(0, 20)}` }
    const check = btns.find((b) => /检查顺序|检查连线/.test((b.innerText || '').trim()))
    if (check) { check.click(); return `点检查：${(check.innerText || '').trim()}` }
    const save = btns.find((b) => /保存我的解释/.test((b.innerText || '').trim()))
    if (save) { save.click(); return '保存解释' }
    const opt = btns.find((b) => b.classList.contains('option') || b.classList.contains('connect-a') || b.classList.contains('connect-opt'))
    if (opt) { opt.click(); return `点选项：${(opt.innerText || '').trim().slice(0, 20)}` }
    return null
  })
}

async function runLesson(maxSteps) {
  for (let i = 0; i < maxSteps; i++) {
    const before = await bodyText()
    if (/本关完成|已完成「/.test(before)) return '完成'
    const action = await doLessonStep()
    if (!action) return '卡住:' + before.slice(0, 80)
    const after = await bodyText()
    if (after === before) return '无变化:' + action
  }
  return '步数超限'
}

try {
  await page.goto(BASE, { timeout: 15000 })
  await page.waitForTimeout(1200)
  await page.locator('button,a').filter({ hasText: /^🌱\s*我完全不懂玄学/ }).first().click().catch(() => {})
  await page.waitForTimeout(400)
  await page.locator('button,a').filter({ hasText: /^开始我的学习/ }).first().click().catch(() => {})
  await page.waitForTimeout(1600)

  // ---- A. 连续学习：完成第一课 → 点「下一关」→ 完成第二课 …（最多学 3 关）----
  for (let round = 1; round <= 3; round++) {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button,a')].find((el) => /开始今天的学习/.test(el.innerText || ''))
      if (b) b.click()
    })
    await page.waitForTimeout(1500)
    const r = await runLesson(40)
    log(`第 ${round} 关：${r}`)
    const done = await bodyText()
    snap(`A${round} 第${round}关完成`, done.slice(0, 400))
    if (!/本关完成/.test(done)) break
    // 点「下一关」主按钮
    const next = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button,a')].find((el) => /下一关|进入下一章|进入新学院|信息提取|继续学习/.test(el.innerText || '') && !el.disabled)
      if (!b) return null
      b.click()
      return (b.innerText || '').trim().slice(0, 30)
    })
    await page.waitForTimeout(1600)
    log(`点下一关：${next}  hash=${await page.evaluate(() => window.location.hash)}`)
    snap(`A${round}n 下一关进入`, (await bodyText()).slice(0, 250))
  }

  // ---- B. 卦档 → 点乾卦 → 卦详情 ----
  await go('/hex')
  const hexClicked = await clickBtnText('^乾$')
  const hexPage = await bodyText()
  snap('B 卦档-乾卦详情', hexPage.slice(0, 500))
  log(`点乾卦：${hexClicked}`)

  // ---- C. 术语 → 点「阴阳」→ 详情 ----
  await go('/terms')
  const termClicked = await clickBtnText('^阴阳$')
  const termPage = await bodyText()
  snap('C 术语-阴阳详情', termPage.slice(0, 300))
  log(`点术语：${termClicked}`)

  // ---- D. 必背 → 看答案 ----
  await go('/memorize')
  const memClicked = await clickBtnText('看答案')
  const memPage = await bodyText()
  snap('D 必背-看答案', memPage.slice(0, 200))
  log(`看答案：${memClicked}`)

  // ---- E. 案例馆 → 案件 #001 → 开始推理 → 第一题 ----
  await go('/cases')
  const caseClicked = await clickBtnText('案件 #001')
  const caseDetail = await bodyText()
  snap('E1 案件详情', caseDetail.slice(0, 400))
  const startClicked = await clickBtnText('开始推理')
  const caseQ = await bodyText()
  snap('E2 案件第一题', caseQ.slice(0, 400))
  log(`案件进入：${caseClicked} 开始推理：${startClicked}`)

  log(`\n控制台错误 ${consoleErrors.length} 条：`)
  consoleErrors.slice(0, 15).forEach((e) => log('  ' + e))
} catch (e) {
  log('FATAL: ' + e.message)
} finally {
  fs.writeFileSync(OUT, lines.join('\n'), 'utf8')
  await browser.close()
  log(`\n日志已写入 ${OUT}`)
}
