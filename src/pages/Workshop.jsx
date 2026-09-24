// ============================================================
// R3 Phase 1 · 易工坊「实战工作台」
//
// 6 个工作台，每个都有明确任务目标（不是资料展示页）：
//   ① 卦象工作台  观察结构（事实 vs 解释）
//   ② 爻研究台    研究爻位与爻辞（为什么换爻会变）
//   ③ 经典解读台  原文 → 自己解释 → 对照传统/现代 → 找误读
//   ④ 案例分析台  案例 → 证据 → 反例 → 结论 → 把握
//   ⑤ 解释构建台  提出并修正解释（本阶段最重要）
//   ⑥ 自由研究台  跨对象自由探索，每步留痕
//
// 所有有意义行为经 `recordWorkshop` 写入统一 Evidence，
// 开放输入只做确定性规则检查，绝不伪造「AI 评分 / 深层正确性」。
// ============================================================
import React, { useEffect, useMemo, useState } from 'react'
import { useApp } from '../store/AppContext'
import { PageHead, Remind, Segmented, Pill } from '../components/ui'
import { getHexagramProfile, HEXAGRAM_PROFILES, TRADITION_REF } from '../data/iching/hexagramProfile'
import { getTerm } from '../data/iching/termData'
import { ICHING_CASES, getCaseById } from '../data/iching/caseGraph'
import {
  WORKSHOPS,
  recordWorkshop,
  checkStructureObservation,
  profileStructureFacts,
  classifyStructureFact,
  checkYaoAnalysis,
  checkClassicReading,
  caseEvidenceCandidates,
  checkCaseFlow,
  checkExplanationDraft,
  REFLECT_OPTIONS,
  relatedResearch,
  workshopTargetLabel,
  workshopHome,
  NEW_USER_PATH,
  CLASSIC_ENTRIES,
  detectAbsolutes,
} from '../agent/workshopEngine'
import { WORKSHOP_BENCHES, WORKSHOP_TASKS, getWorkshopTask, workshopTasksByBench } from '../data/workshopTasks'

// ── 卦画（复用档案样式类）──────────────────────────────────
function Glyph({ lines, size = 'md' }) {
  const arr = (lines || '').split('')
  return (
    <div className={`archive-glyph ag-${size}`}>
      {[5, 4, 3, 2, 1, 0].map((i) => (
        <div key={i} className={`ag-line ${arr[i] === '1' ? 'ag-yang' : 'ag-yin'}`}>
          <span className="ag-bar" />
          {arr[i] === '0' && <span className="ag-bar" />}
        </div>
      ))}
    </div>
  )
}

function BenchShell({ title, goal, benchId, onBack, children }) {
  return (
    <div>
      <div className="row" style={{ alignItems: 'center', gap: 10 }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← 返回工坊</button>
        <h2 style={{ fontSize: 18, margin: 0 }}>{title}</h2>
      </div>
      <Remind icon="🎯">{goal}</Remind>
      {children}
      {benchId && <TrainPanel benchId={benchId} />}
    </div>
  )
}

// ── 可重复训练任务面板（易工坊内容扩充：每工作台 12 个训练任务）──
// 任务真实关联卦/爻/经典/案例/术语/传统，完成即写 Evidence（source=workshop，
// action=complete），进入 Mastery → Agent 闭环。确定性：无随机、无 LLM。
function TrainPanel({ benchId }) {
  const { state, dispatch } = useApp()
  const tasks = workshopTasksByBench(benchId)
  const bench = WORKSHOP_BENCHES.find((b) => b.id === benchId)
  const [selId, setSelId] = useState(tasks[0]?.id || null)
  const [doneIds, setDoneIds] = useState([])
  if (!tasks.length) return null

  const task = getWorkshopTask(selId)
  const evidenceDone = (state.evidence || []).some(
    (e) => e.source === 'workshop' && e.action === 'complete' && e.targetType === 'task' && e.targetId === task?.id
  )
  const justDone = doneIds.includes(task?.id)

  function pick(id) {
    setSelId(id)
    setDoneIds((d) => d.filter((x) => x !== id))
  }
  function completeTask() {
    if (!task) return
    dispatch({
      type: 'RECORD_EVIDENCE',
      evidence: {
        source: 'workshop',
        action: 'complete',
        targetType: 'task',
        targetId: task.id,
        context: `${bench?.label || benchId} 训练任务`,
        result: 'correct',
        masteryKey: task.masteryKeys?.[0] || 'reasoning',
        errorTypes: task.errorTypes || [],
      },
    })
    setDoneIds((d) => [...d, task.id])
  }

  const DIFF = { 1: '入门', 2: '进阶', 3: '高阶', 4: '综合', 5: '挑战' }
  const TYPE_LABEL = { identify: '识别', compare: '比较', judge: '判断边界', construct: '构建解释', hunt: '找反例', trace: '追溯证据' }

  return (
    <div className="card mt-16" style={{ borderLeft: '4px solid var(--indigo)' }}>
      <div className="spread">
        <h4 style={{ fontSize: 15 }}>🎯 可重复训练任务（{tasks.length}）</h4>
        <span className="pill pill-indigo">训练目标明确 · 可复用</span>
      </div>
      <div className="mt-8" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {tasks.map((t) => (
          <button
            key={t.id}
            className={`pill ${t.id === selId ? 'pill-indigo' : 'pill-gray'}`}
            style={{ cursor: 'pointer', border: 'none' }}
            onClick={() => pick(t.id)}
          >
            {t.title}
          </button>
        ))}
      </div>
      {task && (
        <div className="mt-12">
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <span className="pill pill-amber">难度 {task.difficulty} · {DIFF[task.level]}</span>
            <span className="pill pill-gray">题型：{TYPE_LABEL[task.type] || task.type}</span>
            <span className="pill pill-gray">训练：{(task.expectedSkills || []).join(' / ')}</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 10 }}>{task.goal}</div>
          <p className="mt-6" style={{ fontSize: 14, lineHeight: 1.7 }}>{task.prompt}</p>
          {task.example && (
            <div className="mt-8" style={{ borderLeft: '3px solid var(--indigo, #4338ca)', paddingLeft: 12 }}>
              <div className="tiny" style={{ fontWeight: 700, color: 'var(--indigo, #4338ca)' }}>💡 示例</div>
              <p className="mt-4" style={{ fontSize: 13, lineHeight: 1.7 }}>{task.example}</p>
            </div>
          )}
          <ol className="mt-8" style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(task.questions || []).map((q, i) => <li key={i} style={{ fontSize: 14 }}>{q}</li>)}
          </ol>
          {(task.relatedTerms || []).length > 0 && (
            <p className="tiny muted mt-8">关联术语：{task.relatedTerms.join('、')}</p>
          )}
          <div className="mt-12">
            {justDone || evidenceDone ? (
              <p className="tiny" style={{ color: 'var(--teal-deep, #0f7b6c)' }}>✓ 本次训练已记录为 Evidence（能力档案将随之更新，Agent 可据此调整下一步推荐）。</p>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={completeTask}>✔ 完成本任务</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Select({ value, onChange, children, label }) {
  return (
    <label className="tiny muted" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ minWidth: 200, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--line, #e5e1da)' }}
      >
        {children}
      </select>
    </label>
  )
}

// ============================================================
// ① 卦象工作台
// ============================================================
function HexagramBench({ onBack }) {
  const { dispatch } = useApp()
  const [seq, setSeq] = useState(1)
  const [facts, setFacts] = useState(['', '', ''])
  const [kinds, setKinds] = useState(['fact', 'fact', 'fact'])
  const [submitted, setSubmitted] = useState(false)
  const [revealed, setRevealed] = useState(false)

  const profile = getHexagramProfile(seq)
  const check = checkStructureObservation(profile, facts)

  useEffect(() => {
    recordWorkshop(dispatch, { action: 'view', targetType: 'hexagram', targetId: seq })
  }, [seq])

  function choose(s) {
    setSeq(Number(s))
    setSubmitted(false)
    setRevealed(false)
  }
  function setFact(i, v) {
    // 打字时自动给出「事实/解释/未定」的规则提示（只提示、不评分）
    setFacts((f) => f.map((x, j) => (j === i ? v : x)))
    const c = classifyStructureFact(v)
    setKinds((k) => k.map((x, j) => (j === i ? c.kind : x)))
  }
  function submit() {
    const filled = facts.map((f, i) => ({ text: f, kind: kinds[i], auto: classifyStructureFact(f).kind }))
    recordWorkshop(dispatch, {
      action: 'observe',
      targetType: 'hexagram',
      targetId: seq,
      context: { facts: filled },
      result: { count: check.count, complete: check.complete },
    })
    recordWorkshop(dispatch, {
      action: 'identify',
      targetType: 'hexagram',
      targetId: seq,
      context: { kinds },
      result: {
        factCount: kinds.filter((k) => k === 'fact').length,
        interpretationCount: kinds.filter((k) => k === 'interpretation').length,
      },
    })
    setSubmitted(true)
  }
  function revealReference() {
    setRevealed(true)
    recordWorkshop(dispatch, {
      action: 'compare',
      targetType: 'hexagram',
      targetId: seq,
      result: { reference: profileStructureFacts(profile) },
    })
  }

  const KIND_LABEL = { fact: '事实', interpretation: '解释', unclear: '未定' }
  const KIND_TONE = { fact: 'teal', interpretation: 'amber', unclear: 'gray' }

  return (
    <BenchShell title="① 卦象工作台" benchId="hexagram" goal="先写下你看到的结构事实，再把「事实」和「解释」分开。" onBack={onBack}>
      <div className="row mt-12" style={{ alignItems: 'center', gap: 12 }}>
        {profile && <Glyph lines={profile.binaryPattern} />}
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{profile?.name}卦 · {profile?.traditionalName}</div>
          <div className="tiny muted">第 {seq} 卦 · 只看卦画，你能看出什么「结构」？</div>
        </div>
        <Select value={seq} onChange={choose} label="换一卦">
          {HEXAGRAM_PROFILES.map((p) => (
            <option key={p.number} value={p.number}>{p.number} · {p.name}（{p.traditionalName}）</option>
          ))}
        </Select>
      </div>

      <div className="card mt-16">
        <h4 style={{ fontSize: 15 }}>写下 3 个「结构事实」（例如上下卦、阴阳数、错/综/互）</h4>
        {facts.map((f, i) => (
          <div key={i} className="mt-8">
            <div className="row" style={{ gap: 8 }}>
              <input
                className="input-text"
                style={{ flex: 1 }}
                placeholder={`第 ${i + 1} 个观察…`}
                value={f}
                onChange={(e) => setFact(i, e.target.value)}
              />
              <Pill tone={KIND_TONE[kinds[i]]}>判为：{KIND_LABEL[kinds[i]]}</Pill>
            </div>
          </div>
        ))}
        <p className="tiny muted mt-8">
          这是关键词级规则判断，不真正读懂句意；「吉/凶/代表/象征」这类词通常更像「解释」，「上/下卦/错/综/互/阴阳」更像「事实」。
        </p>
        <div className="row mt-12" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-primary btn-sm" disabled={check.count < 1} onClick={submit}>提交观察</button>
        </div>
      </div>

      {submitted && (
        <div className="feedback good mt-12">
          <h4>已记录 {check.count} 条观察{check.complete ? '（满足 3 条结构观察）' : '（建议写满 3 条再深入）'}</h4>
          <p className="tiny mt-8">这只是「你写了什么」的确定记录，不评价对错。下面可对照系统按规则推导的结构事实。</p>
          {!revealed && (
            <div className="row mt-8">
              <button className="btn btn-soft btn-sm" onClick={revealReference}>对照参考结构 →</button>
            </div>
          )}
        </div>
      )}

      {revealed && profile && (
        <div className="card mt-12">
          <h4 style={{ fontSize: 15 }}>系统推导的结构事实（供对照）</h4>
          <ul className="mt-8" style={{ paddingLeft: 18 }}>
            {profileStructureFacts(profile).map((f, i) => <li key={i} style={{ fontSize: 14 }}>{f}</li>)}
          </ul>
          <p className="tiny muted mt-8">对照一下：哪些你写到了？哪些是「解释」其实不是「事实」？</p>
        </div>
      )}
    </BenchShell>
  )
}

// ============================================================
// ② 爻研究台
// ============================================================
function YaoBench({ onBack }) {
  const { dispatch } = useApp()
  const [seq, setSeq] = useState(1)
  const [pos, setPos] = useState(0)
  const [answer, setAnswer] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const profile = getHexagramProfile(seq)
  const yao = profile?.yao[pos]
  const check = checkYaoAnalysis(yao, answer)

  useEffect(() => {
    if (yao) recordWorkshop(dispatch, { action: 'view', targetType: 'yao', targetId: yao.id })
  }, [seq, pos])

  function submit() {
    if (!answer.trim()) return
    recordWorkshop(dispatch, {
      action: 'analyze',
      targetType: 'yao',
      targetId: yao.id,
      context: { answer },
      result: check,
    })
    setSubmitted(true)
  }

  return (
    <BenchShell title="② 爻研究台" benchId="yao" goal="说清：为什么同一卦换一个爻，解释就可能变化？" onBack={onBack}>
      <div className="row mt-12" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Select value={seq} onChange={(v) => { setSeq(Number(v)); setSubmitted(false) }} label="卦">
          {HEXAGRAM_PROFILES.map((p) => <option key={p.number} value={p.number}>{p.number} · {p.name}</option>)}
        </Select>
        <Select value={pos} onChange={(v) => { setPos(Number(v)); setSubmitted(false) }} label="爻位">
          {[0, 1, 2, 3, 4, 5].map((i) => <option key={i} value={i}>{profile?.yao[i]?.name}</option>)}
        </Select>
      </div>

      {yao && (
        <div className="card mt-16">
          <div className="spread">
            <h4 style={{ fontSize: 16 }}>{yao.name}</h4>
            <span className="pill pill-gray">{yao.lineType}爻 · {yao.innerOuter}</span>
          </div>
          {yao.originalText ? (
            <p className="display guaci-quote mt-8">「{yao.originalText}」</p>
          ) : (
            <p className="tiny muted mt-8">该爻爻辞全文「暂无可靠整理」。</p>
          )}
          <div className="rel-grid mt-8">
            <div className="rel-tag">{yao.deweiLabel}</div>
            <div className="rel-tag">{yao.zhong ? `居中${yao.zhongzheng ? '且得正（中正）' : '（未得正）'}` : '不在中位'}</div>
            {yao.ying && <div className="rel-tag">与{yao.ying.partnerLabel}爻：{yao.ying.type}</div>}
            {yao.cheng && <div className="rel-tag">{yao.cheng.type}</div>}
            {yao.ling && <div className="rel-tag">{yao.ling.type}</div>}
          </div>
          <p className="tiny muted mt-8">{yao.positionLabel}爻 —— {yao.positionMeaning}</p>
        </div>
      )}

      <div className="field mt-16">
        <label style={{ fontSize: 15, fontWeight: 600 }}>为什么换成别的爻，解释就可能变化？</label>
        <textarea
          rows={3}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="试着说清：这个爻的位置（得位/中/应/承/乘）如何影响它的含义……"
        />
      </div>
      <div className="row mt-12" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" disabled={!answer.trim()} onClick={submit}>提交分析</button>
      </div>

      {submitted && (
        <div className="feedback good mt-12">
          <h4>已记录你的分析</h4>
          <p className="tiny mt-8">
            你提到了 {check.count} 个结构类关键词（{check.mentioned.length ? check.mentioned.join('、') : '暂无'}）。
            {check.count >= 2 ? '你已经在用结构解释爻位了。' : '可以再想想：得位 / 中 / 应 / 承 / 乘 这些位置关系里，哪几个决定了这个爻？'}
          </p>
        </div>
      )}
    </BenchShell>
  )
}

// ============================================================
// ③ 经典解读台
// ============================================================
function ClassicBench({ onBack }) {
  const { dispatch } = useApp()
  const [idx, setIdx] = useState(0)
  const [own, setOwn] = useState('')
  const [misread, setMisread] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const entry = useMemo(() => CLASSIC_ENTRIES[idx % CLASSIC_ENTRIES.length], [idx])
  const check = checkClassicReading(own, misread)

  useEffect(() => {
    recordWorkshop(dispatch, { action: 'view', targetType: 'classic', targetId: entry.id })
  }, [entry.id])

  function nextEntry() {
    setIdx(idx + 1)
    setOwn('')
    setMisread('')
    setSubmitted(false)
  }
  function submit() {
    recordWorkshop(dispatch, {
      action: 'interpret',
      targetType: 'classic',
      targetId: entry.id,
      context: { own, misread },
      result: check,
    })
    if (misread.trim()) {
      recordWorkshop(dispatch, { action: 'reflect', targetType: 'classic', targetId: entry.id, context: { misread } })
    }
    recordWorkshop(dispatch, {
      action: 'compare',
      targetType: 'classic',
      targetId: entry.id,
      result: { traditional: entry.traditionalNote, modern: entry.modernNote },
    })
    setSubmitted(true)
  }

  return (
    <BenchShell title="③ 经典解读台" benchId="classic" goal="自己先解释，再对照传统解释与现代说明，找出自己可能误读的地方。" onBack={onBack}>
      <div className="card mt-12">
        <div className="spread">
          <span className="pill pill-gray">{entry.source} · {entry.chapter}</span>
          <button className="btn btn-ghost btn-sm" onClick={nextEntry}>换一段 →</button>
        </div>
        <p className="display mt-8" style={{ fontSize: 16 }}>{entry.original}</p>
      </div>

      <div className="field mt-16">
        <label style={{ fontSize: 15, fontWeight: 600 }}>① 先用自己的话解释一遍</label>
        <textarea rows={3} value={own} onChange={(e) => setOwn(e.target.value)} placeholder="不查资料，先写下你怎么理解这段话……" />
        {detectAbsolutes(own).length > 0 && (
          <p className="tiny" style={{ color: 'var(--danger)' }}>检测到绝对化表达：{detectAbsolutes(own).join('、')}。原文给的是视角与条件，不是判决。</p>
        )}
      </div>

      <div className="field mt-12">
        <label style={{ fontSize: 15, fontWeight: 600 }}>② 你觉得自己可能误读 / 忽略了什么？（可留白）</label>
        <textarea rows={2} value={misread} onChange={(e) => setMisread(e.target.value)} placeholder="例如：我可能把它当成了固定吉凶，而没看它成立的条件……" />
      </div>

      <div className="row mt-12" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" disabled={!check.ownDone} onClick={submit}>提交我的解读</button>
      </div>

      {submitted && (
        <div className="card mt-16" style={{ background: 'var(--bg-warm)' }}>
          <h4 style={{ fontSize: 15 }}>对照材料（读原文后的参考，非唯一答案）</h4>
          {entry.traditionalNote ? (
            <p className="mt-8" style={{ fontSize: 14 }}><b>传统解释：</b>{entry.traditionalNote}</p>
          ) : null}
          {entry.modernNote ? (
            <p className="tiny muted mt-8"><b>现代辅助：</b>{entry.modernNote}</p>
          ) : null}
          {entry.wrongMeanings?.length > 0 && (
            <p className="tiny muted mt-8">常见误读：{entry.wrongMeanings.join('；')}</p>
          )}
          <p className="tiny muted mt-8">你写下了自己的解释{check.misreadDone ? '，并标注了可能误读之处' : '；可再补一句「我可能漏了什么」'}——系统不判断你的对错。</p>
        </div>
      )}
    </BenchShell>
  )
}

// ============================================================
// ④ 案例分析台
// ============================================================
function CaseBench({ onBack }) {
  const { dispatch } = useApp()
  const [caseId, setCaseId] = useState(ICHING_CASES[0]?.id || '')
  const [relatedSeq, setRelatedSeq] = useState(1)
  const [evIdx, setEvIdx] = useState([])
  const [hasCounter, setHasCounter] = useState(null)
  const [counterNote, setCounterNote] = useState('')
  const [conclusion, setConclusion] = useState('')
  const [confidence, setConfidence] = useState(null)
  const [submitted, setSubmitted] = useState(false)

  const c = getCaseById(caseId)
  const candidates = caseEvidenceCandidates(c)

  useEffect(() => {
    if (caseId) recordWorkshop(dispatch, { action: 'view', targetType: 'case', targetId: caseId })
  }, [caseId])

  function changeCase(id) {
    setCaseId(id)
    setEvIdx([])
    setHasCounter(null)
    setCounterNote('')
    setConclusion('')
    setConfidence(null)
    setSubmitted(false)
  }
  function toggleEv(i) {
    setEvIdx((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]))
  }
  function submit() {
    const flow = checkCaseFlow({
      relatedChosen: true,
      evidenceChosen: evIdx.length > 0,
      hasCounter,
      counterNote,
      conclusion,
      confidence,
    })
    recordWorkshop(dispatch, {
      action: 'analyze',
      targetType: 'case',
      targetId: caseId,
      context: { relatedSeq, conclusion, confidence, hasCounter, counterNote },
      result: flow,
    })
    if (evIdx.length > 0) {
      recordWorkshop(dispatch, {
        action: 'evidence',
        targetType: 'case',
        targetId: caseId,
        context: { chosen: evIdx.map((i) => candidates[i]) },
        result: { count: evIdx.length },
      })
    }
    if (hasCounter) {
      recordWorkshop(dispatch, {
        action: 'counterexample',
        targetType: 'case',
        targetId: caseId,
        context: { note: counterNote },
        result: { hasCounter: true },
      })
    }
    setSubmitted(true)
  }

  if (!c) {
    return <BenchShell title="④ 案例分析台" benchId="case" goal="" onBack={onBack}><p className="muted mt-16">暂无易经案例。</p></BenchShell>
  }

  return (
    <BenchShell title="④ 案例分析台" benchId="case" goal="先观察案例，再选卦/爻、引用证据、检查反例，最后给结论并说明把握。" onBack={onBack}>
      <Select value={caseId} onChange={changeCase} label="选择案例">
        {ICHING_CASES.map((x) => <option key={x.id} value={x.id}>{c ? x.title : ''}</option>)}
      </Select>

      <div className="card mt-12">
        <h4 style={{ fontSize: 16 }}>{c.title}</h4>
        {c.situation?.map((s, i) => <p key={i} className="mt-8" style={{ fontSize: 14 }}>· {s}</p>)}
        {c.chart?.length > 0 && (
          <div className="mt-8">
            <div className="tiny muted">{c.chartLabel}</div>
            {c.chart.map((r, i) => (
              <div key={i} className="row mt-4" style={{ gap: 8 }}>
                <Pill tone="gray">{r.key}</Pill>
                <span style={{ fontSize: 14 }}>{r.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="field mt-12">
        <label style={{ fontSize: 15, fontWeight: 600 }}>① 这个案例让你联想到哪一卦 / 爻？</label>
        <Select value={relatedSeq} onChange={(v) => setRelatedSeq(Number(v))} label="相关卦">
          {HEXAGRAM_PROFILES.map((p) => <option key={p.number} value={p.number}>{p.name}（{p.traditionalName}）</option>)}
        </Select>
      </div>

      <div className="field mt-12">
        <label style={{ fontSize: 15, fontWeight: 600 }}>② 你引用了哪些「证据」？（多选）</label>
        {candidates.length === 0 && <p className="tiny muted mt-8">本案例暂无结构化证据候选，你可把结论依据写进下方「结论」。</p>}
        <div className="mt-8" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {candidates.map((e, i) => (
            <button
              key={i}
              className={`option ${evIdx.includes(i) ? 'correct' : ''}`}
              onClick={() => toggleEv(i)}
            >
              <span className="option-text" style={{ fontSize: 13 }}>
                <Pill tone={e.type === 'situation' ? 'teal' : 'amber'}>{e.type === 'situation' ? '情境' : '图表'}</Pill> {e.text}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="field mt-12">
        <label style={{ fontSize: 15, fontWeight: 600 }}>③ 有没有「反例」让这个结论可能不成立？</label>
        <div className="row mt-8" style={{ gap: 8 }}>
          <Segmented
            items={[{ value: 'yes', label: '有' }, { value: 'no', label: '没有' }]}
            value={hasCounter === null ? '' : (hasCounter ? 'yes' : 'no')}
            onChange={(v) => setHasCounter(v === 'yes')}
          />
        </div>
        {hasCounter && (
          <textarea className="mt-8" rows={2} value={counterNote} onChange={(e) => setCounterNote(e.target.value)} placeholder="写下这个反例……" />
        )}
      </div>

      <div className="field mt-12">
        <label style={{ fontSize: 15, fontWeight: 600 }}>④ 你的结论（可留白表示「目前无法判断」）</label>
        <textarea rows={2} value={conclusion} onChange={(e) => setConclusion(e.target.value)} placeholder="在什么条件下，这个判断成立？" />
      </div>

      <div className="field mt-12">
        <label style={{ fontSize: 15, fontWeight: 600 }}>⑤ 对这个结论的把握</label>
        <Segmented
          items={[{ value: 'high', label: '较有把握' }, { value: 'mid', label: '一半一半' }, { value: 'low', label: '不确定' }]}
          value={confidence || ''}
          onChange={setConfidence}
        />
      </div>

      <div className="row mt-16" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={submit}>提交分析</button>
      </div>

      {submitted && (
        <div className={`feedback ${checkCaseFlow({ relatedChosen: true, evidenceChosen: evIdx.length > 0, hasCounter, conclusion, confidence, counterNote }).complete ? 'good' : 'warn'} mt-12`}>
          <h4>已记录</h4>
          <p className="tiny mt-8">
            你选了卦、{evIdx.length > 0 ? `引用了 ${evIdx.length} 条证据` : '未引用证据'}、
            {hasCounter ? '找到了反例' : hasCounter === false ? '认为没有反例' : '未检查反例'}、
            {conclusion.trim() ? '给出了结论' : '未给结论'}。
            缺少：{checkCaseFlow({ relatedChosen: true, evidenceChosen: evIdx.length > 0, hasCounter, conclusion, confidence, counterNote }).missing.join('、') || '无'}。
          </p>
        </div>
      )}
    </BenchShell>
  )
}

// ============================================================
// ⑤ 解释构建台（本阶段最重要）
// ============================================================
function ExplainBench({ onBack }) {
  const { dispatch } = useApp()
  const [seq, setSeq] = useState(1)
  const [observed, setObserved] = useState('')
  const [explanation, setExplanation] = useState('')
  const [basis, setBasis] = useState('')
  const [counterexample, setCounterexample] = useState('')
  const [uncertainty, setUncertainty] = useState('')
  const [stage, setStage] = useState('draft') // draft → reflect → revise → done
  const [reflectChoice, setReflectChoice] = useState(null)
  const [revised, setRevised] = useState('')

  const profile = getHexagramProfile(seq)
  const draftCheck = checkExplanationDraft({ observed, explanation, basis, counterexample, uncertainty })

  useEffect(() => {
    recordWorkshop(dispatch, { action: 'view', targetType: 'hexagram', targetId: seq })
  }, [seq])

  function submitDraft() {
    recordWorkshop(dispatch, {
      action: 'construct',
      targetType: 'hexagram',
      targetId: seq,
      context: { observed, explanation, basis },
      result: draftCheck,
    })
    if (counterexample.trim()) {
      recordWorkshop(dispatch, { action: 'counterexample', targetType: 'hexagram', targetId: seq, context: { counterexample } })
    }
    if (uncertainty.trim()) {
      recordWorkshop(dispatch, { action: 'reflect', targetType: 'hexagram', targetId: seq, context: { uncertainty } })
    }
    setStage('reflect')
  }
  function submitReflect() {
    if (!reflectChoice) return
    const opt = REFLECT_OPTIONS.find((o) => o.value === reflectChoice)
    recordWorkshop(dispatch, {
      action: 'reflect',
      targetType: 'hexagram',
      targetId: seq,
      context: { choice: reflectChoice, label: opt?.label },
    })
    setStage('revise')
  }
  function submitRevise() {
    if (!revised.trim()) return
    recordWorkshop(dispatch, {
      action: 'revise',
      targetType: 'hexagram',
      targetId: seq,
      context: { before: explanation, after: revised },
    })
    setExplanation(revised)
    recordWorkshop(dispatch, {
      action: 'complete',
      targetType: 'hexagram',
      targetId: seq,
      context: { final: revised },
    })
    setStage('done')
  }

  return (
    <BenchShell title="⑤ 解释构建台" benchId="explain" goal="完整走一遍：观察 → 解释 → 依据 → 反例 → 不确定 → 反思 → 修正。" onBack={onBack}>
      <div className="row mt-12" style={{ alignItems: 'center', gap: 12 }}>
        {profile && <Glyph lines={profile.binaryPattern} />}
        <div style={{ fontSize: 16, fontWeight: 700 }}>{profile?.name}卦 · {profile?.traditionalName}</div>
        <Select value={seq} onChange={(v) => setSeq(Number(v))} label="换一卦" />
      </div>
      {profile && <p className="guaci-quote mt-8" style={{ fontSize: 15 }}>{profile.guaci}</p>}

      {stage === 'draft' && (
        <div className="mt-12">
          <div className="field">
            <label style={{ fontSize: 15, fontWeight: 600 }}>① 我观察到什么（事实，别急着解释）</label>
            <textarea rows={2} value={observed} onChange={(e) => setObserved(e.target.value)} placeholder="先只记你看到的结构事实……" />
          </div>
          <div className="field mt-12">
            <label style={{ fontSize: 15, fontWeight: 600 }}>② 我的解释（一种解释，不是结论）</label>
            <textarea rows={2} value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="我认为这个卦 / 爻意味着……" />
          </div>
          <div className="field mt-12">
            <label style={{ fontSize: 15, fontWeight: 600 }}>③ 我的依据（引用原文 / 经典 / 结构）</label>
            <textarea rows={2} value={basis} onChange={(e) => setBasis(e.target.value)} placeholder="我这样说，依据是……" />
          </div>
          <div className="field mt-12">
            <label style={{ fontSize: 15, fontWeight: 600 }}>④ 反例（有没有情况会让它不成立？）</label>
            <textarea rows={2} value={counterexample} onChange={(e) => setCounterexample(e.target.value)} placeholder="如果换一个爻位 / 换一种处境，它可能就不对了……" />
          </div>
          <div className="field mt-12">
            <label style={{ fontSize: 15, fontWeight: 600 }}>⑤ 不确定之处（哪些我还说不准）</label>
            <textarea rows={2} value={uncertainty} onChange={(e) => setUncertainty(e.target.value)} placeholder="这里的含义我其实还不确定……" />
          </div>

          {draftCheck.missing.length > 0 && (
            <div className="feedback warn mt-12">
              <h4>还差一些要素</h4>
              <p className="tiny mt-8">尚未填写：{draftCheck.missing.join('、')}。（这是确定性检查，不是评价你的对错。）</p>
            </div>
          )}
          {draftCheck.absolutes.length > 0 && (
            <p className="tiny mt-8" style={{ color: 'var(--danger)' }}>检测到绝对化表达：{draftCheck.absolutes.join('、')}。试着给它加一个「在……条件下」。</p>
          )}
          <div className="row mt-12" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" disabled={!draftCheck.explanationDone || !draftCheck.basisDone} onClick={submitDraft}>提交解释</button>
          </div>
        </div>
      )}

      {stage === 'reflect' && (
        <div className="mt-12">
          <p style={{ fontSize: 15, fontWeight: 600 }}>反思：你对这条解释是什么态度？</p>
          <div className="mt-8" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {REFLECT_OPTIONS.map((o) => (
              <button key={o.value} className={`option ${reflectChoice === o.value ? 'correct' : ''}`} onClick={() => setReflectChoice(o.value)}>
                <span className="option-text">{o.label}</span>
              </button>
            ))}
          </div>
          <div className="row mt-12" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" disabled={!reflectChoice} onClick={submitReflect}>继续 →</button>
          </div>
        </div>
      )}

      {stage === 'revise' && (
        <div className="mt-12">
          <p style={{ fontSize: 15, fontWeight: 600 }}>基于刚才的反思，修改你的解释</p>
          <div className="tiny muted mt-8">原解释：{explanation}</div>
          <textarea className="mt-8" rows={3} value={revised} onChange={(e) => setRevised(e.target.value)} placeholder="写出修正后的解释……" />
          <div className="row mt-12" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" disabled={!revised.trim()} onClick={submitRevise}>完成修正</button>
          </div>
        </div>
      )}

      {stage === 'done' && (
        <div className="feedback good mt-12">
          <h4>✓ 完成一次解释构建</h4>
          <p className="tiny mt-8">你完成了：观察 → 解释 → 依据 → 反思 → 修正。最终解释：{explanation}</p>
          <div className="row mt-8">
            <button className="btn btn-ghost btn-sm" onClick={() => { setStage('draft'); setObserved(''); setExplanation(''); setBasis(''); setCounterexample(''); setUncertainty(''); setReflectChoice(null); setRevised('') }}>再来一条</button>
          </div>
        </div>
      )}
    </BenchShell>
  )
}

// ============================================================
// ⑥ 自由研究台
// ============================================================
function FreeBench({ onBack }) {
  const { dispatch } = useApp()
  const [focus, setFocus] = useState({ type: 'hexagram', id: 1 })
  const [termQuery, setTermQuery] = useState('')
  const [note, setNote] = useState('')

  const rels = relatedResearch(focus.type, focus.id)
  const label = workshopTargetLabel(focus.type, focus.id)

  useEffect(() => {
    recordWorkshop(dispatch, { action: 'view', targetType: focus.type, targetId: focus.id })
  }, [focus.type, focus.id])

  function jump(type, id) {
    setFocus({ type, id })
    setNote('')
  }
  function openTerm() {
    const t = getTerm(termQuery.trim())
    if (t) jump('term', t.id)
    else setTermQuery('')
  }
  function saveNote() {
    if (!note.trim()) return
    recordWorkshop(dispatch, { action: 'observe', targetType: focus.type, targetId: focus.id, context: { note } })
    setNote('')
  }

  const objectInfo = (() => {
    if (focus.type === 'hexagram') {
      const p = getHexagramProfile(Number(focus.id))
      return p ? `${p.name}卦 · ${p.traditionalName} · 第 ${p.number} 卦` : ''
    }
    if (focus.type === 'classic') {
      const c = CLASSIC_ENTRIES.find((x) => x.id === focus.id)
      return c ? `${c.source} · ${c.chapter}` : ''
    }
    if (focus.type === 'case') { const c = getCaseById(focus.id); return c ? c.title : '' }
    if (focus.type === 'tradition') { const t = TRADITION_REF.find((x) => x.key === focus.id); return t ? t.label : '' }
    if (focus.type === 'term') { const t = getTerm(focus.id); return t ? `${t.term}${t.traditionalTerm && t.traditionalTerm !== t.term ? `（${t.traditionalTerm}）` : ''}` : '' }
    return ''
  })()

  return (
    <BenchShell title="⑥ 自由研究台" benchId="free" goal="从任意对象出发，建立自己的研究路径，每步留痕。" onBack={onBack}>
      <div className="card mt-12">
        <div className="spread">
          <h4 style={{ fontSize: 16 }}>当前对象：{label}</h4>
          <span className="pill pill-teal">{focus.type}</span>
        </div>
        {objectInfo && <p className="tiny muted mt-4">{objectInfo}</p>}
        <p className="tiny muted mt-8">留下你的观察（每个对象可写多条）：</p>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="关于这个对象，你注意到什么？产生了什么疑问？" />
        <div className="row mt-8" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-primary btn-sm" disabled={!note.trim()} onClick={saveNote}>留痕</button>
        </div>
      </div>

      <div className="card mt-12">
        <h4 style={{ fontSize: 15 }}>从任意对象出发</h4>
        <div className="row mt-8" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <Select value={focus.type === 'hexagram' ? focus.id : 1} onChange={(v) => jump('hexagram', Number(v))} label="卦">
            {HEXAGRAM_PROFILES.map((p) => <option key={p.number} value={p.number}>{p.name}</option>)}
          </Select>
          <Select value={focus.type === 'case' ? focus.id : (ICHING_CASES[0]?.id || '')} onChange={(v) => jump('case', v)} label="案例">
            {ICHING_CASES.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
          </Select>
          <Select value={focus.type === 'tradition' ? focus.id : TRADITION_REF[0].key} onChange={(v) => jump('tradition', v)} label="传统">
            {TRADITION_REF.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </Select>
          <div className="row" style={{ gap: 6, alignItems: 'center' }}>
            <input
              className="input-text"
              style={{ width: 140 }}
              value={termQuery}
              onChange={(e) => setTermQuery(e.target.value)}
              placeholder="输入术语名"
            />
            <button className="btn btn-ghost btn-sm" onClick={openTerm} disabled={!termQuery.trim()}>打开术语</button>
          </div>
        </div>
      </div>

      <div className="card mt-12">
        <h4 style={{ fontSize: 15 }}>可继续研究（确定性连接）</h4>
        {rels.length === 0 ? (
          <p className="tiny muted mt-8">这个对象暂无更多连接。</p>
        ) : (
          <div className="mt-8" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {rels.map((r, i) => (
              <button key={i} className="option" onClick={() => jump(r.type, r.id)}>
                <span className="option-text" style={{ fontSize: 13 }}>
                  <Pill tone="gray">{r.type}</Pill> {r.label}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </BenchShell>
  )
}

// ============================================================
// 工坊主页：3 问 + 6 入口（全部真实数据驱动）
// ============================================================
function WorkshopHome({ onOpen }) {
  const { state } = useApp()
  const home = workshopHome(state)

  return (
    <div>
      <PageHead title="🛠️ 易工坊" sub="把「看卦」变成「可验证的学习行为」：每步留痕，系统只记录你做过什么，不替你下判断。" />

      {/* ── 3 问（真实数据驱动）── */}
      <div className="home-ask grid-3 mt-8" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        <div className="card">
          <div className="tiny muted">① 现在可以做什么</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 6 }}>{home.nowTask.label}</div>
          <p className="tiny muted mt-6">{home.nowTask.why}</p>
          <button className="btn btn-primary btn-sm mt-8" onClick={() => onOpen(home.nowTask.id)}>开始 →</button>
        </div>

        <div className="card">
          <div className="tiny muted">② 我最近在研究什么</div>
          {home.isNew ? (
            <p className="tiny mt-6" style={{ color: 'var(--amber-deep)' }}>
              还没有历史记录。以下为<b>「新用户默认路径」</b>，不是个性化推荐：
            </p>
          ) : home.recentTargets.length ? (
            <div className="mt-6" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {home.recentTargets.slice(0, 5).map((t, i) => (
                <div key={i} className="row" style={{ justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 14 }}>{t.label}</span>
                  <span className="pill pill-gray">{t.count} 次</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="tiny muted mt-6">最近还没有留下学习行为记录。</p>
          )}
        </div>

        <div className="card">
          <div className="tiny muted">③ 我哪里需要继续练</div>
          {home.toPractice.length ? (
            <div className="mt-6" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {home.toPractice.slice(0, 3).map((p, i) => (
                <button key={i} className="btn btn-soft btn-sm" style={{ textAlign: 'left' }} onClick={() => onOpen(p.workshopId)}>
                  {p.why}
                </button>
              ))}
            </div>
          ) : (
            <p className="tiny muted mt-6">{home.isNew ? '走完默认路径后，这里会根据你的真实行为给建议。' : '保持记录，系统会给出更有针对性的建议。'}</p>
          )}
        </div>
      </div>

      {home.isNew && (
        <div className="card mt-12" style={{ borderLeft: '4px solid var(--indigo)' }}>
          <div className="spread">
            <h4 style={{ fontSize: 15 }}>🌱 新用户默认路径</h4>
            <span className="pill pill-indigo">非个性化</span>
          </div>
          <ol className="mt-8" style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {NEW_USER_PATH.steps.map((s, i) => <li key={i} style={{ fontSize: 14 }}>{s}</li>)}
          </ol>
          <button className="btn btn-primary mt-12" onClick={() => onOpen('hexagram')}>从第一步开始 →</button>
        </div>
      )}

      {/* ── 6 个工作台入口 ── */}
      <div className="mt-16" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        {WORKSHOPS.map((w) => {
          const tasks = workshopTasksByBench(w.id)
          const first = tasks[0]
          return (
            <button key={w.id} className="card workshop-card" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => onOpen(w.id)}>
              <div className="spread">
                <h4 style={{ fontSize: 15, margin: 0 }}>{w.label}</h4>
                <span className="pill pill-amber">{w.tag}</span>
              </div>
              <p className="tiny muted mt-8">{w.goal}</p>
              {tasks.length > 0 && (
                <div className="mt-8" style={{ borderLeft: '3px solid var(--indigo, #4338ca)', paddingLeft: 10 }}>
                  <div className="tiny" style={{ fontWeight: 700 }}>🎯 {tasks.length} 个训练任务</div>
                  {first?.example && (
                    <p className="tiny mt-4" style={{ lineHeight: 1.6, color: 'var(--text-muted, #6b6b6b)' }}>示例：{first.example}</p>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      <Remind icon="🔍">每个工作台都有<b>明确任务</b>，训练任务带<b>示例</b>示范。系统只做「确定性规则检查」（你是否写了、是否找了反例、是否有绝对化表达），不假装读懂你的开放文本。</Remind>
    </div>
  )
}

// ============================================================
// 顶层
// ============================================================
export default function WorkshopPage() {
  const [view, setView] = useState('home')

  if (view === 'home') return <WorkshopHome onOpen={setView} />
  if (view === 'hexagram') return <HexagramBench onBack={() => setView('home')} />
  if (view === 'yao') return <YaoBench onBack={() => setView('home')} />
  if (view === 'classic') return <ClassicBench onBack={() => setView('home')} />
  if (view === 'case') return <CaseBench onBack={() => setView('home')} />
  if (view === 'explain') return <ExplainBench onBack={() => setView('home')} />
  if (view === 'free') return <FreeBench onBack={() => setView('home')} />
  return <WorkshopHome onOpen={setView} />
}