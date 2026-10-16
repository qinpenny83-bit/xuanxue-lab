// 验证怀疑室并入推理实验：导航 / /exp 怀疑室入口 / 任务流 / /doubt 旧链接兼容
import { chromium } from 'playwright-core'
const EXE = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const browser = await chromium.launch({ executablePath: EXE, headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errs = []
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 200)) })
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message.slice(0, 200)))

await page.goto('http://localhost:5178/', { timeout: 15000 })
await page.waitForTimeout(1200)
await page.evaluate(() => localStorage.clear())
await page.reload({ timeout: 15000 })
await page.waitForTimeout(800)
await page.evaluate(() => {
  const c = [...document.querySelectorAll('button, a')].find((el) => el.innerText.includes('我完全不懂玄学'))
  if (c) c.click()
})
await page.waitForTimeout(300)
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button, a')].find((el) => el.innerText.includes('开始我的学习'))
  if (b) b.click()
})
await page.waitForTimeout(1500)

// 1) 导航检查
const nav = await page.evaluate(() => [...document.querySelectorAll('a.nav-item')].map((a) => a.innerText))
console.log('导航项:', JSON.stringify(nav))
console.log('导航不含怀疑:', !nav.includes('怀疑'), '| 含推理实验:', nav.includes('推理实验'))

// 2) /exp 首页含怀疑室入口
await page.evaluate(() => { window.location.hash = '/exp' })
await page.waitForSelector('.discern-hero', { timeout: 8000 })
await page.waitForTimeout(400)
const expText = await page.evaluate(() => document.body.innerText)
console.log('/exp含怀疑室卡片:', expText.includes('怀疑室') && expText.includes('先问凭什么'))

// 3) 点击进入怀疑室
await page.evaluate(() => {
  const el = document.querySelector('.discern-hero')
  if (el) el.click()
})
await page.waitForTimeout(1500)
const doubtText = await page.evaluate(() => document.body.innerText)
console.log('怀疑室首页:', doubtText.includes('怀疑室') || doubtText.includes('怀疑'), '| 有返回:', doubtText.includes('推理实验'))
// 数任务
const doubtCards = await page.evaluate(() => document.querySelectorAll('button').length)
console.log('怀疑室按钮数:', doubtCards)

// 4) /doubt 旧链接兼容
await page.evaluate(() => { window.location.hash = '/doubt' })
await page.waitForTimeout(1500)
const oldText = await page.evaluate(() => document.body.innerText)
console.log('旧链接/doubt渲染怀疑室:', oldText.includes('怀疑'))

// 5) /exp?task= 直接进入怀疑任务
await page.evaluate(() => { window.location.hash = '/exp?task=doubt-001' })
await page.waitForTimeout(1500)
const taskText = await page.evaluate(() => document.body.innerText)
console.log('/exp?task=渲染怀疑任务:', taskText.includes('怀疑') && (taskText.includes('证据') || taskText.includes('初始判断') || taskText.includes('材料')))
console.log('控制台错误:', errs.length ? errs.slice(0, 5) : '无')
await browser.close()
