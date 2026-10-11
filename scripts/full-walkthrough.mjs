// 零基础小白全流程走查 v2（修复 go() 传参 bug + 真实走完课堂第一课）
// 用法：node scripts/full-walkthrough.mjs [输出文件]
import { chromium } from 'playwright-core'
import fs from 'node:fs'

const EXE = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = 'http://localhost:5178/'
const OUT = process.argv[2] || 'scripts/fullwalk-log.txt'

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

// 正文提取：过滤顶部导航栏
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
  await page.waitForTimeout(1300)
}

async function clickNav(name) {
  // 模拟真实小白：点击顶部导航链接
  const clicked = await page.locator('a').filter({ hasText: new RegExp(`^\\s*${name}\\s*$`) }).first().click().then(() => true).catch(() => false)
  await page.waitForTimeout(1300)
  return clicked
}

async function clickBtn(regex, { disabledOk = false } = {}) {
  const clicked = await page.evaluate(([re, dk]) => {
    const btns = [...document.querySelectorAll('button')]
    const b = btns.find((el) => el.offsetParent !== null && (dk || !el.disabled) && new RegExp(re).test((el.innerText || '').trim()))
    if (!b) return null
    b.click()
    return (b.innerText || '').trim().slice(0, 30)
  }, [regex, disabledOk])
  await page.waitForTimeout(800)
  return clicked
}

// 做一步题：返回做了什么
async function doStep() {
  return page.evaluate(() => {
    const ta = document.querySelector('textarea')
    if (ta && !ta.disabled && !ta.value.trim()) {
      ta.value = '我猜可能和整体结构有关，先记下来。'
      ta.dispatchEvent(new Event('input', { bubbles: true }))
      return '填文本框'
    }
    const btns = [...document.querySelectorAll('button')].filter((el) => el.offsetParent !== null && !el.disabled)
    // 1) 推进按钮优先：作答后必须先「继续」才能进入下一题（避免反复点同一个选项）
    const adv = btns.find((b) => /^(继续|完成本课|我先猜猜看|来吧|现在就去|查看我的推理成长)/.test((b.innerText || '').trim()))
    if (adv) { adv.click(); return `点推进：${(adv.innerText || '').trim().slice(0, 20)}` }
    // 2) 检查类按钮（drag-sort / connect 判分）
    const check = btns.find((b) => /检查顺序|检查连线/.test((b.innerText || '').trim()))
    if (check) { check.click(); return `点检查：${(check.innerText || '').trim()}` }
    // 3) 保存解释
    const save = btns.find((b) => /保存我的解释/.test((b.innerText || '').trim()))
    if (save) { save.click(); return '保存解释' }
    // 4) 选择题选项（option / connect 左列右列）
    const opt = btns.find((b) => b.classList.contains('option') || b.classList.contains('connect-a') || b.classList.contains('connect-opt'))
    if (opt) { opt.click(); return `点选项：${(opt.innerText || '').trim().slice(0, 24)}` }
    return null
  })
}

try {
  await page.goto(BASE, { timeout: 15000 })
  await page.waitForTimeout(1200)
  snap('① 引导页', await bodyText())

  // 引导：选「我完全不懂玄学」→ 开始我的学习
  await page.locator('button,a').filter({ hasText: /^🌱\s*我完全不懂玄学/ }).first().click().catch(() => {})
  await page.waitForTimeout(400)
  await page.locator('button,a').filter({ hasText: /^开始我的学习/ }).first().click().catch(() => {})
  await page.waitForTimeout(1600)
  snap('② 首页工作台', await bodyText())

  // 点「开始今天的学习 →」进入课堂（首页今日任务卡）
  const entered = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button,a')].find((el) => /开始今天的学习/.test(el.innerText || ''))
    if (b) { b.click(); return true }
    return false
  })
  await page.waitForTimeout(1600)
  log(`进入课堂：${entered}  hash=${await page.evaluate(() => window.location.hash)}`)
  snap('③ 课堂第一课', await bodyText())

  // 做题循环：最多 60 步
  for (let i = 0; i < 60; i++) {
    const before = await bodyText()
    if (/本关完成|已完成「/.test(before)) { snap('⑦ 完成页', before); break }
    const action = await doStep()
    if (!action) { log(`第 ${i} 步：无可用按钮，停止`); snap('⚠ 卡住页', before); break }
    const after = await bodyText()
    if (after === before) { log(`第 ${i} 步：点了「${action}」页面无变化`) }
    // 记录关键反馈（答对/答错反馈、知识点）
    if (i % 3 === 0 || after !== before) {
      snap(`⑥ 第${i}步 · ${action}`, after)
    }
    if (/本关完成|已完成「/.test(after)) { snap('⑦ 完成页', after); break }
  }

  // 逐页验证顶部导航入口（模拟小白点导航）
  const navPages = [
    ['卦档', '/hex', '卦档'],
    ['术语', '/terms', '术语'],
    ['易工坊', '/play', '易工坊'],
    ['工具', '/tools', '工具'],
    ['实验', '/exp', '实验'],
    ['推理实验', '/lab', '推理实验'],
    ['成长', '/growth', '成长'],
    ['必背', '/memorize', '必背'],
    ['案例', '/cases', '案例馆'],
  ]
  for (const [label, route, mark] of navPages) {
    const okNav = await clickNav(label)
    const text = await bodyText()
    const hash = await page.evaluate(() => window.location.hash)
    const empty = text.trim().length < 20
    const isHome = /道友好/.test(text) && /今日任务/.test(text)
    snap(`⑧ ${mark}（点导航 ${label}）hash=${hash}`, text.slice(0, 600))
    log(`[${label}] 点导航=${okNav} hash=${hash} 空=${empty} 是首页=${isHome}`)
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
