# Phase 2.5 学习状态闭环修复 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把「Evidence → Mastery → Agent → UI」串成真正闭环，让用户完成一次高质量推理行为后，能力档案、Agent 判断、首页/成长页推荐一起改变。

**Architecture:** 建立唯一能力事实源：`LearningEvidence → deriveMasteryEvidence() → evidenceMasteryContribution() → masteryEngine.computeMasteryProfile() → masteryProfile(L0–L6) → Agent(evidence-first nextAction) → Home/Growth`。旧 fingerprint / recommendation 保留为「无证据时」的兜底，不再是最终推荐来源。所有规则 deterministic，含质量门槛、去重、递减、封顶、防刷。

**Tech Stack:** React 18 + Vite 5 + Vitest 2。纯前端，零外部依赖。

---

## 审计结论（6 个关键问题）

1. **`mastery.contribution` 与 `masteryProfile` 的关系**：前者是 `unifiedLearningState.js` 从 Evidence 派生的维度级贡献（`evidenceMasteryContribution`），是「输入」；后者是 `masteryEngine.js` 只从 `caseAttempts` 算出的最终 8 维 L0–L6，是「输出」。当前输出**完全不吸收**输入 → 两套系统分裂（FAIL 2 的根因）。

2. **L0–L6 如何计算**：`computeMasteryProfile` 从 `caseAttempts` 每案例的 `dimensions{info,rule,reasoning,counter,over,boundary}` 加权平均得到 8 维值，再由 `levelFromValues(values, sampleCount)` 按能力门槛 + 样本量双重门控映射 L0–L6。**证据行为从不进入**。

3. **8 维能力唯一事实源**：应为 `caseAttempts + LearningEvidence → masteryEngine → masteryProfile`。案例行为是权威来源，Evidence 是新的「托底调节」证据来源，同引擎输出唯一等级。

4. **哪些 Evidence 可成为 mastery evidence**：`MASTERY_ACTION_RULES` 中 `mastery:true` 的动作（analyze/compare/interpret/hypothesis/construct/evidence/counterexample/revise/reflect/challenge），且满足内容门槛（requiresContent）与结构门槛（requiresStructure）。

5. **fingerprint 是否仍有独立价值**：有。作为「无 Evidence 记录时」的兜底（新用户默认路径、知识瓶颈、复习优先），与历史兼容；但不再作为最终推荐事实来源。

6. **Home/Growth 为何读旧推荐**：两者都取 `runAgent()` 输出的 `agent.nextAction`，而 `nextAction` 由旧 `pickNextAction` 生成，未整合 `evidenceRecommendation.primary` → 引擎已算出 Evidence 推荐但 UI 从不展示。

---

## 文件结构

- Modify: `src/agent/learningEvidence.js` — Evidence ID 唯一性。
- Create: `src/agent/masteryEvidence.js` — MasteryEvidence 派生 + 质量模型 + contribution。
- Modify: `src/agent/unifiedLearningState.js` — 引用并 re-export 新模块，修正 LOW_UNCERTAINTY 信号。
- Modify: `src/lib/textSignals.js` — SELF_CORRECTION 检测（区分绝对化主张 / 主动修正）。
- Modify: `src/agent/masteryEngine.js` — 合并 Evidence 贡献到唯一 profile。
- Modify: `src/store/reducer.js` — RECORD_EVIDENCE 后重算 profile。
- Modify: `src/data/experiments-v3.js` — 卦/爻描述符补 `id`。
- Modify: `src/agent/experimentEngine.js` — 样本补 `targetId`。
- Modify: `src/agent/localAgentEngine.js` — Evidence-first nextAction。
- Modify: `src/pages/Home.jsx` / `src/pages/Growth.jsx` — 渲染 Evidence-first 推荐 + 可解释理由。
- Modify tests: `tests/r3-phase2-antigaming.test.js`, `tests/r3-phase2-learningstate.test.js`, `tests/r3-phase2-reverse-acceptance.test.js`
- Create: `tests/r3-phase2-5-closed-loop.test.js`

---

## Task 1: 修复 Evidence ID 碰撞

**Files:**
- Modify: `src/agent/learningEvidence.js:74-99`
- Test: `tests/r3-phase2-5-closed-loop.test.js`

- [ ] **Step 1: 写失败测试**

在 `tests/r3-phase2-5-closed-loop.test.js` 顶部：

```js
import { describe, it, expect } from 'vitest'
import { createEvidence } from '../src/agent/learningEvidence'

describe('Evidence ID 唯一性', () => {
  it('同一毫秒写入 100 条也不产生重复 ID', () => {
    const ts = 1600000000000
    const ids = new Set()
    for (let i = 0; i < 100; i++) {
      ids.add(createEvidence({ source: 'workshop', action: 'construct', targetType: 'hexagram', targetId: i, timestamp: ts }).id)
    }
    expect(ids.size).toBe(100)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/r3-phase2-5-closed-loop.test.js -t "Evidence ID"`
Expected: FAIL —— 当前同 source 同 ms 的 id 全部相同。

- [ ] **Step 3: 实现**

在 `src/agent/learningEvidence.js` 顶部（`EVIDENCE_VERSION` 之后）加：

```js
// 进程级递增序号 + 会话熵：保证同一毫秒写入 100 条也不撞 ID。
let idCounter = 0
const SESSION_ENTROPY = Math.random().toString(36).slice(2, 8)
```

替换 `createEvidence` 的 id 行（约 79 行）：

```js
export function createEvidence(partial = {}) {
  const timestamp = partial.timestamp ?? Date.now()
  idCounter += 1
  const seq = partial.__seq != null ? String(partial.__seq) : idCounter.toString(36)
  const ev = {
    version: EVIDENCE_VERSION,
    id: `ev-${partial.source || 'unknown'}-${timestamp}-${seq}-${SESSION_ENTROPY}`,
    timestamp,
    // ...其余字段保持不变
  }
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/r3-phase2-5-closed-loop.test.js -t "Evidence ID"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/agent/learningEvidence.js tests/r3-phase2-5-closed-loop.test.js
git commit -m "fix(evidence): guarantee unique evidence IDs within same millisecond"
```

---

## Task 2: 修复实验样本 undefined ID

**Files:**
- Modify: `src/data/experiments-v3.js:69-86`
- Modify: `src/agent/experimentEngine.js:43-49`
- Test: `tests/r3-phase2-5-closed-loop.test.js`

- [ ] **Step 1: 写失败测试**

```js
import { sampleExperiment, EXPERIMENTS_V3 } from '../src/data/experiments-v3'
import { startExperiment } from '../src/agent/experimentEngine'

describe('实验样本完整性', () => {
  it('全部 30 个实验抽样，每个样本 type/id/targetId 都存在且不含 undefined', () => {
    for (const e of EXPERIMENTS_V3) {
      const run = startExperiment(e.id, { seed: e.id, count: 6, timestamp: 1600000000000 })
      expect(run.sample.length).toBeGreaterThanOrEqual(1)
      for (const s of run.sample) {
        expect(s.type).toBeTruthy()
        expect(s.id).toBeTruthy()
        expect(s.targetId).toBeTruthy()
        expect(String(s.id)).not.toContain('undefined')
        expect(String(s.id)).not.toContain('null')
        expect(String(s.targetId)).not.toContain('undefined')
      }
    }
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/r3-phase2-5-closed-loop.test.js -t "实验样本完整性"`
Expected: FAIL —— 卦/爻描述符缺 `id`，`startExperiment` 拼出 `N-undefined`。

- [ ] **Step 3: 实现**

`src/data/experiments-v3.js` 的 `yaoDescriptor`/`hexagramDescriptor` 补 `id`：

```js
function yaoDescriptor(seq, pos) {
  return { type: 'yao', seq, pos, id: `${seq}-${pos}` }
}
function hexagramDescriptor(seq) {
  return { type: 'hexagram', seq, id: String(seq) }
}
```

`resolveDescriptor` 输出补 `id`：

```js
if (d.type === 'hexagram') {
  const p = getHexagramProfile(d.seq)
  return p ? { type: 'hexagram', id: String(d.seq), seq: d.seq, name: p.name, ref: p } : null
}
if (d.type === 'yao') {
  const y = getYao(d.seq, d.pos)
  return y ? { type: 'yao', id: `${d.seq}-${d.pos}`, seq: d.seq, pos: d.pos, label: `${getHexagramProfile(d.seq)?.name || d.seq}·${y.positionLabel}`, ref: y } : null
}
```

`src/agent/experimentEngine.js` 的 `startExperiment` 样本映射补 `targetId`：

```js
    sample: sample.map((s) => ({
      type: s.type,
      id: s.id ?? `${s.seq}-${s.pos}`,
      targetId: s.targetId ?? s.id ?? `${s.seq}-${s.pos}`,
      label: s.label ?? s.title ?? s.name ?? null,
      seq: s.seq ?? null,
      pos: s.pos ?? null,
    })),
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/r3-phase2-5-closed-loop.test.js -t "实验样本完整性"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/data/experiments-v3.js src/agent/experimentEngine.js tests/r3-phase2-5-closed-loop.test.js
git commit -m "fix(experiment): add stable id/targetId to all sampled entities"
```

---

## Task 3: 新建 masteryEvidence.js（MasteryEvidence 派生 + 质量模型）

**Files:**
- Create: `src/agent/masteryEvidence.js`
- Modify: `src/agent/unifiedLearningState.js`
- Test: `tests/r3-phase2-5-closed-loop.test.js`

- [ ] **Step 1: 写失败测试（质量 + 会做≠做过）**

```js
import { deriveMasteryEvidence, evidenceMasteryContribution } from '../src/agent/masteryEvidence'

describe('MasteryEvidence 质量模型', () => {
  const mk = (action, targetId, context, extra = {}) =>
    createEvidence({ source: 'workshop', action, targetType: 'hexagram', targetId, context, timestamp: 1600000000000 + targetId, ...extra })

  it('bare construct（无证据/反例）是低质量、低权重', () => {
    const mes = deriveMasteryEvidence([mk('construct', 1, '乾卦健行')])
    expect(mes).toHaveLength(1)
    expect(mes[0].dimension).toBe('synthesis')
    expect(mes[0].quality).toBe('low')
    expect(mes[0].weight).toBe(0.4)
  })

  it('construct + evidence + counterexample + revise（同一对象）→ construct 高质量', () => {
    const mes = deriveMasteryEvidence([
      mk('construct', 1, '结论'),
      mk('evidence', 1, '原文佐证'),
      mk('counterexample', 1, '存在反例'),
      mk('revise', 1, '修改假设'),
    ])
    const construct = mes.find((m) => m.dimension === 'synthesis')
    expect(construct.quality).toBe('high')
    expect(construct.weight).toBe(1)
  })

  it('bare construct 贡献分 5，有支撑的 construct 贡献分 12 —— 会做 ≠ 做过', () => {
    expect(evidenceMasteryContribution([mk('construct', 1, '乾卦健行')]).synthesis.score).toBe(5)
    expect(evidenceMasteryContribution([
      mk('construct', 1, '乾卦健行'), mk('evidence', 1, '原文佐证'),
    ]).synthesis.score).toBe(12)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/r3-phase2-5-closed-loop.test.js -t "MasteryEvidence"`
Expected: FAIL —— 模块不存在。

- [ ] **Step 3: 创建 `src/agent/masteryEvidence.js`**

```js
// ============================================================
// R3 Phase 2.5 · Mastery Evidence（能力证据派生层）
//
// 单一事实源：LearningEvidence → MasteryEvidence → masteryEngine。
// 任何模块不得直接改写 masteryProfile（禁止 masteryProfile.xxx += 1）。
// 本模块产出「维度级能力证据」，由 masteryEngine 合并进唯一能力档案。
// deterministic，禁止随机。
// ============================================================

import { analyzeSignals } from '../lib/textSignals'

export const MASTERY_CAP = 60 // Evidence 只「调节」能力，不「主导」

// action → 能力维度映射（mastery: true 才产生能力证据）
export const MASTERY_ACTION_RULES = {
  view: { dim: null, mastery: false },
  observe: { dim: 'observation', mastery: false },
  identify: { dim: 'observation', mastery: false },
  sample: { dim: 'observation', mastery: false },
  inspect: { dim: 'observation', mastery: false },
  predict: { dim: 'reasoning', mastery: false },
  analyze: { dim: 'reasoning', mastery: true, requiresStructure: true },
  compare: { dim: 'reasoning', mastery: true, requiresContent: true },
  interpret: { dim: 'reasoning', mastery: true, requiresContent: true },
  hypothesis: { dim: 'reasoning', mastery: true, requiresContent: true },
  construct: { dim: 'synthesis', mastery: true, requiresContent: true },
  evidence: { dim: 'evidence', mastery: true, requiresContent: true },
  counterexample: { dim: 'counterexample', mastery: true, requiresContent: true },
  revise: { dim: 'reasoning', mastery: true, requiresContent: true },
  reflect: { dim: 'uncertainty', mastery: true, requiresContent: true },
  challenge: { dim: 'independence', mastery: true },
  complete: { dim: null, mastery: false },
  retry: { dim: null, mastery: false },
  save: { dim: null, mastery: false },
}

// 从单条 Evidence 取开放文本
export function evidenceText(ev) {
  if (!ev) return ''
  if (typeof ev.context === 'string') return ev.context
  if (typeof ev.result === 'string') return ev.result
  if (ev.result && typeof ev.result.text === 'string') return ev.result.text
  if (ev.metadata && typeof ev.metadata.text === 'string') return ev.metadata.text
  return ''
}

function hasStructureSignal(text) {
  const sig = analyzeSignals(text)
  return sig.mentionsPosition || sig.mentionsRelation || sig.mentionsText
}

// ── Evidence Quality：「会做 ≠ 做过」──
// 下结论类行为（construct/analyze/interpret/hypothesis/compare）在没有证据/反例支撑时权重低。
function weightFor(ev, targetActions) {
  const a = ev.action
  if (a === 'evidence' || a === 'counterexample' || a === 'reflect') return 1
  if (a === 'challenge') return 0.8
  if (a === 'revise') {
    return (targetActions.has('counterexample') || targetActions.has('evidence')) ? 1 : 0.8
  }
  const supported = targetActions.has('evidence') || targetActions.has('counterexample')
  return supported ? 1 : 0.4
}

// LearningEvidence → MasteryEvidence[]（维度级、带质量权重）
export function deriveMasteryEvidence(evidenceList = []) {
  const arr = Array.isArray(evidenceList) ? evidenceList : []
  const byTarget = new Map()
  for (const ev of arr) {
    const k = `${ev.targetType}:${ev.targetId}`
    if (!byTarget.has(k)) byTarget.set(k, new Set())
    byTarget.get(k).add(ev.action)
  }
  const out = []
  for (const ev of arr) {
    const rule = MASTERY_ACTION_RULES[ev.action]
    if (!rule || !rule.mastery) continue
    const text = evidenceText(ev).trim()
    if (rule.requiresContent && !text) continue
    if (rule.requiresStructure && !hasStructureSignal(text)) continue
    const k = `${ev.targetType}:${ev.targetId}`
    const ta = byTarget.get(k) || new Set()
    const weight = weightFor(ev, ta)
    out.push({
      evidenceId: ev.id,
      dimension: rule.dim,
      weight,
      quality: weight >= 1 ? 'high' : weight >= 0.8 ? 'medium' : 'low',
      reason: `${ev.action}@${k}→${rule.dim} weight=${weight}`,
      timestamp: ev.timestamp,
      targetKey: k,
    })
  }
  return out
}

// 折叠成维度级能力贡献（去重 + 递减 + 封顶 + 质量权重）
export function evidenceMasteryContribution(evidenceList = []) {
  const masteryEvidence = deriveMasteryEvidence(evidenceList)
  const perDim = {}
  const seen = new Set()
  for (const me of masteryEvidence) {
    const dedupKey = `${me.dimension}|${me.targetKey}`
    if (seen.has(dedupKey)) continue
    seen.add(dedupKey)
    const d = (perDim[me.dimension] ||= { count: 0, uniqueTargets: 0, weighted: 0 })
    d.count += 1
    d.uniqueTargets += 1
    d.weighted += me.weight
  }
  const out = {}
  for (const [dim, d] of Object.entries(perDim)) {
    out[dim] = {
      count: d.count,
      uniqueTargets: d.uniqueTargets,
      score: Math.round(MASTERY_CAP * (1 - Math.pow(0.8, d.weighted))),
      capped: d.weighted * 12 >= MASTERY_CAP,
    }
  }
  return out
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/r3-phase2-5-closed-loop.test.js -t "MasteryEvidence"`
Expected: PASS

- [ ] **Step 5: 调整 `unifiedLearningState.js` 引用并 re-export**

顶部新增 import 并 re-export（保持既有 import 兼容）：

```js
import {
  MASTERY_ACTION_RULES, evidenceText, evidenceMasteryContribution, deriveMasteryEvidence,
} from './masteryEvidence'

export {
  MASTERY_ACTION_RULES, evidenceText, evidenceMasteryContribution, deriveMasteryEvidence,
} from './masteryEvidence'
```

删除原文件内 4 处本地定义：`MASTERY_ACTION_RULES`（原 65–85 行）、`evidenceText`（原 30–37 行）、`MASTERY_CAP`（原 87 行）、`hasStructureSignal`（原 89–92 行）、`evidenceMasteryContribution`（原 96–124 行）。`preferEvidence`（原 127–129）保留本地。

- [ ] **Step 6: Commit**

```bash
git add src/agent/masteryEvidence.js src/agent/unifiedLearningState.js tests/r3-phase2-5-closed-loop.test.js
git commit -m "feat(evidence): add MasteryEvidence derivation with deterministic quality model"
```

---

## Task 4: 修复 LOW_UNCERTAINTY 误报（textSignals 区分绝对化主张 / 主动修正）

**Files:**
- Modify: `src/lib/textSignals.js`
- Modify: `src/agent/unifiedLearningState.js`
- Test: `tests/r3-phase2-5-closed-loop.test.js`

- [ ] **Step 1: 写失败测试**

```js
import analyzeSignals from '../src/lib/textSignals'
import { recommendByEvidence } from '../src/agent/evidenceRecommendation'
import { initialState as init } from '../src/lib/storage'

describe('TextSignals 修正语境识别', () => {
  it('「原来的假设太绝对了」是主动修正，不算绝对化主张', () => {
    const s = analyzeSignals('原来的假设太绝对了')
    expect(s.absoluteHits).toBeGreaterThan(0)
    expect(s.selfCorrection).toBe(true)
    expect(s.absoluteClaims).toBe(0)
  })

  it('「这个爻一定是吉的」是绝对化主张', () => {
    const s = analyzeSignals('这个爻一定是吉的')
    expect(s.absoluteClaims).toBeGreaterThanOrEqual(1)
    expect(s.selfCorrection).toBe(false)
  })
})

describe('推荐不再被 LOW_UNCERTAINTY 抢占', () => {
  it('修正者（revise「太绝对了」+ 反例 + 信念修正）→ primary 是 BELIEF_REVISION', () => {
    const state = {
      ...init,
      evidence: [
        createEvidence({ source: 'experiment', action: 'evidence', targetType: 'experiment', targetId: 'x', context: '支持假设', timestamp: T() }),
        createEvidence({ source: 'experiment', action: 'counterexample', targetType: 'experiment', targetId: 'x', context: '反例', timestamp: T() }),
        createEvidence({ source: 'experiment', action: 'revise', targetType: 'experiment', targetId: 'x', context: '原来的假设太绝对了', timestamp: T() }),
      ],
      beliefRevisions: [{ originalClaim: '得位即吉', revisedClaim: '得位不必然吉', reason: '反例', timestamp: T() }],
    }
    const rec = recommendByEvidence(state)
    expect(rec.primary.reasonCode).toBe('BELIEF_REVISION')
  })
})
```

（`T()` 定义为 `() => Date.now() - 1000`）

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/r3-phase2-5-closed-loop.test.js -t "修正"`
Expected: FAIL —— 当前 `absoluteHits>0` 直接触发 LOW_UNCERTAINTY（优先级 8）压过 BELIEF_REVISION（优先级 5）。

- [ ] **Step 3: 实现 textSignals 修正语境**

在 `src/lib/textSignals.js` 加 marker 与分类函数（放 `ABSOLUTE_WORDS` 之后）：

```js
const SELF_CORRECTION_MARKERS = [
  '太绝对', '太肯定', '太武断', '过于绝对', '过度绝对',
  '我原来', '我之前', '我以前', '我起初', '原来我', '之前我',
  '现在认为', '现在觉得', '现在看', '改为', '修正为', '改成',
]

// 区分「绝对化主张」与「主动修正」：修正语境的绝对词不算绝对化主张。
export function classifyAbsolutes(text) {
  const s = String(text || '')
  const selfCorrection = SELF_CORRECTION_MARKERS.some((m) => s.includes(m))
  return {
    absoluteClaims: selfCorrection ? 0 : countHits(s, ABSOLUTE_WORDS),
    selfCorrection,
  }
}
```

修改 `analyzeSignals` 返回对象（在 `absoluteHits` 之后加两字段）：

```js
export function analyzeSignals(text = '') {
  const s = String(text || '')
  const yaos = (s.match(YAO_LINE_RE) || []).length
  const abs = classifyAbsolutes(s)
  return {
    // ...原有字段保持不变...
    absoluteLanguage: ABSOLUTE_WORDS.filter((w) => s.includes(w)),
    absoluteHits: countHits(s, ABSOLUTE_WORDS),
    absoluteClaims: abs.absoluteClaims,
    selfCorrection: abs.selfCorrection,
    referencedEntities: detectEntities(s),
  }
}
```

- [ ] **Step 4: 修改 LOW_UNCERTAINTY 信号来源**

`src/agent/unifiedLearningState.js` 的 `computeRecommendationSignals` 里：

```js
  const absHits = recent.filter((e) => analyzeSignals(evidenceText(e)).absoluteHits > 0).length
  if (reflectN === 0 && absHits >= 1) {
```

改为：

```js
  const absClaims = recent.filter((e) => analyzeSignals(evidenceText(e)).absoluteClaims > 0).length
  if (reflectN === 0 && absClaims >= 1) {
```

同文件 `getLearningState` 的 `uncertainty.absoluteSignalCount` 一并改为 `absoluteClaims`：

```js
    absoluteSignalCount: evidence.filter((e) => analyzeSignals(evidenceText(e)).absoluteClaims > 0).length,
```

- [ ] **Step 5: 运行确认通过**

Run: `npx vitest run tests/r3-phase2-5-closed-loop.test.js -t "修正"`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/textSignals.js src/agent/unifiedLearningState.js tests/r3-phase2-5-closed-loop.test.js
git commit -m "fix(textsignals): stop LOW_UNCERTAINTY from masking BELIEF_REVISION"
```

---

## Task 5: 合并 Evidence 贡献到唯一 masteryProfile

**Files:**
- Modify: `src/agent/masteryEngine.js`
- Modify: `src/store/reducer.js`
- Test: `tests/r3-phase2-5-closed-loop.test.js`

- [ ] **Step 1: 写失败测试（场景 B + 防刷 C）**

```js
import { computeMasteryProfile } from '../src/agent/masteryEngine'
import { reducer } from '../src/store/reducer'

const flowEv = (target) => [
  createEvidence({ source: 'workshop', action: 'analyze', targetType: 'hexagram', targetId: target, context: '九三居下卦之极，与上九相应', timestamp: T() }),
  createEvidence({ source: 'experiment', action: 'evidence', targetType: 'experiment', targetId: `e${target}`, context: '支持假设', timestamp: T() }),
  createEvidence({ source: 'experiment', action: 'counterexample', targetType: 'experiment', targetId: `e${target}`, context: '存在反例', timestamp: T() }),
  createEvidence({ source: 'experiment', action: 'revise', targetType: 'experiment', targetId: `e${target}`, context: '需要修改', timestamp: T() }),
  createEvidence({ source: 'experiment', action: 'reflect', targetType: 'experiment', targetId: `e${target}`, context: '我容易只看支持自己的证据', timestamp: T() }),
]

describe('Evidence → Mastery → L0-L6 闭环', () => {
  it('场景B：完成 analyze/evidence/counterexample/revise/reflect 后，profile 维度真实改变', () => {
    const state = { ...init, evidence: flowEv(1) }
    const p = computeMasteryProfile(state)
    expect(p.evidence).toBeGreaterThan(0)
    expect(p.reasoning).toBeGreaterThan(0)
    expect(p.counterexample).toBeGreaterThan(0)
    expect(p.uncertainty).toBeGreaterThan(0)
  })

  it('场景B：5 组完整高质量实验 → 等级从 L0 升到 L1（不是只加 contribution）', () => {
    const evidence = [1, 2, 3, 4, 5].flatMap(flowEv)
    const state = { ...init, evidence }
    const p = computeMasteryProfile(state)
    expect(p.level).toBe('L1')
  })

  it('场景C：view×100 能力不增长', () => {
    const state = { ...init, evidence: Array.from({ length: 100 }, () => createEvidence({ source: 'workshop', action: 'view', targetType: 'hexagram', targetId: 1, timestamp: T() })) }
    const p = computeMasteryProfile(state)
    expect(p.level).toBe('L0')
    expect(p.overall).toBe(0)
  })

  it('场景C：bare construct×100 不能成为高手（结构/观察仍为 0，无法越过 L1）', () => {
    const state = { ...init, evidence: Array.from({ length: 100 }, (_, i) => createEvidence({ source: 'workshop', action: 'construct', targetType: 'hexagram', targetId: i + 1, context: '结论', timestamp: T() })) }
    const p = computeMasteryProfile(state)
    expect(p.synthesis).toBeLessThanOrEqual(60)
    expect(p.structure).toBe(0)
    expect(p.observation).toBe(0)
    expect(p.level).toBe('L0')
  })
})

describe('reducer RECORD_EVIDENCE 重算 profile', () => {
  it('写入证据后 store.masteryProfile 立即吸收贡献', () => {
    let state = { ...init }
    state = reducer(state, { type: 'RECORD_EVIDENCE', evidence: { source: 'experiment', action: 'evidence', targetType: 'experiment', targetId: 'e1', context: '支持假设', timestamp: T() } })
    expect(state.evidence.length).toBe(1)
    expect(state.masteryProfile).toBeTruthy()
    expect(state.masteryProfile.evidence).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/r3-phase2-5-closed-loop.test.js -t "闭环"` 与 `-t "RECORD_EVIDENCE"`
Expected: FAIL —— `computeMasteryProfile` 忽略 evidence，profile 全 0。

- [ ] **Step 3: 重构 `masteryEngine.js`**

顶部 import：

```js
import { evidenceMasteryContribution, MASTERY_CAP } from './masteryEvidence'
```

抽取原案例分支到 `computeCaseValues`，新增 `evidenceSampleCount`，重写 `computeMasteryProfile`：

```js
function evidenceSampleCount(contribution) {
  const total = Object.values(contribution).reduce((a, d) => a + (d.uniqueTargets || 0), 0)
  return Math.min(6, Math.floor(total / 2))
}

function computeCaseValues(attempts) {
  const n = attempts.length
  const w = decayWeights(n)
  const dim = (key) => attempts.map((a) => a.dimensions?.[key])
  const info = weightedAvg(dim('info'), w) ?? 0
  const rule = weightedAvg(dim('rule'), w) ?? 0
  const reasoningRaw = weightedAvg(dim('reasoning'), w) ?? 0
  const counterRaw = weightedAvg(dim('counter'), w) ?? 0
  const over = weightedAvg(dim('over'), w) ?? 0
  const boundary = weightedAvg(dim('boundary'), w) ?? 0
  const observation = round(info)
  const structure = round(rule)
  const evidence = round((over + info) / 2)
  const reasoning = round(reasoningRaw)
  const counterexample = round(counterRaw)
  const unknownRate = attempts.filter((a) => a.usedUnknown).length / n
  const uncertainty = round(boundary * 0.85 + unknownRate * 100 * 0.15)
  const complex = attempts.filter((a) => (a.level || 0) >= 3)
  const complexScore = complex.length ? complex.reduce((x, a) => x + a.score, 0) / complex.length : (reasoning + evidence) / 2
  const dualGood = attempts.filter((a) => a.dualQuality === 'good').length
  const synthesis = round(complexScore * 0.85 + Math.min(100, dualGood * 12) * 0.15)
  const depAvg = weightedAvg(attempts.map((a) => (typeof a.hintDependency === 'number' ? a.hintDependency : 0)), w) ?? 0
  const consultedRate = attempts.filter((a) => a.consultedKnowledge).length / n
  const indepMode = attempts.filter((a) => a.mode === 'independent' || a.mode === 'master')
  const indepScore = indepMode.length ? indepMode.reduce((x, a) => x + a.score, 0) / indepMode.length : 50
  const independence = round(clamp(100 - depAvg * 1.25 - consultedRate * 25 + (indepScore - 50) * 0.3, 0, 100))
  return {
    values: { observation, structure, evidence, reasoning, counterexample, uncertainty, synthesis, independence },
    aux: { depAvg, consultedRate, indepScore: indepMode.length ? indepScore : null },
  }
}

export function computeMasteryProfile(state) {
  const attempts = (state.caseAttempts || []).slice(-12)
  const contribution = evidenceMasteryContribution(state.evidence || [])
  const n = attempts.length
  const hasCase = n > 0

  const empty = {
    observation: 0, structure: 0, evidence: 0, reasoning: 0,
    counterexample: 0, uncertainty: 0, synthesis: 0, independence: 0,
    level: 'L0', levelName: MASTERY_LEVELS.L0.name, levelEmoji: MASTERY_LEVELS.L0.emoji, levelDesc: MASTERY_LEVELS.L0.desc,
    sampleCount: 0, ready: false,
    hintDependency: 0, consultedKnowledgeRate: 0,
    beliefRevision: null, confidenceCalibration: null,
    unfamiliarCasePerformance: null,
    bottleneck: null, overall: 0, evidenceContribution: contribution,
    lastUpdated: null,
  }
  if (!hasCase && Object.keys(contribution).length === 0) return empty

  let values
  let aux = { depAvg: 0, consultedRate: 0, indepScore: null }
  if (!hasCase) {
    values = {}
    for (const k of DIMENSION_KEYS) values[k] = round(clamp(contribution[k]?.score ?? 0, 0, 100))
  } else {
    const cv = computeCaseValues(attempts)
    aux = cv.aux
    values = {}
    for (const k of DIMENSION_KEYS) {
      values[k] = round(Math.max(cv.values[k], Math.min(contribution[k]?.score ?? 0, MASTERY_CAP)))
    }
  }

  const sampleCount = n + evidenceSampleCount(contribution)
  const level = levelFromValues(values, sampleCount)
  const overall = round(DIMENSION_KEYS.reduce((a, k) => a + values[k], 0) / 8)

  return {
    ...values,
    level: level.key, levelName: level.name, levelEmoji: level.emoji, levelDesc: level.desc,
    sampleCount,
    ready: sampleCount >= 3,
    hintDependency: hasCase ? round(aux.depAvg) : 0,
    consultedKnowledgeRate: hasCase ? Math.round(aux.consultedRate * 100) : 0,
    beliefRevision: hasCase ? beliefRevisionOf(attempts) : null,
    confidenceCalibration: hasCase ? calibrationScore(state.confidenceHistory) : null,
    unfamiliarCasePerformance: hasCase && aux.indepScore != null ? round(aux.indepScore) : null,
    bottleneck: bottleneckOf(values),
    overall,
    evidenceContribution: contribution,
    lastUpdated: hasCase ? (attempts[n - 1]?.at || null) : null,
  }
}
```

- [ ] **Step 4: reducer RECORD_EVIDENCE 重算 profile**

`src/store/reducer.js` 的 `RECORD_EVIDENCE` 分支内，在 `touchStreak` 之前加：

```js
      // R3 Phase 2.5：证据写入后重算能力档案，让 Evidence 贡献进入唯一能力事实源。
      s.masteryProfile = computeMasteryProfile(s)
```

- [ ] **Step 5: 运行确认通过**

Run: `npx vitest run tests/r3-phase2-5-closed-loop.test.js -t "闭环"` 与 `-t "RECORD_EVIDENCE"`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/agent/masteryEngine.js src/store/reducer.js tests/r3-phase2-5-closed-loop.test.js
git commit -m "feat(mastery): merge evidence contribution into the single mastery profile"
```

---

## Task 6: Evidence-first nextAction（localAgentEngine）

**Files:**
- Modify: `src/agent/localAgentEngine.js`
- Test: `tests/r3-phase2-5-closed-loop.test.js`

- [ ] **Step 1: 写失败测试（场景 E 推荐唯一性）**

```js
import { runAgent } from '../src/agent/localAgentEngine'

describe('Agent Evidence-first nextAction', () => {
  it('场景A：连续 3 次 construct 无 evidence → nextAction 是 WEAK_EVIDENCE 实验而非旧推荐', () => {
    const state = { ...init, evidence: [1, 2, 3].map((i) => createEvidence({ source: 'workshop', action: 'construct', targetType: 'hexagram', targetId: i, context: '结论', timestamp: T() })) }
    const out = runAgent(state)
    expect(out.nextAction.evidence).toBe(true)
    expect(out.nextAction.reasonCode).toBe('WEAK_EVIDENCE')
    expect(out.nextAction.type).toBe('experiment')
    expect(out.nextAction.id).toBeTruthy()
  })

  it('场景E：旧 fingerprint 会推荐课程，但 Evidence 推荐证据实验 → 最终 nextAction 是 Evidence', () => {
    const state = {
      ...init,
      masteryProfile: { observation: 80, structure: 80, evidence: 85, reasoning: 80, counterexample: 80, uncertainty: 80, synthesis: 80, independence: 80, overall: 80 },
      evidence: [1, 2, 3].map((i) => createEvidence({ source: 'workshop', action: 'construct', targetType: 'hexagram', targetId: i, context: '结论', timestamp: T() })),
    }
    const out = runAgent(state)
    expect(out.nextAction.reasonCode).toBe('WEAK_EVIDENCE')
    expect(out.nextAction.type).toBe('experiment')
  })

  it('新用户（无证据）→ 回退到旧默认路径（lesson）', () => {
    const out = runAgent({ ...init })
    expect(out.nextAction.type).toBe('lesson')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/r3-phase2-5-closed-loop.test.js -t "nextAction"`
Expected: FAIL —— 当前 `nextAction` 由旧 `pickNextAction` 产生。

- [ ] **Step 3: 实现**

`src/agent/localAgentEngine.js`：把第 46 行 `const nextAction = pickNextAction(...)` 改为：

```js
  const nextAction = resolveNextAction(state, evidenceReco, lesson, cs, exp, weakest, training, insight)
```

把旧 `pickNextAction` 改名为 `pickLegacyNextAction`（函数体不改），并新增：

```js
// R3 Phase 2.5：Evidence 推荐是唯一主要 next action；旧路径仅作无证据时兜底。
function resolveNextAction(state, evidenceReco, lesson, cs, exp, weakest, training, insight) {
  const primary = evidenceReco?.primary
  if (primary && primary.experiment?.id) {
    return {
      type: 'experiment',
      id: primary.experiment.id,
      title: primary.experiment.title,
      why: `${primary.headline} ${primary.body}`,
      evidence: true,
      reasonCode: primary.reasonCode,
      headline: primary.headline,
      body: primary.body,
      trace: primary.trace || {},
      meta: primary.meta || {},
      alternatives: (evidenceReco.items || []).slice(1, 4).map((i) => ({
        reasonCode: i.reasonCode, headline: i.headline, experimentId: i.experiment?.id || null,
      })),
    }
  }
  return pickLegacyNextAction(lesson, cs, exp, weakest, state, training, insight)
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/r3-phase2-5-closed-loop.test.js -t "nextAction"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/agent/localAgentEngine.js tests/r3-phase2-5-closed-loop.test.js
git commit -m "feat(agent): make evidence recommendation the single primary next action"
```

---

## Task 7: Home 渲染 Evidence-first + 可解释理由

**Files:**
- Modify: `src/pages/Home.jsx`
- 无单测（UI，回归由现有 build/test 兜底）

- [ ] **Step 1: `actionTarget()` 实验路由**

```js
      case 'experiment':
        return action.evidence ? `/exp/${action.id}` : `/lab/${action.id}`
```

- [ ] **Step 2: 增加「为什么推荐」证据依据块**

在「开始今天的学习」按钮之后、`agent.whyThisCase` 块之前，插入：

```jsx
        {action.evidence && action.reasonCode && (
          <div className="mt-12" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 12 }}>
            <button className="btn btn-ghost btn-sm" style={{ color: '#b5a890' }} onClick={() => setShowWhy((v) => !v)}>
              {showWhy ? '▾ ' : '▸ '}为什么推荐这个？
            </button>
            {showWhy && (
              <div className="mt-8" style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 12 }}>
                <p className="tiny" style={{ color: '#c9bda6', margin: 0 }}>{action.headline}</p>
                <p className="tiny" style={{ color: '#b5a890', marginTop: 6 }}>{action.body}</p>
                <EvidenceBasis action={action} />
              </div>
            )}
          </div>
        )}
```

- [ ] **Step 3: 新增 `EvidenceBasis` 组件**

文件底部加：

```jsx
function EvidenceBasis({ action }) {
  const ids = action.trace?.evidenceIds || []
  const codes = action.trace?.errorCodes || []
  if (!ids.length && !codes.length) return null
  return (
    <div className="tiny mt-8" style={{ color: '#8a7f6a' }}>
      依据：
      {ids.slice(0, 5).map((id) => (
        <span key={id} className="pill" style={{ background: 'rgba(69,84,155,0.08)', color: 'var(--indigo)', marginRight: 4 }}>{id}</span>
      ))}
      {codes.length ? ` · 错误模式 ${codes.join('、')}` : ''}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/Home.jsx
git commit -m "feat(home): render evidence-first recommendation with traceable reason"
```

---

## Task 8: Growth 渲染 Evidence-first「下一步」

**Files:**
- Modify: `src/pages/Growth.jsx`

- [ ] **Step 1: 替换 line 413–426 的按钮块**

```jsx
          {agent.nextAction && (
            <div className="mt-16">
              <button
                className="btn btn-teal"
                onClick={() => {
                  const a = agent.nextAction
                  if (a.type === 'lesson') navigate(a.id ? `/lesson/${a.id}` : '/lesson')
                  else if (a.type === 'case') navigate(`/case/${a.id}`)
                  else if (a.type === 'experiment') navigate(a.evidence ? `/exp/${a.id}` : `/lab/${a.id}`)
                  else navigate('/map')
                }}
              >
                下一步：{agent.nextAction.title} →
              </button>
              {agent.nextAction.evidence && agent.nextAction.headline && (
                <p className="tiny muted mt-8">{agent.nextAction.headline}</p>
              )}
            </div>
          )}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Growth.jsx
git commit -m "feat(growth): render evidence-first next action with reason"
```

---

## Task 9: 更新会因修复而改变语义的既有断言

**Files:**
- Modify: `tests/r3-phase2-antigaming.test.js`
- Modify: `tests/r3-phase2-learningstate.test.js`
- Modify: `tests/r3-phase2-reverse-acceptance.test.js`

- [ ] **Step 1: antigaming**

- `tests/r3-phase2-antigaming.test.js:51`：`expect(c.synthesis.score).toBe(12)` → `.toBe(5)`
- `tests/r3-phase2-antigaming.test.js:69`：`expect(one).toBe(12)` → `.toBe(5)`
- `tests/r3-phase2-antigaming.test.js:87`：`expect(ls.mastery.profile.overall).toBe(0)` 改为：
  ```js
  expect(ls.mastery.profile.level).toBe('L0')      // 200 次点击仍非高手
  expect(ls.mastery.profile.overall).toBeLessThan(10)
  ```

- [ ] **Step 2: learningstate**

- `tests/r3-phase2-learningstate.test.js:88`：`expect(c.synthesis.score).toBe(12)` → `.toBe(5)`
- `tests/r3-phase2-learningstate.test.js:272`：`expect(ls.mastery.profile.overall).toBe(0)` → `.toBeGreaterThan(0)`
- `tests/r3-phase2-learningstate.test.js:273`：`expect(ls.mastery.contribution.synthesis.score).toBe(12)` → `.toBe(5)`

- [ ] **Step 3: reverse-acceptance（把 FAIL 期待翻转为修复后的 PASS）**

- line 87：在 `expect(typeof out.nextAction.type).toBe('string')` 后追加
  ```js
  expect(out.nextAction.reasonCode).toBe('WEAK_EVIDENCE')
  ```
- line 116（2B）：保留 `expect(profile.level).toBe('L0')`，追加维度断言并把 log 改 `'PASS'`：
  ```js
  expect(profile.evidence).toBeGreaterThan(0)
  expect(profile.reasoning).toBeGreaterThan(0)
  ```
- line 256（5b）：`expect(rb.primary.reasonCode).toBe('LOW_UNCERTAINTY')` → `.toBe('BELIEF_REVISION')`
- line 323（Test3）：`expect(c.synthesis.score).toBe(12)` → `.toBe(5)`
- line 383（9a）：`expect(a.id).toBe(b.id)` → `.not.toBe(b.id)`，log 改 `'PASS'`
- line 390（9b）：`expect(String(first.id)).toContain('undefined')` → `.not.toContain('undefined')`，log 改 `'PASS'`

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/r3-phase2-antigaming.test.js tests/r3-phase2-learningstate.test.js tests/r3-phase2-reverse-acceptance.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/r3-phase2-antigaming.test.js tests/r3-phase2-learningstate.test.js tests/r3-phase2-reverse-acceptance.test.js
git commit -m "test: update assertions to reflect fixed closed-loop behavior"
```

---

## Task 10: 补齐 50+ 新测试并全量回归

- [ ] **Step 1: 补全剩余测试用例**

在 `tests/r3-phase2-5-closed-loop.test.js` 补（确保总数 ≥ 50）：

```js
describe('Evidence 贡献边界', () => {
  it('空列表 / 非数组 → 空对象', () => {
    expect(evidenceMasteryContribution([])).toEqual({})
    expect(evidenceMasteryContribution(null)).toEqual({})
  })
  it('view/observe/identify/sample/inspect/predict 都不产生贡献', () => {
    for (const a of ['view', 'observe', 'identify', 'sample', 'inspect', 'predict']) {
      expect(evidenceMasteryContribution([createEvidence({ source: 'workshop', action: a, targetType: 'hexagram', targetId: 1, context: '有内容', timestamp: T() })])).toEqual({})
    }
  })
  it('construct 空文本不加分', () => {
    expect(evidenceMasteryContribution([createEvidence({ source: 'workshop', action: 'construct', targetType: 'hexagram', targetId: 1, context: '', timestamp: T() })])).toEqual({})
  })
  it('analyze 无结构信号不加分', () => {
    expect(evidenceMasteryContribution([createEvidence({ source: 'workshop', action: 'analyze', targetType: 'hexagram', targetId: 1, context: '我觉得不错', timestamp: T() })])).toEqual({})
  })
  it('对同一对象 construct×50 → uniqueTargets 仍为 1（防刷）', () => {
    const list = Array.from({ length: 50 }, () => createEvidence({ source: 'workshop', action: 'construct', targetType: 'hexagram', targetId: 1, context: '结论', timestamp: T() }))
    const c = evidenceMasteryContribution(list)
    expect(c.synthesis.uniqueTargets).toBe(1)
    expect(c.synthesis.score).toBeLessThanOrEqual(5)
  })
  it('贡献封顶 60', () => {
    const list = Array.from({ length: 300 }, (_, i) => createEvidence({ source: 'workshop', action: 'evidence', targetType: 'case', targetId: `c${i}`, context: '原文有据', timestamp: T() }))
    expect(evidenceMasteryContribution(list).evidence.score).toBeLessThanOrEqual(60)
  })
  it('errorTypes 不产生正增益', () => {
    const withErr = createEvidence({ source: 'doubt', action: 'challenge', targetType: 'doubt', targetId: 'a', errorTypes: ['E07'], timestamp: T() })
    const withoutErr = createEvidence({ source: 'doubt', action: 'challenge', targetType: 'doubt', targetId: 'a', timestamp: T() })
    expect(evidenceMasteryContribution([withErr]).independence.score).toBe(evidenceMasteryContribution([withoutErr]).independence.score)
  })
})

describe('推荐优先级与冲突裁决', () => {
  it('WEAK_EVIDENCE 优先级高于 NO_COUNTEREXAMPLE', () => {
    const state = { ...init, evidence: [1, 2, 3].map((i) => createEvidence({ source: 'workshop', action: 'construct', targetType: 'hexagram', targetId: i, context: '结论', timestamp: T() })) }
    const rec = recommendByEvidence(state)
    expect(rec.primary.reasonCode).toBe('WEAK_EVIDENCE')
  })
  it('REPEATED_ERROR 优先于正面 BELIEF_REVISION', () => {
    const state = {
      ...init,
      errorPatterns: { E07: 3 },
      evidence: [1, 2, 3].map((i) => createEvidence({ source: 'doubt', action: 'challenge', targetType: 'doubt', targetId: `d${i}`, errorTypes: ['E07'], timestamp: T() })),
      beliefRevisions: [{ originalClaim: 'a', revisedClaim: 'b', timestamp: T() }],
    }
    expect(recommendByEvidence(state).primary.reasonCode).toBe('REPEATED_ERROR')
  })
  it('推荐带可追溯 trace（evidenceIds），Home/Growth 能展示依据', () => {
    const state = { ...init, evidence: [1, 2, 3].map((i) => createEvidence({ source: 'workshop', action: 'construct', targetType: 'hexagram', targetId: i, context: '结论', timestamp: T() })) }
    const out = runAgent(state)
    expect(Array.isArray(out.nextAction.trace?.evidenceIds)).toBe(true)
    expect(out.nextAction.trace.evidenceIds.length).toBeGreaterThan(0)
  })
})

describe('实验全量 30 抽样本抽检', () => {
  it('每个实验抽样可复现（同 seed 两次一致）', () => {
    for (const e of EXPERIMENTS_V3) {
      const a = startExperiment(e.id, { seed: e.id, count: 6, timestamp: 1600000000000 }).sample.map((s) => `${s.type}:${s.id}`).join(',')
      const b = startExperiment(e.id, { seed: e.id, count: 6, timestamp: 1600000000000 }).sample.map((s) => `${s.type}:${s.id}`).join(',')
      expect(a).toBe(b)
    }
  })
})
```

- [ ] **Step 2: 运行全量测试**

Run: `npm test`
Expected: 全部 PASS，0 fail（基线 557 + 本阶段新增 ≥ 50）。

- [ ] **Step 3: 生产构建**

Run: `npm run build`
Expected: 成功生成 `dist/`。

- [ ] **Step 4: Commit**

```bash
git add tests/r3-phase2-5-closed-loop.test.js
git commit -m "test: add 50+ closed-loop regression tests"
```

---

## 自审清单

- 规格覆盖：Evidence→Mastery（Task 5）、Mastery→L0-L6（Task 5）、Evidence→Agent（Task 6）、Agent→Home/Growth（Task 7/8）、推荐冲突（Task 6 + Task 10）、ID 碰撞（Task 1）、文本信号（Task 4）、样本完整性（Task 2）、防刷（Task 5/10）、推荐可解释（Task 7）均已覆盖。
- 唯一事实源：8 维 L0-L6 只由 `computeMasteryProfile` 输出；`contribution` 不再另立能力，仅作引擎输入与展示元数据。
- 禁止项核对：未新增知识节点/游戏/外部 API/排行榜；未重写 Agent 与 8 维模型；未建第三套 mastery。