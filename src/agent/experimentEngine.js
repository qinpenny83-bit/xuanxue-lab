// ============================================================
// R3 Phase 2 · Experiment Engine（实验引擎，纯逻辑可测试）
//
// 实验不是「看内容→点完成」，而是：
//   问题 → 提出假设 → 预测 → 抽取样本 → 观察 → 记证据 →
//   主动找反例 → 判断是否修改 → 形成新结论 → 复盘
// 每步产生真实 Evidence（source=experiment），最终产出
// ExperimentResult + BeliefRevision，并进入 LearningState。
// deterministic：样本用已建的 sampleExperiment(seed 可复现)。
// ============================================================

import { getExperimentV3, sampleExperiment, TEN_STEP_TEMPLATE } from '../data/experiments-v3'

export const STEP_KEYS = TEN_STEP_TEMPLATE.map((s) => s.key)

// 每步 → Evidence action（question 不产生 Evidence）
export const STEP_ACTIONS = {
  question: null,
  hypothesis: 'hypothesis',
  predict: 'predict',
  sample: 'sample',
  observe: 'observe',
  evidence: 'evidence',
  counterexample: 'counterexample',
  revise: 'revise',
  conclusion: 'construct',
  reflect: 'reflect',
}

export function startExperiment(experimentOrId, opts = {}) {
  const exp = typeof experimentOrId === 'string' ? getExperimentV3(experimentOrId) : experimentOrId
  if (!exp) return null
  const timestamp = opts.timestamp ?? Date.now()
  const seed = opts.seed ?? `${exp.seed ?? exp.id}`
  const sample = sampleExperiment(exp, { seed, count: opts.count ?? 6 })
  return {
    runId: opts.runId ?? `run-${exp.id}-${timestamp}`,
    experimentId: exp.id,
    category: exp.category,
    title: exp.title,
    question: exp.question,
    seededHypothesis: exp.hypothesis,
    sample: sample.map((s) => ({
      type: s.type,
      id: s.id ?? `${s.seq}-${s.pos}`,
      targetId: s.targetId ?? s.id ?? `${s.seq}-${s.pos}`,
      label: s.label ?? s.title ?? s.name ?? null,
      seq: s.seq ?? null,
      pos: s.pos ?? null,
    })),
    steps: {},
    startedAt: timestamp,
  }
}

// 记录一步，返回「更新后的 run」与「此步应写入的 Evidence partial[]」
export function recordStep(run, stepKey, value, opts = {}) {
  if (!run || !STEP_KEYS.includes(stepKey)) return { run, evidence: [] }
  const action = STEP_ACTIONS[stepKey] || null
  const entry = { key: stepKey, value, at: opts.timestamp ?? Date.now() }
  if (stepKey === 'hypothesis' || stepKey === 'conclusion') {
    entry.confidence = typeof opts.confidence === 'number' ? opts.confidence : null
  }
  const next = { ...run, steps: { ...(run.steps || {}), [stepKey]: entry } }
  const evidence = []
  if (action) {
    evidence.push({
      source: 'experiment',
      action,
      targetType: 'experiment',
      targetId: run.experimentId,
      context: typeof value === 'string' ? value : (value && value.text) || '',
      result: typeof value === 'object' && value !== null ? value : null,
      confidence: entry.confidence ?? null,
      metadata: { step: stepKey, runId: run.runId },
    })
  }
  return { run: next, evidence }
}

// BeliefRevision：核心成长指标——「用户有没有根据证据修改自己的解释」
export function buildBeliefRevision(run, opts = {}) {
  if (!run) return null
  const h = run.steps?.hypothesis
  const c = run.steps?.conclusion
  const textOf = (x) => (typeof x === 'string' ? x : x?.text ?? '')
  const originalClaim = textOf(h?.value)
  const revisedClaim = textOf(c?.value)
  if (!originalClaim.trim() && !revisedClaim.trim()) return null

  const counteritems = []
  const ce = run.steps?.counterexample
  if (ce?.value) counteritems.push(textOf(ce.value))
  const obs = run.steps?.observe
  if (obs?.value) counteritems.push(textOf(obs.value))

  const reason = run.steps?.revise?.value ?? run.steps?.reflect?.value ?? null
  return {
    originalClaim: originalClaim.trim() || null,
    originalConfidence: h?.confidence ?? null,
    counterEvidence: counteritems.filter((x) => x && String(x).trim()),
    revisedClaim: revisedClaim.trim() || null,
    revisedConfidence: c?.confidence ?? null,
    reason: textOf(reason) || null,
    timestamp: opts.timestamp ?? Date.now(),
  }
}

// 由 run 生成 ExperimentResult（含 BeliefRevision）
export function buildExperimentResult(run, opts = {}) {
  if (!run) return null
  const completedAt = opts.timestamp ?? Date.now()
  const beliefRevision = buildBeliefRevision(run, { timestamp: completedAt })
  const val = (k) => {
    const e = run.steps?.[k]
    if (!e) return { value: null, confidence: null }
    return { value: e.value ?? null, confidence: e.confidence ?? null }
  }
  return {
    runId: run.runId,
    experimentId: run.experimentId,
    category: run.category,
    title: run.title,
    question: run.question,
    hypothesis: val('hypothesis').value,
    hypothesisConfidence: val('hypothesis').confidence,
    predict: val('predict').value ?? null,
    sample: run.sample || [],
    observe: val('observe').value ?? null,
    evidence: val('evidence').value ?? null,
    counterexample: val('counterexample').value ?? null,
    revise: val('revise').value ?? null,
    conclusion: val('conclusion').value ?? null,
    conclusionConfidence: val('conclusion').confidence,
    reflect: val('reflect').value ?? null,
    beliefRevision,
    completedAt,
  }
}

// 把 run 的每一步译为 Evidence partial（测试/持久化共用）
export function runEvidencePartials(run) {
  if (!run) return []
  const out = []
  for (const k of STEP_KEYS) {
    const e = run.steps?.[k]
    if (!e) continue
    const action = STEP_ACTIONS[k]
    if (!action) continue
    out.push({
      source: 'experiment',
      action,
      targetType: 'experiment',
      targetId: run.experimentId,
      context: typeof e.value === 'string' ? e.value : (e.value && e.value.text) || '',
      result: typeof e.value === 'object' && e.value !== null ? e.value : null,
      confidence: e.confidence ?? null,
      metadata: { step: k, runId: run.runId },
    })
  }
  return out
}

// Experiment Archive：把若干 run 组织成「我的易学推理实验记录」
export function buildExperimentArchive(runs) {
  const arr = Array.isArray(runs) ? runs : []
  const revisions = []
  const byExperiment = {}
  for (const r of arr) {
    const br = r.beliefRevision || buildBeliefRevision(r)
    if (br) revisions.push({ ...br, runId: r.runId, experimentId: r.experimentId, title: r.title })
    byExperiment[r.experimentId] ||= { experimentId: r.experimentId, title: r.title, category: r.category, runs: [] }
    byExperiment[r.experimentId].runs.push({
      runId: r.runId,
      hypothesis: r.hypothesis ?? null,
      conclusion: r.conclusion ?? null,
      counterexample: r.counterexample ?? null,
      beliefRevision: br,
      completedAt: r.completedAt ?? null,
    })
  }
  return {
    runCount: arr.length,
    hypothesisCount: revisions.filter((r) => r.originalClaim).length,
    counterexampleCount: revisions.filter((r) => (r.counterEvidence || []).length > 0).length,
    revisionCount: revisions.length,
    beliefRevisions: revisions,
    byExperiment: Object.values(byExperiment),
  }
}