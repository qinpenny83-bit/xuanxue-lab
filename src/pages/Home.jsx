// ============================================================
// 首页 / Agent 主动工作台（V1.5）：
//   不再是「请选择功能」，而是「我看了你的记录，今天只安排一件事」。
// 数据来源：本地 Agent 引擎（无 LLM），规则化解出学习状态、记忆与任务。
// ============================================================
import React, { useEffect, useMemo, useState } from 'react'
import { useApp } from '../store/AppContext'
// shouldRefreshInsight 来自零依赖纯函数模块；runAgent/getCase/DICTIONARY 均按需加载，避免首包带大模块
import { shouldRefreshInsight } from '../agent/agentInsightSnapshot'
import { navigate } from '../lib/router'
import { Remind, Modal } from '../components/ui'
import { puzzleForDate } from '../data/puzzles'
import { todayString } from '../lib/storage'

// V1.6.1：「目前无法判断」理由的中文标签（洞察证据展示用）
const UNKNOWN_REASON_LABEL = {
  'missing-evidence': '缺少关键证据',
  conflict: '信息互相矛盾',
  multi: '可能存在多个解释',
  knowledge: '还没学会相关知识',
  other: '其他',
}

function greeting() {
  // 固定称呼「道友好」，不随时间变化（实验室氛围，非时间问候）
  return { text: '道友好', emoji: '👋' }
}

export function Home() {
  const { state, dispatch } = useApp()
  const [agent, setAgent] = useState(null)
  const [agentError, setAgentError] = useState(false) // 生产防御：分析失败不白屏，降级展示
  const [agentErrorMessage, setAgentErrorMessage] = useState('')
  const [retryTick, setRetryTick] = useState(0)
  const [showWhy, setShowWhy] = useState(false)
  const [showEvidence, setShowEvidence] = useState(false) // V1.6.1：查看我的推理证据
  const [showEvidenceWhy, setShowEvidenceWhy] = useState(false) // R3 Phase 2.5：查看证据推荐依据
  const [caseLib, setCaseLib] = useState(null) // 案例库按需加载
  const hi = greeting()

  // V1.6.1：洞察状态（行为变化驱动刷新）——必须置于所有条件 return 之前，
  // 且下方对应的 useEffect 也必须在最顶层调用，保证任意渲染路径 Hook 数量一致
  const insight = agent?.insight
  const insightAccepted = !!state.insightState && !!insight && state.insightState.key === insight.key
  const insightDone = insightAccepted && state.insightState?.done === true

  // runAgent 依赖全量课程数据（curriculum 2MB+），异步加载：首屏先出问候，分析后台完成。
  // 任何失败（chunk 加载 / runAgent 抛错）都降级为可用首页，绝不白屏。
  useEffect(() => {
    let alive = true
    import('../agent/localAgentEngine')
      .then((m) => {
        if (!alive) return
        let result
        try {
          result = m.runAgent(state)
        } catch (e) {
          console.error('[Agent] runAgent 失败（已降级）', e)
          if (alive) {
            setAgentErrorMessage(String(e?.message || e))
            setAgentError(true)
          }
          return
        }
        if (alive) setAgent(result)
      })
      .catch((e) => {
        console.error('[Agent] 模块加载失败（已降级）', e)
        if (alive) {
          setAgentErrorMessage(String(e?.message || e))
          setAgentError(true)
        }
      })
    return () => { alive = false }
  }, [state, retryTick])

  // 案例库按需加载：仅当展开「推理证据」时拉取（避免首包带 cases.js 142KB）
  useEffect(() => {
    if (!showEvidence || caseLib) return
    let alive = true
    import('../data/cases').then((m) => {
      if (alive) setCaseLib(m)
    })
    return () => { alive = false }
  }, [showEvidence, caseLib])

  // V1.6.1：洞察持久化——行为显著变化时把新洞察写入状态；无变化保留原洞察
  // （放在所有条件 return 之前，Hook 规则要求任意渲染路径调用数量一致）
  useEffect(() => {
    if (!insight) return
    const stored = state.insightState
    const sameKey = stored?.key === insight.key
    const sameSnap = !!stored?.snapshot && !shouldRefreshInsight(stored.snapshot, insight.snapshot)
    if (!sameKey || !sameSnap) {
      const { snapshot, ...content } = insight
      dispatch({ type: 'SYNC_INSIGHT', key: insight.key, caseId: insight.caseId, snapshot, content })
    }
  }, [insight?.key, insight?.snapshot, state.insightState?.key, state.insightState?.snapshot])

  // 分析失败降级：完整功能入口仍在，仅 Agent 板块暂时不可用，绝不白屏
  if (agentError) {
    return (
      <div>
        <section className="hero card-ink" style={{ background: 'linear-gradient(150deg,#1c1a17,#2a2620)' }}>
          <div className="hero-orb" />
          <div className="spread" style={{ position: 'relative' }}>
            <span className="eyebrow" style={{ color: 'var(--amber)', letterSpacing: 3, fontSize: 12 }}>XUANXUE LAB</span>
            <span className="pill" style={{ background: 'rgba(217,164,65,0.18)', color: 'var(--amber)' }}>⏳ 分析暂不可用</span>
          </div>
          <h1 className="display" style={{ fontSize: 26, marginTop: 6 }}>
            {hi.emoji} {hi.text}。
          </h1>
          <p style={{ color: '#e8ddc8', fontSize: 14, lineHeight: 1.6, marginTop: 6, maxWidth: 560 }}>
            学习分析暂时没能跑起来，但下面所有功能都能正常使用。点「重试分析」再试一次。
          </p>
          {agentErrorMessage && (
            <p className="tiny" style={{ color: '#e0a08a', marginTop: 10, maxWidth: 640 }}>诊断信息：{agentErrorMessage}</p>
          )}
          <button className="btn btn-primary mt-16" onClick={() => { setAgentError(false); setRetryTick((t) => t + 1) }}>
            重试分析 ↻
          </button>
        </section>
        <HomeQuickLinks />
      </div>
    )
  }

  // 等待 agent 计算完成时，先渲染轻量首屏（问候 + 每日谜题 + 快速入口）
  if (!agent) {
    return (
      <div>
        <section className="hero card-ink" style={{ background: 'linear-gradient(150deg,#1c1a17,#2a2620)' }}>
          <div className="hero-orb" />
          <div className="spread" style={{ position: 'relative' }}>
            <span className="eyebrow" style={{ color: 'var(--amber)', letterSpacing: 3, fontSize: 12 }}>XUANXUE LAB</span>
            <span className="pill" style={{ background: 'rgba(217,164,65,0.18)', color: 'var(--amber)' }}>⏳ 分析中</span>
          </div>
          <h1 className="display" style={{ fontSize: 26, marginTop: 6 }}>
            {hi.emoji} {hi.text}。
          </h1>
          <p style={{ color: '#e8ddc8', fontSize: 14, lineHeight: 1.6, marginTop: 6, maxWidth: 560 }}>
            正在读取你的学习记录，为你安排今天最重要的一件事…
          </p>
        </section>
        <div className="card mt-16" style={{ textAlign: 'center', padding: '26px 0', color: '#8a8378', fontSize: 14 }}>
          ⏳ 正在分析学习状态与今日任务…
        </div>
        <HomeQuickLinks />
      </div>
    )
  }

  const ls = agent.learningState
  const memory = agent.teacherMemory

  const masteredTitles = agent.masteryList
    .filter((x) => x.level >= 4)
    .slice(0, 3)
    .map((x) => x.node.title)

  const action = agent.nextAction

  // V1.6.1：洞察状态（行为变化驱动刷新，不再按日期去重）——定义已上移置组件顶层，此处复用

  function actionTarget() {
    switch (action.type) {
      case 'lesson':
        return action.id ? `/lesson/${action.id}` : '/lesson'
      case 'case':
        return `/case/${action.id}`
      case 'experiment':
        return `/lab/${action.id}`
      case 'exp':
        return action.id ? `/exp/${action.id}` : '/exp'
      case 'doubt':
        return action.id ? `/doubt?task=${action.id}` : '/doubt'
      default:
        return '/map'
    }
  }

  // 把 Agent 的任务翻译成一句「破案感」的话
  function taskLine() {
    if (action.type === 'case' && action.trainingLabel) return `🎯 今天不学新知识。针对性训练：「${action.trainingLabel}」`
    if (action.type === 'case' && action.insight) return `🕵️ 接受挑战：「${action.title}」`
    if (action.type === 'case') return `🕵️ 今天不安排新知识，我想让你破一个案：「${action.title}」`
    if (action.type === 'experiment') return `🧪 今天不背书，去现实里验证一个判断：「${action.title}」`
    if (action.type === 'exp') return `🧪 今天用一次实验，验证一个你可能忽略的点：「${action.title}」`
    if (action.type === 'doubt') return `🧠 今天有一个地方值得怀疑：「${action.title}」`
    if (action.type === 'lesson' && memory.hasMemory) return `📚 今天先回去补一个短板：「${action.title}」`
    return `🧩 今天只学一件事：「${action.title}」`
  }

  function acceptInsight() {
    if (!insight) return
    if (!insightAccepted) {
      const { snapshot, ...content } = insight
      dispatch({ type: 'ACCEPT_INSIGHT', key: insight.key, caseId: insight.caseId, snapshot, content })
    }
    if (insight.caseId) navigate(`/case/${insight.caseId}`)
    else navigate('/cases')
  }

  return (
    <div>
      {/* 首屏：Agent 主动打招呼 */}
      <section className="hero card-ink" style={{ background: 'linear-gradient(150deg,#1c1a17,#2a2620)' }}>
        <div className="hero-orb" />
        <div className="spread" style={{ position: 'relative' }}>
          <span className="eyebrow" style={{ color: 'var(--amber)', letterSpacing: 3, fontSize: 12 }}>XUANXUE LAB</span>
          <span className="pill" style={{ background: 'rgba(217,164,65,0.18)', color: 'var(--amber)' }}>{ls.emoji} {ls.label}期</span>
        </div>
        <h1 className="display" style={{ fontSize: 26, marginTop: 6 }}>
          {hi.emoji} {hi.text}。
        </h1>

        <p style={{ color: '#e8ddc8', fontSize: 14, lineHeight: 1.6, marginTop: 6, maxWidth: 560 }}>
          {memory.hasMemory ? (
            <>{memory.opener || `我记得你之前容易「${memory.title}」。今天这一课，我会特别盯着这一点。`}</>
          ) : authoredIntro(ls, masteredTitles)}
        </p>

        <div className="row mt-10" style={{ gap: 8, flexWrap: 'wrap', position: 'relative' }}>
          {masteredTitles.length > 0 && (
            <span className="pill" style={{ background: 'rgba(255,255,255,0.09)', color: '#d8cdb6' }}>✓ 已掌握：{masteredTitles.join('、')}</span>
          )}
          {ls.phase === 'stuck' && (
            <span className="pill" style={{ background: 'rgba(194,91,72,0.25)', color: '#f0c4b4' }}>⚠️ 最近连续出错，先停下来</span>
          )}
        </div>
      </section>

      {/* V1.6.1：新用户三阶段引导——Agent 先观察，不轻易下结论 */}
      {!agent.fingerprint.ready && (
        <section className="card mt-16" style={{ borderLeft: '4px solid var(--amber)' }}>
          <div className="spread">
            <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: 1 }}>{agent.fingerprint.stage.emoji} {agent.fingerprint.stage.title}</div>
            <span className="pill pill-amber">样本 {agent.fingerprint.sampleCount}/3</span>
          </div>
          <p className="tiny muted mt-8" style={{ lineHeight: 1.8 }}>{agent.fingerprint.stage.desc}</p>
          {agent.fingerprint.stage.key === 'seed' && (
            <button className="btn btn-primary mt-16" onClick={() => navigate('/cases')}>先做一道案件 →</button>
          )}
          {agent.fingerprint.stage.key === 'hint' && (
            <button className="btn btn-primary mt-16" onClick={() => navigate('/cases')}>再做一道案件 →</button>
          )}
        </section>
      )}

      {/* 今日任务：Agent 只安排一件事 */}
      <section className="card card-ink daily-card">
        <div className="spread">
          <div style={{ color: 'var(--amber)', fontWeight: 700, fontSize: 13, letterSpacing: 1 }}>🎯 今日任务</div>
          {action.trainingLabel && (
            <span className="pill" style={{ background: 'rgba(69,84,155,0.4)', color: '#d8d9f0' }}>{action.trainingLabel}</span>
          )}
        </div>
        <h2 className="mt-8">{taskLine()}</h2>
        <p className="tiny" style={{ color: '#b5a890', marginTop: 10, maxWidth: 620 }}>{action.why}</p>
        {action.trainingBrief && (
          <p className="tiny" style={{ color: '#e8ddc8', marginTop: 8, maxWidth: 620, fontWeight: 600 }}>唯一任务：{action.trainingBrief}</p>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <span className="pill" style={{ background: 'rgba(255,255,255,0.08)', color: '#d8cdb6' }}>⏱ 约 {estimateMinutes(action)} 分钟</span>
          <span className="pill" style={{ background: 'rgba(255,255,255,0.08)', color: '#d8cdb6' }}>🟡 {ls.label}期</span>
        </div>
        <button className="btn btn-primary btn-lg mt-20" onClick={() => navigate(actionTarget())}>
          {action.type === 'case' ? (action.trainingLabel ? '开始针对性训练' : '接受挑战') : action.type === 'experiment' || action.type === 'exp' ? '开始验证' : action.type === 'doubt' ? '开始怀疑 →' : '开始今天的学习'} →
        </button>

        {/* R3 Phase 3：怀疑室推荐——Agent 判断有需要纠正的认知漏洞时直接出现 */}
        {agent.doubtRecommendation && agent.doubtRecommendation.taskId && action.type !== 'doubt' && (
          <div className="mt-16" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 12 }}>
            <p className="tiny" style={{ color: 'var(--amber)', fontWeight: 600, lineHeight: 1.7 }}>
              🧠 今天有一个地方值得怀疑：{agent.doubtRecommendation.reason}
            </p>
            {(agent.doubtRecommendation.targetError || agent.doubtRecommendation.evidenceIds?.length > 0) && (
              <div className="row mt-8" style={{ gap: 8, flexWrap: 'wrap' }}>
                {agent.doubtRecommendation.targetError && (
                  <span className="pill" style={{ background: 'rgba(194,91,72,0.2)', color: '#f0c4b4' }}>
                    要纠正：{agent.doubtRecommendation.targetError}
                  </span>
                )}
                {agent.doubtRecommendation.evidenceIds?.length > 0 && (
                  <span className="pill" style={{ background: 'rgba(255,255,255,0.08)', color: '#d8cdb6' }}>
                    依据：{agent.doubtRecommendation.evidenceIds.slice(0, 3).join('、')}
                  </span>
                )}
              </div>
            )}
            <button className="btn btn-ghost btn-sm mt-8" style={{ color: '#e8ddc8' }} onClick={() => navigate(`/doubt?task=${agent.doubtRecommendation.taskId}`)}>
              去怀疑室开始这次怀疑 →
            </button>
          </div>
        )}

        {/* R3 Phase 2.5：证据推荐的可解释依据（为什么推荐 + 可追溯到学习记录） */}
        {agent.nextActionSource === 'evidence' && agent.evidenceWhy && (
          <div className="mt-16" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 12 }}>
            {action.headline && (
              <p className="tiny" style={{ color: 'var(--amber)', fontWeight: 600, lineHeight: 1.7 }}>为什么推荐：{action.headline}</p>
            )}
            <button className="btn btn-ghost btn-sm" style={{ color: '#b5a890', paddingLeft: 0 }} onClick={() => setShowEvidenceWhy((v) => !v)}>
              {showEvidenceWhy ? '▾ ' : '▸ '}{agent.evidenceWhy.title}
            </button>
            {showEvidenceWhy && (
              <div className="mt-8" style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 12 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {agent.evidenceWhy.points.map((p, i) => (
                    <li key={i} className="tiny" style={{ color: '#c9bda6', marginBottom: 4 }}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* V1.6：为什么推荐这道题（可解释，普通用户能看懂） */}
        {agent.whyThisCase && (
          <div className="mt-16" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 12 }}>
            <button className="btn btn-ghost btn-sm" style={{ color: '#b5a890' }} onClick={() => setShowWhy((v) => !v)}>
              {showWhy ? '▾ ' : '▸ '}{agent.whyThisCase.title}
            </button>
            {showWhy && (
              <div className="mt-8" style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 12 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {agent.whyThisCase.points.map((p, i) => (
                    <li key={i} className="tiny" style={{ color: '#c9bda6', marginBottom: 4 }}>{p}</li>
                  ))}
                </ul>
                {agent.whyThisCase.whyNotLesson && (
                  <div className="tiny mt-8" style={{ color: '#b5a890', fontWeight: 600 }}>为什么不是普通课程？{agent.whyThisCase.whyNotLesson}</div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* V2：学徒档案 + Agent 对你的判断 + 为什么还不能升级 */}
      {agent.masteryProfile?.ready && (
        <section className="card mt-16" style={{ borderLeft: '4px solid var(--teal)' }}>
          <div className="spread">
            <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: 1 }}>🧭 我的学徒档案</div>
            <span className="pill pill-teal">{agent.masteryProfile.levelEmoji} {agent.masteryProfile.levelName}</span>
          </div>
          <p className="tiny muted mt-8" style={{ maxWidth: 640, lineHeight: 1.8 }}>{agent.masteryProfile.levelDesc}</p>

          {agent.masteryProfile.bottleneck && (
            <div className="mt-12" style={{ background: 'rgba(69,84,155,0.06)', borderRadius: 12, padding: 12 }}>
              <b className="tiny">当前瓶颈：{agent.masteryProfile.bottleneck.label}（{agent.masteryProfile.bottleneck.value}/100）</b>
              <p className="tiny muted mt-4">{agent.masteryProfile.bottleneck.desc}</p>
            </div>
          )}

          {agent.judgment && (
            <div className="mt-16">
              <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: 1, color: 'var(--indigo)' }}>🤖 Agent 对你的判断</div>
              <p className="tiny muted mt-8">过去 {agent.judgment.total} 次案例里的真实变化：</p>
              {agent.judgment.items.map((it, i) => (
                <div key={i} className="tiny mt-8" style={{ lineHeight: 1.8 }}>{it.icon} {it.text}</div>
              ))}
            </div>
          )}

          {agent.whyNotPromote && (
            <div className="mt-16" style={{ background: 'rgba(217,164,65,0.08)', borderRadius: 12, padding: 12 }}>
              <b className="tiny" style={{ color: 'var(--amber-deep)' }}>🚧 你还不能进入 {agent.whyNotPromote.nextName}</b>
              <p className="tiny mt-8" style={{ lineHeight: 1.8 }}>{agent.whyNotPromote.reason}</p>
              <p className="tiny mt-8" style={{ color: 'var(--teal-deep)' }}>{agent.whyNotPromote.suggest}</p>
            </div>
          )}
        </section>
      )}

      {/* V1.6.1：你可能没发现（Agent 洞察，每条都带真实行为证据） */}
      {insight && !insightDone && (
        <section className="card mt-16" style={{ borderLeft: '4px solid var(--indigo)' }}>
          <div className="spread">
            <div style={{ fontWeight: 700, color: 'var(--indigo)', fontSize: 13, letterSpacing: 1 }}>🔍 你可能没发现</div>
            <span className="pill pill-indigo">来自你最近的真实行为</span>
          </div>
          <h2 className="mt-8" style={{ fontSize: 19 }}>{insight.headline}</h2>
          <p className="tiny muted mt-8" style={{ maxWidth: 640, lineHeight: 1.8 }}>{insight.body}</p>
          {insight.evidence?.length > 0 && (
            <div className="row mt-12" style={{ gap: 8, flexWrap: 'wrap' }}>
              {insight.evidence.map((e, i) => (
                <span key={i} className="pill" style={{ background: 'rgba(69,84,155,0.08)', color: 'var(--indigo)' }}>{e}</span>
              ))}
            </div>
          )}
          {insight.evidenceDetail?.cases?.length > 0 && (
            <>
              <button className="btn btn-ghost btn-sm mt-12" style={{ color: 'var(--indigo)' }} onClick={() => setShowEvidence((v) => !v)}>
                {showEvidence ? '▾ 收起' : '▸ 查看我的推理证据'}
              </button>
              {showEvidence && (
                <div className="mt-8" style={{ background: 'rgba(69,84,155,0.06)', borderRadius: 12, padding: 12 }}>
                  <div className="tiny muted" style={{ marginBottom: 8 }}>是这些行为让我得出这个结论：</div>
                  {insight.evidenceDetail.cases.map((c, i) => {
                    const csd = caseLib ? caseLib.getCase(c.caseId) : null
                    const unkLabel = UNKNOWN_REASON_LABEL[c.unknownReason]
                    return (
                      <div key={i} className="tiny" style={{ padding: '6px 0', borderTop: i ? '1px dashed rgba(69,84,155,0.18)' : 'none' }}>
                        #{c.caseId.replace('case-', '')} {csd?.title || ''} · 得分 {c.score} · 证据克制 {c.over ?? '—'} · 判断边界 {c.boundary ?? '—'}
                        {c.usedUnknown ? ` · 选择了「无法判断」${unkLabel ? `（${unkLabel}）` : ''}` : ''}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
          <div className="mt-16" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div className="tiny muted">
              {insightAccepted ? '✅ 已接受挑战，去完成它。' : insight.caseId ? '今天我不给你新知识，来一道专门测试这个问题的案件。' : '保持这个状态，继续用真实案例巩固它。'}
            </div>
            <button className="btn btn-indigo btn-lg" onClick={acceptInsight}>
              {insightAccepted ? '继续完成 →' : '接受挑战 →'}
            </button>
          </div>
        </section>
      )}

      {/* 每日谜题 */}
      <DailyPuzzle />

      {/* 快速入口 */}
      <HomeQuickLinks />
    </div>
  )
}

// 没有错误记忆时，用学习状态生成一段「懂你」的开场
function authoredIntro(ls, masteredTitles) {
  const base = { exploring: '你是第一次来。别急着算，先从一个让你好奇的问题开始。', building: '我看了一下你的记录——概念正在搭起来，但骨架还没稳。', applying: '你已经有基础了，今天把「会用」再往上推一层。', consolidating: '你最近在稳步巩固，今天保持这个节奏，别贪多。', leveling: '核心概念你已经掌握，是时候进入更高难度的推理了。', stuck: '最近几次正确率有点低。先别学新的，回到薄弱点把它补实。' }
  const line = base[ls.phase] || base.building
  if (masteredTitles.length > 0) return `${line} 你已经掌握：${masteredTitles.join('、')}。`
  return line
}

function estimateMinutes(action) {
  if (action.type === 'case') return '6–8'
  if (action.type === 'experiment') return '3'
  if (action.type === 'exp') return '5–8'
  if (action.type === 'doubt') return '4–6'
  if (action.type === 'lesson') return '5–7'
  return '5'
}

function EntryCard({ icon, title, desc, to }) {
  return (
    <button className="entry-card" onClick={() => navigate(to)} style={{ textAlign: 'left' }}>
      <div className="ico">{icon}</div>
      <h3>{title}</h3>
      <p>{desc}</p>
    </button>
  )
}

// 首页快速入口（首屏等待 agent 时同样渲染，不依赖任何大模块）
function HomeQuickLinks() {
  return (
    <>
      <div className="entry-grid" style={{ marginBottom: 24, marginTop: 24 }}>
        <EntryCard icon="🧠" title="我想学懂" desc="从零开始，顺着问题学。" to="/lesson" />
        <EntryCard icon="🕵️" title="我想破案" desc="给你一个案例，你来判断。" to="/cases" />
        <EntryCard icon="🧪" title="我想验证" desc="把假设带进现实，记录 7 天。" to="/lab" />
        <EntryCard icon="🧠" title="我要怀疑" desc="看一句「玄学判断」，先问凭什么。" to="/doubt" />
      </div>

      <QuestionCard />

      <Remind icon="🔬">
        <b>小提醒：</b>这是传统知识体系中的一种解释方式，它不等同于经过现代科学验证的因果规律。我们更关心的是——你能不能理解它、分析它，并知道它的边界。
      </Remind>
    </>
  )
}

// ---------------- 每日谜题（2 分钟挑战） ----------------
function DailyPuzzle() {
  const { state, dispatch } = useApp()
  const puzzle = puzzleForDate()
  const today = todayString()
  const answered = (state.puzzleHistory || []).find((p) => p.date === today && p.puzzleId === puzzle.id)
  const [picked, setPicked] = useState(null)

  const chosen = answered ? answered.answerIdx : picked

  function choose(i) {
    if (chosen !== null) return
    setPicked(i)
    dispatch({ type: 'RECORD_PUZZLE', puzzleId: puzzle.id, answerIdx: i, correct: puzzle.options[i].correct })
  }

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="spread">
        <div>
          <div style={{ color: 'var(--indigo-deep)', fontWeight: 700, fontSize: 13, letterSpacing: 1 }}>🕵️ 今日玄学谜题</div>
          <h2 className="mt-8" style={{ fontSize: 20 }}>{puzzle.question}</h2>
        </div>
        <span className="pill pill-indigo">约 2 分钟</span>
      </div>

      {chosen === null ? (
        <div className="mt-12">
          {puzzle.options.map((o, i) => (
            <button key={i} className="option" onClick={() => choose(i)}>
              <span className="letter">{String.fromCharCode(65 + i)}</span>
              {o.text}
            </button>
          ))}
        </div>
      ) : (
        <div>
          <div className={`feedback mt-12 ${puzzle.options[chosen].correct ? 'good' : 'warn'}`}>
            <h4>{puzzle.options[chosen].correct ? '✓ 对。' : '⚠️ 差一点。'}</h4>
            <p className="tiny mt-8">{puzzle.options[chosen].explain}</p>
          </div>
          <div className="row mt-12">
            {answered ? (
              <span className="tiny muted">📌 今天的谜题你已答过，明天再来一个新的。</span>
            ) : (
              <button className="btn btn-ghost" onClick={() => navigate('/cases')}>想多练一练 →</button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

function QuestionCard() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [dict, setDict] = useState(null) // 词典按需加载：打开弹窗后才拉取（termData.js 173KB 不进首包）

  useEffect(() => {
    if (!open || dict) return
    let alive = true
    import('../data/dictionary').then((m) => {
      if (alive) setDict(m.DICTIONARY)
    })
    return () => { alive = false }
  }, [open, dict])

  const suggestions = useMemo(() => {
    if (!q.trim() || !dict) return []
    const hit = dict.filter((d) => d.term.includes(q) || q.includes(d.term) || d.oneLine.includes(q))
    return hit.slice(0, 3)
  }, [q, dict])

  return (
    <>
      <button className="entry-card" onClick={() => setOpen(true)} style={{ textAlign: 'left', width: '100%', marginBottom: 0 }}>
        <div className="ico">🌙</div>
        <h3>我有一个问题</h3>
        <p>输入一个问题，帮你找到「该学什么」。</p>
      </button>

      {open && (
        <Modal title="🌙 我有一个问题" onClose={() => setOpen(false)}>
          <p className="muted tiny">先别急着要答案，把问题写出来，我会帮你找到「该学什么」。</p>
          <div className="mt-12 field">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="例如：五行到底是什么？犯太岁是不是会倒霉？"
            />
          </div>

          {suggestions.length > 0 && (
            <div className="mt-12">
              <div className="tiny muted" style={{ marginBottom: 8 }}>也许你想弄懂这些：</div>
              {suggestions.map((d) => (
                <div key={d.term} className="row spread" style={{ padding: '10px 12px', background: 'var(--bg-warm)', borderRadius: 12, marginBottom: 8 }}>
                  <span>{d.emoji} {d.term} <span className="tiny muted">{d.oneLine}</span></span>
                  <button className="btn btn-sm btn-teal" onClick={() => navigate(`/dict?term=${encodeURIComponent(d.term)}`)}>去查</button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-16 grid-2">
            <button className="btn btn-soft btn-block" onClick={() => navigate('/lesson')}>进课堂系统学</button>
            <button className="btn btn-soft btn-block" onClick={() => navigate('/cases')}>用案例练一练</button>
          </div>
        </Modal>
      )}
    </>
  )
}