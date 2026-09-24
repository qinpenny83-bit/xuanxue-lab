// ============================================================
// 探索实验「材料解析」：把 material / compare 引用解析成可读内容。
// 所有解析都是确定性数据查询（卦/爻/经典/传统/案例/术语），
// 不引入随机、不生成新内容；找不到时返回「暂无可靠整理」。
// ============================================================
import { getHexagramProfile, getYao, TRADITION_REF } from '../data/iching/hexagramProfile'
import { getTerm } from '../data/iching/termData'
import { getClassicEntry } from '../agent/workshopEngine'
import { getCaseById } from '../data/iching/caseGraph'

// 简短标签（用于列表/徽章）
export function materialLabel(mat) {
  if (!mat || !mat.kind) return '未知对象'
  try {
    if (mat.kind === 'hexagram') {
      const p = getHexagramProfile(mat.seq)
      return p ? `${p.name}卦（${p.traditionalName}）` : `第 ${mat.seq} 卦`
    }
    if (mat.kind === 'yao') {
      const y = getYao(mat.seq, mat.pos)
      const p = getHexagramProfile(mat.seq)
      return y && p ? `${p.name}·${y.name}` : `卦${mat.seq}·第${(mat.pos || 0) + 1}爻`
    }
    if (mat.kind === 'classic') {
      const c = getClassicEntry(mat.id)
      return c ? `${c.source}·${c.chapter}` : mat.id
    }
    if (mat.kind === 'tradition') {
      const t = TRADITION_REF.find((x) => x.key === mat.id)
      return t ? t.label : mat.id
    }
    if (mat.kind === 'case') {
      const c = getCaseById(mat.id)
      return c ? c.title : mat.id
    }
    if (mat.kind === 'term') {
      const t = getTerm(mat.id)
      return t ? t.term : mat.id
    }
  } catch {
    /* 解析失败时回退 */
  }
  return '暂无可靠整理'
}

// 详细内容（用于查看器正文）
export function materialDetail(mat) {
  if (!mat || !mat.kind) return null
  try {
    if (mat.kind === 'hexagram') {
      const p = getHexagramProfile(mat.seq)
      if (!p) return null
      return {
        label: `${p.name}卦 · ${p.traditionalName}`,
        body: p.guaci || '「暂无可靠整理」',
        note: `上卦${p.upperTrigram || '?'}，下卦${p.lowerTrigram || '?'} · 第 ${p.number} 卦`,
      }
    }
    if (mat.kind === 'yao') {
      const y = getYao(mat.seq, mat.pos)
      const p = getHexagramProfile(mat.seq)
      if (!y) return null
      return {
        label: `${p?.name || mat.seq}·${y.name}`,
        body: y.originalText ? `「${y.originalText}」` : '该爻爻辞全文「暂无可靠整理」。',
        note: `${y.lineType}爻 · ${y.deweiLabel || ''}${y.zhong ? ' · 居中' : ''}`,
      }
    }
    if (mat.kind === 'classic') {
      const c = getClassicEntry(mat.id)
      if (!c) return null
      return {
        label: `${c.source} · ${c.chapter}`,
        body: c.original || '「暂无可靠整理」',
        note: c.traditionalNote || '',
      }
    }
    if (mat.kind === 'tradition') {
      const t = TRADITION_REF.find((x) => x.key === mat.id)
      if (!t) return null
      return {
        label: t.label,
        body: t.note || '',
        note: '',
      }
    }
    if (mat.kind === 'case') {
      const c = getCaseById(mat.id)
      if (!c) return null
      return {
        label: c.title,
        body: c.situation?.join('；') || '',
        note: '',
      }
    }
    if (mat.kind === 'term') {
      const t = getTerm(mat.id)
      if (!t) return null
      return {
        label: t.term,
        body: t.definition || t.summary || '',
        note: '',
      }
    }
  } catch {
    /* 解析失败时回退 */
  }
  return null
}

// 查看器可展示的完整材料块（主材料 + 可选对比对象）
export function resolveExploreMaterials(exp) {
  const main = materialDetail(exp?.material)
  const compare = exp?.compare ? materialDetail(exp.compare) : null
  return {
    mainLabel: materialLabel(exp?.material),
    compareLabel: exp?.compare ? materialLabel(exp.compare) : null,
    main,
    compare,
  }
}
