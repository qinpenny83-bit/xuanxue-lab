// 验证词典术语合并：导航 / 术语首页入口 / dict子页 / 旧链接兼容
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
console.log('导航含词典:', nav.includes('词典'), '| 含术语:', nav.includes('术语'))

// 2) 术语首页入口
await page.evaluate(() => { window.location.hash = '/terms' })
await page.waitForTimeout(1500)
const homeText = await page.evaluate(() => document.body.innerText)
console.log('术语首页含命理入门:', homeText.includes('命理入门') && homeText.includes('八字常用词'))

// 3) dict 子页（56 词条网格）
await page.evaluate(() => { window.location.hash = '/terms/dict' })
await page.waitForTimeout(1200)
const dictText = await page.evaluate(() => document.body.innerText)
console.log('dict子页标题:', dictText.includes('命理入门'))
console.log('dict子页含五行:', dictText.includes('五行'), '| 含天干:', dictText.includes('天干'))
console.log('dict子页不含阴阳(已删):', !dictText.includes('词条「阴阳」') && !dictText.includes('☯'))
console.log('dict子页不含八卦(已删):', !dictText.includes('八类事物'))
// 数词条卡片
const cardCount = await page.evaluate(() => document.querySelectorAll('.dict-card').length)
console.log('词条卡片数:', cardCount)

// 4) 词条详情
await page.evaluate(() => { window.location.hash = '/terms/dict?term=%E4%BA%94%E8%A1%8C' })
await page.waitForTimeout(1000)
const detailText = await page.evaluate(() => document.body.innerText)
console.log('详情页五行:', detailText.includes('木火土金水'), '| 返回按钮:', detailText.includes('← 命理入门'))

// 5) 旧链接 /dict 兼容
await page.evaluate(() => { window.location.hash = '/dict' })
await page.waitForTimeout(1000)
const oldText = await page.evaluate(() => document.body.innerText)
console.log('旧链接/dict渲染命理入门:', oldText.includes('命理入门'))

// 6) 搜索跳转 dict 结果
await page.evaluate(() => { window.location.hash = '/search?q=%E5%8D%81%E7%A5%9E' })
await page.waitForTimeout(1200)
const searchText = await page.evaluate(() => document.body.innerText)
console.log('搜索十神命中:', searchText.includes('十神'))
console.log('控制台错误:', errs.length ? errs.slice(0, 5) : '无')
await browser.close()
