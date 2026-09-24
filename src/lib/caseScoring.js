// ============================================================
// 案例评分引擎：把「作答过程」变成多维能力评估（0–100）。
// 维度：找信息 / 规则理解 / 推理完整度 / 考虑反例 / 避免过度推断。
// V1.5 新增：evidence（证据强度）、open（无唯一答案），并输出 actualQuality 供信心校准。
// V1.6 新增：boundary（判断边界）+ 「我目前无法判断」选项：
//   证据不足时选「不知道」→ 正向；证据充分却选「不知道」→ 识别过度谨慎。
// ============================================================

export const DIMENSION_LABELS = {
  info: '找信息能力',
  rule: '规则理解',
  reasoning: '推理完整度',
  counter: '考虑反例',
  over: '避免过度推断',
  boundary: '判断边界',
}

// V1.6.1：「目前无法判断」的可选理由（用户选完理由后进入画像统计）
export const UNKNOWN_REASONS = ['missing-evidence', 'conflict', 'multi', 'knowledge']

const OVER_ERRORS = ['E01', 'E02', 'E06', 'E07', 'E08']

// answers: { [challengeIndex]: value }
//  - choice/conclusion/why/counter/boundary: 选中的 option index
//  - evidence: 选中的 option index（证据强度 弱/一般/较强/很强）
//  - open: 选中的 option index（带 quality / overreach，无唯一答案）
//  - classify: 被勾选为「证据」的 item.text 数组
//  - confidence: 0–100
//  - option.isUnknown: true 表示「目前无法判断」，进入 boundary 维度
//  - answers.unknownReason: 'missing-evidence' | 'conflict' | 'multi' | 'knowledge' | 'other'（V1.6.1）
export function scoreCase(caseDef, answers = {}) {
  const acc = {
    infoT: 0, infoN: 0,
    ruleT: 0, ruleN: 0,
    reasoningT: 0, reasoningN: 0,
    counterT: 0, counterN: 0,
    boundaryT: 0, boundaryN: 0,
  }
  let classifyInfo = null
  let overPenalty = 0
  let confidenceValue = null
  let overconfident = false
  const notes = []
  const infoSufficiency = caseDef.infoSufficiency // 'sufficient' | 'insufficient' | undefined
  const infoConflict = !!caseDef.infoConflict // V1.6.1：信息互相冲突
  const unknownReason = answers.unknownReason // V1.6.1：「目前无法判断」的理由
  // V2：提示依赖 / 知识查阅 / 信念修正 / 双解释 / 模式 / 无法判断标记
  const hintDependencyRaw = Math.min(5, Number(answers.hintCount) || 0)
  const consultedKnowledge = !!answers.consultedKnowledge
  const mode = caseDef.mode || (caseDef.level >= 4 ? 'semi' : 'guided')
  let beliefRevision = null
  let dualQuality = null
  let usedUnknown = false

  caseDef.challenges.forEach((ch, idx) => {
    const ans = answers[idx]
    if (ans === undefined || ans === null) return

    if (ch.type === 'classify') {
      const selected = Array.isArray(ans) ? ans : []
      const evidences = ch.items.filter((i) => i.kind === 'evidence').map((i) => i.text)
      const backgrounds = ch.items.filter((i) => i.kind === 'background').map((i) => i.text)
      const correctSelected = evidences.filter((e) => selected.includes(e)).length
      const correctUnselected = backgrounds.filter((b) => !selected.includes(b)).length
      classifyInfo = ((correctSelected + correctUnselected) / ch.items.length) * 100
      return
    }

    if (ch.type === 'confidence') {
      confidenceValue = Number(ans)
      // 极度自信却未给出强推理时，判定为「过度自信」
      if (confidenceValue >= 90 && acc.reasoningN > 0 && acc.reasoningT / acc.reasoningN < 2.5) {
        overPenalty += 15
        overconfident = true
      }
      return
    }

    // V1.6.1：evidence / open 类型同样支持「目前无法判断」→ 落入判断边界评分
    if (ch.type === 'open' && ans !== 'unknown') {
      const option = ch.options[ans]
      if (!option) return
      const quality = Number(option.quality ?? 0)
      acc.reasoningT += (quality / 100) * 3 // 把 0–100 归一化到 0–3 分制
      acc.reasoningN += 1
      if (option.overreach) {
        overPenalty += 20
        notes.push(`「${option.text.slice(0, 12)}…」用单一证据下重结论，属于过度推断，扣减避免过度推断分。`)
      }
      return
    }

    if (ch.type === 'evidence' && ans !== 'unknown') {
      const option = ch.options[ans]
      if (!option) return
      const pts = option.points ?? 0
      acc.infoT += pts
      acc.infoN += 1
      if (option.errorType && OVER_ERRORS.includes(option.errorType)) {
        overPenalty += 20
        notes.push(`「${option.text.slice(0, 12)}…」对证据强度的判断有偏差（${errorLabel(option.errorType)}），扣减避免过度推断分。`)
      }
      return
    }

    // V2：独立分析（自由文本）—— 确定性启发式评分（长度 + 关键线索词命中）
    if (ch.type === 'analysis') {
      const text = typeof ans === 'string' ? ans.trim() : ''
      if (text.length > 0) {
        const kws = ch.keywords || []
        const hits = kws.filter((k) => text.includes(k)).length
        const lengthScore = Math.min(70, 20 + text.length * 0.6)
        const kwScore = hits >= 2 ? 100 : hits === 1 ? 75 : 40
        const s = ((lengthScore * 0.5 + kwScore * 0.5) / 100) * 3 // 归一化到 0–3 分制
        acc.infoT += s
        acc.infoN += 1
        acc.reasoningT += s
        acc.reasoningN += 1
        acc.ruleT += s * 0.5
        acc.ruleN += 1
      } else {
        acc.infoT += 0
        acc.infoN += 1
        acc.reasoningT += 0
        acc.reasoningN += 1
      }
      return
    }

    // V2：信念修正（新增信息 → 会不会改变判断）
    if (ch.type === 'revision') {
      if (ans !== 'unknown') {
        const opt = ch.options[ans]
        if (!opt) return
        beliefRevision = opt.value || null
        acc.reasoningT += opt.points ?? 0
        acc.reasoningN += 1
        if (opt.errorType && OVER_ERRORS.includes(opt.errorType)) {
          overPenalty += 20
          notes.push(`「${opt.text.slice(0, 12)}…」拒绝在信息变化时修正判断，扣减避免过度推断分。`)
        }
      }
      return
    }

    // V2：反事实挑战（如果 X 不存在 / 相反，你还能解释吗）
    if (ch.type === 'counterfactual') {
      if (ans !== 'unknown') {
        const opt = ch.options[ans]
        if (!opt) return
        acc.counterT += opt.points ?? 0
        acc.counterN += 1
        if (opt.errorType && OVER_ERRORS.includes(opt.errorType)) {
          overPenalty += 20
          notes.push(`「${opt.text.slice(0, 12)}…」无法在反事实条件下调整解释，扣减反例意识。`)
        }
      }
      return
    }

    // V2：双解释挑战（解释 A / B，哪个证据支持更多）
    if (ch.type === 'dual') {
      if (ans !== 'unknown') {
        const opt = ch.options[ans]
        if (!opt) return
        acc.reasoningT += opt.points ?? 0
        acc.reasoningN += 1
        if (opt.dualQuality === 'good') dualQuality = 'good'
        if (opt.errorType && OVER_ERRORS.includes(opt.errorType)) {
          overPenalty += 20
          notes.push(`「${opt.text.slice(0, 12)}…」把「能对上」当成了「被证实」，扣减避免过度推断分。`)
        }
      }
      return
    }

    // boundary / choice / why / conclusion / counter
    // 「我目前无法判断」以特殊答案标记进入（显式 isUnknown 选项同样生效）
    const isUnknownAnswer = ans === 'unknown'
    const option = isUnknownAnswer ? { isUnknown: true } : ch.options[ans]
    if (!option) return

    // 「目前无法判断」：进入判断边界维度（V1.6.1 四种情况）
    if (option.isUnknown) {
      usedUnknown = true
      const hasReason = UNKNOWN_REASONS.includes(unknownReason)
      if (!hasReason) {
        // 情况 D：选择了「无法判断」但没有说明理由 → 不给满分
        acc.boundaryT += 1.5
        acc.boundaryN += 1
        notes.push('保留判断是合理的，但下一步应该说明：到底缺少哪条信息？')
      } else if (infoConflict) {
        // 情况 C：信息互相冲突 → 高分（注意到了冲突，没有强行解释）
        acc.boundaryT += 3
        acc.boundaryN += 1
        notes.push('你注意到了信息之间的冲突，没有强行解释——这是判断边界意识。')
      } else if (infoSufficiency === 'insufficient') {
        // 情况 A：证据明显不足 → 判断边界满分
        acc.boundaryT += 3
        acc.boundaryN += 1
        notes.push('证据不足时选择「不判断」，这是判断边界意识——知道什么时候不该下结论。')
      } else if (infoSufficiency === 'sufficient') {
        // 情况 B：证据充分却选「无法判断」→ 识别过度谨慎
        acc.boundaryT += 1
        acc.boundaryN += 1
        overPenalty += 15
        notes.push('证据其实已经足够，你却选择了「不判断」——可能存在过度谨慎，低估了已有信息。')
      } else {
        // 中性案例 + 有理由 → 中上评价
        acc.boundaryT += 2.5
        acc.boundaryN += 1
      }
      return
    }

    const pts = option.points ?? 0
    if (ch.type === 'boundary') {
      acc.boundaryT += pts
      acc.boundaryN += 1
    } else if (ch.type === 'choice' || ch.type === 'why') {
      acc.ruleT += pts
      acc.ruleN += 1
    } else if (ch.type === 'conclusion') {
      acc.reasoningT += pts
      acc.reasoningN += 1
    } else if (ch.type === 'counter') {
      acc.counterT += pts
      acc.counterN += 1
    }

    if (option.errorType && OVER_ERRORS.includes(option.errorType)) {
      overPenalty += 20
      notes.push(`「${option.text.slice(0, 12)}…」这条选择体现了「${errorLabel(option.errorType)}」，扣减避免过度推断分。`)
    }
  })

  const rule = acc.ruleN ? (acc.ruleT / (acc.ruleN * 3)) * 100 : 50
  const reasoning = acc.reasoningN ? (acc.reasoningT / (acc.reasoningN * 3)) * 100 : 50
  const counter = acc.counterN ? (acc.counterT / (acc.counterN * 3)) * 100 : 50
  const boundary = acc.boundaryN ? (acc.boundaryT / (acc.boundaryN * 3)) * 100 : 50

  // 找信息：classify 与 evidence 综合
  let info
  if (classifyInfo !== null && acc.infoN) {
    const evScore = (acc.infoT / (acc.infoN * 3)) * 100
    info = (classifyInfo + evScore) / 2
  } else if (classifyInfo !== null) {
    info = classifyInfo
  } else if (acc.infoN) {
    info = (acc.infoT / (acc.infoN * 3)) * 100
  } else {
    info = 50 // 未作答时的中性基线
  }

  const over = clamp(100 - overPenalty, 0, 100)

  const dimensions = {
    info: round(info),
    rule: round(rule),
    reasoning: round(reasoning),
    counter: round(counter),
    over: round(over),
    boundary: round(boundary),
  }
  const total = round(
    dimensions.info * 0.15 +
      dimensions.rule * 0.2 +
      dimensions.reasoning * 0.2 +
      dimensions.counter * 0.15 +
      dimensions.over * 0.15 +
      dimensions.boundary * 0.15,
  )

  const biggest = biggestIssue(dimensions)
  if (overconfident) notes.push('你在证据不足时给出了过高的信心，这对「避免过度推断」不利。')

  return {
    total,
    actualQuality: total, // 供信心校准对比使用
    confidence: confidenceValue,
    dimensions,
    labels: DIMENSION_LABELS,
    notes,
    biggestIssue: biggest,
    // V2：行为元数据（进入 masteryProfile / 出师报告）
    hintDependency: hintDependencyRaw * 20, // 0–100（0 次提示 = 0 依赖，5 次 = 100）
    consultedKnowledge,
    beliefRevision,
    dualQuality,
    mode,
    usedUnknown,
  }
}

function errorLabel(code) {
  const map = {
    E01: '单一变量直接下结论',
    E02: '把传统观点当作科学事实',
    E03: '忽略整体结构',
    E04: '忽略时间变化',
    E05: '忽略现实信息',
    E06: '过度解释',
    E07: '只寻找支持自己的证据',
    E08: '把相关性当因果性',
    E09: '记住结论但不会推理',
    E10: '术语混淆',
  }
  return map[code] || '推理瑕疵'
}

function biggestIssue(dimensions) {
  const entries = Object.entries(dimensions)
  entries.sort((a, b) => a[1] - b[1])
  const [key, val] = entries[0]
  if (val >= 70) return '各项能力比较均衡，继续保持，可以尝试更高难度的案例。'
  const tips = {
    info: '你现在最大的问题不是不会看，而是信息还没有分清楚哪些是「证据」、哪些只是「背景」。',
    rule: '你对规则还停留在「知道」，没有真正「会用」，建议回到地图重练对应节点。',
    reasoning: '你容易从一个信息直接跳到结论，中间缺少完整的推理链条。',
    counter: '你很少主动考虑反例，建议在做结论前习惯性问一句「反过来会怎样」。',
    over: '你存在过度推断的倾向：证据不够就下了很确定的结论。',
    boundary: '你还没掌握「什么时候该下结论、什么时候该说不确定」。该停的时候，试着停下来。',
  }
  return tips[key] || '还有提升空间。'
}

function round(n) {
  return Math.round(n)
}
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}