// ============================================================
// R2-2 · 术语知识百科（知识连接层）测试
// 验证：
//   TermProfile 数据质量（200+、id/term 唯一、分类/层级、四层解释、来源可信度）
//   双向连接（术语↔卦/爻/原典/十翼/传统/案例 正向 + 反向）
//   结构术语由规则引擎 deterministic 推导（不手写、不 LLM）
//   20+ 辨析组（A/B 存在、关系有效、练习与解释齐全）
//   术语掌握度复用 0-6 mastery + 学习证据 + 确定性推荐
//   搜索（中文/繁体/拼音/别名）
// ============================================================
import { describe, it, expect } from 'vitest'
import {
  ALL_TERMS,
  TERM_COUNT,
  TERM_CATEGORIES,
  TERM_CATEGORY_BY_ID,
  getTerm,
  searchTerms,
} from '../src/data/iching/termData'
import {
  isStructuralTerm,
  yaoIdsForTerm,
  hexagramIdsForTerm,
  yaosForTerm,
  hexagramsForTerm,
  classicsForTerm,
  traditionsForTerm,
  termsForTradition,
  tenWingsForTerm,
  casesForTerm,
  termsForCase,
  termsForYao,
  termsForHexagram,
  termsForClassic,
  prerequisitesForTerm,
  termRelations,
  termNetwork,
  FEATURED_TERM_IDS,
} from '../src/data/iching/termGraph'
import {
  DISCERNMENT_GROUPS,
  DISCERNMENT_COUNT,
  DISCERNMENT_BY_ID,
  getDiscernment,
  discernmentsForTerm,
  discernmentPartner,
} from '../src/data/iching/termDiscern'
import {
  termMasteryKey,
  termMastery,
  termStage,
  termEvidence,
  termRecommendation,
  contrastRecommendation,
  termDefinitionQuestion,
} from '../src/data/iching/termMastery'
import { ALL_YAO, YAO_BY_ID } from '../src/data/iching/hexagramProfile'

const empty = { mastery: {}, termEvidence: {}, termNotes: {}, quizHistory: [], contrastHistory: [] }

describe('TermProfile · 数据质量', () => {
  it('术语总量 >= 200', () => {
    expect(TERM_COUNT).toBeGreaterThanOrEqual(200)
  })

  it('id 唯一，term 唯一，masteryKey 统一为 term-{id}', () => {
    const ids = new Set()
    const terms = new Set()
    for (const t of ALL_TERMS) {
      expect(ids.has(t.id), `重复 id: ${t.id}`).toBe(false)
      expect(terms.has(t.term), `重复 term: ${t.term}`).toBe(false)
      ids.add(t.id)
      terms.add(t.term)
    }
    expect(Array.isArray(ALL_TERMS)).toBe(true)
    for (const t of ALL_TERMS) {
      expect(t.masteryKey).toBe(`term-${t.id}`)
    }
  })

  it('分类有效且与层级一致（category level 匹配 TERM_CATEGORIES）', () => {
    for (const t of ALL_TERMS) {
      const cat = TERM_CATEGORY_BY_ID[t.category]
      expect(cat, `未知分类: ${t.category}`).toBeTruthy()
      expect(t.level).toBe(cat.level)
    }
  })

  it('四层解释：shortDefinition / beginnerExplanation / coreMeaning 均非空', () => {
    for (const t of ALL_TERMS) {
      expect(t.shortDefinition, `${t.id} 缺「一句话」`).toBeTruthy()
      expect(t.beginnerExplanation, `${t.id} 缺「展开」`).toBeTruthy()
      expect(t.coreMeaning, `${t.id} 缺「核心含义」`).toBeTruthy()
    }
  })

  it('来源可信度合法（verified / needs_review）', () => {
    for (const t of ALL_TERMS) {
      expect(['verified', 'needs_review']).toContain(t.sourceInfo.confidence)
      expect(t.sourceInfo.edition).toBeTruthy()
    }
  })

  it('涉及传承/托名的术语使用保守来源（needs_review，不轻下断言）', () => {
    const mhy = getTerm('meihuayishu')
    expect(mhy).toBeTruthy()
    expect(mhy.sourceInfo.confidence).toBe('needs_review')
    expect(mhy.coreMeaning).toMatch(/托名|传承|讨论|审慎|不下/)
    // 不许出现「邵雍发明/创立梅花易数」的确定性断言
    expect(mhy.coreMeaning).not.toMatch(/邵雍(所)?(创|发明|著)/)
  })

  it('反伪深度：现代类比若出现必须标注，不得把术语混成算命结论', () => {
    // 抽样核心术语：核心含义不得落进「抽到某卦→你事业顺利」这类决定论
    const zheng = getTerm('zheng')
    expect(zheng.coreMeaning).not.toMatch(/事业顺|好运|命中|一定(吉|凶)/)
  })
})

describe('结构术语 · deterministic（由规则引擎推导，不手写）', () => {
  it('结构术语集合 = analyzeYao 已算字段，同源一致', () => {
    // 中 = 居二/五位
    expect(yaoIdsForTerm('zhong').slice().sort()).toEqual(
      ALL_YAO.filter((y) => y.zhong).map((y) => y.id).sort()
    )
    // 正 = 得位
    expect(yaoIdsForTerm('zheng').slice().sort()).toEqual(
      ALL_YAO.filter((y) => y.dewei).map((y) => y.id).sort()
    )
    // 中正 = 中且正
    expect(yaoIdsForTerm('zhongzheng').slice().sort()).toEqual(
      ALL_YAO.filter((y) => y.zhongzheng).map((y) => y.id).sort()
    )
  })

  it('乾九五（hx-1-4）中且正；乾九二（hx-1-1）居中不当位', () => {
    const wu = YAO_BY_ID['hx-1-4']
    const er = YAO_BY_ID['hx-1-1']
    expect(wu.zhong).toBe(true)
    expect(wu.dewei).toBe(true)
    expect(wu.zhongzheng).toBe(true)
    expect(er.zhong).toBe(true)
    expect(er.dewei).toBe(false)
    expect(er.zhongzheng).toBe(false)
  })

  it('结构术语不写硬编码数据库：zhong 覆盖每一卦（每卦都有二/五爻）', () => {
    expect(hexagramIdsForTerm('zhong').length).toBe(64)
  })
})

describe('术语 → 真实对象（正向连接）', () => {
  it('zhong → 相关爻：含乾九二、乾九五', () => {
    const ids = yaosForTerm('zhong').map((y) => y.id)
    expect(ids).toContain('hx-1-1')
    expect(ids).toContain('hx-1-4')
  })

  it('经典文本术语由规则展开：卦辞覆盖 64 卦、爻辞覆盖 384 爻、文言仅乾坤', () => {
    expect(hexagramIdsForTerm('guaci').length).toBe(64)
    expect(yaoIdsForTerm('yaoci').length).toBe(384)
    expect(hexagramIdsForTerm('wenyan').slice().sort()).toEqual([1, 2])
  })

  it('原典关联：易 关联到已核对的系辞片段', () => {
    const classics = classicsForTerm('yi')
    const ids = classics.map((c) => c.id)
    expect(ids).toEqual(expect.arrayContaining(['sv-03', 'sv-05']))
  })

  it('传统关联：王弼 挂到 yx-wangbi 传统节点', () => {
    const traditions = traditionsForTerm('wangbi')
    expect(traditions.map((t) => t.node)).toContain('yx-wangbi')
  })

  it('十翼关联：周易 关联到 yz-overview 等十翼节点', () => {
    const wings = tenWingsForTerm('zhouyi')
    const labels = wings.map((w) => w.label)
    expect(labels).toEqual(expect.arrayContaining(['彖传', '象传']))
  })

  it('术语 → 案例：核心/结构类术语能找到真实案例', () => {
    // 结构术语有 case 关联（经课程节点确定性匹配）
    const cases = casesForTerm('zhongzheng')
    expect(Array.isArray(cases)).toBe(true)
    expect(cases.length).toBeGreaterThan(0)
  })

  it('术语关系网络：zhong 前驱含爻位、辨析含 正', () => {
    const net = termNetwork('zhong')
    expect(net).toBeTruthy()
    expect(net.relations.prerequisites.map((t) => t.id)).toContain('yaowei')
    expect(net.relations.contrasts.map((t) => t.id)).toContain('zheng')
    expect(net.masteryKey).toBe('term-zhong')
  })

  it('学习依赖：zhongzheng 前驱链含 中、正、爻位、阴阳', () => {
    const pre = prerequisitesForTerm('zhongzheng')
    expect(pre).toEqual(expect.arrayContaining(['zhong', 'zheng', 'yaowei', 'yinyang']))
  })

  it('精选术语均为真实存在实体', () => {
    for (const id of FEATURED_TERM_IDS) {
      expect(getTerm(id), `精选术语不存在: ${id}`).toBeTruthy()
    }
  })
})

describe('对象 → 术语（反向连接，可反查）', () => {
  it('乾九五 hx-1-4 → 中/正/中正', () => {
    const terms = termsForYao('hx-1-4')
    expect(terms).toEqual(expect.arrayContaining(['zhong', 'zheng', 'zhongzheng']))
  })

  it('乾初九 hx-1-0 → 得位、敌应；但不在 中 里', () => {
    const chujiu = YAO_BY_ID['hx-1-0']
    expect(chujiu.dewei).toBe(true)
    expect(termsForYao('hx-1-0')).toContain('dewei')
    expect(termsForYao('hx-1-0')).not.toContain('zhong')
  })

  it('乾卦 → 术语：包含中/正（结构）与 卦辞 等经典类', () => {
    const terms = termsForHexagram(1)
    expect(terms).toEqual(expect.arrayContaining(['zhong', 'zheng', 'guaci', 'daxiang']))
  })

  it('经典片段 sv-03（生生之谓易）→ 术语 易/变化/生生', () => {
    const terms = termsForClassic('sv-03')
    expect(terms).toEqual(expect.arrayContaining(['yi', 'bianhua']))
  })

  it('yx-wangbi 传统节点 → 术语 王弼', () => {
    const terms = termsForTradition('yx-wangbi')
    expect(terms).toContain('wangbi')
  })

  it('案例反向：casesForTerm 返回的案例可回查术语', () => {
    const cases = casesForTerm('zhongzheng')
    if (cases.length) {
      const back = termsForCase(cases[0].id)
      expect(back).toContain('zhongzheng')
    }
  })
})

describe('易学辨析室 · 概念边界', () => {
  it('辨析组 >= 20', () => {
    expect(DISCERNMENT_COUNT).toBeGreaterThanOrEqual(20)
  })

  it('每组 A/B 均存在且不同，一句话区别与混淆原因齐全', () => {
    for (const g of DISCERNMENT_GROUPS) {
      const a = getTerm(g.termA)
      const b = getTerm(g.termB)
      expect(a, `辨析 ${g.id} 的 A 不存在: ${g.termA}`).toBeTruthy()
      expect(b, `辨析 ${g.id} 的 B 不存在: ${g.termB}`).toBeTruthy()
      expect(g.termA).not.toBe(g.termB)
      expect(g.oneLineDiff).toBeTruthy()
      expect(g.confusionReason).toBeTruthy()
    }
  })

  it('每组含练习：题目、至少 2 选项、合法答案、解释齐全', () => {
    for (const g of DISCERNMENT_GROUPS) {
      const p = g.practice
      expect(p, `${g.id} 缺练习`).toBeTruthy()
      expect(p.question).toBeTruthy()
      expect(p.options.length).toBeGreaterThanOrEqual(2)
      expect(p.answerIndex).toBeGreaterThanOrEqual(0)
      expect(p.answerIndex).toBeLessThan(p.options.length)
      expect(p.explain).toBeTruthy()
    }
  })

  it('中 vs 正 辨析存在：答案不是「一样」也不是「无关」', () => {
    const g = getDiscernment('disc-zhong-zheng')
    expect(g).toBeTruthy()
    expect(g.practice.options[g.practice.answerIndex]).toMatch(/不是同一个|有关/)
  })

  it('反查：zhong 可找到 中 vs 正、得位 vs 中 两组辨析', () => {
    const groups = discernmentsForTerm('zhong').map((g) => g.id)
    expect(groups).toEqual(expect.arrayContaining(['disc-zhong-zheng', 'disc-dewei-zhong']))
    expect(discernmentPartner('zhong', 'disc-zhong-zheng')).toBe('zheng')
  })
})

describe('术语掌握度 · 复用 0-6 mastery', () => {
  it('termMasteryKey 与 TermProfile.masteryKey 一致', () => {
    expect(termMasteryKey('zhong')).toBe('term-zhong')
    expect(termMasteryKey('zhong')).toBe(getTerm('zhong').masteryKey)
  })

  it('termMastery 读取 state.mastery（默认 0）', () => {
    expect(termMastery(empty, 'zhong')).toBe(0)
    const s = { ...empty, mastery: { 'term-zhong': 3 } }
    expect(termMastery(s, 'zhong')).toBe(3)
  })

  it('termStage 由掌握度推导：0 → L0，6 → L5', () => {
    expect(termStage(empty, 'zhong').id).toBe('L0')
    const s6 = { ...empty, mastery: { 'term-zhong': 6 } }
    expect(termStage(s6, 'zhong').id).toBe('L5')
  })

  it('termEvidence 七维，阅读 ≠ 学会', () => {
    const ev = termEvidence(empty, 'zhong')
    for (const k of ['read', 'link', 'define', 'discern', 'original', 'case', 'analyze']) {
      expect(k in ev, `缺证据维度 ${k}`).toBe(true)
    }
    expect(ev.read).toBe(false)
    expect(ev.analyze).toBe(false)
    const readState = { ...empty, termEvidence: { 'term-zhong': { read: true } } }
    expect(termEvidence(readState, 'zhong').read).toBe(true)
    expect(termEvidence(readState, 'zhong').analyze).toBe(false) // 只看过 ≠ 会分析
  })

  it('termRecommendation：全新为 start，掌握度 2 为 weak，均 deterministic', () => {
    const r0 = termRecommendation(empty, 'zhong')
    expect(r0.kind).toBe('start')
    expect(r0.why).toContain('0')

    const s2 = { ...empty, mastery: { 'term-zhong': 2 } }
    const r2 = termRecommendation(s2, 'zhong')
    expect(r2.kind).toBe('weak')
    expect(r2.why).toContain('2')

    // 同一 state 多次调用结果一致（无随机）
    expect(termRecommendation(s2, 'zhong')).toEqual(r2)
  })

  it('contrastRecommendation：「我分不清中和正」→ 推一次中 vs 正辨析', () => {
    const rec = contrastRecommendation(empty, 'zhong')
    expect(rec).toBeTruthy()
    expect(rec.kind).toBe('contrast')
    expect(rec.groupId).toBe('disc-zhong-zheng')
  })

  it('definitionQuestion 确定性：同一术语多次调用结果一致，答案固定', () => {
    const q1 = termDefinitionQuestion('zhong')
    const q2 = termDefinitionQuestion('zhong')
    expect(q1).toBeTruthy()
    expect(q1).toEqual(q2)
    expect(q1.answer).toBe(0)
    expect(q1.options.length).toBeGreaterThanOrEqual(1)
  })
})

describe('术语搜索 · 中文/繁体/拼音/别名', () => {
  it('空查询返回全部术语', () => {
    expect(searchTerms('').length).toBe(TERM_COUNT)
  })

  it('中文「中正」可查', () => {
    expect(searchTerms('中正').map((t) => t.id)).toContain('zhongzheng')
  })

  it('拼音「zhongzheng」可查（去声调归一）', () => {
    expect(searchTerms('zhongzheng').map((t) => t.id)).toContain('zhongzheng')
  })

  it('繁体「王弼」可查', () => {
    expect(searchTerms('王弼').map((t) => t.id)).toContain('wangbi')
  })

  it('别名「伊川」可查到程颐', () => {
    expect(searchTerms('伊川').map((t) => t.id)).toContain('chengyi')
  })
})