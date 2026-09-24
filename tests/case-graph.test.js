// ============================================================
// R2-1.5 · 案例↔卦/爻 知识连接测试
// 验证：五级案例分级 / 案例可反查卦、爻、知识点、errorType /
//       384 爻已确定性接入案例（不批量制造）/
//       「暂无专属案例」时的建议结构完整。
// ============================================================
import { describe, it, expect } from 'vitest'
import {
  CASE_LEVELS,
  ICHING_CASES,
  getCaseById,
  casesForHexagram,
  casesForYao,
  caseKnowledgeRefs,
} from '../src/data/iching/caseGraph'
import { HEXAGRAM_PROFILES, ALL_YAO } from '../src/data/iching/hexagramProfile'

describe('案例分级（五级）', () => {
  it('五级定义完整：文本理解 / 结构分析 / 解释比较 / 反例 / 综合分析', () => {
    for (let lv = 1; lv <= 5; lv++) {
      expect(CASE_LEVELS[lv]).toBeTruthy()
      expect(CASE_LEVELS[lv].level).toBe(lv)
      expect(typeof CASE_LEVELS[lv].label).toBe('string')
      expect(typeof CASE_LEVELS[lv].tip).toBe('string')
    }
  })
})

describe('案例↔卦/爻 反查', () => {
  it('存在易经案例，且全部 category === iching', () => {
    expect(ICHING_CASES.length).toBeGreaterThan(0)
    for (const c of ICHING_CASES) expect(c.category).toBe('iching')
  })

  it('casesForHexagram：每卦都有案例，引用结构完整且可反查', () => {
    for (const p of HEXAGRAM_PROFILES) {
      const refs = casesForHexagram(p.number)
      expect(refs.length, `${p.name} 应至少有案例`).toBeGreaterThan(0)
      for (const r of refs) {
        expect(getCaseById(r.id)).toBeTruthy()
        expect(r.caseLevel).toBeGreaterThanOrEqual(1)
        expect(r.caseLevel).toBeLessThanOrEqual(5)
        expect(typeof r.levelLabel).toBe('string')
        expect(Array.isArray(r.errorTypes)).toBe(true)
        expect(Array.isArray(r.nodeIds)).toBe(true)
      }
    }
  })

  it('casesForYao：返回 { cases, dedicated, suggestions }，suggestions 五类齐全', () => {
    for (const y of ALL_YAO) {
      const parts = y.id.split('-') // hx-{seq}-{index}
      const seq = Number(parts[1])
      const index = Number(parts[2])
      const res = casesForYao(seq, index)
      expect(Array.isArray(res.cases)).toBe(true)
      expect(typeof res.dedicated).toBe('boolean')
      expect(res.suggestions).toBeTruthy()
      for (const k of ['adjacent', 'sameHex', 'structure', 'classic', 'tradition']) {
        expect(typeof res.suggestions[k], `${y.id} 缺建议 ${k}`).toBe('string')
      }
    }
  })

  it('384 爻的 cases 已确定性接入（不保持空数组，也不批量虚构）', () => {
    for (const y of ALL_YAO) {
      expect(Array.isArray(y.cases)).toBe(true)
      expect(y.cases.length, `${y.id} 应有案例`).toBeGreaterThan(0)
      // 每条 caseId 均可反查到真实案例
      for (const cid of y.cases) expect(getCaseById(cid)).toBeTruthy()
    }
  })

  it('案例可反查知识节点 nodeIds 与 errorTypes', () => {
    for (const c of ICHING_CASES) {
      const refs = caseKnowledgeRefs(c.id)
      expect(refs, `${c.id} 无法反查`).toBeTruthy()
      expect(refs.category).toBe('iching')
      expect(Array.isArray(refs.knowledgeNodeIds)).toBe(true)
      expect(Array.isArray(refs.errorTypes)).toBe(true)
    }
  })

  it('errorType 统一为 E0X 格式', () => {
    for (const c of ICHING_CASES) {
      for (const e of caseKnowledgeRefs(c.id).errorTypes) {
        expect(e, `${c.id} 的错误码格式异常`).toMatch(/^E\d{2}$/)
      }
    }
  })
})