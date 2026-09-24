// ============================================================
// 错误识别系统 E01–E10：把「选错的题」翻译成「思维模式」。
// ============================================================

export const ERROR_TYPES = {
  E01: { code: 'E01', name: '单变量直接下结论', advice: '看到一个信息就想定性结论。慢一点，先多看几个变量。' },
  E02: { code: 'E02', name: '把传统观点当作科学事实', advice: '传统框架是「解释方式」，不是「确定结论」。时刻记得它的边界。' },
  E03: { code: 'E03', name: '忽略整体结构', advice: '孤立地看一个字、一个信息。试着把它放回整体结构里。' },
  E04: { code: 'E04', name: '忽略时间变化', advice: '把某一刻的状态当成永恒。引入大运、流年、人生阶段这些时间维度。' },
  E05: { code: 'E05', name: '忽略现实信息', advice: '只谈命盘、不谈现实。现实证据往往比框架更直接。' },
  E06: { code: 'E06', name: '过度解释', advice: '用一个标签解释一切。给结论留一点「可能不成立」的空间。' },
  E07: { code: 'E07', name: '只寻找支持自己的证据', advice: '先有结论再找证据。每次下结论前，逼自己找一条反对证据。' },
  E08: { code: 'E08', name: '把相关性当因果性', advice: '「同时发生」不等于「一个导致另一个」。' },
  E09: { code: 'E09', name: '记住结论但不会推理', advice: '知道「要查八字」，却说不出为什么。回到原理，重新推一遍。' },
  E10: { code: 'E10', name: '术语混淆', advice: '概念记串了。回到词典，把每个术语的一句话定义过一遍。' },
}

export function recordError(errorPatterns, code) {
  if (!code || !ERROR_TYPES[code]) return errorPatterns
  const next = { ...errorPatterns }
  next[code] = (next[code] || 0) + 1
  return next
}

export function topErrors(errorPatterns, n = 3) {
  return Object.entries(errorPatterns || {})
    .map(([code, count]) => ({ ...ERROR_TYPES[code], code, count }))
    .filter((e) => e.name)
    .sort((a, b) => b.count - a.count)
    .slice(0, n)
}