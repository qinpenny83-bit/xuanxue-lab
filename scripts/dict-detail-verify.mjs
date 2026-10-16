// 详细验证：每步输出页面开头内容
import { chromium } from 'playwright-core'
const EXE = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const browser = await chromium.launch({ executablePath: EXE, headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errs = []
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 200)) })
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message.slice(0, 200)))

async function show(label, wait = 1500) {
  await page.waitForTimeout(wait)
  const t = await page.evaluate(() => document.body.innerText.slice(0, 300).replace(/\n+/g, ' | '))
  console.log(`[${label}]`, t.slice(0, 300))
}

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

await page.evaluate(() => { window.location.hash = '/terms' })
await show('术语首页')
await page.evaluate(() => { window.location.hash = '/terms/dict' })
await show('dict子页', 2000)
const cardCount = await page.evaluate(() => document.querySelectorAll('.dict-card').length)
console.log('词条卡片数:', cardCount)
const hasYinYang = await page.evaluate(() => document.body.innerText.includes('☯'))
console.log('页面含阴阳☯:', hasYinYang)
// 点一个词条进详情，验证返回按钮
const clicked = await page.evaluate(() => {
  const card = [...document.querySelectorAll('.dict-card')].find((c) => c.innerText.includes('五行'))
  if (card) { card.click(); return true }
  return false
})
await show('词条详情', 1500)
const backBtn = await page.evaluate(() => document.body.innerText.includes('← 命理入门'))
console.log('详情含返回按钮←命理入门:', backBtn)
await browser.close()
