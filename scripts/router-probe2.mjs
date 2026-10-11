// 探针 v2：判断各路由真实渲染的页面 + 模拟「案件页卡住后跳转」场景
import { chromium } from 'playwright-core'

const EXE = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = 'http://localhost:5178/'

const browser = await chromium.launch({ executablePath: EXE, headless: true })
const page = await browser.newPage()
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

await page.goto(BASE, { timeout: 15000 })
await page.waitForTimeout(1200)

// 完成引导
await page.locator('button,a').filter({ hasText: /^🌱\s*我完全不懂玄学/ }).first().click().catch(() => {})
await page.waitForTimeout(400)
await page.locator('button,a').filter({ hasText: /^开始我的学习/ }).first().click().catch(() => {})
await page.waitForTimeout(1500)

async function probe(tag, r) {
  await page.evaluate((rr) => { window.location.hash = rr }, r)
  await page.waitForTimeout(1400)
  const info = await page.evaluate(() => {
    const t = (document.body.innerText || '').trim()
    return {
      hash: window.location.hash,
      hasHome: t.includes('道友好'),
      hasGrowth: t.includes('推理成长') || t.includes('成长档案'),
      hasMap: t.includes('学习地图') || t.includes('求学之路'),
      hasLesson: t.includes('课堂') && t.includes('第 1 段'),
      hasMemorize: t.includes('必背') && (t.includes('背') && t.includes('记忆')),
      hasHex: t.includes('卦') && t.includes('档案'),
      hasTerms: t.includes('术语'),
      hasPlay: t.includes('易工坊') || t.includes('工坊'),
      hasTools: t.includes('工具') && (t.includes('排盘') || t.includes('起卦')),
      hasExp: t.includes('实验') && t.includes('假设'),
      hasLab: t.includes('推理') && t.includes('指纹'),
      hasCases: t.includes('案件'),
      first: t.split('\n').filter((l) => l.trim()).slice(14, 22).join(' / '),
    }
  })
  console.log(`--- ${tag} (${r}) hash=${info.hash}`)
  console.log(`   home=${info.hasHome} growth=${info.hasGrowth} map=${info.hasMap} lesson=${info.hasLesson} memorize=${info.hasMemorize}`)
  console.log(`   hex=${info.hasHex} terms=${info.hasTerms} play=${info.hasPlay} tools=${info.hasTools} exp=${info.hasExp} lab=${info.hasLab} cases=${info.hasCases}`)
  console.log(`   正文14-22行: ${info.first}`)
}

// 场景一：从首页直接跳各路由
for (const r of ['/growth', '/hex', '/terms', '/play', '/tools', '/exp', '/lab', '/cases']) {
  await probe('首页直达', r)
}

// 场景二：进入案件 #001 后（模拟走查脚本卡住状态），再跳转
await page.evaluate(() => { window.location.hash = '/cases' })
await page.waitForTimeout(1200)
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button,a')].find((el) => /案件 #001/.test(el.innerText || ''))
  if (b) b.click()
})
await page.waitForTimeout(1200)
const inCase = await page.evaluate(() => (document.body.innerText || '').includes('她为什么最近特别想换工作'))
console.log(`\n进入案件 #001: ${inCase}`)
await probe('案件页后', '/growth')
await probe('案件页后', '/hex')

console.log(`\n控制台错误 ${errors.length} 条：`)
errors.slice(0, 10).forEach((e) => console.log('  ' + e))
await browser.close()
