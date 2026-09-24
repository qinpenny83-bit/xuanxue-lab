// ============================================================
// R3 Phase 1 · 易工坊「实战工作台」测试
//
// 覆盖（≥60 项）：
//   1. 工作台元数据 / 动作白名单（有意义行为，不机械打点）
//   2. 确定性助手（seed / 绝对化检测 / 事实-解释分类 / 爻 id 兼容）
//   3. 6 个工作台的确定性规则检查（只检查，不伪造评分）
//   4. 自由研究台跨对象连接 + 对象标签
//   5. 首页 3 问（真实数据驱动；新用户走明确标注的默认路径）
//   6. 坤卦 stale bug 回归（题目随卦/爻切换）
//   7. Agent / Mastery / ErrorMuseum 读取 Evidence
//   8. 真实新用户路径（从 0 走完一遍，验证 Evidence 可还原行为）
// ============================================================
import { describe, it, expect } from 'vitest'
import {
  WORKSHOPS,
  WORKSHOP_ACTIONS,
  recordWorkshop,
  seedFromString,
  detectAbsolutes,
  ABSOLUTES,
  classifyStructureFact,
  checkStructureObservation,
  profileStructureFacts,
  checkYaoAnalysis,
  checkClassicReading,
  caseEvidenceCandidates,
  checkCaseFlow,
  checkExplanationDraft,
  REFLECT_OPTIONS,
  relatedResearch,
  workshopTargetLabel,
  workshopHome,
  workshopForWeakness,
  NEW_USER_PATH,
  CLASSIC_ENTRIES,
  getClassicEntry,
  parseYaoRef,
  getTradition,
} from '../src/agent/workshopEngine'
import { EVIDENCE_ACTIONS, createEvidence, summarizeEvidence, filterEvidence } from '../src/agent/learningEvidence'
import { getHexagramProfile, getYao, getYaoById, TRADITION_REF } from '../src/data/iching/hexagramProfile'
import { hexQuestions, yaoQuestions } from '../src/data/iching/hexMastery'
import { getTerm } from '../src/data/iching/termData'
import { ICHING_CASES, getCaseById } from '../src/data/iching/caseGraph'
import { computeMasteryProfile, DIMENSION_KEYS } from '../src/agent/masteryEngine'
import { topErrors, ERROR_TYPES } from '../src/agent/errors'
import { reducer } from '../src/store/reducer'
import { initialState } from '../src/lib/storage'

// ─────────────────────────────────────────────────────────────
// 工作台元数据 + 动作白名单
// ─────────────────────────────────────────────────────────────
describe('易工坊 · 工作台元数据与动作白名单', () => {
  it('共 6 个工作台，每个都有明确任务（不是资料页）', () => {
    expect(WORKSHOPS.length).toBe(6)
    for (const w of WORKSHOPS) {
      expect(w.id).toBeTruthy()
      expect(w.tag).toBeTruthy()
      expect(w.goal.trim().length).toBeGreaterThan(10) // 明确任务目标，非空壳
    }
  })

  it('6 个工作台 id 稳定且互不重复', () => {
    const ids = WORKSHOPS.map((w) => w.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.sort()).toEqual(['case', 'classic', 'explain', 'free', 'hexagram', 'yao'])
  })

  it('每个工作台的 goal 都是「行为任务」而非「资料描述」', () => {
    // 任务词必须导向「做某事」，避免做成资料展示页
    const actionVerbs = ['写下', '说清', '解释', '对照', '观察', '引用', '检查', '构建', '修正', '建立', '留痕', '选']
    for (const w of WORKSHOPS) {
      expect(actionVerbs.some((v) => w.goal.includes(v)), `${w.id} 缺少行为任务动词`).toBe(true)
    }
  })

  it('动作白名单恰好 13 种「有意义学习行为」', () => {
    expect(WORKSHOP_ACTIONS.length).toBe(13)
    expect([...WORKSHOP_ACTIONS].sort()).toEqual([
      'analyze', 'compare', 'complete', 'construct', 'counterexample', 'evidence',
      'identify', 'interpret', 'observe', 'reflect', 'retry', 'revise', 'view',
    ])
  })

  it('工作台动作全部属于合法 Evidence action（不越界）', () => {
    for (const a of WORKSHOP_ACTIONS) {
      expect(EVIDENCE_ACTIONS).toContain(a)
    }
  })

  it('工作台不包含「点一下就算学会」的机械 action（无 visit/click/open）', () => {
    for (const a of WORKSHOP_ACTIONS) {
      expect(['visit', 'click', 'open', 'hover', 'scroll'].includes(a)).toBe(false)
    }
  })

  it('最重的 6 种行为（construct/evidence/counterexample/revise/reflect/retry）都在白名单', () => {
    for (const a of ['construct', 'evidence', 'counterexample', 'revise', 'reflect', 'retry']) {
      expect(WORKSHOP_ACTIONS).toContain(a)
    }
  })
})

// ─────────────────────────────────────────────────────────────
// 确定性助手
// ─────────────────────────────────────────────────────────────
describe('易工坊 · 确定性助手（无随机）', () => {
  it('seedFromString 对同一输入永远返回同一值', () => {
    expect(seedFromString('乾卦')).toBe(seedFromString('乾卦'))
  })

  it('seedFromString 对不同输入返回不同值（至少一对）', () => {
    expect(seedFromString('乾')).not.toBe(seedFromString('坤'))
  })

  it('detectAbsolutes 命中「必然 / 一定 / 绝对」', () => {
    const hits = detectAbsolutes('这个卦必然大吉，一定成功')
    expect(hits).toContain('必然')
    expect(hits).toContain('一定')
  })

  it('detectAbsolutes 对中性表述返回空', () => {
    expect(detectAbsolutes('上卦为乾，下卦为坤')).toEqual([])
  })

  it('detectAbsolutes 对空串 / 空参返回空，不抛异常', () => {
    expect(detectAbsolutes('')).toEqual([])
    expect(detectAbsolutes()).toEqual([])
  })

  it('绝对化词表包含「就是 / 等于」等过度断言词', () => {
    for (const w of ['就是', '等于', '全部', '所有']) expect(ABSOLUTES).toContain(w)
  })

  it('classifyStructureFact 把含「上下卦/阴阳」的判为 fact', () => {
    expect(classifyStructureFact('上卦为乾，下卦为震').kind).toBe('fact')
  })

  it('classifyStructureFact 把含「象征/吉凶」的判为 interpretation', () => {
    expect(classifyStructureFact('这卦象征吉祥大利').kind).toBe('interpretation')
  })

  it('classifyStructureFact 对空输入判为未定（不误报）', () => {
    expect(classifyStructureFact('').kind).toBe('unclear')
  })

  it('classifyStructureFact 明确说明是关键词级规则，返回命中的计数量', () => {
    const r = classifyStructureFact('上卦下卦阴阳')
    expect(typeof r.factHits).toBe('number')
    expect(typeof r.interpHits).toBe('number')
  })

  it('parseYaoRef 兼容档案写法 hx-1-0', () => {
    expect(parseYaoRef('hx-1-0')).toEqual({ seq: 1, pos: 0 })
  })

  it('parseYaoRef 兼容简写 12-5', () => {
    expect(parseYaoRef('12-5')).toEqual({ seq: 12, pos: 5 })
  })

  it('parseYaoRef 对非法输入返回 null', () => {
    expect(parseYaoRef('abc')).toBeNull()
    expect(parseYaoRef('1-')).toBeNull()
    expect(parseYaoRef('1-99')).toBeNull()
  })

  it('getTradition 解析存在的传统 / 缺失返回 null', () => {
    expect(getTradition('wangbi').label).toBeTruthy()
    expect(getTradition('__不存在__')).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────
// ① 卦象工作台
// ─────────────────────────────────────────────────────────────
describe('① 卦象工作台 · 观察结构', () => {
  const qian = getHexagramProfile(1)

  it('profileStructureFacts 真实推导出上下卦 / 阴阳数', () => {
    const facts = profileStructureFacts(qian)
    expect(facts.some((f) => f.includes('上卦'))).toBe(true)
    expect(facts.some((f) => /阳/.test(f))).toBe(true)
  })

  it('profileStructureFacts 对 null 返回空数组，不抛异常', () => {
    expect(profileStructureFacts(null)).toEqual([])
  })

  it('checkStructureObservation 少于 3 条判为未完成', () => {
    const r = checkStructureObservation(qian, ['上卦为乾'])
    expect(r.count).toBe(1)
    expect(r.complete).toBe(false)
  })

  it('checkStructureObservation 写满 3 条判为完成', () => {
    const r = checkStructureObservation(qian, ['上卦为乾', '下卦为乾', '六爻皆阳'])
    expect(r.count).toBe(3)
    expect(r.complete).toBe(true)
  })

  it('checkStructureObservation 的 reference 来自结构引擎（供对照）', () => {
    const r = checkStructureObservation(qian, [])
    expect(r.reference.length).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────────────────────────────
// ② 爻研究台
// ─────────────────────────────────────────────────────────────
describe('② 爻研究台 · 研究爻位与爻辞', () => {
  const y = getYao(1, 0) // 乾·初九

  it('checkYaoAnalysis 命中结构关键词（得位/中/应）', () => {
    const r = checkYaoAnalysis(y, '初九得位，但不在中位')
    expect(r.mentioned).toContain('得位')
    expect(r.count).toBeGreaterThanOrEqual(2)
  })

  it('checkYaoAnalysis 提到 ≥2 个结构词判为 complete', () => {
    const r = checkYaoAnalysis(y, '得位，与四爻相应')
    expect(r.complete).toBe(true)
  })

  it('checkYaoAnalysis 识别到位号引用', () => {
    expect(checkYaoAnalysis(y, '它居初位').hasPositionRef).toBe(true)
  })

  it('checkYaoAnalysis 空输入 → count 0 且不 complete', () => {
    const r = checkYaoAnalysis(y, '')
    expect(r.count).toBe(0)
    expect(r.complete).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────
// ③ 经典解读台
// ─────────────────────────────────────────────────────────────
describe('③ 经典解读台 · 原文→解释→比较', () => {
  it('checkClassicReading 区分 ownDone / misreadDone', () => {
    const r = checkClassicReading('我理解为刚健', '')
    expect(r.ownDone).toBe(true)
    expect(r.misreadDone).toBe(false)
    expect(r.complete).toBe(false)
  })

  it('checkClassicReading 两者都写才 complete', () => {
    const r = checkClassicReading('刚健', '可能漏了条件')
    expect(r.complete).toBe(true)
  })

  it('checkClassicReading 检测到绝对化表达', () => {
    const r = checkClassicReading('这个卦一定吉', '')
    expect(r.absolutes).toContain('一定')
  })

  it('CLASSIC_ENTRIES 非空且每条有 id 与原文', () => {
    expect(CLASSIC_ENTRIES.length).toBeGreaterThan(0)
    for (const c of CLASSIC_ENTRIES) {
      expect(c.id).toBeTruthy()
      expect(c.original).toBeTruthy()
    }
  })

  it('getClassicEntry 命中 / 缺失发 null', () => {
    expect(getClassicEntry(CLASSIC_ENTRIES[0].id).id).toBe(CLASSIC_ENTRIES[0].id)
    expect(getClassicEntry('__不存在__')).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────
// ④ 案例分析台
// ─────────────────────────────────────────────────────────────
describe('④ 案例分析台 · 案例→证据→反例→结论', () => {
  const c = getCaseById(ICHING_CASES[0].id)

  it('caseEvidenceCandidates 从情境+图表生成证据候选', () => {
    const cands = caseEvidenceCandidates(c)
    expect(Array.isArray(cands)).toBe(true)
    expect(cands.length).toBeGreaterThan(0)
    expect(cands.some((x) => x.type === 'situation')).toBe(true)
  })

  it('caseEvidenceCandidates 对 null 返回空', () => {
    expect(caseEvidenceCandidates(null)).toEqual([])
  })

  it('checkCaseFlow 全空时列出全部缺项', () => {
    const r = checkCaseFlow({})
    expect(r.complete).toBe(false)
    expect(r.missing).toContain('相关卦/爻')
    expect(r.missing).toContain('证据')
    expect(r.missing).toContain('反例')
    expect(r.missing).toContain('结论')
    expect(r.missing).toContain('把握程度')
  })

  it('checkCaseFlow 齐备时 complete', () => {
    const r = checkCaseFlow({ relatedChosen: true, evidenceChosen: true, hasCounter: true, counterNote: 'x', conclusion: 'y', confidence: 'mid' })
    expect(r.complete).toBe(true)
    expect(r.missing).toEqual([])
  })

  it('checkCaseFlow 明确「没有反例」不算缺反例（这是确定判断）', () => {
    const r = checkCaseFlow({ relatedChosen: true, evidenceChosen: true, hasCounter: false, conclusion: 'y', confidence: 'low' })
    expect(r.complete).toBe(true)
    expect(r.missing).not.toContain('反例')
  })

  it('checkCaseFlow 把握程度为 null 仍会记为缺项', () => {
    const r = checkCaseFlow({ relatedChosen: true, evidenceChosen: true, hasCounter: true, conclusion: 'y', confidence: null })
    expect(r.missing).toContain('把握程度')
    expect(r.complete).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────
// ⑤ 解释构建台
// ─────────────────────────────────────────────────────────────
describe('⑤ 解释构建台 · 提出并修正解释', () => {
  it('缺解释/依据会被识别（确定性，非评分）', () => {
    const r = checkExplanationDraft({ observed: 'x', explanation: '', basis: '' })
    expect(r.missing).toContain('解释')
    expect(r.missing).toContain('依据')
    expect(r.complete).toBe(false)
  })

  it('有解释+依据即满足核心 complete（反例/不确定是能力信号，不阻塞提交）', () => {
    const r = checkExplanationDraft({ observed: 'x', explanation: '乾为刚健', basis: '文言曰' })
    expect(r.complete).toBe(true)
    expect(r.hasCounter).toBe(false)
    expect(r.hasUncertainty).toBe(false)
  })

  it('记录是否填写反例 / 不确定（确定性检查）', () => {
    const r = checkExplanationDraft({ explanation: 'x', basis: 'y', counterexample: '过刚则折', uncertainty: '尚不确定' })
    expect(r.hasCounter).toBe(true)
    expect(r.hasUncertainty).toBe(true)
  })

  it('检测解释/依据中的绝对化表达', () => {
    const r = checkExplanationDraft({ explanation: '这个卦绝对代表成功', basis: '因为必然如此' })
    expect(r.absolutes).toContain('绝对')
    expect(r.absolutes).toContain('必然')
  })

  it('REFLECT_OPTIONS 提供 3 个确定性反思选项（把解释当事实可被纠正）', () => {
    expect(REFLECT_OPTIONS.length).toBe(3)
    for (const o of REFLECT_OPTIONS) {
      expect(o.value).toBeTruthy()
      expect(o.label).toBeTruthy()
    }
    expect(REFLECT_OPTIONS.some((o) => o.value === 'claimed-fact')).toBe(true)
  })

  it('空解释判为未完成（不伪造「你答对了」）', () => {
    expect(checkExplanationDraft({ explanation: '', basis: '' }).complete).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────
// ⑥ 自由研究台 · 跨对象连接
// ─────────────────────────────────────────────────────────────
describe('⑥ 自由研究台 · 跨对象确定性连接', () => {
  it('由卦出发 → 连接到该卦的 6 爻', () => {
    const rels = relatedResearch('hexagram', 2) // 坤
    const yaos = rels.filter((r) => r.type === 'yao')
    expect(yaos.length).toBe(6)
    expect(yaos.every((r) => parseYaoRef(r.id))).toBe(true)
  })

  it('由单爻出发 → 连接到同卦其余 5 爻（排除自身）', () => {
    const rels = relatedResearch('yao', 'hx-2-0')
    const yaos = rels.filter((r) => r.type === 'yao')
    expect(yaos.length).toBe(5)
    expect(yaos.some((r) => r.id === 'hx-2-0')).toBe(false)
  })

  it('由术语出发 → 连接到关联术语（term 存在时）', () => {
    const rels = relatedResearch('term', 'yinyang')
    expect(Array.isArray(rels)).toBe(true)
    expect(rels.length).toBeGreaterThan(0)
  })

  it('由解释传统出发 → 确定性连接到经典（不随机）', () => {
    const rels = relatedResearch('tradition', 'wangbi')
    expect(Array.isArray(rels)).toBe(true)
    // 王弼义理：有相关经典则列经典，无则给乾坤兜底，两条路径结果都可复现
    expect(rels.length).toBeGreaterThan(0)
  })

  it('由案例出发 → 至少给乾坤两卦确定性入口', () => {
    const rels = relatedResearch('case', ICHING_CASES[0].id)
    expect(rels.some((r) => r.type === 'hexagram' && (r.id === 1 || r.id === 2))).toBe(true)
  })

  it('unrelated/unknown 类型返回空数组', () => {
    expect(relatedResearch('__unknown__', 1)).toEqual([])
  })

  it('workshopTargetLabel 正确解析卦/爻/术语', () => {
    expect(workshopTargetLabel('hexagram', 1)).toBe('乾卦')
    expect(workshopTargetLabel('yao', 'hx-2-0')).toContain('坤')
    expect(workshopTargetLabel('term', 'yinyang')).toBe(getTerm('yinyang').term)
  })

  it('workshopTargetLabel 解析课程题目 questionId 为可读标签，不露英文内部 ID', () => {
    expect(workshopTargetLabel('question', 'lesson-yin-yang:s0:v800800011')).toBe('阴阳不是好坏 · 第1步')
    expect(workshopTargetLabel('question', 'lesson-yin-yang:s2:v800800011')).toBe('阴阳不是好坏 · 第3步')
  })

  it('workshopTargetLabel 对无效 id 兜底为 id 字符串，不抛异常', () => {
    expect(workshopTargetLabel('hexagram', '__不存在__')).toBe('#__不存在__')
  })
})

// ─────────────────────────────────────────────────────────────
// 首页 3 问
// ─────────────────────────────────────────────────────────────
describe('易工坊首页 · 3 问（真实数据驱动）', () => {
  const now = 1_800_000_000_000

  function stateWithEvidence(list) {
    return { ...initialState, evidence: list }
  }

  it('新用户（无任何历史）isNew = true', () => {
    const home = workshopHome(stateWithEvidence([]), { now })
    expect(home.isNew).toBe(true)
    expect(home.hasRecent).toBe(false)
    expect(home.recentCount).toBe(0)
  })

  it('新用户 nowTask 走「卦象工作台」，明确标注为默认路径而非个性化', () => {
    const home = workshopHome(stateWithEvidence([]), { now })
    expect(home.nowTask.id).toBe('hexagram')
    expect(home.nowTask.why).toContain('新用户默认路径')
  })

  it('NEW_USER_PATH 明确标注「新用户默认路径」且有 5 步', () => {
    expect(NEW_USER_PATH.label).toContain('新用户默认路径')
    expect(NEW_USER_PATH.steps.length).toBe(5)
  })

  it('有真实证据时 hasRecent = true，recentTargets 排前面的对象计数最高', () => {
    const list = [
      createEvidence({ source: 'workshop', action: 'observe', targetType: 'hexagram', targetId: 1, timestamp: now - 1000 }),
      createEvidence({ source: 'workshop', action: 'observe', targetType: 'hexagram', targetId: 1, timestamp: now - 2000 }),
      createEvidence({ source: 'workshop', action: 'analyze', targetType: 'yao', targetId: 'hx-1-0', timestamp: now - 3000 }),
    ]
    const home = workshopHome(stateWithEvidence(list), { now })
    expect(home.isNew).toBe(false)
    expect(home.hasRecent).toBe(true)
    expect(home.recentTargets[0].id).toBe(1)
    expect(home.recentTargets[0].count).toBe(2)
  })

  it('recentTargets 的 label 由真实对象解析（乾卦 / 爻）', () => {
    const list = [
      createEvidence({ source: 'workshop', action: 'view', targetType: 'hexagram', targetId: 1, timestamp: now - 1000 }),
      createEvidence({ source: 'workshop', action: 'view', targetType: 'yao', targetId: 'hx-2-0', timestamp: now - 2000 }),
    ]
    const home = workshopHome(stateWithEvidence(list), { now })
    const labels = home.recentTargets.map((t) => t.label)
    expect(labels.some((l) => l.includes('乾'))).toBe(true)
    expect(labels.some((l) => l.includes('坤'))).toBe(true)
  })

  it('重复错误 E07 → 首页给出「解释构建台找反例」的具体建议', () => {
    const list = [
      createEvidence({ source: 'doubt', action: 'challenge', targetType: 'doubt', targetId: 'a', errorTypes: ['E07'], timestamp: now - 1000 }),
      createEvidence({ source: 'doubt', action: 'challenge', targetType: 'doubt', targetId: 'b', errorTypes: ['E07'], timestamp: now - 2000 }),
      // 触碰关键意识，避免「薄弱行为」抢占推荐位
      createEvidence({ source: 'workshop', action: 'evidence', targetType: 'case', targetId: 'c', timestamp: now - 3000 }),
      createEvidence({ source: 'workshop', action: 'counterexample', targetType: 'case', targetId: 'c', timestamp: now - 4000 }),
      createEvidence({ source: 'workshop', action: 'reflect', targetType: 'case', targetId: 'c', timestamp: now - 5000 }),
    ]
    const home = workshopHome(stateWithEvidence(list), { now })
    const e07 = home.toPractice.find((p) => p.why.includes('E07'))
    expect(e07).toBeTruthy()
    expect(e07.workshopId).toBe('explain')
  })

  it('从不找反例 → 薄弱行为浮现，建议去解释构建台', () => {
    const home = workshopHome(stateWithEvidence([createEvidence({ source: 'workshop', action: 'analyze', targetType: 'hexagram', targetId: 1, timestamp: now - 1000 })]), { now })
    const weakSkills = (home.summary.weakBehaviors || []).map((b) => b.skill)
    expect(weakSkills).toContain('counterexample')
    expect(weakSkills).toContain('evidence')
  })

  it('workshopForWeakness 做确定性映射', () => {
    expect(workshopForWeakness('counterexample').id).toBe('explain')
    expect(workshopForWeakness('evidence').id).toBe('case')
    expect(workshopForWeakness('uncertainty').id).toBe('explain')
    expect(workshopForWeakness('__unknown__').id).toBe('hexagram')
  })

  it('recordWorkshop 会产生 source=workshop 的 RECORD_EVIDENCE 动作', () => {
    const dispatched = []
    recordWorkshop((a) => dispatched.push(a), { action: 'observe', targetType: 'hexagram', targetId: 1 })
    expect(dispatched[0].type).toBe('RECORD_EVIDENCE')
    expect(dispatched[0].evidence.source).toBe('workshop')
    expect(dispatched[0].evidence.action).toBe('observe')
  })
})

// ─────────────────────────────────────────────────────────────
// 坤卦 stale bug 回归（题目随卦/爻切换，不再残留上一卦）
// ─────────────────────────────────────────────────────────────
describe('坤卦练习 · stale 状态回归（确定性题目）', () => {
  const qian = getHexagramProfile('乾')
  const kun = getHexagramProfile('坤')

  it('hexQuestions 的题干使用「坤」自己的名字（不是乾）', () => {
    const qs = hexQuestions(kun)
    expect(qs[0].prompt).toContain('坤')
    expect(qs[0].prompt).not.toContain('「乾」')
  })

  it('hexQuestions(坤) 的上卦答案是坤自身，答案下标对应正确', () => {
    const BAGUA = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤']
    const q = hexQuestions(kun)[0]
    expect(BAGUA[q.answer]).toBe(kun.upperTrigram)
  })

  it('yaoQuestions(坤) 题干引用坤的爻名（不是乾的爻）', () => {
    const qs = yaoQuestions(kun, 0)
    expect(qs[0].prompt).toContain(kun.yao[0].name)
    expect(qs[0].prompt).not.toContain('初九')
  })

  it('乾 / 坤 的卦题答案不同（题目确实随卦切换）', () => {
    expect(hexQuestions(qian)[0].answer).not.toBe(hexQuestions(kun)[0].answer)
  })
})

// ─────────────────────────────────────────────────────────────
// Agent / Mastery / ErrorMuseum 读取 Evidence
// ─────────────────────────────────────────────────────────────
describe('Agent / Mastery / ErrorMuseum · 读取 Evidence', () => {
  it('reducer RECORD_EVIDENCE 追加工作台证据', () => {
    const s1 = reducer({ ...initialState }, { type: 'RECORD_EVIDENCE', evidence: { source: 'workshop', action: 'observe', targetType: 'hexagram', targetId: 1 } })
    expect(s1.evidence.length).toBe(1)
    expect(s1.evidence[0].source).toBe('workshop')
  })

  it('reducer RECORD_EVIDENCE 携带 errorTypes 时同步进 ErrorMuseum', () => {
    const s1 = reducer({ ...initialState }, { type: 'RECORD_EVIDENCE', evidence: { source: 'doubt', action: 'challenge', targetType: 'doubt', targetId: 'x', errorTypes: ['E07'] } })
    expect(s1.errorPatterns.E07).toBe(1)
    expect(s1.errorEvents.length).toBe(1)
    expect(s1.errorEvents[0].code).toBe('E07')
  })

  it('topErrors（ErrorMuseum）能读出证据里沉淀的错误模式', () => {
    expect(topErrors({ E07: 3, E01: 1 })[0].code).toBe('E07')
    expect(topErrors({ E07: 1 })[0].name).toBe(ERROR_TYPES.E07.name)
  })

  it('summarizeEvidence 从证据推导薄弱行为（不写死）', () => {
    const sum = summarizeEvidence([createEvidence({ source: 'workshop', action: 'analyze', targetType: 'hexagram', targetId: 1, timestamp: 1 })])
    const weak = sum.weakBehaviors.map((b) => b.skill)
    expect(weak).toContain('counterexample')
    expect(weak).toContain('evidence')
    expect(weak).toContain('uncertainty')
  })

  it('computeMasteryProfile（Mastery）对新用户返回 sampleCount 0、bottleneck null', () => {
    const p = computeMasteryProfile(initialState)
    expect(p.sampleCount).toBe(0)
    expect(p.bottleneck).toBeNull()
    expect(p.ready).toBe(false)
  })

  it('能力维度仍归 masteryEngine 8 维，工作台不另造能力值', () => {
    expect(DIMENSION_KEYS).toHaveLength(8)
    expect(Object.keys(computeMasteryProfile(initialState))).toEqual(expect.arrayContaining(DIMENSION_KEYS))
  })
})

// ─────────────────────────────────────────────────────────────
// 真实新用户路径（从 0 走完一遍，验证 Evidence 可还原行为）
// ─────────────────────────────────────────────────────────────
describe('真实新用户路径 · Evidence 可还原', () => {
  // 用固定时间基，逐步 +1s，避免去重；结果可复现。
  const CL_ID = CLASSIC_ENTRIES[0].id
  const CASE_ID = ICHING_CASES[0].id

  function walkNewUserPath() {
    let s = { ...initialState }
    let ts = 1_800_000_000_000
    const ev = (partial) => {
      ts += 1000
      s = reducer(s, { type: 'RECORD_EVIDENCE', evidence: { source: 'workshop', timestamp: ts, __seq: ts, ...partial } })
    }
    // 进入易工坊 → 选乾卦 → 结构观察（观察 + 事实/解释分类）
    ev({ action: 'view', targetType: 'hexagram', targetId: 1 })
    ev({ action: 'observe', targetType: 'hexagram', targetId: 1, context: { facts: [{ text: '上卦为乾', kind: 'fact' }, { text: '下卦为乾', kind: 'fact' }, { text: '六爻皆阳', kind: 'fact' }] }, result: { count: 3, complete: true } })
    ev({ action: 'identify', targetType: 'hexagram', targetId: 1, context: { kinds: ['fact', 'fact', 'fact'] }, result: { factCount: 3, interpretationCount: 0 } })
    // 研究一个爻（乾·九三）
    ev({ action: 'view', targetType: 'yao', targetId: 'hx-1-2' })
    ev({ action: 'analyze', targetType: 'yao', targetId: 'hx-1-2', context: { answer: '九三居三，得位；三多凶，需谨慎' }, result: { count: 2, complete: true } })
    // 阅读相关经典
    ev({ action: 'view', targetType: 'classic', targetId: CL_ID })
    ev({ action: 'interpret', targetType: 'classic', targetId: CL_ID, context: { own: '乾象征刚健进取', misread: '可能忽略了它成立的条件' }, result: { ownDone: true, misreadDone: true, absolutes: [], complete: true } })
    // 分析一个案例（含一次「先找支持证据」的错误 E07）
    ev({ action: 'view', targetType: 'case', targetId: CASE_ID })
    ev({ action: 'analyze', targetType: 'case', targetId: CASE_ID, context: { relatedSeq: 1, conclusion: '更信任可核对的说法', confidence: 'mid', hasCounter: true, counterNote: '来源 B 也不等于更准' }, result: { complete: true, missing: [] }, errorTypes: ['E07'] })
    ev({ action: 'evidence', targetType: 'case', targetId: CASE_ID, context: { chosen: [{ type: 'situation', text: '来源B说明规则与卦象' }] }, result: { count: 1 } })
    ev({ action: 'counterexample', targetType: 'case', targetId: CASE_ID, context: { note: '来源 B 透明不等于更准' }, result: { hasCounter: true } })
    // 自己构建解释（回到乾卦）
    ev({ action: 'view', targetType: 'hexagram', targetId: 1 })
    ev({ action: 'construct', targetType: 'hexagram', targetId: 1, context: { observed: '六爻皆阳', explanation: '乾代表刚健', basis: '文言曰：大哉乾元' }, result: { complete: true, missing: [] } })
    // 寻找反例
    ev({ action: 'counterexample', targetType: 'hexagram', targetId: 1, context: { counterexample: '过刚则折，需坤以济' } })
    // 反思 + 修改解释 + 完成任务
    ev({ action: 'reflect', targetType: 'hexagram', targetId: 1, context: { choice: 'claimed-fact', label: '我把解释当成了事实，需要修正' } })
    ev({ action: 'revise', targetType: 'hexagram', targetId: 1, context: { before: '乾代表刚健', after: '乾为刚健之势，但过刚则折，需配坤以济' } })
    ev({ action: 'complete', targetType: 'hexagram', targetId: 1, context: { final: '乾为刚健之势，但过刚则折，需配坤以济' } })
    return { state: s, now: ts }
  }

  it('真实走完一遍路径，产生 17 条 Evidence（有意义的，非机械点击）', () => {
    const { state } = walkNewUserPath()
    expect(state.evidence.length).toBe(17)
  })

  it('能还原「研究对象」：乾卦 / 乾·九三 / 经典 / 案例', () => {
    const { state } = walkNewUserPath()
    const types = state.evidence.map((e) => `${e.targetType}:${e.targetId}`)
    expect(types).toContain('hexagram:1')
    expect(types).toContain('yao:hx-1-2')
    expect(types).toContain('classic:' + CL_ID)
    expect(types).toContain('case:' + CASE_ID)
  })

  it('能还原「做过什么」：观察/识别/分析/解读/引证据/构建/反思/修正/完成', () => {
    const { state } = walkNewUserPath()
    const actions = state.evidence.map((e) => e.action)
    for (const a of ['observe', 'identify', 'analyze', 'interpret', 'evidence', 'construct', 'reflect', 'revise', 'complete']) {
      expect(actions, `缺 action:${a}`).toContain(a)
    }
  })

  it('能还原「引用过什么」：evidence 事件保存了实际选择的证据文本', () => {
    const { state } = walkNewUserPath()
    const evs = filterEvidence(state.evidence, { action: 'evidence' })
    expect(evs.length).toBe(1)
    expect(evs[0].context.chosen.length).toBe(1)
    expect(evs[0].context.chosen[0].text).toContain('来源')
  })

  it('能还原「是否找到反例」：反例事件保留用户输入', () => {
    const { state } = walkNewUserPath()
    const evs = filterEvidence(state.evidence, { action: 'counterexample' })
    expect(evs.length).toBe(2) // 案例 + 解释构建台
    expect(evs.some((e) => e.context.counterexample === '过刚则折，需坤以济')).toBe(true)
  })

  it('能还原「是否修改过观点」：revise 事件保存 before/after', () => {
    const { state } = walkNewUserPath()
    const evs = filterEvidence(state.evidence, { action: 'revise' })
    expect(evs.length).toBe(1)
    expect(evs[0].context.before).toBe('乾代表刚健')
    expect(evs[0].context.after).toContain('过刚则折')
  })

  it('能还原「是否把解释当事实」：reflect 保存反思选择', () => {
    const { state } = walkNewUserPath()
    const evs = filterEvidence(state.evidence, { action: 'reflect' })
    expect(evs.some((e) => e.context.choice === 'claimed-fact')).toBe(true)
  })

  it('能还原「哪里出错」：E07 沉淀进 ErrorMuseum', () => {
    const { state } = walkNewUserPath()
    expect(state.errorPatterns.E07).toBe(1)
    expect(topErrors(state.errorPatterns)[0].code).toBe('E07')
  })

  it('Agent（workshopHome）能读出路径 → 给出非默认的具体「现在做什么」', () => {
    const { state, now } = walkNewUserPath()
    const home = workshopHome(state, { now })
    expect(home.isNew).toBe(false)
    expect(home.hasRecent).toBe(true)
    expect(home.recentCount).toBe(17)
    expect(home.nowTask).toBeTruthy()
    expect(home.nowTask.why.length).toBeGreaterThan(0)
  })

  it('Agent 的「最近研究什么」完全来自真实 Evidence（含计数）', () => {
    const { state, now } = walkNewUserPath()
    const home = workshopHome(state, { now })
    const qianT = home.recentTargets.find((t) => t.type === 'hexagram' && t.id === 1)
    expect(qianT).toBeTruthy()
    expect(qianT.count).toBe(9) // view×2 + observe + identify + construct + counterexample + reflect + revise + complete
    expect(qianT.label).toBe('乾卦')
  })

  it('全量数据完整性：走完路径也不产生任何悬空引用', async () => {
    const { checkDataIntegrity } = await import('../src/lib/dataIntegrity')
    const r = checkDataIntegrity()
    expect(r.passed).toBe(true)
    expect(r.errors).toEqual([])
  })
})