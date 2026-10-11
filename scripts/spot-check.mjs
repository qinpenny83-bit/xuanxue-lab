// 深层交互抽查：必背/术语详情/易工坊/首页提问
import { chromium } from 'playwright-core'

const EXE = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = 'http://localhost:5178/'

const browser = await chromium.launch({ executablePath: EXE, headless: true })
const page = await browser.newPage()
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

async function body() {
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
async function go(r) {
  await page.evaluate((x) => { window.location.hash = x }, r)
  await page.waitForTimeout(1300)
}

await page.goto(BASE, { timeout: 15000 })
await page.waitForTimeout(1200)
await page.locator('button,a').filter({ hasText: /^🌱\s*我完全不懂玄学/ }).first().click().catch(() => {})
await page.waitForTimeout(400)
await page.locator('button,a').filter({ hasText: /^开始我的学习/ }).first().click().catch(() => {})
await page.waitForTimeout(1600)

// 1) 必背：点第一张「看答案 ▼」
await go('/memorize')
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((el) => /看答案/.test(el.innerText || ''))
  if (b) b.click()
})
await page.waitForTimeout(600)
const mem = await body()
console.log('--- 必背看答案 ---')
console.log(mem.slice(0, 220))

// 2) 术语详情：点「阴阳」术语（term-row）
await go('/terms')
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((el) => (el.innerText || '').trim().startsWith('阴阳'))
  if (b) b.click()
})
await page.waitForTimeout(1300)
const term = await body()
console.log('\n--- 术语「阴阳」详情 ---')
console.log(term.slice(0, 400))

// 3) 易工坊：点「案例分析台 开始 →」
await go('/play')
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button,a')].find((el) => /开始 →/.test(el.innerText || ''))
  if (b) b.click()
})
await page.waitForTimeout(1300)
const ws = await body()
console.log('\n--- 易工坊案例分析台 ---')
console.log(ws.slice(0, 300))

// 4) 首页提问：「我有一个问题」输入并提交
await go('/')
await page.waitForTimeout(1500)
const q = await page.evaluate(() => {
  const ta = document.querySelector('textarea, input[type="text"]')
  if (!ta) return '无输入框'
  ta.value = '七杀是什么意思？'
  ta.dispatchEvent(new Event('input', { bubbles: true }))
  const btn = [...document.querySelectorAll('button')].find((el) => /提问|问它|问老师|搜索|看看|帮我找/.test(el.innerText || ''))
  if (!btn) return '有输入框无按钮'
  btn.click()
  return '已提交'
})
await page.waitForTimeout(1800)
const home = await body()
console.log('\n--- 首页提问 ---')
console.log('提交：' + q)
console.log(home.slice(0, 300))

console.log(`\n控制台错误 ${errors.length} 条：`)
errors.slice(0, 10).forEach((e) => console.log('  ' + e))
await browser.close()
