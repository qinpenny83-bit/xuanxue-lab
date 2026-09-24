// ============================================================
// 信心校准：把「我很有把握」和「实际判断质量」放在一起比较。
// 过度自信 vs 信心不足 vs 校准良好。
// ============================================================

export function calibrateConfidence(confidence, actualQuality) {
  const conf = Number(confidence)
  const actual = Number(actualQuality)
  const delta = conf - actual

  if (delta >= 25) {
    return {
      verdict: '过度自信',
      delta,
      advice: '你有一点过度自信了。证据不够时，要学会说「我不确定」。',
      hint: '下一阶段会专门训练你：什么时候该说「我不确定」。',
    }
  }
  if (delta <= -25) {
    return {
      verdict: '信心不足',
      delta,
      advice: '你其实已经会了，只是对自己的判断不够有信心。',
      hint: '多留意你已经做对的地方，大胆一点。',
    }
  }
  return {
    verdict: '校准良好',
    delta,
    advice: '你的信心和实际判断质量基本一致，这是很可贵的分析素养。',
    hint: '保持这个校准感，它会让你在复杂案例里更稳。',
  }
}

export function calibrationSummary(history) {
  if (!history || history.length === 0) return { ready: false, verdict: '暂无记录', ratio: 0 }
  const good = history.filter((h) => Math.abs((h.confidence || 0) - (h.actual || 0)) <= 20).length
  const ratio = Math.round((good / history.length) * 100)
  let verdict = '校准良好'
  if (ratio < 40) verdict = '经常过度自信'
  else if (ratio < 70) verdict = '信心偶有偏差'
  return { ready: true, verdict, ratio }
}