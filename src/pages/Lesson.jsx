// ============================================================
// AI 式课堂：不是聊天机器人，而是可交互的微课程。
// 步骤类型：curiosity / predict / info / drag-sort / connect /
//           choice / why / counter / selfreflect / summary / microexperiment / mastery
// V1.5 新增：好奇开场、先猜再学、老师记忆、教学人格语气、微实验跳转。
// ============================================================
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../store/AppContext'
import { LESSONS, getLesson } from '../data/lessons'
import { getNode } from '../data/knowledge'
import { getCurriculumNode } from '../data/curriculum'
import { composeStepFeedback } from '../agent/feedback'
import { composingTeacherMemory } from '../agent/teacherMemory'
import { getPersona } from '../agent/teacherPersona'
import { navigate } from '../lib/router'
import { PageHead, Bar, EmptyState, Remind } from '../components/ui'
import {
  questionIdFor,
  getNextLessonNode,
  profileDelta,
  replayOf,
} from '../lib/lessonProgress'

const LETTERS = ['A', 'B', 'C', 'D']

// 步骤类型 → 能力维度键（Evidence 的 masteryKey，供 masteryEngine 消费）
function masteryKeyForStep(stepType) {
  switch (stepType) {
    case 'predict': return 'observation'
    case 'drag-sort': return 'structure'
    case 'connect': return 'synthesis'
    case 'counter': return 'counterexample'
    case 'selfreflect': return 'uncertainty'
    case 'mastery': return 'structure'
    case 'choice': return 'reasoning'
    case 'why': return 'reasoning'
    default: return 'structure'
  }
}

// ---------------- 课程列表 ----------------
export function LessonList() {
  const { state } = useApp()
  return (
    <div>
      <PageHead title="🧑‍🏫 互动课堂" sub="每节课 5–10 分钟，从「一个让人好奇的问题」开始，先猜再学。" />
      <div className="grid-2">
        {LESSONS.map((l) => {
          const done = state.completedLessons[l.id]
          const value = state.mastery[l.nodeId] || 0
          const perfect = done?.perfect
          return (
            <button key={l.id} className="card card-hover" style={{ textAlign: 'left' }} onClick={() => navigate(`/lesson/${l.id}`)}>
              <div className="spread">
                <div style={{ fontSize: 26 }}>{l.emoji}</div>
                <div className="row">
                  {perfect ? <span className="pill pill-teal">✓ 满分</span> : value >= 4 ? <span className="pill pill-teal">已掌握</span> : value > 0 ? <span className="pill pill-amber">学习中</span> : <span className="pill pill-gray">未开始</span>}
                </div>
              </div>
              <h3 className="mt-12" style={{ fontSize: 18 }}>{l.title}</h3>
              <p className="muted tiny mt-8">{l.subtitle}</p>
              {l.hook && <p className="tiny mt-8" style={{ color: 'var(--amber-deep)' }}>❓ {l.hook.question}</p>}
              <div className="row mt-12 tiny muted">
                <span>⏱ {l.minutes} 分钟</span>
                <span>·</span>
                <span>{l.steps.length} 个互动</span>
              </div>
              <div className="mt-12"><Bar value={value} max={4} tone={value >= 4 ? 'teal' : 'amber'} /></div>
            </button>
          )
        })}
      </div>
      <Remind icon="🧠">课堂不是「看视频」，而是「先作答、再反馈、再应用」。真正的掌握，是你能在案例里用出来。</Remind>
    </div>
  )
}

// ---------------- 单课运行 ----------------
export function LessonRunner({ lessonId }) {
  const { state, dispatch } = useApp()
  const persona = getPersona(state)
  const memory = composingTeacherMemory(state)
  const [showOpening, setShowOpening] = useState(() => memory.hasMemory)
  const [result, setResult] = useState({ correct: 0, total: 0, masteryCorrect: false })
  // 视图状态机：'boot'（初始化定位）| 'run'（做题/刚完成）| 'completed'（已完成状态页）
  const [view, setView] = useState('boot')
  const [replay, setReplay] = useState(false)
  const booted = useRef(false)

  const lesson = getLesson(lessonId)

  if (!lesson) {
    return <EmptyState title="找不到这节课" desc="它可能已被移除。" action={<button className="btn" onClick={() => navigate('/lesson')}>返回课堂</button>} />
  }

  const nodeId = lesson.nodeId
  const progress = nodeId ? state.lessonProgress?.[nodeId] : null
  const attemptId = progress?.currentAttemptId || null
  // 题目位置唯一事实源：进度记录（刷新/退出后从 localStorage 恢复）
  const idx = Math.min(progress?.currentQuestionIndex || 0, lesson.steps.length)
  const node = getCurriculumNode(lesson.nodeId) || getNode(lesson.nodeId)

  // 进入课程时的定位（只执行一次）：
  //   completed     → 已完成状态页（不再重放第一题）
  //   in_progress   → 恢复上次进度（跳过已完成题，从第一个未完成题继续）
  //   not_started   → 开启新 attempt（从 Q1 开始）
  useEffect(() => {
    if (booted.current) return
    booted.current = true
    if (!nodeId) {
      setView('run')
      return
    }
    const p = state.lessonProgress?.[nodeId]
    if (p && p.status === 'completed') {
      setView('completed')
    } else if (p && p.status === 'in_progress' && p.currentAttemptId) {
      // 作答过但未点「继续」就退出：自动跳到第一个未完成题
      let startIdx = Math.min(p.currentQuestionIndex || 0, lesson.steps.length)
      while (
        startIdx < lesson.steps.length &&
        (p.completedQuestionIds || []).includes(questionIdFor(lessonId, startIdx, p.currentAttemptId))
      ) {
        startIdx += 1
      }
      if (startIdx !== (p.currentQuestionIndex || 0)) {
        dispatch({ type: 'ADVANCE_LESSON_QUESTION', nodeId, attemptId: p.currentAttemptId, nextIndex: startIdx })
      }
      setView('run')
    } else {
      dispatch({ type: 'START_LESSON_ATTEMPT', nodeId, lessonId, chapterId: lesson.chapter, collegeId: lesson.college })
      setView('run')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function startNewAttempt() {
    dispatch({
      type: 'START_LESSON_ATTEMPT',
      nodeId,
      lessonId,
      chapterId: lesson.chapter,
      collegeId: lesson.college,
      forceNew: true,
    })
    setResult({ correct: 0, total: 0, masteryCorrect: false })
    setShowOpening(false)
    setReplay(false)
    setView('run')
  }

  // 判断类作答：记录结果（不推进，等用户看完反馈点「继续」）
  function recordAnswer({ correct, errorType, stepType }) {
    const qIndex = idx
    const qId = questionIdFor(lessonId, qIndex, attemptId)
    // 幂等：同一 attempt 同一题已完成（刷新/重放保护）→ 不重复计分、不重复写 Evidence
    if ((progress?.completedQuestionIds || []).includes(qId)) return
    setResult((r) => ({
      correct: r.correct + (correct ? 1 : 0),
      total: r.total + 1,
      masteryCorrect: r.masteryCorrect || (stepType === 'mastery' && correct),
    }))
    dispatch({ type: 'RECORD_QUESTION_PROGRESS', nodeId, lessonId, attemptId, questionIndex: qIndex, questionId: qId, correct, stepType, errorType })
    dispatch({
      type: 'RECORD_EVIDENCE',
      evidence: {
        source: 'lesson',
        action: 'complete',
        targetType: 'question',
        targetId: qId,
        context: `课堂 ${lessonId}`,
        result: correct ? 'correct' : 'wrong',
        errorTypes: errorType ? [errorType] : [],
        masteryKey: masteryKeyForStep(stepType),
      },
    })
    dispatch({ type: 'RECORD_QUIZ', item: { lessonId, nodeId, correct, errorType, stepType } })
  }

  // 浏览/信息类步骤：记录 view（幂等）
  function recordView(stepType) {
    const qIndex = idx
    const qId = questionIdFor(lessonId, qIndex, attemptId)
    if ((progress?.completedQuestionIds || []).includes(qId)) return
    dispatch({ type: 'RECORD_QUESTION_PROGRESS', nodeId, lessonId, attemptId, questionIndex: qIndex, questionId: qId, correct: true, stepType: stepType || 'info' })
    dispatch({
      type: 'RECORD_EVIDENCE',
      evidence: {
        source: 'lesson',
        action: 'view',
        targetType: 'question',
        targetId: qId,
        context: `课堂 ${lessonId}`,
        result: 'view',
        masteryKey: masteryKeyForStep(stepType || 'info'),
      },
    })
  }

  // 推进到下一题（保持反馈停留：作答与推进分离）
  function advance() {
    recordView(step?.type)
    dispatch({ type: 'ADVANCE_LESSON_QUESTION', nodeId, attemptId, nextIndex: idx + 1 })
  }

  function finish() {
    recordView(step?.type)
    const finalResult = result.total ? result : { correct: 0, total: 0, masteryCorrect: false }
    // 关键：必须把 currentQuestionIndex 推进到 steps.length，
    // 渲染层 `idx >= lesson.steps.length` 才会切换到庆祝页；
    // 否则停在最后一题，点「完成本课」看起来毫无反应。
    dispatch({ type: 'ADVANCE_LESSON_QUESTION', nodeId, attemptId, nextIndex: lesson.steps.length })
    dispatch({ type: 'COMPLETE_LESSON_ATTEMPT', nodeId, lessonId, attemptId, result: finalResult })
    dispatch({ type: 'COMPLETE_LESSON', lessonId, nodeId, result: finalResult })
  }

  // 已完成关卡 → 轻量状态页（查看复盘 / 再练一次 / 继续下一关）
  if (view === 'completed') {
    return (
      <CompletedLessonView
        lesson={lesson}
        node={node}
        progress={progress}
        state={state}
        onReplay={startNewAttempt}
        onReplayView={() => setReplay(true)}
        onCloseReplay={() => setReplay(false)}
        showReplay={replay}
      />
    )
  }

  // 定位中（progress 尚未就绪）
  if (!progress || !attemptId) {
    return (
      <div className="lesson-body center">
        <p className="muted">正在打开课程…</p>
      </div>
    )
  }

  // 刚完成全部题目 → 庆祝页（主按钮：下一关）
  if (idx >= lesson.steps.length) {
    return (
      <LessonCompletePage
        lesson={lesson}
        node={node}
        progress={progress}
        attemptId={attemptId}
        result={result.total ? result : progress.result || result}
        persona={persona}
        memory={memory}
        state={state}
        showReplay={replay}
        onReplayView={() => setReplay(true)}
        onCloseReplay={() => setReplay(false)}
      />
    )
  }

  // 老师记忆开场（只在课程最开始出现一次，已完成关卡不出现）
  if (showOpening) {
    return <TeacherOpening memory={memory} persona={persona} onStart={() => setShowOpening(false)} />
  }

  const step = lesson.steps[idx]
  const isLast = idx === lesson.steps.length - 1

  return (
    <div className="lesson-body">
      <div className="spread">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/lesson')}>← 课堂</button>
        <div className="tiny muted">⏱ {lesson.minutes} 分钟 · 第 {idx + 1}/{lesson.steps.length} 题</div>
      </div>

      <Stepper count={lesson.steps.length} current={idx} />

      <div className="card" style={{ marginTop: 4 }}>
        <StepView
          key={idx}
          step={step}
          persona={persona}
          onAnswer={recordAnswer}
          onNext={isLast ? finish : advance}
          isLast={isLast}
        />
      </div>
    </div>
  )
}

// ---------------- 已完成状态页 ----------------
function CompletedLessonView({ lesson, node, progress, state, onReplay, onReplayView, onCloseReplay, showReplay }) {
  const next = getNextLessonNode(state, lesson.nodeId)
  const last = lastResultOf(progress)
  const replay = replayOf(progress)
  const completedAt = progress?.completedAt

  if (showReplay) {
    return (
      <div className="lesson-body">
        <div className="spread">
          <button className="btn btn-ghost btn-sm" onClick={onCloseReplay}>← 返回</button>
          <div className="tiny muted">本关复盘</div>
        </div>
        <h1 className="page-title" style={{ marginTop: 8 }}>📋 复盘「{lesson.title}」</h1>
        {replay.length ? (
          <div className="card mt-12">
            {replay.map((q, i) => (
              <div key={q.questionId} className="row" style={{ gap: 10, padding: '8px 0', borderBottom: i < replay.length - 1 ? '1px solid var(--line)' : 'none' }}>
                <span className="pill" style={{ minWidth: 34, textAlign: 'center' }}>{q.correct ? '✓' : '✗'}</span>
                <span className="tiny muted">第 {q.questionIndex + 1} 题 · {q.stepType}</span>
                <span className="tiny" style={{ marginLeft: 'auto', color: q.correct ? 'var(--teal-deep)' : 'var(--amber-deep)' }}>
                  {q.correct ? '正确' : q.errorType ? `错误：${q.errorType}` : '待练'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted mt-12">这一关还没有题目记录。</p>
        )}
        <div className="row mt-20" style={{ gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={onCloseReplay}>返回状态页</button>
        </div>
      </div>
    )
  }

  return (
    <div className="lesson-body center">
      <div style={{ fontSize: 56 }}>✓</div>
      <h1 className="page-title">已完成「{lesson.title}」</h1>
      <p className="muted">你已经完成过这一关。</p>
      <p className="tiny muted mt-8">
        上次完成：{completedAt ? new Date(completedAt).toLocaleDateString('zh-CN') : '—'}
        {last ? ` · 答对 ${last.correct}/${last.total}` : ''}
      </p>
      <div className="mt-20 card" style={{ maxWidth: 420, width: '100%' }}>
        <div className="tiny muted">对「{node?.title}」的掌握</div>
        <div className="mt-8"><Bar value={state.mastery?.[lesson.nodeId] || 0} max={6} tone="teal" /></div>
      </div>
      <div className="row mt-20" style={{ justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
        <NextLessonButton next={next} label="继续下一关" />
        <button className="btn btn-ghost" onClick={onReplayView}>查看复盘</button>
        <button className="btn btn-primary" onClick={onReplay}>再练一次</button>
        <button className="btn btn-ghost" onClick={() => navigate('/map')}>返回地图</button>
      </div>
    </div>
  )
}

// ---------------- 刚完成：庆祝页 ----------------
function LessonCompletePage({ lesson, node, progress, attemptId, result, persona, memory, state, showReplay, onReplayView, onCloseReplay }) {
  const next = getNextLessonNode(state, lesson.nodeId)
  const attempt = (progress?.attempts || []).find((a) => a.attemptId === attemptId) || (progress?.attempts || []).slice(-1)[0]
  const delta = profileDelta(attempt?.startProfile, attempt?.endProfile)
  const score = result.total ? Math.round((result.correct / result.total) * 100) : 0
  const memo = memory.hasMemory ? `「${memory.title}」这个坑，今天你踩得比上次少了吗？` : '每次都比上一次更接近「会看」。'
  const replay = replayOf(progress)

  if (showReplay) {
    return (
      <div className="lesson-body">
        <div className="spread">
          <button className="btn btn-ghost btn-sm" onClick={onCloseReplay}>← 返回</button>
          <div className="tiny muted">本关复盘</div>
        </div>
        <h1 className="page-title" style={{ marginTop: 8 }}>📋 复盘「{lesson.title}」</h1>
        {replay.length ? (
          <div className="card mt-12">
            {replay.map((q, i) => (
              <div key={q.questionId} className="row" style={{ gap: 10, padding: '8px 0', borderBottom: i < replay.length - 1 ? '1px solid var(--line)' : 'none' }}>
                <span className="pill" style={{ minWidth: 34, textAlign: 'center' }}>{q.correct ? '✓' : '✗'}</span>
                <span className="tiny muted">第 {q.questionIndex + 1} 题 · {q.stepType}</span>
                <span className="tiny" style={{ marginLeft: 'auto', color: q.correct ? 'var(--teal-deep)' : 'var(--amber-deep)' }}>
                  {q.correct ? '正确' : q.errorType ? `错误：${q.errorType}` : '待练'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted mt-12">这一关还没有题目记录。</p>
        )}
        <div className="row mt-20" style={{ gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={onCloseReplay}>返回完成页</button>
        </div>
      </div>
    )
  }

  return (
    <div className="lesson-body center">
      <div style={{ fontSize: 60 }}>🎉</div>
      <h1 className="page-title">本关完成</h1>
      <p className="muted">你完成了「{lesson.title}」</p>
      <p className="tiny muted mt-8">
        完成 {result.total} 道训练 · 答对 {result.correct} 道 · 掌握度 {score}%
      </p>
      <p className="tiny muted mt-8">{persona.emoji} {memo}</p>

      <div className="mt-20 card" style={{ maxWidth: 420, width: '100%' }}>
        <div className="tiny muted">对「{node?.title}」的掌握</div>
        <div className="mt-8"><Bar value={state.mastery?.[lesson.nodeId] || 0} max={6} tone="teal" /></div>
        {delta.length > 0 && (
          <div className="mt-12 tiny">
            能力变化：
            {delta.map((d) => (
              <span key={d.key} className="pill pill-teal" style={{ margin: '0 4px' }}>{d.label} {d.from} → {d.to}</span>
            ))}
          </div>
        )}
      </div>

      <div className="row mt-20" style={{ justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
        <NextLessonButton next={next} label="下一关" />
        <button className="btn btn-ghost" onClick={onReplayView}>查看本关复盘</button>
        <button className="btn btn-ghost" onClick={() => navigate('/map')}>返回地图</button>
      </div>

      <Remind icon="🔬">
        {next && next.node
          ? next.unlocked
            ? `刚学完就趁热继续：下一关「${next.node.emoji} ${next.node.title}」已解锁，点上面的按钮直接开练。`
            : `下一关「${next.node.title}」还需要先满足前置：${next.lockReason || '完成前置节点'}。`
          : '你已经走完了当前学习路径，去地图看看下一章，或回到案例馆把概念真正用一次。'}
      </Remind>
    </div>
  )
}

// 下一关按钮：按地图真实顺序计算，主按钮
function NextLessonButton({ next, label }) {
  if (!next || next.pathEnd || !next.node) {
    return <button className="btn btn-ghost" onClick={() => navigate('/map')}>查看学习路径</button>
  }
  const text = next.chapterEnd
    ? `进入下一章：${next.nextChapterTitle || '新章节'} →`
    : next.collegeEnd
      ? `进入新学院 →`
      : `${label}：${next.node.emoji} ${next.node.title} →`
  return (
    <button
      className="btn btn-primary btn-lg"
      disabled={!next.unlocked}
      title={next.unlocked ? '' : next.lockReason || '前置未完成'}
      onClick={() => navigate(`/lesson/${next.lessonId}`)}
    >
      {text}
    </button>
  )
}

function lastResultOf(progress) {
  return (progress && progress.result) || null
}

function TeacherOpening({ memory, persona, onStart }) {
  return (
    <div className="lesson-body">
      <div className="card center" style={{ padding: '36px 24px' }}>
        <div style={{ fontSize: 52 }}>👀</div>
        <p className="tiny muted mt-12">{persona.emoji} {persona.greet}</p>
        <h2 className="mt-16" style={{ fontSize: 22, maxWidth: 480, margin: '0 auto' }}>{memory.opener}</h2>
        {memory.generic && <p className="muted tiny mt-12">{memory.generic}</p>}
        <button className="btn btn-primary btn-lg mt-24" onClick={onStart}>来吧</button>
      </div>
    </div>
  )
}

function Stepper({ count, current }) {
  return (
    <div className="stepper">
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className={`step-dot ${i === current ? 'on' : i < current ? 'done' : ''}`} />
      ))}
    </div>
  )
}

// ---------------- 单步渲染 ----------------
function StepView({ step, persona, onAnswer, onNext, isLast }) {
  const [answered, setAnswered] = useState(false)
  const [feedback, setFeedback] = useState(null)

  function handleChoice(optIndex) {
    if (answered) return
    const option = step.options[optIndex]
    const correct = !!option.correct
    setFeedback(composeStepFeedback(step, option))
    setAnswered(true)
    onAnswer({ correct, errorType: option.errorType || null, stepType: step.type })
  }

  switch (step.type) {
    case 'curiosity':
      return <CuriosityStep step={step} onNext={onNext} />

    case 'predict':
      return <PredictStep step={step} onNext={onNext} isLast={isLast} />

    case 'intro':
    case 'info':
      return <ReadStep step={step} onNext={onNext} isLast={isLast} />

    case 'summary':
      return <SummaryStep step={step} onNext={onNext} isLast={isLast} />

    case 'microexperiment':
      return <MicroExperimentStep step={step} onNext={onNext} isLast={isLast} />

    case 'choice':
    case 'why':
    case 'counter':
    case 'mastery':
      return (
        <div>
          <h2 className="step-prompt">{step.prompt}</h2>
          {step.options.map((opt, i) => (
            <button key={i} className={`option ${answered && opt.correct ? 'correct' : ''}`} onClick={() => handleChoice(i)}>
              <span className="letter">{LETTERS[i]}</span>
              {opt.text}
            </button>
          ))}
          {answered && <FeedbackBlock feedback={feedback} persona={persona} />}
          <NextBtn disabled={!answered} isLast={isLast} onNext={onNext} />
        </div>
      )

    case 'drag-sort':
      return <DragSort step={step} persona={persona} onAnswer={onAnswer} onNext={onNext} isLast={isLast} />

    case 'connect':
      return <Connect step={step} persona={persona} onAnswer={onAnswer} onNext={onNext} isLast={isLast} />

    case 'selfreflect':
      return <SelfReflect step={step} onNext={onNext} isLast={isLast} />

    default:
      return <ReadStep step={step} onNext={onNext} isLast={isLast} />
  }
}

// ① 好奇：一个反常识问题
function CuriosityStep({ step, onNext }) {
  return (
    <div>
      <div className="tiny muted" style={{ color: 'var(--amber-deep)', fontWeight: 700 }}>① 好奇</div>
      <h2 className="step-prompt" style={{ fontSize: 22 }}>{step.question}</h2>
      <p style={{ fontSize: 16, color: 'var(--text-2)' }}>{step.tease}</p>
      <button className="btn btn-primary btn-lg mt-20" onClick={onNext}>我先猜猜看 →</button>
    </div>
  )
}

// ② 预测：让用户先猜，不给对错
function PredictStep({ step, onNext, isLast }) {
  const [picked, setPicked] = useState(null)
  return (
    <div>
      <div className="tiny muted" style={{ color: 'var(--amber-deep)', fontWeight: 700 }}>② 预测 · 先猜，答案稍后揭晓</div>
      <h2 className="step-prompt">{step.prompt}</h2>
      {step.options.map((opt, i) => {
        const active = picked === i
        return (
          <button key={i} className={`option ${active ? 'correct' : ''}`} onClick={() => setPicked(i)} style={active ? { borderColor: 'var(--amber)' } : {}}>
            <span className="letter">{LETTERS[i]}</span>
            {opt.text}
          </button>
        )
      })}
      {picked !== null && (
        <div className="feedback good mt-12">
          <h4>👀 先记住你的猜测</h4>
          <p className="tiny mt-8">{step.reveal || '先不评判对错。带着你的猜测，往下学。'}</p>
          {step.remember && <div className="remember mt-12">🧠 {step.remember}</div>}
          <NextBtn disabled={false} isLast={isLast} onNext={onNext} />
        </div>
      )}
    </div>
  )
}

// ⑦ 总结
function SummaryStep({ step, onNext, isLast }) {
  return (
    <div>
      <div className="tiny muted" style={{ color: 'var(--teal-deep)', fontWeight: 700 }}>⑦ 总结</div>
      <h2 className="step-prompt">{step.title}</h2>
      <ul className="clue-list">
        {step.points.map((p, i) => <li key={i}>{p}</li>)}
      </ul>
      {step.remember && <div className="remember mt-12">🧠 {step.remember}</div>}
      <NextBtn disabled={false} isLast={isLast} onNext={onNext} />
    </div>
  )
}

// ⑧ 微实验
function MicroExperimentStep({ step, onNext, isLast }) {
  return (
    <div>
      <div className="tiny muted" style={{ color: 'var(--indigo-deep)', fontWeight: 700 }}>⑧ 微实验 · 带到现实</div>
      <h2 className="step-prompt">{step.title}</h2>
      <p style={{ fontSize: 16 }}>{step.text}</p>
      <div className="row mt-20" style={{ gap: 10 }}>
        {step.experimentId && (
          <button className="btn btn-indigo" onClick={() => navigate(`/lab/${step.experimentId}`)}>现在就去做 →</button>
        )}
        <button className="btn btn-primary" onClick={onNext}>{isLast ? '完成本课' : '继续 →'}</button>
      </div>
    </div>
  )
}

function ReadStep({ step, onNext, isLast }) {
  return (
    <div>
      <h2 className="step-prompt">{step.title || step.prompt}</h2>
      <p style={{ fontSize: 16 }}>{step.body || step.explain}</p>
      {step.highlight && (
        <div className="feedback remember" style={{ background: 'rgba(69,84,155,0.1)', color: 'var(--indigo-deep)', marginTop: 14 }}>
          {step.highlight}
        </div>
      )}
      {step.tip && <p className="muted tiny mt-12">💡 {step.tip}</p>}
      {step.remember && step.type !== 'choice' && <div className="remember mt-12">🧠 {step.remember}</div>}
      <NextBtn disabled={false} isLast={isLast} onNext={onNext} />
    </div>
  )
}

function NextBtn({ disabled, isLast, onNext }) {
  return (
    <div className="mt-20" style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <button className="btn btn-primary" disabled={disabled} onClick={onNext}>
        {isLast ? '完成本课' : '继续 →'}
      </button>
    </div>
  )
}

function FeedbackBlock({ feedback, persona }) {
  const wrongTitle = persona?.wrong || '⚠️ 这里值得注意'
  const rightTitle = persona?.correct || '✓ 你做对了'
  const title = feedback.tone === 'good' ? rightTitle : wrongTitle
  return (
    <div className={`feedback ${feedback.tone}`}>
      <h4>{title}</h4>
      <p className="tiny" style={{ marginTop: 4 }}>{feedback.detail}</p>
      {feedback.errorName && (
        <p className="tiny mt-8" style={{ color: 'var(--amber-deep)' }}>
          识别到错误类型：{feedback.errorName}
        </p>
      )}
      {feedback.remember && (
        <div className="remember mt-12">🧠 记住：{feedback.remember}</div>
      )}
    </div>
  )
}

// 拖动排序（相生/相克顺序）
function DragSort({ step, persona, onAnswer, onNext, isLast }) {
  const [order, setOrder] = useState(step.items)
  const [done, setDone] = useState(false)
  const [correct, setCorrect] = useState(false)
  const [dragIdx, setDragIdx] = useState(null)

  function move(from, to) {
    const next = [...order]
    const [v] = next.splice(from, 1)
    next.splice(to, 0, v)
    setOrder(next)
  }

  function check() {
    const ok = order.join('|') === step.correctOrder.join('|')
    setCorrect(ok)
    setDone(true)
    onAnswer({ correct: ok, errorType: ok ? null : 'E03', stepType: 'choice' })
  }

  return (
    <div>
      <h2 className="step-prompt">{step.prompt}</h2>
      <div className="drag-list">
        {order.map((item, i) => (
          <div
            key={item}
            className="drag-item"
            draggable
            onDragStart={() => setDragIdx(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (dragIdx !== null && dragIdx !== i) move(dragIdx, i); setDragIdx(null) }}
          >
            <span className="row" style={{ justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-3)', fontSize: 12 }}>◦</span>
              <span>{item}</span>
              <span className="row" style={{ gap: 4 }}>
                <button className="btn btn-ghost btn-sm" disabled={i === 0} onClick={() => move(i, i - 1)}>↑</button>
                <button className="btn btn-ghost btn-sm" disabled={i === order.length - 1} onClick={() => move(i, i + 1)}>↓</button>
              </span>
            </span>
          </div>
        ))}
      </div>
      <p className="tiny muted">拖动或用箭头调整顺序，然后点击检查。</p>

      {!done ? (
        <button className="btn btn-primary mt-12" onClick={check}>检查顺序</button>
      ) : (
        <div className={`feedback ${correct ? 'good' : 'warn'} mt-12`}>
          <h4>{correct ? (persona?.correct || '✓ 排对了') : (persona?.wrong || '⚠️ 再想一想')}</h4>
          <p className="tiny mt-8">{step.discoverText || step.explain}</p>
          <div className="remember mt-12">🧠 记住：{step.remember}</div>
          <div className="mt-16" style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={onNext}>{isLast ? '完成本课' : '继续 →'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

// 连线题（天干 ↔ 五行）
function Connect({ step, persona, onAnswer, onNext, isLast }) {
  const rights = useMemo(() => step.pairs.map((p) => p.b).sort(() => Math.random() - 0.5), [step])
  const [selA, setSelA] = useState(null)
  const [match, setMatch] = useState({})
  const [done, setDone] = useState(false)
  const [correct, setCorrect] = useState(false)

  function pickRight(b) {
    if (selA === null) return
    setMatch((m) => ({ ...m, [selA]: b }))
    setSelA(null)
  }

  function check() {
    const ok = step.pairs.every((p) => match[p.a] === p.b)
    setCorrect(ok)
    setDone(true)
    onAnswer({ correct: ok, errorType: ok ? null : 'E10', stepType: 'choice' })
  }

  return (
    <div>
      <h2 className="step-prompt">{step.prompt}</h2>
      <div className="row" style={{ alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
        <div className="connect-col">
          {step.pairs.map((p) => (
            <button key={p.a} className={`connect-a ${selA === p.a ? 'active' : ''} ${match[p.a] ? 'matched' : ''}`} style={{ display: 'block', width: '100%', marginBottom: 10 }} onClick={() => setSelA(p.a)}>
              {p.a} {match[p.a] ? <span className="tiny muted"> → {match[p.a]}</span> : ''}
            </button>
          ))}
        </div>
        <div className="connect-col">
          {rights.map((r) => {
            const used = Object.values(match).includes(r)
            return (
              <button key={r} className={`connect-opt ${used ? 'done' : ''}`} style={{ display: 'block', width: '100%', marginBottom: 10 }} onClick={() => pickRight(r)}>
                {r}
              </button>
            )
          })}
        </div>
      </div>
      <p className="tiny muted mt-8">先点左边一个，再点右边一个完成连线。</p>

      {!done ? (
        <button className="btn btn-primary mt-12" onClick={check}>检查连线</button>
      ) : (
        <div className={`feedback ${correct ? 'good' : 'warn'} mt-12`}>
          <h4>{correct ? (persona?.correct || '✓ 连对了') : (persona?.wrong || '⚠️ 有连错的地方')}</h4>
          <p className="tiny mt-8">{step.explain}</p>
          <div className="remember mt-12">🧠 记住：{step.remember}</div>
          <div className="mt-16" style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={onNext}>{isLast ? '完成本课' : '继续 →'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

// 自我解释
function SelfReflect({ step, onNext, isLast }) {
  const { dispatch } = useApp()
  const [text, setText] = useState('')
  const [saved, setSaved] = useState(false)

  function save() {
    if (!text.trim()) return
    dispatch({ type: 'SAVE_SELF_EXPLANATION', nodeId: step.nodeId, text: text.trim() })
    setSaved(true)
  }

  return (
    <div className="selfreflect">
      <h2 className="step-prompt">{step.prompt}</h2>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={step.placeholder} disabled={saved} />
      <p className="tiny muted mt-8">这是给你自己的记录，本地保存，不会「打分」，但会帮你形成长期记忆。</p>
      {!saved ? (
        <button className="btn btn-primary mt-12" onClick={save}>保存我的解释</button>
      ) : (
        <div className="feedback good mt-12">
          <h4>✓ 已记录</h4>
          <p className="tiny mt-8">你的解释会留在「成长」页，之后回忆时可以对照。</p>
          <div className="mt-16" style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={onNext}>{isLast ? '完成本课' : '继续 →'}</button>
          </div>
        </div>
      )}
    </div>
  )
}