// ============================================================
// R3 Phase 3 · 怀疑室（DoubtTask Runner）
//
// 不是答题模块：任务是「材料 → 初始判断 → 证据 → 反例 → 修正 → 反思」
// 的认知纠偏流程。开放文本只做 deterministic TextSignals 分析，
// 不判对错、不做语义幻觉判断、无 LLM。
//
// 每步产生真实 Evidence（source='doubt'），完成时产出 DoubtResult +
// BeliefRevision 并归档（RECORD_DOUBT_RUN），复用 computeMasteryProfile
// 吸收能力变化。完成后展示「这次改变了什么？」（不展示虚假得分）。
// ============================================================
import React, { useState } from 'react'
import { useApp } from '../store/AppContext'
import {
  DOUBT_CATEGORIES,
  DOUBT_TASKS,
  getDoubtTask,
  doubtTasksByCategory,
} from '../data/doubtTasks'
import {
  startDoubtTask,
  recordDoubtStep,
  buildDoubtResult,
  DOUBT_STEP_KEYS,
  DOUBT_FLOW,
  summarizeDoubtSignals,
  hasRevision,
} from '../agent/doubtEngine'
import { selectDoubtTask } from '../agent/doubtSelector'
import { runAgent } from '../agent/localAgentEngine'
import { computeMasteryProfile, MASTERY_DIMENSIONS } from '../agent/masteryEngine'
import { ERROR_TYPES } from '../agent/errors'
import { navigate } from '../lib/router'
import { PageHead, Remind, EmptyState, Pill } from '../components/ui'

// ── 怀疑室首页 ──────────────────────────────────────────────
export function DoubtLabPage({ taskId }) {
  const { state } = useApp()
  const doneIds = new Set((state.doubtRuns || []).map((r) => r.taskId))

  // 首页推荐（允许 CONTINUITY：/doubt 页面新用户有默认路径，不伪造问题）
  const reco = selectDoubtTask(state, { allowContinuity: true })

  // 若带 task 参数直接进入该任务
  if (taskId) {
    const task = getDoubtTask(taskId)
    if (task) return <DoubtRunner task={task} reco={reco} />
    return <EmptyState title="找不到这个怀疑任务" action={<button className="btn" onClick={() => navigate('/doubt')}>返回怀疑室</button>} />
  }

  return (
    <div>
      <PageHead
        title="🧠 怀疑室"
        sub="看一句「玄学判断」，先问凭什么。每一次怀疑都会进入你的能力档案与 Agent 判断。"
        right={
          <span className="pill pill-indigo">已完成 {doneIds.size} / {DOUBT_TASKS.length}</span>
        }
      />

      {/* Agent 推荐：有认知漏洞时直接给出针对性任务 */}
      {reco && reco.taskId && (
        <DoubtRecommend reco={reco} />
      )}

      {DOUBT_CATEGORIES.map((cat) => {
        const list = doubtTasksByCategory(cat.id)
        const doneN = list.filter((t) => doneIds.has(t.id)).length
        return (
          <section key={cat.id} className="mt-16">
            <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
              <h3 style={{ fontSize: 16, margin: 0 }}>{cat.emoji} {cat.label}</h3>
              <span className="tiny muted">{cat.tip}</span>
              <span className="pill pill-gray" style={{ marginLeft: 'auto' }}>{doneN}/{list.length}</span>
            </div>
            <div className="grid-2 mt-12">
              {list.map((t) => {
                const done = doneIds.has(t.id)
                return (
                  <button
                    key={t.id}
                    className="card card-hover"
                    style={{ textAlign: 'left', opacity: done ? 0.72 : 1 }}
                    onClick={() => navigate(`/doubt?task=${t.id}`)}
                  >
                    <div className="spread">
                      <span style={{ fontSize: 22 }}>{t.emoji}</span>
                      {done ? <Pill tone="teal">已做过</Pill> : <Pill tone="gray">未做</Pill>}
                    </div>
                    <h4 className="mt-8" style={{ fontSize: 15 }}>{t.title}</h4>
                    <p className="muted tiny mt-8">「{t.statement || t.prompt}」</p>
                    {(t.errorTypes || []).length > 0 && (
                      <div className="row mt-8" style={{ gap: 6, flexWrap: 'wrap' }}>
                        {t.errorTypes.map((c) => (
                          <span key={c} className="pill pill-red" style={{ fontSize: 11 }}>{c}</span>
                        ))}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}

      <Remind icon="🧠">
        这里不是在教你「玄学是假的」，而是在训练一个核心能力：<b>看到一个说法，先问「凭什么」，
        而不是先问「灵不灵」。</b>开放回答没有标准答案，Agent 只看你的行为模式，不判断对错。
      </Remind>
    </div>
  )
}

// ── Agent 推荐卡片：为什么推荐 + 触发证据 + 要纠正的行为 ──────
function DoubtRecommend({ reco }) {
  const task = getDoubtTask(reco.taskId)
  return (
    <section className="card mt-16" style={{ borderLeft: '4px solid var(--amber)' }}>
      <div className="spread">
        <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: 1 }}>🧠 今天有一个地方值得怀疑</div>
        <span className="pill pill-amber">Agent 推荐</span>
      </div>
      <p className="mt-8" style={{ lineHeight: 1.8, fontSize: 15 }}>{reco.reason}</p>
      {(reco.targetError || reco.evidenceIds?.length > 0) && (
        <div className="row mt-12" style={{ gap: 8, flexWrap: 'wrap' }}>
          {reco.targetError && (
            <span className="pill pill-red">要纠正：{ERROR_TYPES[reco.targetError]?.name || reco.targetError}</span>
          )}
          {reco.expectedSkill && <span className="pill pill-indigo">训练：{reco.expectedSkill}</span>}
          {reco.evidenceIds?.length > 0 && (
            <span className="pill pill-gray">依据：{reco.evidenceIds.slice(0, 3).join('、')}</span>
          )}
        </div>
      )}
      <button className="btn btn-primary btn-lg mt-16" onClick={() => navigate(`/doubt?task=${reco.taskId}`)}>
        {task ? `${task.emoji} 开始怀疑「${task.title}」 →` : '开始这次怀疑 →'}
      </button>
    </section>
  )
}

// ── 怀疑任务执行器：材料 → 初始判断 → 证据 → 反例 → 修正 → 反思 ──
function DoubtRunner({ task, reco }) {
  const { state, dispatch } = useApp()
  const [run, setRun] = useState(() => startDoubtTask(task.id))
  const [stepIdx, setStepIdx] = useState(0)
  const [input, setInput] = useState('')
  const [optionIdx, setOptionIdx] = useState(null)
  const [confidence, setConfidence] = useState(50)
  const [doneResult, setDoneResult] = useState(null)
  const [before] = useState(() => ({
    profile: state.masteryProfile || computeMasteryProfile(state),
    agent: runAgent(state),
  }))

  if (!run) {
    return <EmptyState title="任务启动失败" action={<button className="btn" onClick={() => navigate('/doubt')}>返回怀疑室</button>} />
  }

  const step = DOUBT_FLOW[stepIdx]

  function writeEvidence(evidence) {
    evidence.forEach((partial) => dispatch({ type: 'RECORD_EVIDENCE', evidence: partial }))
  }

  function commit(stepKey, value, opts = {}) {
    const res = recordDoubtStep(run, stepKey, value, opts)
    writeEvidence(res.evidence)
    setRun(res.run)
    return res.run
  }

  function goto(n) {
    setStepIdx(n)
    setInput('')
    setOptionIdx(null)
    setConfidence(50)
  }

  function next() {
    const k = step.key
    if (k === 'material') {
      goto(1)
      return
    }
    if (k === 'hypothesis') {
      // 初始判断：选项文本 + 开放说明（若无选项则纯文本）
      let value
      if (task.options && task.options.length) {
        const optText = optionIdx != null ? task.options[optionIdx].text : ''
        const extra = input.trim()
        value = extra ? `${optText}；我的补充：${extra}` : optText
      } else {
        value = input.trim()
      }
      if (!String(value).trim()) return
      commit('hypothesis', value, { confidence })
    } else if (k === 'evidence') {
      const v = input.trim()
      if (!v) return
      commit('evidence', v)
    } else if (k === 'counterexample') {
      const v = input.trim() || '暂时没想到'
      commit('counterexample', v)
    } else if (k === 'revise') {
      const v = input.trim()
      if (!v) return
      commit('revise', v)
    } else if (k === 'reflect') {
      const v = input.trim()
      if (!v) return
      commit('reflect', v)
    }
    goto(stepIdx + 1)
  }

  function finish() {
    const finalRun = run
    const result = buildDoubtResult(finalRun)
    dispatch({ type: 'RECORD_DOUBT_RUN', run: result })
    setDoneResult(result)
  }

  if (doneResult) {
    return <DoubtDone task={task} result={doneResult} reco={reco} before={before} />
  }

  const valid =
    step.key === 'material'
      ? true
      : step.key === 'hypothesis'
        ? (task.options && task.options.length ? optionIdx != null : input.trim().length >= 1)
        : step.key === 'counterexample'
          ? true // 找不到反例也允许写「暂时没想到」
          : input.trim().length >= 1

  return (
    <div className="lesson-body">
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/doubt')}>← 怀疑室</button>

      <div className="card mt-12">
        <div className="spread" style={{ alignItems: 'baseline' }}>
          <div className="row" style={{ gap: 8 }}>
            <span style={{ fontSize: 22 }}>{task.emoji}</span>
            <h1 className="page-title" style={{ fontSize: 21, margin: 0 }}>{task.title}</h1>
          </div>
          <span className="tiny muted">第 {stepIdx + 1} / {DOUBT_FLOW.length} 步</span>
        </div>

        <div className="mt-12">
          <div className="bar">
            <div className="bar-fill indigo" style={{ width: `${Math.round((stepIdx / (DOUBT_FLOW.length - 1)) * 100)}%` }} />
          </div>
        </div>

        <h2 className="step-prompt">{step.label}</h2>
        <p className="muted tiny">{step.hint}</p>

        <div className="mt-16">
          {step.key === 'material' && (
            <div>
              <div className="feedback" style={{ background: 'rgba(28,26,23,0.03)' }}>
                <p className="tiny muted">{task.prompt || '有人说：'}</p>
                <p style={{ fontSize: 17, fontWeight: 600, marginTop: 6 }}>「{task.statement}」</p>
              </div>
              {task.hint && <p className="tiny muted mt-12">提示：{task.hint}</p>}
            </div>
          )}

          {step.key === 'hypothesis' && (
            <div>
              {task.options && task.options.length > 0 && (
                <div className="mt-8">
                  {task.options.map((o, i) => (
                    <button
                      key={i}
                      className={`option ${optionIdx === i ? 'selected' : ''}`}
                      style={optionIdx === i ? { borderColor: 'var(--indigo)', background: 'rgba(69,84,155,0.08)' } : undefined}
                      onClick={() => setOptionIdx(i)}
                    >
                      <span className="letter">{String.fromCharCode(65 + i)}</span>
                      {o.text}
                    </button>
                  ))}
                </div>
              )}
              <div className="field mt-12">
                <textarea rows={3} value={input} onChange={(e) => setInput(e.target.value)} placeholder="再写下你第一反应的补充解释（可选）……" />
              </div>
              <div className="metric-row" style={{ maxWidth: 340, marginTop: 12 }}>
                <label>初始信心</label>
                <input type="range" min={0} max={100} className="slider" value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} />
                <span style={{ fontWeight: 700, minWidth: 46, textAlign: 'right' }}>{confidence}%</span>
              </div>
            </div>
          )}

          {step.key === 'evidence' && (
            <div className="field">
              <textarea rows={4} value={input} onChange={(e) => setInput(e.target.value)} placeholder="写一条支持这个判断的依据——是原文？结构？还是只有感觉？" />
            </div>
          )}

          {step.key === 'counterexample' && (
            <div className="field">
              <textarea rows={4} value={input} onChange={(e) => setInput(e.target.value)} placeholder="主动找一个可能推翻它的反例；实在找不到就写「暂时没想到」……" />
            </div>
          )}

          {step.key === 'revise' && (
            <div className="field">
              <textarea rows={4} value={input} onChange={(e) => setInput(e.target.value)} placeholder="现在你会怎么修正初始判断？可以保持不变，但请说明理由……" />
            </div>
          )}

          {step.key === 'reflect' && (
            <div className="field">
              <textarea rows={4} value={input} onChange={(e) => setInput(e.target.value)} placeholder="这次训练里，你最容易卡在哪一步？" />
            </div>
          )}
        </div>

        <div className="row mt-16" style={{ justifyContent: 'space-between' }}>
          {stepIdx > 0 ? (
            <button className="btn btn-ghost" onClick={() => goto(stepIdx - 1)}>← 上一步</button>
          ) : (
            <span />
          )}
          {step.key === 'reflect' ? (
            <button className="btn btn-primary" disabled={!valid} onClick={finish}>✅ 完成这次怀疑</button>
          ) : (
            <button className="btn btn-primary" disabled={!valid} onClick={next}>
              {step.key === 'material' ? '我准备好了 →' : '记下并继续 →'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 完成后展示：「这次改变了什么？」 ──────────────────────────
function DoubtDone({ task, result, reco, before }) {
  const { state } = useApp()
  const afterProfile = state.masteryProfile || computeMasteryProfile(state)
  const afterAgent = runAgent(state)
  const sig = result.signals || summarizeDoubtSignals(result)
  const beforeProfile = before.profile
  const beforeAgent = before.agent

  const dimLabel = (k) => MASTERY_DIMENSIONS.find((d) => d.key === k)?.label || k
  const dimKeys = ['evidence', 'counterexample', 'uncertainty', 'reasoning', 'synthesis']
  const diffs = dimKeys
    .map((k) => ({
      key: k,
      label: dimLabel(k),
      before: beforeProfile?.[k] ?? 0,
      after: afterProfile?.[k] ?? 0,
    }))
    .filter((d) => d.after !== d.before)

  const beforeAction = beforeAgent?.nextAction
  const afterAction = afterAgent?.nextAction
  const actionChanged = beforeAction?.title !== afterAction?.title

  return (
    <div className="lesson-body">
      <div className="card mt-12">
        <div className="spread">
          <h1 className="page-title" style={{ fontSize: 22, margin: 0 }}>🧪 这次怀疑完成了</h1>
          <span className="pill pill-teal">{task.emoji} {task.title}</span>
        </div>

        {/* 原来为什么推荐（原行为模式） */}
        <div className="mt-16" style={{ background: 'rgba(28,26,23,0.04)', borderRadius: 12, padding: 12 }}>
          <b className="tiny">🔍 原来的行为模式</b>
          <p className="tiny mt-8" style={{ lineHeight: 1.8 }}>
            {reco ? reco.reason : `怀疑任务「${task.title}」——重点训练「先问凭什么」。`}
          </p>
        </div>

        {/* 本次实际行为（deterministic 信号，不判对错） */}
        <div className="mt-16">
          <b className="tiny">✍️ 本次实际行为</b>
          <div className="row mt-8" style={{ gap: 8, flexWrap: 'wrap' }}>
            <Pill tone={sig.mentionedEvidence ? 'teal' : 'gray'}>{sig.mentionedEvidence ? '✓ 主动找证据' : '未提证据'}</Pill>
            <Pill tone={sig.mentionedCounterexample ? 'teal' : 'gray'}>{sig.mentionedCounterexample ? '✓ 主动找反例' : '未提反例'}</Pill>
            <Pill tone={sig.mentionedUncertainty ? 'teal' : 'gray'}>{sig.mentionedUncertainty ? '✓ 提到不确定' : '未提不确定'}</Pill>
            <Pill tone={sig.selfCorrection ? 'teal' : 'gray'}>{sig.selfCorrection ? '✓ 有自我修正' : '未修正'}</Pill>
            <Pill tone={sig.absoluteClaims > 0 ? 'red' : 'teal'}>{sig.absoluteClaims > 0 ? `⚠ 绝对化措辞 ${sig.absoluteClaims}` : '无绝对化措辞'}</Pill>
          </div>
          {result.hasRevision && (
            <div className="tiny mt-8" style={{ color: 'var(--teal-deep)' }}>观点有实质修正 → 已形成 BeliefRevision 记录。</div>
          )}
        </div>

        {/* 能力变化（真实维度，非得分） */}
        <div className="mt-16">
          <b className="tiny">📈 能力档案变化</b>
          {diffs.length === 0 ? (
            <p className="tiny muted mt-8">本次行为没有改变能力维度（浏览/空文本不计分，这是正常现象）。</p>
          ) : (
            <div className="grid-2 mt-8">
              {diffs.map((d) => (
                <div key={d.key} className="stat-card">
                  <div className="num" style={{ color: d.after > d.before ? 'var(--teal-deep)' : 'var(--amber-deep)' }}>
                    {d.before} → {d.after}
                  </div>
                  <div className="lbl">{d.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 错误状态变化 */}
        <div className="mt-16">
          <b className="tiny">🪤 错误状态</b>
          <div className="row mt-8" style={{ gap: 8, flexWrap: 'wrap' }}>
            {(result.errorTypes || []).length > 0 ? (
              result.errorTypes.map((c) => (
                <span key={c} className="pill pill-red">{ERROR_TYPES[c]?.name || c}（{c}）</span>
              ))
            ) : (
              <span className="tiny muted">本次任务未挂接具体错误类型。</span>
            )}
          </div>
        </div>

        {/* Agent 下一步变化 */}
        <div className="mt-16" style={{ background: 'rgba(69,84,155,0.06)', borderRadius: 12, padding: 12 }}>
          <b className="tiny">🤖 Agent 下一步变化</b>
          <p className="tiny mt-8" style={{ lineHeight: 1.8 }}>
            之前：{beforeAction ? `「${beforeAction.title}」` : '—'}
          </p>
          <p className="tiny mt-4" style={{ lineHeight: 1.8 }}>
            现在：{afterAction ? `「${afterAction.title}」` : '—'}
            {actionChanged ? '（推荐已更新）' : '（推荐保持不变）'}
          </p>
        </div>

        <div className="row mt-20" style={{ justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={() => navigate('/doubt')}>返回怀疑室</button>
          <button className="btn btn-primary" onClick={() => navigate('/growth')}>去看成长档案 →</button>
        </div>
      </div>
    </div>
  )
}
