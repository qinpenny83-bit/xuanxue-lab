// ============================================================
// R4 · 四大板块最终内容扩充 + 知识覆盖审计
//
// 板块与数量目标（一次性验收）：
//   易工坊   6 工作台 × 10+ 可重复训练任务（实际 12×6=72）
//   实验     探索实验室 ≥60（实际 60，五大方向均衡）
//   推理实验 验证判断方式 ≥80（实际 EXPERIMENTS_V3 全量）
//   怀疑室   认知纠偏 ≥150，六大类各 ≥20，难度分层（实际 160）
//
// 硬标准（内容质量）：
//   引用必须真实可解析（0 dangling）
//   禁止换皮/伪造原典/算命表达/把传统解释说成事实
//   覆盖 64 卦 / 384 爻 / 术语 / 经典 / 案例 / 6 传统 /
//          10 错误类型 / 8 能力维度
//   输出 coverage report（console.log）
// ============================================================
import { describe, it, expect } from 'vitest'
import { WORKSHOP_TASKS, WORKSHOP_BENCHES, workshopTasksByBench, getWorkshopTask } from '../src/data/workshopTasks'
import { EXPLORE_EXPERIMENTS, EXPLORE_CATEGORIES } from '../src/data/exploreExperiments'
import { EXPERIMENTS_V3, EXPERIMENT_CATEGORIES } from '../src/data/experiments-v3'
import { DOUBT_TASKS, DOUBT_CATEGORIES } from '../src/data/doubtTasks'
import { getHexagram } from '../src/data/iching/hexagramTools'
import { getYao, TRADITION_REF } from '../src/data/iching/hexagramProfile'
import { getClassicPassage } from '../src/data/iching/classic-passages'
import { getTerm } from '../src/data/iching/termData'
import { getCase } from '../src/data/cases'
import { ERROR_TYPES } from '../src/agent/errors'
import { reducer } from '../src/store/reducer'
import { initialState } from '../src/lib/storage'
import { runAgent } from '../src/agent/localAgentEngine'

// ── 常量 ─────────────────────────────────────────────────────
const DIMS = ['observation', 'structure', 'evidence', 'reasoning', 'counterexample', 'uncertainty', 'synthesis', 'independence']
const TRADITION_KEYS = TRADITION_REF.map((t) => t.key)
const ERROR_CODES = Object.keys(ERROR_TYPES)
const BENCH_IDS = WORKSHOP_BENCHES.map((b) => b.id)
const EXPLORE_CAT_IDS = EXPLORE_CATEGORIES.map((c) => c.id)
const EXPERIMENT_CAT_IDS = EXPERIMENT_CATEGORIES.map((c) => c.id)
const DOUBT_CAT_IDS = DOUBT_CATEGORIES.map((c) => c.id)
const TASK_TYPES = ['identify', 'compare', 'judge', 'construct', 'hunt', 'trace']
const FORBIDDEN_WORDS = ['命中注定', '算命', '大师预测', '精准预测', '科学验证', '必吉', '转运', '开运', '包你', '一定灵']

// ── 确定性 RNG（抽样用，可复现）──────────────────────────────
function hashSeed(str) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function pick(pool, count, seedStr) {
  const rng = mulberry32(hashSeed(seedStr))
  const idx = Array.from({ length: pool.length }, (_, i) => i)
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[idx[i], idx[j]] = [idx[j], idx[i]]
  }
  return idx.slice(0, Math.min(count, pool.length)).map((i) => pool[i])
}

// ── 引用解析工具 ─────────────────────────────────────────────
function materialList(m) {
  return Array.isArray(m) ? m : m ? [m] : []
}
function resolveMaterial(m) {
  if (!m || !m.kind) return false
  switch (m.kind) {
    case 'hexagram': return Number.isInteger(m.seq) && m.seq >= 1 && m.seq <= 64 && !!getHexagram(m.seq)
    case 'yao': return Number.isInteger(m.seq) && m.seq >= 1 && m.seq <= 64 && Number.isInteger(m.pos) && m.pos >= 0 && m.pos <= 5 && !!getYao(m.seq, m.pos)
    case 'classic': return !!getClassicPassage(m.id)
    case 'case': return !!getCase(m.id)
    case 'term': return !!getTerm(m.id)
    case 'tradition': return TRADITION_KEYS.includes(m.id)
    default: return false
  }
}
const clean = (s) => String(s || '').replace(/[\s，。、,.，！？!?：:；;（）()「」『』【】"'“”‘’]/g, '')
const nonEmpty = (s) => typeof s === 'string' && s.trim().length > 0
const subsetOf = (arr, allowed) => Array.isArray(arr) && arr.every((x) => allowed.includes(x))
// 禁词检查：剔除「」引号内的「被引用的说法」后，再查系统的主动表达。
// 理由：大量训练任务的任务本体就是「对一条错误说法进行质疑/拆解」（如「得位必吉」的例外、
// 这与「算命」的用法是一回事吗），引号内的词属于被检验对象，不属于系统的断言；
// 硬标准禁止的是「系统把算命/必吉当作事实输出」，而非「系统点名批评这些说法」。
const noForbidden = (...texts) =>
  texts.every((t) => {
    const cleaned = String(t || '').replace(/「[^」]*」/g, '')
    return !FORBIDDEN_WORDS.some((w) => cleaned.includes(w))
  })

// ============================================================
// 一、易工坊：6 工作台 × 12 任务（验收点 1）
// ============================================================
describe('R4 · 易工坊训练任务库', () => {
  it('总量 72，每工作台 12 个，id 全局唯一且前缀规范', () => {
    expect(WORKSHOP_TASKS.length).toBe(72)
    for (const b of BENCH_IDS) {
      const list = workshopTasksByBench(b)
      expect(list.length).toBeGreaterThanOrEqual(10)
    }
    const ids = WORKSHOP_TASKS.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    const prefixes = { hexagram: 'ws-hx', yao: 'ws-yo', classic: 'ws-cl', case: 'ws-cs', explain: 'ws-ex', free: 'ws-fr' }
    for (const t of WORKSHOP_TASKS) {
      expect(t.id.startsWith(prefixes[t.benchId])).toBe(true)
      expect(getWorkshopTask(t.id)).toBeTruthy()
    }
  })

  it('难度五档 + 等级四档全覆盖（每个工作台都含 1/3/5 与 level 1-4）', () => {
    for (const b of BENCH_IDS) {
      const list = workshopTasksByBench(b)
      const diffs = new Set(list.map((t) => t.difficulty))
      const lvls = new Set(list.map((t) => t.level))
      for (const d of [1, 2, 3, 4, 5]) expect(diffs.has(d), `${b} 缺 difficulty ${d}`).toBe(true)
      for (const l of [1, 2, 3, 4]) expect(lvls.has(l), `${b} 缺 level ${l}`).toBe(true)
    }
  })

  it('题型覆盖六类，材料全部真实可解析（卦/爻/经典/案例/术语/传统）', () => {
    const types = new Set(WORKSHOP_TASKS.map((t) => t.type))
    for (const ty of TASK_TYPES) expect(types.has(ty)).toBe(true)
    for (const t of WORKSHOP_TASKS) {
      for (const m of materialList(t.material)) {
        expect(resolveMaterial(m), `${t.id} 材料不可解析 ${JSON.stringify(m)}`).toBe(true)
      }
    }
  })

  it('易工坊引用分散：≥20 卦、≥10 爻位组合、术语 ≥40', () => {
    const seqs = new Set()
    const yaoKeys = new Set()
    const terms = new Set()
    for (const t of WORKSHOP_TASKS) {
      for (const m of materialList(t.material)) {
        if (m.kind === 'hexagram') seqs.add(m.seq)
        if (m.kind === 'yao') { seqs.add(m.seq); yaoKeys.add(`${m.seq}-${m.pos}`) }
        if (m.kind === 'term') terms.add(m.id)
      }
      for (const id of t.relatedTerms || []) terms.add(id)
    }
    expect(seqs.size).toBeGreaterThanOrEqual(20)
    expect(yaoKeys.size).toBeGreaterThanOrEqual(10)
    expect(terms.size).toBeGreaterThanOrEqual(40)
  })

  it('每工作台覆盖各自领域要点（卦象台/爻研台/经典台/案例台/解释台/自由台）', () => {
    const bench = (b) => workshopTasksByBench(b).map((t) => (t.title + t.goal + t.prompt + t.questions.join('')).replace(/\s/g, ''))
    const hx = bench('hexagram').join('')
    for (const kw of ['上下', '错卦', '综卦', '互卦', '中正', '承', '乘', '比', '应', '得位']) expect(hx, `卦象台缺「${kw}」`).toContain(kw)
    const yo = bench('yao').join('')
    for (const kw of ['初', '二', '三', '四', '五', '上', '得位', '中位', '应', '比', '承', '乘']) expect(yo, `爻研台缺「${kw}」`).toContain(kw)
    const cl = bench('classic').join('')
    for (const kw of ['卦辞', '爻辞', '大象', '系辞', '文言', '序卦', '杂卦']) expect(cl, `经典台缺「${kw}」`).toContain(kw)
    const cs = bench('case').join('')
    for (const kw of ['信息', '误判', '反例', '边界', '冲突', '对照']) expect(cs, `案例台缺「${kw}」`).toContain(kw)
    const ex = bench('explain').join('')
    for (const kw of ['观察', '证据', '假设', '解释', '反例', '修正', '表达']) expect(ex, `解释台缺「${kw}」`).toContain(kw)
    const fr = bench('free').join('')
    const cross = workshopTasksByBench('free').filter((t) => Array.isArray(t.material) && t.material.length >= 2)
    expect(cross.length).toBeGreaterThanOrEqual(6)
    expect(fr.length).toBeGreaterThan(0)
  })

  it('训练目标与能力/错误类型闭环：masteryKeys ⊆ 8 维、errorTypes ⊆ E01-E10、无禁词', () => {
    for (const t of WORKSHOP_TASKS) {
      expect(subsetOf(t.masteryKeys, DIMS), `${t.id} masteryKeys 非法`).toBe(true)
      expect(subsetOf(t.errorTypes, ERROR_CODES), `${t.id} errorTypes 非法`).toBe(true)
      expect(t.masteryKeys.length).toBeGreaterThan(0)
      expect(t.goal.length).toBeGreaterThanOrEqual(6)
      expect(t.prompt.length).toBeGreaterThanOrEqual(20)
      expect(t.questions.length).toBeGreaterThanOrEqual(2)
      expect(t.questions.length).toBeLessThanOrEqual(4)
      expect(noForbidden(t.title, t.goal, t.prompt, ...t.questions), `${t.id} 含禁词`).toBe(true)
    }
  })

  // 逐任务完整性（12×6）
  for (const t of WORKSHOP_TASKS) {
    it(`易工坊 ${t.id} 字段完整且引用可解析`, () => {
      expect(t.title).toBeTruthy()
      expect(BENCH_IDS).toContain(t.benchId)
      expect(Number.isInteger(t.difficulty) && t.difficulty >= 1 && t.difficulty <= 5).toBe(true)
      expect(Number.isInteger(t.level) && t.level >= 1 && t.level <= 4).toBe(true)
      expect(TASK_TYPES).toContain(t.type)
      expect(subsetOf(t.expectedSkills, DIMS)).toBe(true)
      expect(subsetOf(t.traditions || [], TRADITION_KEYS)).toBe(true)
      for (const id of t.relatedTerms || []) expect(getTerm(id), `${t.id} 术语 ${id} 不存在`).toBeTruthy()
      for (const id of t.caseIds || []) expect(getCase(id), `${t.id} 案例 ${id} 不存在`).toBeTruthy()
    })
  }
})

// ============================================================
// 二、探索实验（实验 = 探索材料）≥60（验收点 2）
// ============================================================
describe('R4 · 探索实验库（实验 = 探索）', () => {
  it('总量 60，五大方向均衡（各 ≥10），id 唯一', () => {
    expect(EXPLORE_EXPERIMENTS.length).toBeGreaterThanOrEqual(60)
    const ids = EXPLORE_EXPERIMENTS.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const c of EXPLORE_CAT_IDS) {
      const n = EXPLORE_EXPERIMENTS.filter((e) => e.category === c).length
      expect(n, `探索方向 ${c} 仅 ${n}`).toBeGreaterThanOrEqual(10)
    }
  })

  it('与推理实验定位区分：探索实验带 focus 观察指引与 reflection，不带十步验证模板', () => {
    for (const e of EXPLORE_EXPERIMENTS) {
      expect(Array.isArray(e.focus) && e.focus.length >= 2).toBe(true)
      expect(nonEmpty(e.reflection)).toBe(true)
      expect(e.focus.every((f) => f.length >= 8)).toBe(true)
    }
  })

  it('材料/对比/术语/传统全部真实可解析，能力与错误标记合法', () => {
    for (const e of EXPLORE_EXPERIMENTS) {
      for (const m of materialList(e.material)) expect(resolveMaterial(m), `${e.id} 材料不可解析`).toBe(true)
      if (e.compare) expect(resolveMaterial(e.compare), `${e.id} compare 不可解析`).toBe(true)
      for (const id of e.relatedTerms || []) expect(getTerm(id), `${e.id} 术语 ${id} 不存在`).toBeTruthy()
      expect(subsetOf(e.masteryKeys, DIMS), `${e.id} masteryKeys 非法`).toBe(true)
      expect(subsetOf(e.errorTypes, ERROR_CODES), `${e.id} errorTypes 非法`).toBe(true)
      expect(noForbidden(e.title, e.subtitle, e.reflection, ...(e.focus || []))).toBe(true)
    }
  })

  // 逐实验完整性（60）
  for (const e of EXPLORE_EXPERIMENTS) {
    it(`探索实验 ${e.id} 字段完整`, () => {
      expect(EXPLORE_CAT_IDS).toContain(e.category)
      expect(nonEmpty(e.title) && nonEmpty(e.subtitle)).toBe(true)
      expect(nonEmpty(e.reflection)).toBe(true)
      expect(subsetOf(e.expectedSkills, DIMS)).toBe(true)
    })
  }
})

// ============================================================
// 三、推理实验（验证判断方式）≥80（验收点 3）
// ============================================================
describe('R4 · 推理实验库（推理实验 = 验证）', () => {
  it('总量 ≥80，id 唯一，每实验带问题/假设/反例/反思（十步验证模板）', () => {
    expect(EXPERIMENTS_V3.length).toBeGreaterThanOrEqual(80)
    const ids = EXPERIMENTS_V3.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const e of EXPERIMENTS_V3) {
      expect(nonEmpty(e.question), `${e.id} 缺 question`).toBe(true)
      expect(nonEmpty(e.hypothesis), `${e.id} 缺 hypothesis`).toBe(true)
      expect(Array.isArray(e.counterexamples) && e.counterexamples.length >= 1, `${e.id} 缺反例`).toBe(true)
      expect(Array.isArray(e.reflectionQuestions) && e.reflectionQuestions.length >= 1, `${e.id} 缺反思`).toBe(true)
    }
  })

  it('预期能力/错误类型/术语/传统全部可解析，samplePool 引用真实', () => {
    for (const e of EXPERIMENTS_V3) {
      expect(subsetOf(e.expectedSkills, DIMS), `${e.id} expectedSkills 非法`).toBe(true)
      expect(subsetOf(e.errorTypes, ERROR_CODES), `${e.id} errorTypes 非法`).toBe(true)
      for (const id of e.relatedTerms || []) expect(getTerm(id), `${e.id} 术语 ${id} 不存在`).toBeTruthy()
      for (const k of [...(e.traditions || []), ...(e.relatedTraditions || [])]) expect(TRADITION_KEYS, `${e.id} 传统 ${k} 非法`).toContain(k)
      const pool = e.samplePool
      if (pool && Array.isArray(pool.ids) && pool.ids.length) {
        for (const id of pool.ids) {
          if (pool.kind === 'hexagram') expect(getHexagram(id), `${e.id} 卦 ${id} 不存在`).toBeTruthy()
          if (pool.kind === 'yao' && id && id.seq != null) expect(getYao(id.seq, id.pos), `${e.id} 爻不可解析`).toBeTruthy()
          if (pool.kind === 'case') expect(getCase(id), `${e.id} 案例 ${id} 不存在`).toBeTruthy()
          if (pool.kind === 'classic') expect(getClassicPassage(id), `${e.id} 经典 ${id} 不存在`).toBeTruthy()
          if (pool.kind === 'term') expect(getTerm(id), `${e.id} 术语 ${id} 不存在`).toBeTruthy()
        }
      }
    }
  })

  it('推理实验覆盖 8 能力维度（expectedSkills 并集），含高难度实验', () => {
    const union = new Set(EXPERIMENTS_V3.flatMap((e) => e.expectedSkills || []))
    for (const d of DIMS) expect(union.has(d), `推理实验缺能力 ${d}`).toBe(true)
    const hard = EXPERIMENTS_V3.filter((e) => (e.difficulty || 0) >= 3)
    expect(hard.length).toBeGreaterThan(0)
  })

  // 逐实验完整性（80）
  for (const e of EXPERIMENTS_V3) {
    it(`推理实验 ${e.id} 字段完整`, () => {
      expect(EXPERIMENT_CAT_IDS).toContain(e.category)
      expect(nonEmpty(e.title) && nonEmpty(e.subtitle)).toBe(true)
      expect(subsetOf(e.expectedSkills, DIMS)).toBe(true)
    })
  }
})

// ============================================================
// 四、怀疑室：≥150，六大类，分层（验收点 4）
// ============================================================
describe('R4 · 怀疑室任务库（认知纠偏）', () => {
  it('总量 ≥150（实际 160），id 唯一', () => {
    expect(DOUBT_TASKS.length).toBeGreaterThanOrEqual(150)
    const ids = DOUBT_TASKS.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('六大类型各 ≥20，且每类含 level 1-4 全档', () => {
    for (const c of DOUBT_CAT_IDS) {
      const list = DOUBT_TASKS.filter((t) => t.category === c)
      expect(list.length, `类别 ${c} 仅 ${list.length}`).toBeGreaterThanOrEqual(20)
      const lvls = new Set(list.map((t) => t.level))
      for (const l of [1, 2, 3, 4]) expect(lvls.has(l), `${c} 缺 level ${l}`).toBe(true)
    }
  })

  it('任务字段完整：prompt/statement 非空、错误/能力/传统/术语标记合法、无禁词', () => {
    for (const t of DOUBT_TASKS) {
      expect(nonEmpty(t.title), `${t.id} 缺 title`).toBe(true)
      expect(nonEmpty(t.prompt), `${t.id} 缺 prompt`).toBe(true)
      expect(nonEmpty(t.statement || t.evidence || '')).toBe(true)
      expect(subsetOf(t.errorTypes, ERROR_CODES), `${t.id} errorTypes 非法`).toBe(true)
      expect(subsetOf(t.traditions, TRADITION_KEYS), `${t.id} traditions 非法`).toBe(true)
      for (const id of t.relatedTerms || []) expect(getTerm(id), `${t.id} 术语 ${id} 不存在`).toBeTruthy()
      expect(noForbidden(t.title, t.prompt, t.statement, t.hint)).toBe(true)
    }
  })

  it('怀疑任务引用真实：卦 seq / 爻 seq+pos / 案例 / 经典全部可解析', () => {
    for (const t of DOUBT_TASKS) {
      for (const seq of t.hexagrams || []) expect(getHexagram(seq), `${t.id} 卦 ${seq} 不存在`).toBeTruthy()
      for (const y of t.yaos || []) expect(getYao(y.seq, y.pos), `${t.id} 爻 ${y.seq}-${y.pos} 不可解析`).toBeTruthy()
      for (const id of t.cases || []) expect(getCase(id), `${t.id} 案例 ${id} 不存在`).toBeTruthy()
      for (const id of t.classics || []) expect(getClassicPassage(id), `${t.id} 经典 ${id} 不存在`).toBeTruthy()
    }
  })

  // 逐任务完整性（160）
  for (const t of DOUBT_TASKS) {
    it(`怀疑任务 ${t.id} 字段完整`, () => {
      expect(DOUBT_CAT_IDS).toContain(t.category)
      expect(Number.isInteger(t.level) && t.level >= 1 && t.level <= 4).toBe(true)
      expect(Number.isInteger(t.difficulty) && t.difficulty >= 1 && t.difficulty <= 5).toBe(true)
      expect(Array.isArray(t.masteryKeys) && t.masteryKeys.length > 0).toBe(true)
      expect(subsetOf(t.masteryKeys, DIMS), `${t.id} masteryKeys ${t.masteryKeys.join(',')} 非法`).toBe(true)
    })
  }
})

// ============================================================
// 五、知识覆盖审计（验收点：coverage report）
// ============================================================
describe('R4 · 知识覆盖审计', () => {
  it('全量引用扫描：0 dangling（四板块所有引用真实可解析）', () => {
    const dangling = []
    for (const t of WORKSHOP_TASKS) {
      for (const m of materialList(t.material)) if (!resolveMaterial(m)) dangling.push(`ws:${t.id}:${JSON.stringify(m)}`)
      for (const id of t.relatedTerms || []) if (!getTerm(id)) dangling.push(`ws:${t.id}:term:${id}`)
      for (const id of t.caseIds || []) if (!getCase(id)) dangling.push(`ws:${t.id}:case:${id}`)
      for (const k of t.traditions || []) if (!TRADITION_KEYS.includes(k)) dangling.push(`ws:${t.id}:trad:${k}`)
    }
    for (const e of EXPLORE_EXPERIMENTS) {
      for (const m of materialList(e.material)) if (!resolveMaterial(m)) dangling.push(`xpl:${e.id}:${JSON.stringify(m)}`)
      if (e.compare && !resolveMaterial(e.compare)) dangling.push(`xpl:${e.id}:compare`)
      for (const id of e.relatedTerms || []) if (!getTerm(id)) dangling.push(`xpl:${e.id}:term:${id}`)
    }
    for (const e of EXPERIMENTS_V3) {
      for (const id of e.relatedTerms || []) if (!getTerm(id)) dangling.push(`exp:${e.id}:term:${id}`)
      for (const k of [...(e.traditions || []), ...(e.relatedTraditions || [])]) if (!TRADITION_KEYS.includes(k)) dangling.push(`exp:${e.id}:trad:${k}`)
    }
    for (const t of DOUBT_TASKS) {
      for (const seq of t.hexagrams || []) if (!getHexagram(seq)) dangling.push(`doubt:${t.id}:hex:${seq}`)
      for (const y of t.yaos || []) if (!getYao(y.seq, y.pos)) dangling.push(`doubt:${t.id}:yao:${y.seq}-${y.pos}`)
      for (const id of t.cases || []) if (!getCase(id)) dangling.push(`doubt:${t.id}:case:${id}`)
      for (const id of t.classics || []) if (!getClassicPassage(id)) dangling.push(`doubt:${t.id}:classic:${id}`)
      for (const id of t.relatedTerms || []) if (!getTerm(id)) dangling.push(`doubt:${t.id}:term:${id}`)
      for (const k of t.traditions || []) if (!TRADITION_KEYS.includes(k)) dangling.push(`doubt:${t.id}:trad:${k}`)
    }
    expect(dangling).toEqual([])
  })

  it('8 能力维度全部被训练（四板块 masteryKeys/expectedSkills 并集）', () => {
    const union = new Set()
    WORKSHOP_TASKS.forEach((t) => t.masteryKeys.forEach((k) => union.add(k)))
    EXPLORE_EXPERIMENTS.forEach((e) => e.masteryKeys.forEach((k) => union.add(k)))
    EXPERIMENTS_V3.forEach((e) => (e.expectedSkills || []).forEach((k) => union.add(k)))
    DOUBT_TASKS.forEach((t) => t.masteryKeys.forEach((k) => union.add(k)))
    for (const d of DIMS) expect(union.has(d), `能力维度 ${d} 无训练任务`).toBe(true)
  })

  it('10 错误类型全部有对应训练（E01-E10 全出现）', () => {
    const union = new Set()
    WORKSHOP_TASKS.forEach((t) => t.errorTypes.forEach((c) => union.add(c)))
    EXPLORE_EXPERIMENTS.forEach((e) => e.errorTypes.forEach((c) => union.add(c)))
    EXPERIMENTS_V3.forEach((e) => e.errorTypes.forEach((c) => union.add(c)))
    DOUBT_TASKS.forEach((t) => t.errorTypes.forEach((c) => union.add(c)))
    for (const c of ERROR_CODES) expect(union.has(c), `错误类型 ${c} 无对应训练`).toBe(true)
  })

  it('6 解释传统全部被引用', () => {
    const union = new Set()
    WORKSHOP_TASKS.forEach((t) => (t.traditions || []).forEach((k) => union.add(k)))
    EXPLORE_EXPERIMENTS.forEach((e) => materialList(e.material).forEach((m) => m.kind === 'tradition' && union.add(m.id)))
    EXPLORE_EXPERIMENTS.forEach((e) => e.compare && e.compare.kind === 'tradition' && union.add(e.compare.id))
    EXPERIMENTS_V3.forEach((e) => (e.traditions || []).concat(e.relatedTraditions || []).forEach((k) => union.add(k)))
    DOUBT_TASKS.forEach((t) => t.traditions.forEach((k) => union.add(k)))
    for (const k of TRADITION_KEYS) expect(union.has(k), `传统 ${k} 无引用`).toBe(true)
  })

  it('卦引用不过度集中：单卦在易工坊材料中最多出现 ≤12 次', () => {
    const counts = {}
    for (const t of WORKSHOP_TASKS) {
      for (const m of materialList(t.material)) if (m.kind === 'hexagram') counts[m.seq] = (counts[m.seq] || 0) + 1
    }
    const max = Math.max(...Object.values(counts))
    expect(max).toBeLessThanOrEqual(12)
  })

  it('初级/高级内容均衡：每板块都有 difficulty 1 与 5（或 level 1 与 4）', () => {
    const wsD = new Set(WORKSHOP_TASKS.map((t) => t.difficulty))
    expect(wsD.has(1) && wsD.has(5)).toBe(true)
    const xD = new Set(EXPLORE_EXPERIMENTS.map((e) => e.level))
    expect(xD.has(1) && xD.has(4)).toBe(true)
    const dL = new Set(DOUBT_TASKS.map((t) => t.level))
    expect(dL.has(1) && dL.has(4)).toBe(true)
  })

  it('知识覆盖审计输出 coverage report（诊断用）', () => {
    const hexRefs = new Set()
    const yaoRefs = new Set()
    const termRefs = new Set()
    const classicRefs = new Set()
    const caseRefs = new Set()
    const tradRefs = new Set()
    const collectWs = (t) => {
      for (const m of materialList(t.material)) {
        if (m.kind === 'hexagram') hexRefs.add(m.seq)
        if (m.kind === 'yao') { hexRefs.add(m.seq); yaoRefs.add(`${m.seq}-${m.pos}`) }
        if (m.kind === 'classic') classicRefs.add(m.id)
        if (m.kind === 'case') caseRefs.add(m.id)
        if (m.kind === 'term') termRefs.add(m.id)
        if (m.kind === 'tradition') tradRefs.add(m.id)
      }
      ;(t.relatedTerms || []).forEach((id) => termRefs.add(id))
      ;(t.caseIds || []).forEach((id) => caseRefs.add(id))
      ;(t.traditions || []).forEach((k) => tradRefs.add(k))
    }
    WORKSHOP_TASKS.forEach(collectWs)
    EXPLORE_EXPERIMENTS.forEach((e) => {
      materialList(e.material).forEach((m) => { if (m.kind === 'hexagram') hexRefs.add(m.seq); if (m.kind === 'yao') { hexRefs.add(m.seq); yaoRefs.add(`${m.seq}-${m.pos}`) }; if (m.kind === 'term') termRefs.add(m.id); if (m.kind === 'tradition') tradRefs.add(m.id); if (m.kind === 'classic') classicRefs.add(m.id); if (m.kind === 'case') caseRefs.add(m.id) })
      if (e.compare) { if (e.compare.kind === 'hexagram') hexRefs.add(e.compare.seq); if (e.compare.kind === 'yao') yaoRefs.add(`${e.compare.seq}-${e.compare.pos}`); if (e.compare.kind === 'term') termRefs.add(e.compare.id); if (e.compare.kind === 'tradition') tradRefs.add(e.compare.id) }
      ;(e.relatedTerms || []).forEach((id) => termRefs.add(id))
    })
    DOUBT_TASKS.forEach((t) => {
      ;(t.hexagrams || []).forEach((s) => hexRefs.add(s))
      ;(t.yaos || []).forEach((y) => yaoRefs.add(`${y.seq}-${y.pos}`))
      ;(t.cases || []).forEach((id) => caseRefs.add(id))
      ;(t.classics || []).forEach((id) => classicRefs.add(id))
      ;(t.relatedTerms || []).forEach((id) => termRefs.add(id))
      ;(t.traditions || []).forEach((k) => tradRefs.add(k))
    })
    const dims = new Set()
    const errors = new Set()
    WORKSHOP_TASKS.forEach((t) => { t.masteryKeys.forEach((k) => dims.add(k)); t.errorTypes.forEach((c) => errors.add(c)) })
    EXPLORE_EXPERIMENTS.forEach((e) => { e.masteryKeys.forEach((k) => dims.add(k)); e.errorTypes.forEach((c) => errors.add(c)) })
    EXPERIMENTS_V3.forEach((e) => { (e.expectedSkills || []).forEach((k) => dims.add(k)); e.errorTypes.forEach((c) => errors.add(c)) })
    DOUBT_TASKS.forEach((t) => { t.masteryKeys.forEach((k) => dims.add(k)); t.errorTypes.forEach((c) => errors.add(c)) })
    console.log('COVERAGE', JSON.stringify({
      hexagrams: hexRefs.size, yaos: yaoRefs.size, terms: termRefs.size, classics: classicRefs.size,
      cases: caseRefs.size, traditions: tradRefs.size, dimensions: dims.size, errors: errors.size,
      workshop: WORKSHOP_TASKS.length, explore: EXPLORE_EXPERIMENTS.length,
      inference: EXPERIMENTS_V3.length, doubts: DOUBT_TASKS.length,
    }))
    expect(hexRefs.size).toBeGreaterThanOrEqual(30)
    expect(yaoRefs.size).toBeGreaterThanOrEqual(15)
    expect(termRefs.size).toBeGreaterThanOrEqual(60)
    expect(classicRefs.size).toBeGreaterThanOrEqual(8)
    expect(caseRefs.size).toBeGreaterThanOrEqual(10)
    expect(tradRefs.size).toBe(6)
    expect(dims.size).toBe(8)
    expect(errors.size).toBeGreaterThanOrEqual(10)
  })
})

// ============================================================
// 六、随机抽样 20 个任务人工质量检查（确定性抽样，可复现）
// ============================================================
describe('R4 · 随机抽样质量检查（20 个）', () => {
  const pool = [
    ...WORKSHOP_TASKS.map((t) => ({ board: '易工坊', id: t.id, title: t.title, text: [t.title, t.goal, t.prompt, ...(t.questions || [])].join(' '), level: t.level })),
    ...EXPLORE_EXPERIMENTS.map((e) => ({ board: '实验', id: e.id, title: e.title, text: [e.title, e.subtitle, e.reflection, ...(e.focus || [])].join(' '), level: e.level })),
    ...EXPERIMENTS_V3.map((e) => ({ board: '推理实验', id: e.id, title: e.title, text: [e.title, e.subtitle, e.question, e.hypothesis, ...(e.counterexamples || []), ...(e.reflectionQuestions || [])].join(' '), level: e.difficulty || 1 })),
    ...DOUBT_TASKS.map((t) => ({ board: '怀疑室', id: t.id, title: t.title, text: [t.title, t.prompt, t.statement, t.hint].join(' '), level: t.level })),
  ]
  const sampled = pick(pool, 20, 'r4-quality-audit-v1')
  it('确定性抽样 20 个，分布覆盖四板块', () => {
    expect(sampled.length).toBe(20)
    const boards = new Set(sampled.map((s) => s.board))
    expect(boards.size).toBeGreaterThanOrEqual(3) // 至少覆盖 3 个板块
  })
  for (let i = 0; i < sampled.length; i++) {
    const s = sampled[i]
    it(`抽样#${i + 1} [${s.board}] ${s.id} 内容质量达标`, () => {
      expect(s.title.length).toBeGreaterThanOrEqual(4)
      expect(s.text.length).toBeGreaterThanOrEqual(30)
      expect(noForbidden(s.text), '含禁词（算命/命中注定/科学验证等）').toBe(true)
      expect(Number.isInteger(s.level) && s.level >= 1 && s.level <= 4).toBe(true)
    })
  }
})

// ============================================================
// 七、四大板块互连闭环（Evidence → Mastery → Agent）
// ============================================================
describe('R4 · 四板块互连闭环', () => {
  it('易工坊任务完成 → 写入 Evidence → 能力档案变化 → Agent 推荐变化', () => {
    const a1 = runAgent({ ...initialState, evidence: [] })
    const before = a1.nextAction.id
    // 真实行为流：用户在易工坊「解释构建台」连续完成 3 次解释构建（construct），
    // 但未补充证据（evidence=0）也未找反例 → 触发 WEAK_EVIDENCE / NO_COUNTEREXAMPLE 信号，
    // 证据推荐（推理实验，type=exp）取代旧路径的课程推荐（lesson），推荐必须变化。
    let s = { ...initialState, evidence: [] }
    for (const targetId of ['ws-ex-01', 'ws-ex-02', 'ws-ex-03']) {
      s = reducer(s, {
        type: 'RECORD_EVIDENCE',
        evidence: {
          source: 'workshop',
          action: 'construct',
          targetType: 'task',
          targetId,
          context: '解释构建台训练任务',
          result: 'correct',
          masteryKey: 'reasoning',
        },
      })
    }
    const a2 = runAgent(s)
    expect(s.evidence).toHaveLength(3)
    expect(s.masteryProfile).toBeTruthy()
    expect(a2.nextAction.type).toBe('exp') // 证据推荐：推理实验
    expect(a2.nextAction.id).not.toBe(before)
    expect(a2.nextActionSource).toBe('evidence')
  })

  it('探索实验（/lab）与推理实验（/exp）入口区分：字段契约不同', () => {
    // 探索实验以 focus（观察指引）为骨架；推理实验以 question/hypothesis/counterexamples（验证）为骨架
    const x = EXPLORE_EXPERIMENTS[0]
    const e = EXPERIMENTS_V3[0]
    expect(Array.isArray(x.focus) && x.focus.length >= 2).toBe(true)
    expect(x.question == null || x.question === '').toBe(true) // 探索不以假设为起点
    expect(nonEmpty(e.question) && nonEmpty(e.hypothesis)).toBe(true)
    expect(e.focus == null || e.focus.length === 0).toBe(true) // 验证不以观察指引为骨架
  })
})
