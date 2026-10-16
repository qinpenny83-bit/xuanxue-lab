// 验证易工坊并入卦档：导航 / 卦档入口卡片 / /hex/workshop 子页 / /play 旧链接兼容
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
// 完成引导
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
console.log('导航不含易工坊:', !nav.includes('易工坊'), '| 含卦档:', nav.includes('卦档'))

// 2) 卦档首页入口卡片
await page.evaluate(() => { window.location.hash = '/hex' })
await page.waitForSelector('.discern-hero', { timeout: 8000 })
const hexText = await page.evaluate(() => document.body.innerText)
console.log('卦档首页含易工坊卡片:', hexText.includes('实战工作台') && hexText.includes('把「看卦」变成可验证的学习行为'))

// 3) /hex/workshop 子页
await page.evaluate(() => { window.location.hash = '/hex/workshop' })
await page.waitForTimeout(2500)
const wsText = await page.evaluate(() => document.body.innerText)
console.log('工坊子页标题:', wsText.includes('易工坊'), '| 含卦象工作台:', wsText.includes('卦象工作台'), '| 含返回卦档:', wsText.includes('64卦档案'))
// 数工作台入口
const benchCount = await page.evaluate(() => document.querySelectorAll('.workshop-card').length)
console.log('工作台入口数:', benchCount)

// 4) 进入一个工作台（卦象工作台）
await page.evaluate(() => { window.location.hash = '/hex/workshop' })
await page.waitForTimeout(1000)
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((el) => el.innerText.includes('卦象工作台'))
  if (b) b.click()
})
await page.waitForTimeout(1200)
const benchText = await page.evaluate(() => document.body.innerText)
console.log('工作台进入成功:', benchText.includes('返回工坊'), '| 有训练任务:', benchText.includes('可重复训练任务'))

// 5) /play 旧链接兼容
await page.evaluate(() => { window.location.hash = '/play' })
await page.waitForTimeout(2500)
const playText = await page.evaluate(() => document.body.innerText)
console.log('旧链接/play渲染易工坊:', playText.includes('易工坊'))

// 6) 随机深挖仍在（卦档功能未被破坏）
await page.evaluate(() => { window.location.hash = '/hex' })
await page.waitForTimeout(1200)
const hexText2 = await page.evaluate(() => document.body.innerText)
console.log('卦档随机深挖保留:', hexText2.includes('随机深挖'))
console.log('控制台错误:', errs.length ? errs.slice(0, 5) : '无')
await browser.close()
