// ============================================================
// R3 Phase 1 · 全量数据引用完整性检查
//
// 目标：保证知识图谱里的每一条引用都「解析得到真实对象」，
//       任何悬空引用都暴露为 errors（用于测试断言，运行时不打断）。
// 覆盖的引用类型：hexagramId / yaoId / termId / classicId / traditionId / caseId。
// ============================================================

import {
  HEXAGRAM_PROFILES,
  getYaoById,
  TRADITION_REF,
} from '../data/iching/hexagramProfile'
import { TERM_BY_ID } from '../data/iching/termData'
import { CLASSIC_PASSAGES, daXiangPassage, getClassicPassage } from '../data/iching/classic-passages'
import { getCaseById } from '../data/iching/caseGraph'
import { HEXAGRAMS } from '../data/iching/hexagrams-data'
import { CASES } from '../data/cases'

const TRADITION_KEYS = new Set(TRADITION_REF.map((t) => t.key))
const TRADITION_NODES = new Set(TRADITION_REF.map((t) => t.node))

// 经典 id 全集：系辞/文言等静态片段 + 64 条大象（dx-${seq}）
function buildClassicIdSet() {
  const set = new Set(CLASSIC_PASSAGES.map((p) => p.id))
  for (const h of HEXAGRAMS) {
    const d = daXiangPassage(h.seq)
    if (d) set.add(d.id)
  }
  return set
}

// 引用类型 → 空间标签（供报告分类与测试断言）
const SPACES = ['hexagram', 'yao', 'term', 'classic', 'tradition', 'case']

export function checkDataIntegrity() {
  const errors = [] // { space, msg }
  const push = (space, msg) => errors.push({ space, msg })

  const hexSeqs = new Set(HEXAGRAMS.map((h) => h.seq))
  const classicIds = buildClassicIdSet()

  // 1) 卦档案：经典 / 案例 / 错综互 / 爻的引用
  for (const p of HEXAGRAM_PROFILES) {
    const seq = p.number
    if (!hexSeqs.has(seq)) push('hexagram', `卦档案 seq 悬空：${seq}`)

    for (const cid of p.classicPassageIds || []) {
      if (!classicIds.has(cid)) push('classic', `卦 ${seq} 引用悬空 classicId：${cid}`)
    }
    for (const csid of p.caseIds || []) {
      if (!getCaseById(csid)) push('case', `卦 ${seq} 引用悬空 caseId：${csid}`)
    }
    for (const r of p.relations || []) {
      if (r.target != null && !hexSeqs.has(r.target)) {
        push('hexagram', `卦 ${seq} 错/综/互引用悬空 hexagramId：${r.target}`)
      }
    }
    for (const y of p.yao || []) {
      if (!getYaoById(y.id)) push('yao', `无法解析爻 id：${y.id}`)
      if (y.hexagramId !== seq) {
        push('yao', `爻 ${y.id} 的 hexagramId（${y.hexagramId}）与所属卦（${seq}）不一致`)
      }
      for (const cid of y.classicPassageIds || []) {
        if (!classicIds.has(cid)) push('classic', `爻 ${y.id} 引用悬空 classicId：${cid}`)
      }
      for (const csid of y.cases || []) {
        if (!getCaseById(csid)) push('case', `爻 ${y.id} 引用悬空 caseId：${csid}`)
      }
    }
  }

  // 2) 术语：关联术语 / 经典 / 解释传统 的引用
  for (const t of Object.values(TERM_BY_ID)) {
    for (const rid of t.relatedTermIds || []) {
      if (!TERM_BY_ID[rid]) push('term', `术语 ${t.id} 引用悬空 termId：${rid}`)
    }
    for (const cid of t.classicPassageIds || []) {
      if (!classicIds.has(cid)) push('classic', `术语 ${t.id} 引用悬空 classicId：${cid}`)
    }
    for (const tid of t.traditionIds || []) {
      // 术语的 traditionIds 实际使用「课程节点 id」（yx-*），
      // 因此同时接受 key 与 node 两种写法；两者之外的视为悬空。
      if (!TRADITION_KEYS.has(tid) && !TRADITION_NODES.has(tid)) {
        push('tradition', `术语 ${t.id} 引用悬空 traditionId：${tid}`)
      }
    }
  }

  // 3) 经典片段：相关卦 / 相关爻 的引用（relatedTerms 为中文名称软引用，不受此检查约束）
  for (const p of CLASSIC_PASSAGES) {
    for (const seq of p.relatedHexagrams || []) {
      if (!hexSeqs.has(seq)) push('hexagram', `经典 ${p.id} 引用悬空 hexagramId：${seq}`)
    }
    for (const yid of p.relatedYaos || []) {
      if (!getYaoById(yid)) push('yao', `经典 ${p.id} 引用悬空 yaoId：${yid}`)
    }
  }

  // 4) 大象：相关卦必须有效
  for (const h of HEXAGRAMS) {
    const d = daXiangPassage(h.seq)
    if (!d) continue
    for (const seq of d.relatedHexagrams || []) {
      if (!hexSeqs.has(seq)) push('hexagram', `大象 dx-${h.seq} 引用悬空 hexagramId：${seq}`)
    }
  }

  const bySpace = {}
  for (const s of SPACES) bySpace[s] = errors.filter((e) => e.space === s)

  return {
    errors,
    bySpace,
    passed: errors.length === 0,
    counts: {
      hexagrams: HEXAGRAM_PROFILES.length,
      yaos: HEXAGRAM_PROFILES.reduce((a, p) => a + p.yao.length, 0),
      terms: Object.keys(TERM_BY_ID).length,
      classics: classicIds.size,
      cases: CASES.length,
      traditions: TRADITION_REF.length,
    },
  }
}

export function hasDanglingReferences() {
  return checkDataIntegrity().errors.length > 0
}

export { getClassicPassage }