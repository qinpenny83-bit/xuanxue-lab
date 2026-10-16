// 零基础小白全流程走查脚本（无头 Chrome + playwright-core）
// 用法：node scripts/beginner-walkthrough.mjs [输出文件]
// 输出：每个里程碑的页面可见文字 + 控制台错误
import { chromium } from 'playwright-core'
import fs from 'node:fs'

const EXE = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = 'http://localhost:5178/'
const OUT = process.argv[2] || 'scripts/beginner-log.txt'

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

async function clickByText(text, { nth = 0, tag = null } = {}) {
  const sel = tag ? tag : 'a,button'
  const found = await page.evaluate(([sel, text]) => {
    const els = [...document.querySelectorAll(sel)]
      .filter((el) => el.innerText && el.innerText.trim().startsWith(text) && el.offsetParent !== null)
    return els.length ? els[Math.min(0, els.length - 1)].innerText.trim().slice(0, 40) : null
  }, [sel, text])
  if (!found) return false
  const loc = tag ? tag : 'a,button'
  const handles = page.locator(loc).filter({ hasText: new RegExp(`^\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) })
  const n = await handles.count()
  if (n === 0) return false
  await handles.nth(Math.min(nth, n - 1)).click({ timeout: 4000 }).catch(() => {})
  return true
}

async function snapshot(title) {
  const text = await page.evaluate(() => document.body.innerText)
  snap(title, text)
}

async function go(route) {
  await page.evaluate((r) => { window.location.hash = r }, route)
  await page.waitForTimeout(900)
}

try {
  await page.goto(BASE, { timeout: 15000 })
  await page.waitForTimeout(1000)
  // 全新小白视角：清空本地进度再走查
  await page.evaluate(() => localStorage.clear())
  await page.reload({ timeout: 15000 })
  await page.waitForTimeout(1200)
  await snapshot('① 首屏（引导页）')

  // 引导页：选一个目标卡片，再点「开始我的学习」
  const goalClicked = await clickByText('🌱 我完全不懂玄学')
  await page.waitForTimeout(500)
  const startClicked = await clickByText('开始我的学习')
  log(`引导页：目标卡片=${goalClicked} 开始按钮=${startClicked}`)
  await page.waitForTimeout(1500)
  await snapshot('② 首页（AI 主动工作台）')

  // 进入第一课：等首页分析完成、「开始今天的学习」按钮出现后再点（否则点击落空）
  let btnFound = false
  for (let i = 0; i < 15 && !btnFound; i++) {
    btnFound = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button, a')].find((el) => /开始今天的学习/.test(el.innerText || ''))
      if (btn) { btn.click(); return true }
      return false
    })
    if (!btnFound) await page.waitForTimeout(1000)
  }
  log(`进入第一课：按钮出现并点击=${btnFound}（等待${btnFound ? '' : '超时'}）`)
  // 等待课程渲染完成（懒加载可能出现「加载中…」）
  for (let i = 0; i < 8; i++) {
    const t = await page.evaluate(() => document.body.innerText)
    if (!t.includes('加载中') && !t.includes('分析中')) break
    await page.waitForTimeout(1000)
  }
  await page.waitForTimeout(1200)
  await snapshot('③ 第一课开头')

  // 地图
  await go('/map')
  await snapshot('④ 学习地图')

  // 走步骤：最多 40 步，直到出现「本关完成」或无法前进
  let prevHash = ''
  for (let i = 0; i < 40; i++) {
    // 若页面在「加载中/分析中」，先等它渲染完再判断，避免误判「无按钮」
    for (let w = 0; w < 8; w++) {
      const t = await page.evaluate(() => document.body.innerText)
      if (!t.includes('加载中') && !t.includes('分析中')) break
      await page.waitForTimeout(1000)
    }
    const stepText = await page.evaluate(() => document.body.innerText)
    if (stepText.includes('本关完成')) { snap('⑦ 第一课完成页', stepText); break }
    if (stepText.includes('已完成「')) { snap('⑦ 已完成状态页', stepText); break }

    // 记录当前步骤可见内容（精简）
    if (i % 5 === 0 || i < 3) snap(`⑥-${i} 步骤`, stepText)

    // 作答：优先推进按钮；若是 selfreflect 先填文本框
    const clicked = await page.evaluate(() => {
      const ta = document.querySelector('textarea')
      if (ta && !ta.disabled && !ta.value.trim()) {
        ta.value = '我暂时先猜：可能是和阴阳的状态有关。'
        ta.dispatchEvent(new Event('input', { bubbles: true }))
        return '已填写文本框'
      }
      const btns = [...document.querySelectorAll('button, a')].filter((el) => el.offsetParent !== null)
      const candidates = btns.filter((b) => {
        const t = (b.innerText || '').trim()
        if (!t || t.length < 2) return false
        if (/^(首页|地图|求学|必背|课堂|卦档|术语|案例|易工坊|实验|工具|推理实验|怀疑|命盘|成长|词典|←\s*课堂)$/.test(t)) return false
        return true
      })
      // 推进按钮（继续/完成/保存/检查/来吧/先猜猜看/确定/确认）——优先点推进，
      // 因为「预测题/选择题」点选项后不会自动翻页，要靠「继续 →」推进
      const adv = candidates.find((b) =>
        !b.disabled && /继续|完成|保存|检查|来吧|先猜猜看|确定|确认/.test(b.innerText)
      )
      // 选择/连线/拖动题的选项（class 含 option/connect/drag 或字母开头）
      const opt = candidates.find((b) =>
        !b.disabled && (b.classList.contains('option') || b.classList.contains('connect-a') || b.classList.contains('connect-opt') || /^[A-D][\s\u3000]/.test(b.innerText.trim()))
      )
      const target = adv || opt || candidates.find((b) => !b.disabled) || candidates[candidates.length - 1]
      if (!target) return null
      target.click()
      return target.innerText.trim().slice(0, 40)
    })
    if (!clicked) { log(`步骤 ${i}：无可用按钮，停止`); break }
    await page.waitForTimeout(700)
    const after = await page.evaluate(() => document.body.innerText)
    const hash = await page.evaluate(() => window.location.hash)
    if (after === stepText && hash === prevHash) { log(`步骤 ${i}：点了「${clicked}」但页面无变化`); }
    prevHash = hash
    if (after.includes('本关完成') || after.includes('已完成「')) { snap('⑦ 完成页', after); break }
  }

  // 成长页
  await go('/growth')
  await snapshot('⑧ 成长页')

  // 案例
  await go('/cases')
  await snapshot('⑨ 案例馆')
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button, a')].find((el) => /案件|案例/.test(el.innerText || ''))
    if (b) b.click()
  })
  await page.waitForTimeout(1000)
  await snapshot('⑩ 案例详情/简报')

  // 必背
  await go('/memorize')
  await snapshot('⑪ 必背')

  // 卦档
  await go('/hex')
  await snapshot('⑫ 卦档')

  // 术语
  await go('/terms')
  await snapshot('⑬ 术语')

  // 易工坊
  await go('/play')
  await snapshot('⑭ 易工坊')

  // 工具 / 实验 / 推理实验
  await go('/tools')
  await snapshot('⑮ 工具')
  await go('/experiment')
  await snapshot('⑯ 实验')
  await go('/lab')
  await snapshot('⑰ 推理实验')

  log(`\n控制台错误 ${consoleErrors.length} 条：`)
  consoleErrors.slice(0, 15).forEach((e) => log('  ' + e))
} catch (e) {
  log('FATAL: ' + e.message)
} finally {
  fs.writeFileSync(OUT, lines.join('\n'), 'utf8')
  await browser.close()
  log(`\n日志已写入 ${OUT}`)
}
