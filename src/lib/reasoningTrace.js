// ============================================================
// 推理轨迹与重做比较（V1.6）：
//   1. buildTrace：把一次案例的作答过程还原成「推理路径」；
//   2. traceHabit：从路径中识别用户的思维习惯与更好的做法；
//   3. correctionVerdict：比较第一次/第二次，识别「真正的进步」。
// 不替用户完成推理，只标记路径上的关键节点。
// ============================================================

const LETTERS = ['A', 'B', 'C', 'D', 'E']

export function buildTrace(caseDef, answers = {}, result = null) {
  const nodes = []
  caseDef.challenges.forEach((ch, idx) => {
    const ans = answers[idx]
    if (ans === undefined || ans === null || ans === '') return

    if (ch.type === 'classify') {
      const selected = Array.isArray(ans) ? ans : []
      nodes.push({
        step: idx + 1,
        icon: '🔎',
        label: '整理信息',
        text: `你从 ${ch.items.length} 条信息中，选出 ${selected.length} 条作为证据。`,
      })
      return
    }

    // V2：独立分析（自由文本）—— 你的分析路径本身
    if (ch.type === 'analysis') {
      const text = typeof ans === 'string' ? ans.trim() : ''
      nodes.push({
        step: idx + 1,
        icon: '✍️',
        label: '独立分析',
        text: text.length > 32 ? `你的分析：「${text.slice(0, 32)}…」` : text ? `你的分析：「${text}」` : '（未填写分析）',
      })
      return
    }

    if (ch.type === 'confidence') {
      nodes.push({
        step: idx + 1,
        icon: '🎯',
        label: '信心',
        text: `你的信心：${Number(ans)}%`,
      })
      return
    }

    // 「我目前无法判断」的轨迹节点
    if (ans === 'unknown') {
      nodes.push({
        step: idx + 1,
        icon: '🚦',
        label: '判断边界',
        text: '你选择：我目前无法判断（不硬下结论）',
        isUnknown: true,
      })
      return
    }

    const option = ch.options[ans]
    if (!option) return

    const isUnknown = !!option.isUnknown
    const iconMap = {
      choice: '🧩', why: '🧩', boundary: '🚦', conclusion: '💡', counter: '⚖️', evidence: '🔎', open: '🧭',
      revision: '🔄', counterfactual: '🔁', dual: '⚖️',
    }
    const labelMap = {
      choice: '选择规则', why: '解释原因', boundary: '判断边界', conclusion: '形成判断', counter: '反例检验', evidence: '证据强度', open: '开放判断',
      revision: '信念修正', counterfactual: '反事实检验', dual: '双解释比较',
    }
    const text = isUnknown
      ? '你选择：我目前无法判断（不硬下结论）'
      : `你选择：「${option.text.slice(0, 18)}${option.text.length > 18 ? '…' : ''}」`

    nodes.push({
      step: idx + 1,
      icon: iconMap[ch.type] || '•',
      label: labelMap[ch.type] || ch.type,
      text,
      isConclusion: ch.type === 'conclusion' && !isUnknown,
      isCounter: ch.type === 'counter',
      counterActive: ch.type === 'counter' && (option.points ?? 0) >= 3,
      isUnknown,
    })
  })

  // V1.6.1：在轨迹里补上「证据评分」节点（来自真实评分结果，不伪造用户操作）
  if (result && result.dimensions) {
    const over = result.dimensions.over
    if (typeof over === 'number') {
      const risk = over < 55
      const evidenceNode = {
        step: nodes.length + 1,
        icon: '⚖️',
        label: '证据评分',
        text:
          over >= 70
            ? `这次结论的证据支撑：${over}/100——证据够扎实，方向站得住。`
            : over >= 55
              ? `这次结论的证据支撑：${over}/100——中等，还可以再稳一点。`
              : `这次结论的证据支撑：${over}/100——单薄，结论偏冒险。`,
        risk,
        riskText: risk ? '这里出现了一个风险：你在证据还不充分时已经形成结论。' : null,
      }
      const conclusionIdx = nodes.findIndex((n) => n.isConclusion)
      nodes.splice(conclusionIdx >= 0 ? conclusionIdx + 1 : nodes.length, 0, evidenceNode)
    }
  }
  return nodes
}

// 识别习惯：过早形成方向 / 没考虑反例 / 边界意识
export function traceHabit(trace, result) {
  const conclusionIdx = trace.findIndex((n) => n.isConclusion)
  const counterNode = trace.find((n) => n.isCounter)
  const unknownNodes = trace.filter((n) => n.isUnknown)
  const dims = result?.dimensions || {}

  let issue = null
  if (conclusionIdx >= 0 && conclusionIdx <= 1 && trace.length > 2) {
    issue = `你在第 ${conclusionIdx + 1} 步就形成了最终方向。`
  } else if (conclusionIdx >= 0 && counterNode && !counterNode.counterActive) {
    issue = '你形成了判断，但没有主动给它找一个反例。'
  } else if (!counterNode && (dims.counter ?? 50) < 50) {
    issue = '这次推理没有经历「反例检验」这一步。'
  }

  // 更好的做法：针对最弱维度
  const worstKey = Object.entries(dims).sort((a, b) => a[1] - b[1])[0]?.[0]
  const betterMap = {
    info: '再寻找一个独立证据，再决定是否下结论。',
    reasoning: '把「线索 → 判断」之间的推理链写完整，再下结论。',
    counter: '下结论前，主动问一句「反过来会怎样」。',
    over: '证据不够时，先承认「我只能给出低置信的判断」。',
    boundary: '分清「证据足够」与「证据不足」，该说不知道时就说不确定。',
  }
  const better = betterMap[worstKey] || '把每一步的依据写清楚，再下结论。'

  return { issue, better, unknownNodes: unknownNodes.length, hasCounterStep: !!counterNode }
}

// 修正能力：比较第一次与第二次（V1.6.1：过程进步优先于分数）
// 不把「答对」直接等同于「成长」：
//   - 分数提高但证据/反例意识没变 → 只说「答案对了」，不夸过程
//   - 分数持平但过程更完整 → 明确肯定「这次真正改善的是推理过程」
export function correctionVerdict(first, second) {
  if (!first || !second) return null
  const d1 = first.dimensions || {}
  const d2 = second.dimensions || {}
  const scoreDelta = second.score - first.score

  const avgDim = (d, key) => (typeof d[key] === 'number' ? d[key] : 50)
  const ev1 = (avgDim(d1, 'info') + avgDim(d1, 'over')) / 2
  const ev2 = (avgDim(d2, 'info') + avgDim(d2, 'over')) / 2
  const counter1 = avgDim(d1, 'counter')
  const counter2 = avgDim(d2, 'counter')
  const boundary1 = avgDim(d1, 'boundary')
  const boundary2 = avgDim(d2, 'boundary')

  const err1 = first.errorTypes || []
  const err2 = second.errorTypes || []
  const counterFixed = err1.includes('E07') && !err2.includes('E07')
  const earlyFixed = err1.includes('E01') && !err2.includes('E01')
  const calibImprove =
    second.confidence != null && first.confidence != null && first.actualQuality != null && second.actualQuality != null
      ? Math.abs(second.confidence - second.actualQuality) < Math.abs(first.confidence - first.actualQuality) - 8
      : false

  const evidenceUp = ev2 - ev1 >= 10
  const counterUp = counter2 - counter1 >= 10
  const boundaryUp = boundary2 - boundary1 >= 10

  const processGains = []
  if (counterFixed || counterUp) processGains.push('主动寻找反例')
  if (evidenceUp) processGains.push('证据意识提升')
  if (boundaryUp) processGains.push('判断边界更清晰')
  if (earlyFixed) processGains.push('不再过早下结论')
  if (calibImprove) processGains.push('信心更接近实际质量')
  const processGained = processGains.length > 0

  if (processGained && scoreDelta >= 8) {
    return {
      tone: 'good',
      title: '这次有明显改善',
      body: `分数从 ${first.score} 提到 ${second.score}（+${scoreDelta}），推理过程也更完整。结论可能变了，也可能没变，但判断质量实打实地提高了。`,
      deltas: [`分数 +${scoreDelta}`, ...processGains],
    }
  }
  if (processGained) {
    return {
      tone: 'good',
      title: '这次真正改善的不是答案，而是你的推理过程',
      body: `第一次你很快形成判断；这一次你${processGains.join('、')}${
        scoreDelta > 0 ? `，分数还提高了 ${scoreDelta} 分` : scoreDelta < 0 ? `，虽然分数略降 ${-scoreDelta} 分` : ''
      }。结论有没有变不重要——这才是这次真正的进步。`,
      deltas: processGains,
    }
  }
  if (scoreDelta >= 8) {
    return {
      tone: 'neutral',
      title: '答案正确了，但推理过程没有明显改善',
      body: `分数从 ${first.score} 提到 ${second.score}（+${scoreDelta}）。但这一次的证据意识、反例意识没有明显变化——答对不等于成长，下一次试着主动改变一个环节。`,
      deltas: [`分数 +${scoreDelta}`],
    }
  }
  if (scoreDelta >= 0) {
    return {
      tone: 'neutral',
      title: '这次保持了稳定',
      body: `分数从 ${first.score} 到 ${second.score}，基本持平。稳定是好事，但下一题可以试着主动改变一个环节（找反例、或更谨慎地标信心）。`,
      deltas: [],
    }
  }
  return {
    tone: 'warn',
    title: '这次反而更不稳',
    body: `分数从 ${first.score} 降到 ${second.score}（-${-scoreDelta}）。别急着归因——案例不同、状态波动都可能。先回看轨迹，找到变弱的那一步。`,
    deltas: [`分数 -${-scoreDelta}`],
  }
}

// ============================================================
// 推理进化时间线（V1.6）：把 caseAttempts 按时间分成阶段，
// 用真实行为描述「你的推理是怎么变化的」。
// 返回 null 表示样本不足；每个阶段必须有行为依据。
// ============================================================

function describePhase(chunk) {
  const n = chunk.length
  const e01 = chunk.filter((a) => (a.errorTypes || []).includes('E01')).length
  const e07 = chunk.filter((a) => (a.errorTypes || []).includes('E07')).length
  const unknown = chunk.filter((a) => a.usedUnknown).length
  const counterGood = chunk.filter((a) => (a.dimensions?.counter ?? 0) >= 70).length
  const boundaryGood = chunk.filter((a) => (a.dimensions?.boundary ?? 0) >= 70).length
  const cautious = chunk.filter((a) => typeof a.confidence === 'number' && typeof a.actualQuality === 'number' && a.confidence < a.actualQuality - 15).length
  const overconfident = chunk.filter((a) => typeof a.confidence === 'number' && typeof a.actualQuality === 'number' && a.confidence > a.actualQuality + 15).length

  const rate = (c) => Math.round((c / n) * 100)

  if (unknown >= 1 && rate(boundaryGood) >= 60) {
    return `学会在证据不足时选择「不判断」（${unknown} 次主动说不确定）`
  }
  if (rate(counterGood) >= 60) {
    return `开始主动寻找反例，遇到冲突信息会重查判断（${counterGood} 次）`
  }
  if (rate(e01) >= 40) {
    return '看到一个线索就下结论（过早判断占比高）'
  }
  if (rate(e07) >= 40) {
    return '容易只找支持自己的证据（确认偏误出现较多）'
  }
  if (rate(cautious) >= 50) {
    return '信心明显低于实际质量——你可能过度怀疑自己'
  }
  if (rate(overconfident) >= 50) {
    return '信心明显高于实际质量——判断先于证据'
  }
  return '各维度比较均衡，推理过程趋于稳定'
}

function phaseLabel(attempts, startIdx, endIdx) {
  const first = new Date(attempts[0].at)
  const last = new Date(attempts[endIdx - 1].at)
  const days = Math.max(0, Math.floor((last - first) / 86400000))
  const week = Math.floor(days / 7) + 1
  return { week: `第 ${week} 周`, range: `第 ${startIdx + 1}–${endIdx} 次` }
}

export function buildEvolutionTimeline(attempts) {
  if (!attempts || attempts.length < 3) return null
  const sorted = [...attempts].sort((a, b) => new Date(a.at) - new Date(b.at))
  const n = sorted.length
  const seg = Math.max(2, Math.ceil(n / 3))
  const phases = []
  for (let s = 0; s < n; s += seg) {
    const chunk = sorted.slice(s, s + seg)
    if (!chunk.length) break
    const desc = describePhase(chunk)
    const { week, range } = phaseLabel(sorted, s, Math.min(s + seg, n))
    phases.push({ week, range, desc, chunkSize: chunk.length })
  }
  return { total: n, phases }
}
