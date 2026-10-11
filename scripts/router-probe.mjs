import { chromium } from 'playwright-core'
const EXE = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const browser = await chromium.launch({ executablePath: EXE, headless: true })
const page = await browser.newPage()
page.on('console', (m) => console.log('CONSOLE[' + m.type() + ']', m.text().slice(0, 120)))
page.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 200)))
await page.goto('http://localhost:5178/', { timeout: 15000 })
await page.waitForTimeout(1500)
const h1 = await page.evaluate(() => ({ hash: location.hash, title: document.title, head: document.body.innerText.slice(0, 200) }))
console.log('AFTER LOAD:', JSON.stringify(h1))
// 绕过引导页：直接点击「开始我的学习」
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button, a')].find((el) => el.innerText.trim().startsWith('开始我的学习'))
  if (b) b.click()
})
await page.waitForTimeout(1000)
const h2 = await page.evaluate(() => ({ hash: location.hash, head: document.body.innerText.slice(0, 300) }))
console.log('AFTER ONBOARDING:', JSON.stringify(h2))
// 尝试 hash 跳转
await page.evaluate(() => { window.location.hash = '/lesson' })
await page.waitForTimeout(1500)
const h3 = await page.evaluate(() => ({ hash: location.hash, head: document.body.innerText.slice(0, 300) }))
console.log('AFTER HASH=#/lesson:', JSON.stringify(h3))
// 再试一次
await page.evaluate(() => { window.location.hash = '/map' })
await page.waitForTimeout(1500)
const h4 = await page.evaluate(() => ({ hash: location.hash, head: document.body.innerText.slice(0, 200) }))
console.log('AFTER HASH=#/map:', JSON.stringify(h4))
await browser.close()
