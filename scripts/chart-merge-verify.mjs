// 验证命盘并入工具：导航 / 工具页命盘入口 / 八字排盘+易经起卦 / /chart 旧链接兼容
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
console.log('导航不含命盘:', !nav.includes('命盘'), '| 含工具:', nav.includes('工具'))

// 2) 工具页含命盘入口
await page.evaluate(() => { window.location.hash = '/tools' })
await page.waitForSelector('button.tool-tab', { timeout: 8000 })
await page.waitForTimeout(500)
const toolsText = await page.evaluate(() => document.body.innerText)
console.log('工具页含命盘:', toolsText.includes('命盘'), '| 不含排盘学习(已删):', !toolsText.includes('排盘学习'))

// 3) 切换到命盘工具
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button.tool-tab')].find((el) => el.innerText.includes('命盘'))
  if (b) b.click()
})
await page.waitForTimeout(1500)
let chartText = await page.evaluate(() => document.body.innerText)
console.log('命盘八字排盘:', chartText.includes('出生信息'), '| 有保存按钮:', chartText.includes('保存为我的信息'))
// 易经起卦
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button.tool-tab')].find((el) => el.innerText.includes('易经起卦'))
  if (b) b.click()
})
await page.waitForTimeout(800)
chartText = await page.evaluate(() => document.body.innerText)
console.log('易经起卦:', chartText.includes('时间起卦') && chartText.includes('随机三钱起卦') && chartText.includes('数字起卦'))

// 4) /chart 旧链接兼容
await page.evaluate(() => { window.location.hash = '/chart' })
await page.waitForFunction(() => document.body.innerText.includes('出生信息'), { timeout: 8000 })
const oldText = await page.evaluate(() => document.body.innerText)
console.log('旧链接/chart渲染命盘:', oldText.includes('八字排盘') && oldText.includes('出生信息'))

// 5) 工具数量（6 个 tab）
const tabCount = await page.evaluate(() => document.querySelectorAll('button.tool-tab').length)
console.log('工具 tab 数:', tabCount)
console.log('控制台错误:', errs.length ? errs.slice(0, 5) : '无')
await browser.close()
