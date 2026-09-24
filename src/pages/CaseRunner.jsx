// ============================================================
// 案例运行器：从「读档案」到「多维推理评分」。
// V1.5 新增：证据强度(evidence) / 无唯一答案(open) / 信心校准 / 教学人格反馈 / 线索收集感。
// V1.6 新增：
//   - 「我目前无法判断」正式答案（判断边界训练）
//   - 🧭 推理轨迹（还原推理路径 + 标记习惯 + 更好的做法）
//   - 🔄 如果重来一次（前后对比 + 修正能力评价）
// V2 新增：
//   - 独立分析(analysis) / 双解释(dual) / 反事实(counterfactual) / 信念修正(revision) 挑战
//   - 提示依赖记录：用户主动请求的提示会进入 hintCount → independenceScore
//   - 提示撤离机制：能力越高，Agent 提示越少；master 模式允许一次提示但扣独立性
//   - 查阅知识记录：consultedKnowledge 计入独立分析评估
// ============================================================
import React, { useState } from 'react'
import { useApp } from '../store/AppContext'
import { getCase } from '../data/cases'
import { getNode } from '../data/knowledge'
import { scoreCase } from '../lib/caseScoring'
import { buildTrace, traceHabit, correctionVerdict } from '../lib/reasoningTrace'
import { scoreMasterChallenge, masterVerdict, nextStageAfterMaster } from '../agent/masterChallenge'
import { composeCaseFeedback } from '../agent/feedback'
import { getPersona, personaLine } from '../agent/teacherPersona'
import { calibrateConfidence } from '../agent/confidence'
import { ERROR_TYPES } from '../agent/errors'
import { navigate } from '../lib/router'
import { Bar, EmptyState, Remind } from '../components/ui'

const LETTERS = ['A', 'B', 'C', 'D', 'E']

// 带选项的挑战类型（点选式，V2 加入 revision / counterfactual / dual）
const OPTION_TYPES = ['choice', 'conclusion', 'why', 'counter', 'evidence', 'open', 'boundary', 'revision', 'counterfactual', 'dual']

// V1.6.1：所有点选式挑战都允许「目前无法判断」，选完后补一个轻量理由步骤
const UNKNOWN_REASON_LABELS = {
  'missing-evidence': '缺少关键证据',
  conflict: '信息互相矛盾',
  multi: '可能存在多个解释',
  knowledge: '我还没有学会相关知识',
  other: '说不太清楚，先保留判断',
}

// V2：按挑战类型 + 案例特性生成确定性提示文案（无随机）
function hintFor(cs, ch) {
  const parts = []
  if (cs.infoConflict) parts.push('这个案例的信息可能互相矛盾——注意别只挑支持自己的那条。')
  else if (cs.infoSufficiency === 'insufficient') parts.push('注意：这个案例的信息可能不足。')
  if (ch.type === 'analysis') parts.push('从「关键事实」开始：先列出你确认知道的，再列出你不确定的。')
  else if (ch.type === 'evidence') parts.push('先问自己：现有证据足够支持这个结论吗？不够就说出来。')
  else if (ch.type === 'counter' || ch.type === 'counterfactual') parts.push('试着找一条「可能推翻你」的证据。')
  else if (ch.type === 'boundary') parts.push('如果信息不足，「无法判断」也是一种判断，但要说明缺什么。')
  else if (ch.type === 'dual') parts.push('比较两种解释时，看「哪种更容易被验证或推翻」，而不是哪种听起来对。')
  else if (ch.type === 'revision') parts.push('新信息出现时，先问：它改变了哪些已知条件？')
  else if (ch.type === 'confidence') parts.push('信心应该来自证据条数，而不是感觉。')
  else parts.push('先别急着下结论，回头看看案例资料里有哪些关键事实。')
  return parts.join(' ')
}

// V2：提示撤离策略——能力越高，Agent 越少出现
function hintPolicy(state, cs) {
  const level = state.masteryProfile?.level || 'L0'
  if (cs.mode === 'master') {
    return { enabled: true, label: '我需要提示', copy: '出师挑战本不该提示你——使用提示会影响独立性评分。', level }
  }
  if (level === 'L0' || level === 'L1') {
    return { enabled: true, label: '💡 我需要提示', copy: '没关系，先给一点方向。', level }
  }
  if (level === 'L2' || level === 'L3') {
    return { enabled: true, label: '💡 我需要提示', copy: '你已经可以自己找方向了。提示会用掉一次独立性分。', level }
  }
  return { enabled: false, label: '', copy: '', level }
}

// 收集本次作答中的错误类型（去重）
export function collectErrorTypes(cs, answers) {
  const types = []
  cs.challenges.forEach((ch, idx) => {
    const ans = answers[idx]
    if (ans === undefined || ans === null || ans === 'unknown') return
    if (ch.type === 'classify' || ch.type === 'confidence' || ch.type === 'open' || ch.type === 'analysis') return
    const opt = ch.options[ans]
    if (opt?.errorType) types.push(opt.errorType)
  })
  return [...new Set(types)]
}

export function CaseRunner({ caseId }) {
  const { state, dispatch } = useApp()
  const cs = getCase(caseId)
  const persona = getPersona(state)
  const [phase, setPhase] = useState('brief')
  const [cIdx, setCIdx] = useState(0)
  const [answers, setAnswers] = useState({})
  const [selected, setSelected] = useState(null)
  const [unknownReason, setUnknownReason] = useState(null) // V1.6.1：「目前无法判断」的理由
  const [classifySel, setClassifySel] = useState([])
  const [conf, setConf] = useState(60)
  const [result, setResult] = useState(null)
  const [attemptNo, setAttemptNo] = useState(1)
  const [firstAttempt, setFirstAttempt] = useState(null) // { answers, result, errorTypes }
  // V2：提示依赖 / 查阅知识（进入 independenceScore 的真实行为）
  const [hintCount, setHintCount] = useState(0)
  const [hintShown, setHintShown] = useState(false)
  const [consulted, setConsulted] = useState(false)
  const [analysisText, setAnalysisText] = useState('')
  const [masterReport, setMasterReport] = useState(null) // V2：出师挑战报告

  if (!cs) {
    return <EmptyState title="找不到这个案件" action={<button className="btn" onClick={() => navigate('/cases')}>返回案例馆</button>} />
  }

  if (phase === 'brief') {
    return <Brief cs={cs} onStart={() => setPhase('solve')} />
  }

  if (phase === 'solve') {
    const ch = cs.challenges[cIdx]
    const isLastCh = cIdx === cs.challenges.length - 1

    function commit(value, errorType) {
      setAnswers((a) => ({ ...a, [cIdx]: value }))
      if (errorType) dispatch({ type: 'RECORD_ERROR', errorType })
      setClassifySel([])
    }

    function finish() {
      // V2：提示次数 / 是否查阅知识 一并进入评分 → independenceScore
      const r = scoreCase(cs, { ...answers, unknownReason, hintCount, consultedKnowledge: consulted })
      const consideredCounter = cs.challenges.some((c, i) => c.type === 'counter' && c.options[answers[i]]?.points === 3)
      const errorTypes = collectErrorTypes(cs, answers)
      // V1.6.1：「目前无法判断」包括动态选项（'unknown'）与显式 isUnknown 选项
      const usedUnknown = cs.challenges.some((c, i) => {
        const a = answers[i]
        if (a === 'unknown') return true
        return !!(c.options?.[a] && c.options[a].isUnknown)
      })
      setResult(r)
      dispatch({
        type: 'COMPLETE_CASE',
        caseId,
        relatedNodes: cs.relatedNodes,
        level: cs.level,
        mode: cs.mode,
        result: {
          total: r.total,
          dimensions: r.dimensions,
          consideredCounter,
          confidence: r.confidence,
          actualQuality: r.actualQuality,
          errorTypes,
          attempt: attemptNo,
          redo: attemptNo > 1,
          usedUnknown,
          unknownReason: usedUnknown ? unknownReason || null : null,
          // V2 行为元数据：提示依赖 / 查阅知识 / 信念修正 / 双解释 / 模式
          hintDependency: r.hintDependency,
          consultedKnowledge: r.consultedKnowledge,
          beliefRevision: r.beliefRevision,
          dualQuality: r.dualQuality,
          mode: r.mode,
        },
      })

      // V2：出师挑战 → 生成出师报告并入档
      if (cs.mode === 'master') {
        const mc = scoreMasterChallenge(cs, { ...answers, unknownReason, hintCount, consultedKnowledge: consulted })
        const passed = mc.overall >= 80 && mc.independence >= 75
        setMasterReport({ ...mc, passed })
        dispatch({
          type: 'RECORD_MASTER_CHALLENGE',
          attempt: {
            caseId,
            at: new Date().toISOString(),
            score: mc.overall,
            baseScore: mc.baseScore,
            independence: mc.independence,
            passed,
            hintCount,
            consulted,
          },
          report: { ...mc, passed, overall: mc.overall, independence: mc.independence },
        })
      }
      if (r.confidence != null) {
        dispatch({ type: 'RECORD_CONFIDENCE', caseId, confidence: r.confidence, actual: r.actualQuality })
      }
      setPhase('result')
    }

    function next() {
      // V1.6.1：切换挑战时重置选中态，否则会残留上一题的 selected，
      // 导致新挑战选项不可点、「目前无法判断」不显示。
      // unknownReason 保留到 finish()：它是整个案例的「无法判断理由」，由 usedUnknown 门控。
      setSelected(null)
      setAnalysisText('') // V2：analysis 文本不跨挑战残留
      if (isLastCh) {
        finish()
      } else {
        setCIdx(cIdx + 1)
      }
    }

    function handleOption(optIndex) {
      if (selected !== null) return
      const opt = ch.options[optIndex]
      if (opt.isUnknown) {
        // 案例自带「无法判断」选项 → 同样进入理由步骤
        setSelected('unknown')
        setUnknownReason(null)
        return
      }
      setSelected(optIndex)
      commit(optIndex, opt.errorType)
    }

    function handleUnknown() {
      if (selected !== null) return
      setSelected('unknown')
      // V1.6.1：不在此清空 unknownReason——
      // 如果之前某一步已说明「缺什么」，用户直接跳过时不应丢失已有理由（保留到 finish() 统一评分）。
      // 用户可在理由区重新点选覆盖。
    }

    function pickUnknownReason(reason) {
      setUnknownReason(reason)
      commit('unknown', null)
    }

    // V2：提示与查阅知识（计入独立性评估的真实行为）
    const policy = hintPolicy(state, cs)
    function showHint() {
      if (hintShown) return
      setHintShown(true)
      setHintCount((n) => n + 1)
    }

    const hasUnknownOption = (ch.options || []).some((o) => o.isUnknown)
    const showUnknown = OPTION_TYPES.includes(ch.type) && !hasUnknownOption && selected === null
    const knowledgeNodes = (cs.relatedNodes || []).map(getNode).filter(Boolean)

    return (
      <div className="lesson-body">
        <div className="spread">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/cases')}>← 案例馆</button>
          <span className="tiny muted">挑战 {cIdx + 1} / {cs.challenges.length}{attemptNo > 1 ? ' · 第二次作答' : ''}</span>
        </div>

        <div className="card mt-12" style={{ marginTop: 12 }}>
          <div className="tiny muted">案件 #{cs.id.replace('case-', '')} · {cs.subject}{cs.levelName ? ` · Level ${cs.level} ${cs.levelName}` : ''}</div>
          {cs.mode === 'master' && (
            <div className="feedback warn mt-8" style={{ borderLeftColor: 'var(--gold, #d4a017)' }}>
              <h4>🎓 出师挑战</h4>
              <p className="tiny mt-8">这次我不会告诉你看哪里。你自己来。全程无提示，主动请求提示会影响独立性评分。</p>
            </div>
          )}
          {cs.mode === 'independent' && (
            <div className="tiny mt-4" style={{ color: 'var(--indigo)' }}>独立模式：没有选项的地方由你自己决定分析路径。</div>
          )}
          <h2 className="step-prompt">{ch.prompt}</h2>

          {ch.type === 'analysis' && (
            <div>
              <textarea
                className="analysis-input"
                rows={4}
                placeholder={ch.placeholder || '写下你的分析……'}
                value={analysisText}
                onChange={(e) => {
                  setAnalysisText(e.target.value)
                  commit(e.target.value, null)
                }}
              />
              <p className="tiny muted mt-8">没有标准答案。你的分析路径本身，就是评分对象。</p>
              <button
                className="btn btn-primary mt-12"
                disabled={!analysisText.trim()}
                onClick={() => setSelected('done')}
              >
                确认我的分析
              </button>
            </div>
          )}

          {ch.type === 'dual' && ch.explain && (
            <div className="row mt-12" style={{ gap: 10, flexWrap: 'wrap' }}>
              {Object.entries(ch.explain).map(([k, x]) => (
                <div key={k} className="card" style={{ flex: '1 1 220px', padding: 12 }}>
                  <b>{x.title}</b>
                  <p className="tiny muted mt-4">{x.text}</p>
                </div>
              ))}
            </div>
          )}

          {ch.type === 'classify' && (
            <div>
              <div className="evidence-grid">
                {ch.items.map((it) => {
                  const picked = classifySel.includes(it.text)
                  return (
                    <button
                      key={it.text}
                      className={`evidence-chip ${picked ? 'picked' : ''}`}
                      onClick={() => setClassifySel((s) => (picked ? s.filter((x) => x !== it.text) : [...s, it.text]))}
                    >
                      {picked ? '✓ ' : ''}{it.text}
                    </button>
                  )
                })}
              </div>
              <p className="tiny muted mt-12">🔎 勾选你认为是「证据」的信息，其余当作「背景」。已勾选 {classifySel.length} 条。</p>
              <button
                className="btn btn-primary mt-12"
                disabled={classifySel.length === 0}
                onClick={() => { commit(classifySel); setSelected('done') }}
              >
                确认我的选择
              </button>
            </div>
          )}

          {ch.type === 'confidence' && (
            <div>
              <div className="confidence">
                <input type="range" min="0" max="100" className="slider" value={conf} onChange={(e) => setConf(Number(e.target.value))} />
                <span className="val">{conf}</span>
              </div>
              <div className="spread tiny muted mt-8">
                <span>0 很没把握</span>
                <span>100 非常确定</span>
              </div>
              <button className="btn btn-primary mt-16" onClick={() => { commit(conf); setSelected('done') }}>
                确认信心
              </button>
            </div>
          )}

          {OPTION_TYPES.includes(ch.type) && (
            <div>
              {ch.options.map((opt, i) => {
                const best = optionIsBest(ch, opt)
                let cls = 'option'
                if (selected !== null && best) cls += ' correct'
                return (
                  <button key={i} className={cls} onClick={() => handleOption(i)}>
                    <span className="option letter">{LETTERS[i]}</span>
                    {opt.text}
                  </button>
                )
              })}

              {showUnknown && (
                <button className="option unknown" onClick={handleUnknown}>
                  <span className="option letter">？</span>
                  目前无法判断
                  <span className="tiny muted" style={{ display: 'block', marginTop: 2 }}>我认为现有信息还不足以支持一个可靠结论</span>
                </button>
              )}

              {selected === 'unknown' && (
                <div className="unknown-reason mt-12">
                  <div style={{ fontWeight: 700, fontSize: 14 }}>🤔 你觉得缺什么？</div>
                  <p className="tiny muted mt-4">先别急着放弃判断——告诉我，具体是哪里让你停下来了？</p>
                  <div className="row mt-8" style={{ gap: 8, flexWrap: 'wrap' }}>
                    {Object.entries(UNKNOWN_REASON_LABELS).map(([key, label]) => (
                      <button
                        key={key}
                        className={`btn btn-sm ${unknownReason === key ? 'btn-indigo' : 'btn-soft'}`}
                        onClick={() => pickUnknownReason(key)}
                      >
                        {unknownReason === key ? '✓ ' : ''}{label}
                      </button>
                    ))}
                  </div>
                  <p className="tiny muted mt-8">不选理由也可以继续，但说清楚「缺什么」，我才能看懂你的判断边界。</p>
                  {unknownReason && <UnknownFeedback cs={cs} reason={unknownReason} />}
                </div>
              )}
              {typeof selected === 'number' && <OptionFeedback ch={ch} selected={selected} persona={persona} />}
            </div>
          )}

          {selected !== null && (
            <div className="mt-20" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={next}>{isLastCh ? '查看评分' : '下一挑战 →'}</button>
            </div>
          )}

          {/* V2：提示撤离 + 查阅知识（进入独立性评估的真实行为） */}
          <div className="row mt-16" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {policy.enabled && !hintShown && (
              <button className="btn btn-ghost btn-sm" onClick={showHint}>{policy.label}</button>
            )}
            {!consulted && (
              <button className="btn btn-ghost btn-sm" onClick={() => setConsulted(true)}>📖 查阅知识</button>
            )}
            {(policy.enabled || hintShown) && (
              <span className="tiny muted">请求提示会记录进独立性评估{hintCount > 0 ? `（已用 ${hintCount} 次）` : ''}</span>
            )}
          </div>
          {hintShown && (
            <div className="feedback mt-8" style={{ borderLeftColor: 'var(--teal)' }}>
              <p className="tiny" style={{ color: 'var(--amber-deep)' }}>{policy.copy}</p>
              <p className="tiny mt-4">{hintFor(cs, ch)}</p>
              <p className="tiny muted mt-4">提示已记录——你完成的案例越独立，能力档案里的独立性越高。</p>
            </div>
          )}
          {consulted && knowledgeNodes.length > 0 && (
            <div className="card mt-8" style={{ padding: 12 }}>
              <b>📖 知识卡片</b>
              {knowledgeNodes.map((n) => (
                <p key={n.id} className="tiny mt-4"><b>{n.title}</b>：{n.concept || n.simpleExplanation || ''}</p>
              ))}
              <p className="tiny muted mt-4">偶尔查阅没问题；进入独立阶段后，建议先自己分析再看资料。</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <CaseResult
      cs={cs}
      result={result}
      answers={answers}
      caseId={caseId}
      attemptNo={attemptNo}
      firstAttempt={firstAttempt}
      masterReport={masterReport}
      onRedo={() => {
        // V1.6.1：按 correctionVerdict 期望的结构保存第一次作答（score 而非 total），
        // 否则修正判定会把 first.score 当成 undefined，导致「-NaN」文案。
        setFirstAttempt({
          answers: { ...answers },
          result: {
            score: result.total,
            confidence: result.confidence,
            actualQuality: result.actualQuality,
            errorTypes: collectErrorTypes(cs, answers),
            dimensions: result.dimensions,
          },
          errorTypes: collectErrorTypes(cs, answers),
        })
        setAnswers({})
        setSelected(null)
        setUnknownReason(null)
        setClassifySel([])
        setConf(60)
        setCIdx(0)
        setAttemptNo(2)
        setHintCount(0)
        setHintShown(false)
        setConsulted(false)
        setAnalysisText('')
        setPhase('solve')
      }}
    />
  )
}

// 判断某选项是否为「最优/最佳」答案。
// open 题没有唯一答案：quality >= 80 视为「较强解释」，不显示「对/错」。
function optionIsBest(ch, opt) {
  if (ch.type === 'open') return (opt.quality ?? 0) >= 80
  return (opt.points ?? 0) >= 3
}

function OptionFeedback({ ch, selected, persona }) {
  const opt = ch.options[selected]

  // 开放题：中性反馈，显示解释质量
  if (ch.type === 'open') {
    const quality = opt.quality ?? 0
    return (
      <div className="feedback warn mt-12" style={{ borderLeftColor: 'var(--indigo)' }}>
        <h4>💬 这是一个「可成立」的解释</h4>
        <p className="tiny mt-8">{opt.feedback}</p>
        {opt.overreach ? (
          <p className="tiny mt-8" style={{ color: 'var(--amber-deep)' }}>注意：如果只用这一条证据，信心不应超过 60%。</p>
        ) : (
          <p className="tiny mt-8" style={{ color: 'var(--teal-deep)' }}>解释质量约 {quality}%，但请注意它的边界。</p>
        )}
      </div>
    )
  }

  const best = optionIsBest(ch, opt)
  const isClose = !best && (opt.points ?? 0) >= 2

  return (
    <div className={`feedback ${best ? 'good' : 'warn'} mt-12`}>
      <h4>{best ? personaLine(persona, 'correct') : isClose ? `⚠️ 差一点 —— ${personaLine(persona, 'wrong')}` : personaLine(persona, 'wrong')}</h4>
      <p className="tiny mt-8">{opt.feedback || (best ? '这一步踩在正确的推理方向上。' : '这里有一个偏差，值得停下来。')}</p>
      {opt.errorType && (
        <p className="tiny mt-8" style={{ color: 'var(--amber-deep)' }}>
          识别到错误类型：{ERROR_TYPES[opt.errorType]?.name || opt.errorType}
        </p>
      )}
    </div>
  )
}

// 「目前无法判断」的反馈：理由 + 案例信息充足性 / 冲突（V1.6.1）
function UnknownFeedback({ cs, reason }) {
  const reasonLabel = UNKNOWN_REASON_LABELS[reason]
  return (
    <div className="feedback warn mt-12" style={{ borderLeftColor: reason ? 'var(--teal)' : 'var(--indigo)' }}>
      <h4>{reason ? `✓ 你说明了原因：${reasonLabel}` : '保留判断是合理的'}</h4>
      <p className="tiny mt-8">
        {reason
          ? `你提到「${reasonLabel}」——这是一个理由，它会被记进你的推理画像。`
          : '但你还没有说明：到底缺少哪条信息？下一步试着说出来，判断边界意识才算完整。'}
      </p>
      <div className="tiny mt-8" style={{ color: 'var(--indigo)' }}>{boundaryNote(cs)}</div>
    </div>
  )
}

function boundaryNote(cs) {
  if (cs.infoConflict) return '这道案例的信息互相冲突。你注意到冲突、没有强行解释——这正是判断边界意识。'
  if (cs.infoSufficiency === 'insufficient') return '这道案例的证据不足。证据不够时选择「不判断」，不是不会，而是知道判断的边界。'
  if (cs.infoSufficiency === 'sufficient') return '不过这道案例的证据其实已经足够——小心：过度谨慎和过早下结论，一样会错过正确判断。'
  return '诚实承认「暂时无法判断」比硬给结论好。但也要注意：如果总是选这个，可能是在回避下结论。'
}

function Brief({ cs, onStart }) {
  return (
    <div className="lesson-body">
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/cases')}>← 案例馆</button>
      <div className="card mt-12">
        <div className="tiny muted">案件 #{cs.id.replace('case-', '')}{cs.levelName ? ` · Level ${cs.level} ${cs.levelName}` : ''}</div>
        <h1 className="page-title" style={{ fontSize: 26 }}>{cs.title}</h1>
        <div className="row mt-8">
          <span className="pill pill-amber">{cs.subject}</span>
          {cs.blindTest && <span className="pill pill-indigo">🎭 盲测 · 先别问背景</span>}
          {cs.openEnded && <span className="pill pill-teal">🧩 无唯一答案</span>}
          {cs.infoSufficiency === 'insufficient' && <span className="pill pill-red">🚦 信息不足 · 允许不判断</span>}
          {cs.infoSufficiency === 'sufficient' && <span className="pill pill-teal">📋 信息已足够判断</span>}
        </div>

        <h3 className="mt-20" style={{ fontSize: 16 }}>🔎 线索清单</h3>
        <ul className="clue-list">
          {cs.situation.map((s, i) => <li key={i}>线索 0{i + 1} · {s}</li>)}
        </ul>

        <h3 className="mt-12" style={{ fontSize: 16 }}>{cs.chartLabel || '补充提示'}</h3>
        {cs.chart.length ? (
          <div className="mt-8">
            {cs.chart.map((c) => (
              <span key={c.key} className="chart-tag"><b>{c.key}</b> {c.value}</span>
            ))}
          </div>
        ) : (
          <p className="muted tiny mt-8">🎭 背景被刻意隐藏，先完成判断，最后再揭晓。</p>
        )}

        <Remind icon="🔬">不要急着下结论。先分清：哪些是「证据」，哪些只是「背景」。线索越全，判断越稳。</Remind>

        <button className="btn btn-primary btn-lg btn-block" onClick={onStart}>开始推理</button>
      </div>
    </div>
  )
}

function CaseResult({ cs, result, answers, caseId, attemptNo, firstAttempt, masterReport, onRedo }) {
  const { state } = useApp()
  const persona = getPersona(state)
  const feedback = composeCaseFeedback(result)
  const { dimensions, labels } = result
  const calib = result.confidence != null ? calibrateConfidence(result.confidence, result.actualQuality) : null

  const trace = buildTrace(cs, answers, result)
  const habit = traceHabit(trace, result)
  const riskNode = trace.find((n) => n.risk) // V1.6.1：证据不足的风险点

  const currentVerdictInput = {
    score: result.total,
    confidence: result.confidence,
    actualQuality: result.actualQuality,
    errorTypes: collectErrorTypes(cs, answers),
    dimensions: result.dimensions, // V1.6.1：过程进步判定需要维度数据
  }
  const correction = firstAttempt ? correctionVerdict(firstAttempt.result, currentVerdictInput) : null

  return (
    <div className="lesson-body">
      {/* V2：出师能力报告 */}
      {masterReport && (
        <div className="card mt-16" style={{ borderLeft: '4px solid var(--gold, #d4a017)' }}>
          <div className="center">
            <div style={{ fontSize: 42 }}>🎓</div>
            <h1 className="page-title">你的出师报告</h1>
            <div style={{ fontSize: 56, fontWeight: 800, color: 'var(--amber-deep)' }}>{masterReport.overall}</div>
            <p className="muted tiny">综合能力（基础推理 70% + 独立性 30%）</p>
            <p className="mt-8" style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.7, maxWidth: 620, margin: '0 auto' }}>{masterVerdict(masterReport.overall, masterReport.independence)}</p>
          </div>

          <div className="mt-16" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <div className="stat-card"><div className="num">{masterReport.baseScore}</div><div className="lbl">基础推理</div></div>
            <div className="stat-card"><div className="num">{masterReport.independence}</div><div className="lbl">独立分析</div></div>
            <div className="stat-card"><div className="num">{masterReport.hintCount}</div><div className="lbl">请求提示</div></div>
          </div>

          <div className="mt-16">
            <div className="feedback good" style={{ marginTop: 0 }}>
              <h4>↗ 你的优势</h4>
              {masterReport.strengths.map((s, i) => <p key={i} className="tiny mt-4">{s}</p>)}
            </div>
            <div className="feedback warn mt-8">
              <h4>↘ 仍然容易出现的问题</h4>
              {masterReport.issues.map((s, i) => <p key={i} className="tiny mt-4">{s}</p>)}
            </div>
            <div className="feedback mt-8" style={{ background: 'rgba(69,84,155,0.08)', borderLeftColor: 'var(--indigo)' }}>
              <h4>💡 一个值得继续训练的习惯</h4>
              <p className="tiny mt-4">{masterReport.habit}</p>
            </div>
          </div>

          <p className="tiny muted mt-16" style={{ lineHeight: 1.8 }}>
            {nextStageAfterMaster(masterReport.overall)}
            <br />
            本报告基于本产品的学习体系与训练案例，是对你「独立分析能力」的评估，不代表传统玄学预测具有科学验证意义。
          </p>
        </div>
      )}

      <div className="center">
        <div style={{ fontSize: 50 }}>🧠</div>
        <h1 className="page-title">{attemptNo > 1 ? '第二次推理能力' : '本次推理能力'}</h1>
        <div style={{ fontSize: 64, fontWeight: 800, color: 'var(--amber-deep)' }}>{result.total}</div>
        {cs.openEnded && <p className="muted tiny">开放题没有标准答案，评分衡量的是「推理是否完整、是否克制」。</p>}
      </div>

      <div className="card mt-16">
        <h3 style={{ fontSize: 16, marginBottom: 14 }}>📊 能力维度</h3>
        <div className="score-dims">
          {Object.entries(dimensions).map(([k, v]) => (
            <div key={k} className="dim-row">
              <span>{labels[k]}</span>
              <Bar value={v} tone={v >= 70 ? 'teal' : v >= 50 ? 'amber' : 'indigo'} />
              <span style={{ fontWeight: 700 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {calib && (
        <div className="card mt-16">
          <h3 style={{ fontSize: 16 }}>🎯 信心校准</h3>
          <p className="mt-8" style={{ fontSize: 15 }}>
            你的信心 <b>{result.confidence}%</b> · 实际判断质量 <b>{result.actualQuality}%</b>
          </p>
          <p className="mt-8" style={{ fontSize: 15, fontWeight: 700, color: calib.verdict === '校准良好' ? 'var(--teal-deep)' : 'var(--amber-deep)' }}>
            {calib.verdict === '校准良好' ? '✓ 校准良好' : `⚠️ ${calib.verdict}`}
          </p>
          <p className="muted tiny mt-8">{calib.advice}</p>
          {calib.hint && <p className="tiny mt-8" style={{ color: 'var(--indigo)' }}>{calib.hint}</p>}
        </div>
      )}

      {/* V2：独立性评估（提示依赖 / 查阅知识 / 信念修正 / 双解释） */}
      <div className="card mt-16">
        <h3 style={{ fontSize: 16 }}>🧗 本次独立性</h3>
        <p className="mt-8" style={{ fontSize: 15 }}>
          提示依赖 <b>{result.hintDependency ?? 0}/100</b>
          {result.consultedKnowledge ? ' · 查阅过知识' : ' · 未查阅知识'}
          {result.mode === 'master' ? ' · 🎓 出师挑战' : result.mode === 'independent' ? ' · 🧗 独立模式' : result.mode === 'semi' ? ' · 🧭 半引导' : ''}
        </p>
        <p className="muted tiny mt-8">
          {(result.hintDependency ?? 0) === 0
            ? '全程没有请求提示——这是独立完成，已计入你的独立分析能力。'
            : (result.hintDependency ?? 0) <= 40
              ? '只用了少量提示，独立性不错。'
              : '提示用得偏多——下一步试着先自己分析，再决定要不要提示。'}
        </p>
        {result.beliefRevision && (
          <p className="tiny mt-8" style={{ color: result.beliefRevision === 'keep' ? 'var(--amber-deep)' : 'var(--indigo)' }}>
            {result.beliefRevision === 'revise'
              ? '✓ 新信息出现时你愿意修正判断（信念修正灵活）'
              : result.beliefRevision === 'keep'
                ? '⚠️ 新信息出现时你坚持原判断（信念修正偏刚性）'
                : '新信息出现时你保持条件性态度（信念修正中性）'}
          </p>
        )}
        {result.dualQuality === 'good' && (
          <p className="tiny mt-8" style={{ color: 'var(--teal-deep)' }}>✓ 双解释比较中你选择了「可验证的解释优先」。</p>
        )}
      </div>

      {/* V1.6：推理轨迹 */}
      <div className="card mt-16">
        <h3 style={{ fontSize: 16 }}>🧭 我的推理轨迹</h3>
        <p className="muted tiny mt-4">这不是标准答案，只是还原你刚才走过的推理路径。</p>
        {trace.length > 0 && (
          <div className="trace mt-12">
            {trace.map((n, i) => (
              <div key={i} className={`trace-node ${n.isConclusion ? 'conclusion' : ''} ${n.isUnknown ? 'unknown' : ''}`}>
                <div className="trace-ico">{n.icon}</div>
                <div className="trace-main">
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{n.label}</div>
                  <div className="tiny muted mt-2">{n.text}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {habit.issue ? (
          <div className="feedback warn mt-12">
            <h4>⚠️ 你的习惯</h4>
            <p className="tiny mt-8">{habit.issue}</p>
          </div>
        ) : (
          <div className="feedback good mt-12">
            <h4>✓ 路径比较完整</h4>
            <p className="tiny mt-8">你在形成判断前，走了足够多的步骤。</p>
          </div>
        )}
        {riskNode && (
          <div className="feedback warn mt-12">
            <h4>⚠️ 这里出现了一个风险</h4>
            <p className="tiny mt-8">{riskNode.riskText}</p>
          </div>
        )}
        <div className="feedback good mt-12" style={{ background: 'rgba(69,84,155,0.08)', borderLeftColor: 'var(--indigo)' }}>
          <h4>💡 更好的做法</h4>
          <p className="tiny mt-8">{habit.better}</p>
        </div>
      </div>

      {/* V1.6：如果重来一次 → 前后对比 */}
      {correction && (
        <div className="card mt-16">
          <h3 style={{ fontSize: 16 }}>🔄 你的修正能力</h3>
          <div className="redo-compare mt-12">
            <div className="redo-col">
              <div className="tiny muted">第一次</div>
              <div className="redo-score">{firstAttempt.result.total}</div>
              <div className="tiny muted mt-4">信心 {firstAttempt.result.confidence ?? '—'}% · 证据 {firstAttempt.result.dimensions?.over ?? '—'}</div>
              {firstAttempt.errorTypes.length > 0 ? (
                <div className="tiny muted mt-4">错误：{firstAttempt.errorTypes.map((c) => ERROR_TYPES[c]?.name || c).join('、')}</div>
              ) : (
                <div className="tiny mt-4" style={{ color: 'var(--teal-deep)' }}>E01 未触发</div>
              )}
            </div>
            <div className="redo-arrow">→</div>
            <div className="redo-col">
              <div className="tiny muted">第二次</div>
              <div className="redo-score">{result.total}</div>
              <div className="tiny muted mt-4">信心 {result.confidence ?? '—'}% · 证据 {result.dimensions?.over ?? '—'}</div>
              {currentVerdictInput.errorTypes.length > 0 ? (
                <div className="tiny muted mt-4">错误：{currentVerdictInput.errorTypes.map((c) => ERROR_TYPES[c]?.name || c).join('、')}</div>
              ) : (
                <div className="tiny mt-4" style={{ color: 'var(--teal-deep)' }}>E01 未触发</div>
              )}
            </div>
          </div>
          <div className={`feedback ${correction.tone === 'good' ? 'good' : correction.tone === 'warn' ? 'warn' : ''} mt-12`} style={correction.tone === 'neutral' ? { borderLeftColor: 'var(--indigo)' } : {}}>
            <h4>{correction.title}</h4>
            <p className="tiny mt-8">{correction.body}</p>
            {correction.deltas.length > 0 && (
              <div className="row mt-8" style={{ gap: 6, flexWrap: 'wrap' }}>
                {correction.deltas.map((d, i) => <span key={i} className="pill pill-teal">{d}</span>)}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card mt-16">
        <h3 style={{ fontSize: 16 }}>💬 导师点评</h3>
        <p className="mt-8" style={{ fontSize: 15 }}>{persona.emoji} {feedback.advice}</p>
        {result.notes?.length > 0 && (
          <ul className="clue-list mt-12">
            {result.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        )}
      </div>

      <div className="card mt-16">
        <h3 style={{ fontSize: 16 }}>🔎 揭晓与复盘</h3>
        {cs.reveal.realBackground && <p className="mt-8"><b>真实背景：</b>{cs.reveal.realBackground}</p>}
        {cs.reveal.expectedReasoning && <p className="mt-8"><b>正确思路：</b>{cs.reveal.expectedReasoning}</p>}
        {cs.reveal.otherMayHold && <p className="mt-8"><b>另一种可能：</b>{cs.reveal.otherMayHold}</p>}
        {cs.reveal.takeaway && (
          <div className="remember mt-12">🧠 {cs.reveal.takeaway}</div>
        )}
      </div>

      <Remind icon="🔬">换了「证据」，结论就可能变。推理质量，比「猜对结果」重要得多。</Remind>

      <div className="row mt-8" style={{ justifyContent: 'center' }}>
        <button className="btn btn-primary" onClick={() => navigate('/cases')}>再练一个案例</button>
        {!firstAttempt ? (
          <button className="btn btn-ghost" onClick={onRedo}>🔄 如果重来一次</button>
        ) : (
          <button className="btn btn-ghost" onClick={() => navigate('/growth')}>去看我的推理成长</button>
        )}
      </div>
    </div>
  )
}
