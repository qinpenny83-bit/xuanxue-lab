// ============================================================
// 🔬 64卦深度档案（R2-1）
// 一卦 = 可钻研知识对象：结构 → 卦辞 → 六爻(384) → 十翼 → 爻位
//      → 关键词 → 解释传统 → 案例 → 易错 → 练习 → 我的理解 → 掌握度
// 三层模式：初学者 / 深入 / 研究。
// 原则：原典不编造（缺=「暂无可靠整理」）；结构·爻位全部确定性推导；
//       十翼/解释传统走 nodeId 引用，一份知识只存一份。
// ============================================================
import React, { useState, useEffect, useMemo } from 'react'
import { useApp } from '../store/AppContext'
import { navigate } from '../lib/router'
import { PageHead, Remind, Segmented } from '../components/ui'
import {
  HEXAGRAM_PROFILES,
  HEX_PROFILE_BY_SEQ,
  getHexagramProfile,
  TRADITION_REF,
} from '../data/iching/hexagramProfile'
import {
  hexMastery,
  hexStage,
  yaoMasteryDetail,
  hexRecommendation,
  yaoQuestions,
  hexQuestions,
  hexMasteryKey,
  hexDepthProgress,
  yaoEvidence,
} from '../data/iching/hexMastery'
import { getClassicPassage, randomClassicPassage, hexName } from '../data/iching/classic-passages'
import { casesForHexagram, casesForYao, CASE_LEVELS } from '../data/iching/caseGraph'
import { getCurriculumNode } from '../data/curriculum'
import { V3_LESSONS } from '../data/lessons'

// ── 小工具 ──────────────────────────────────────────────
const HEX_STAGE_ORDER = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5']

const lessonByNode = {}
for (const l of V3_LESSONS) if (l.nodeId && !lessonByNode[l.nodeId]) lessonByNode[l.nodeId] = l

function lessonLink(nodeId) {
  const l = lessonByNode[nodeId]
  return l ? `/lesson/${l.id}` : '/map'
}

// 六爻卦画（自下而上的 01 串 → 上爻在上的竖排）
function Glyph({ lines, size = 'md' }) {
  const arr = lines.split('')
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

// 「我的理解」便签（按 key 持久化到 state.hexNotes）
function NoteField({ noteKey, placeholder }) {
  const { state, dispatch } = useApp()
  const saved = state.hexNotes?.[noteKey]?.note || ''
  const [val, setVal] = useState(saved)
  useEffect(() => setVal(saved), [saved])
  return (
    <div>
      <textarea
        className="archive-note"
        rows={3}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder={placeholder}
      />
      <div className="row mt-8" style={{ justifyContent: 'flex-end', gap: 8 }}>
        <button className="btn btn-ghost btn-sm" disabled={!val} onClick={() => { dispatch({ type: 'DELETE_HEX_NOTE', key: noteKey }); setVal('') }}>清除</button>
        <button className="btn btn-primary btn-sm" onClick={() => dispatch({ type: 'SAVE_HEX_NOTE', key: noteKey, note: val })}>保存</button>
      </div>
    </div>
  )
}

// 通用选择题练习（deterministic；答对记录掌握度，答错记 E03 结构误判）
function Quiz({ questions, nodeId }) {
  const { dispatch } = useApp()
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState(null)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)
  const q = questions[idx]

  function pick(i) {
    if (picked !== null) return
    setPicked(i)
    const correct = i === q.answer
    if (correct) setScore((s) => s + 1)
    dispatch({
      type: 'RECORD_QUIZ',
      item: { nodeId, correct, stepType: 'mastery', errorType: correct ? undefined : 'E03', storeContext: '卦档案练习' },
    })
  }
  function next() {
    if (idx + 1 >= questions.length) { setDone(true); return }
    setIdx(idx + 1)
    setPicked(null)
  }
  function restart() { setIdx(0); setPicked(null); setScore(0); setDone(false) }

  if (done) {
    return (
      <div className="archive-quiz-done">
        <div style={{ fontSize: 30 }}>{score === questions.length ? '🏆' : score >= 2 ? '✅' : '🌱'}</div>
        <div style={{ fontWeight: 700, marginTop: 4 }}>答对 {score}/{questions.length}</div>
        <p className="tiny muted mt-4">
          {score === questions.length ? '全对！这部分你已经掌握了。' : score >= 2 ? '不错，还差一点点，再巩固一下。' : '别急，回「看结构」把规则过一遍，再回来试。'}
        </p>
        <div className="row mt-12" style={{ justifyContent: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={restart}>再练一轮</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="spread">
        <span className="pill pill-gray">{idx + 1}/{questions.length}</span>
        <span className="tiny muted">答完自动计入掌握度</span>
      </div>
      <p className="mt-8" style={{ fontSize: 15, fontWeight: 600 }}>{q.prompt}</p>
      <div className="mt-12" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {q.options.map((opt, i) => {
          let cls = 'option'
          if (picked !== null) {
            if (i === q.answer) cls += ' correct'
            else if (i === picked) cls += ' wrong'
          }
          return (
            <button key={i} className={cls} onClick={() => pick(i)} disabled={picked !== null}>
              <span className="option-text">{opt}</span>
            </button>
          )
        })}
      </div>
      {picked !== null && (
        <div className={`feedback ${picked === q.answer ? 'good' : 'warn'} mt-12`}>
          <h4>{picked === q.answer ? '✓ 正确' : '✗ 再看看'}</h4>
          <p className="tiny mt-8">{q.explain}</p>
          <div className="row mt-12" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-primary btn-sm" onClick={next}>{idx + 1 >= questions.length ? '看结果' : '下一题 →'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 爻条目（可展开）──────────────────────────────────────
function YaoItem({ profile, index, autoOpen }) {
  const y = profile.yao[index]
  const { state, dispatch } = useApp()
  const m = (state.mastery && state.mastery[y.id]) || 0
  const [open, setOpen] = useState(autoOpen)
  const noteKey = y.id
  const [yaoCases] = useState(() => casesForYao(profile.number, index))

  const qs = useMemoYaoQuestions(profile, index)

  function toggle() {
    const next = !open
    setOpen(next)
    if (next) {
      dispatch({ type: 'RECORD_HEX_EVIDENCE', key: y.id, kind: 'read' })
      dispatch({ type: 'RECORD_HEX_EVIDENCE', key: y.id, kind: 'original' })
    }
  }

  return (
    <div className="yao-item">
      <button className="yao-item-head" onClick={toggle}>
        <span className="yao-name">{y.name}</span>
        <span className="yao-lineinfo tiny muted">{y.lineType}爻 · {y.innerOuter}</span>
        <span className="yao-badges">
          <span className={`yao-badge ${y.dewei ? 'on' : 'off'}`}>{y.dewei ? '当位' : '失位'}</span>
          {y.zhong && <span className="yao-badge zhong">中</span>}
        </span>
        <span className="yao-mastery tiny muted">
          {m >= 4 ? '🏆' : m >= 1 ? '📖' : '🌱'}
        </span>
        <span className="yao-toggle">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="yao-body">
          <div className="archive-sub">① 原文</div>
          {y.originalText ? (
            <p className="display guaci-quote">「{y.originalText}」</p>
          ) : (
            <p className="tiny muted">该爻爻辞全文「暂无可靠整理」（通行本译注待核对）。</p>
          )}

          <div className="archive-sub">② 它处在什么位置</div>
          <p style={{ fontSize: 14 }}>{y.positionLabel}爻 —— {y.positionMeaning}</p>

          <div className="archive-sub">③ 这条爻本身</div>
          <p style={{ fontSize: 14 }}>{y.gangrou}（{y.lineType}）· {y.innerOuter}</p>

          <div className="archive-sub">④ 结构关系（规则引擎推导）</div>
          <div className="rel-grid">
            <div className="rel-tag">{y.deweiLabel}</div>
            <div className="rel-tag">{y.zhong ? '居中' + (y.zhongzheng ? '且得正（中正）' : '（未得正）') : '不在中位'}</div>
            {y.ying && <div className="rel-tag">与{y.ying.partnerLabel}爻：{y.ying.type}（{y.ying.favorable ? '可呼应' : '不呼应'}）</div>}
            {y.cheng && <div className="rel-tag">{y.cheng.type}（承{y.cheng.toLabel}爻）</div>}
            {y.ling && <div className="rel-tag">{y.ling.type}（乘{y.ling.toLabel}爻）</div>}
          </div>
          <p className="tiny muted mt-8">注：以上为传统易学「爻位」规则推导，是一种解释框架，不是唯一或“科学”结论。</p>

          <div className="archive-sub">⑤ 《象》怎么说</div>
          <p className="tiny muted">本爻小象「暂无可靠整理」，可到〈象传〉课程查看小象的通例。{' '}
            <a href={`#${lessonLink('yz-xiang')}`} style={{ color: 'var(--indigo)' }}>去象传 →</a></p>

          <div className="archive-sub">⑥ 不同传统怎么解释</div>
          <div className="trad-list">
            {y.interpretationTraditions.slice(0, 3).map((t) => (
              <div key={t.key} className="trad-row">
                <a href={`#${lessonLink(t.node)}`} style={{ fontWeight: 700, color: 'var(--indigo)' }}>{t.label}</a>
                <span className="tiny muted"> · {t.note}。此爻解说「暂无可靠整理」。</span>
              </div>
            ))}
          </div>

          <div className="archive-sub">⑦ 案例 · 先想再比</div>
          {yaoCases.cases.length > 0 ? (
            <div className="trad-list">
              {yaoCases.cases.map((c) => (
                <div key={c.id} className="trad-row">
                  <span className="pill pill-gray">{c.levelLabel}</span>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{c.title}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="tiny muted">本爻暂无专属案例。</p>
          )}
          {!yaoCases.dedicated && (
            <p className="tiny muted mt-8">{yaoCases.suggestions.adjacent} {yaoCases.suggestions.structure} {yaoCases.suggestions.classic}</p>
          )}
          <div className="mt-8">
            <ThinkFirst
              prompt={`先自己想：${y.name}「${y.originalText || y.name}」这句话，为什么放在这个位置？`}
              revealText="对照结构再看：看本爻的得位 / 中 / 应关系，再看不同传统如何取象或取义——同一文本可以有多条解释路径，没有唯一答案。把你的想法同它们比一比。"
              onReveal={() => dispatch({ type: 'RECORD_HEX_EVIDENCE', key: y.id, kind: 'cases' })}
            />
          </div>

          <div className="archive-sub">⑧ 练习（判断·确定性）</div>
          <Quiz questions={qs} nodeId={y.id} />

          <div className="archive-sub">⑨ 我的理解</div>
          <NoteField noteKey={noteKey} placeholder={`用自己的话说说，你怎么理解「${y.name}」此时的位置与含义……`} />
        </div>
      )}
    </div>
  )
}

// 避免每次渲染重建题目（题目本身 deterministic）。
// 关键：用 useMemo 而非 useState —— 当卦 / 爻切换时，题目必须随 profile/index 重新计算，
// 否则会残留上一个卦的 stale 题目（Phase 0 的「坤卦却问乾卦上卦」bug 根因）。
function useMemoYaoQuestions(profile, index) {
  return useMemo(() => yaoQuestions(profile, index), [profile, index])
}

// ── 卦级练习 ─────────────────────────────────────────────
function HexPractice({ profile }) {
  const qs = useMemoHexQuestions(profile)
  return <Quiz questions={qs} nodeId={hexMasteryKey(profile.number)} />
}
function useMemoHexQuestions(profile) {
  return useMemo(() => hexQuestions(profile), [profile])
}

// ── 深度进度（认识→…→独立分析，八阶段，从真实证据推导）─────────────
const STATUS_ICON = { done: '✓', partial: '△', todo: '○' }
const STATUS_CLASS = { done: 'dp-done', partial: 'dp-partial', todo: 'dp-todo' }

function DepthBar({ stages }) {
  return (
    <div className="depth-bar">
      {stages.map((s) => (
        <span key={s.key} className={`depth-step ${STATUS_CLASS[s.status]}`} title={s.status === 'done' ? '已完成' : s.status === 'partial' ? '进行中' : '未开始'}>
          <span className="depth-ico">{STATUS_ICON[s.status]}</span>
          <span className="depth-label">{s.label}</span>
        </span>
      ))}
    </div>
  )
}

// ── 先思考，再看解释（本轮核心交互：不直接给答案）────────────────
function ThinkFirst({ prompt, revealText, onReveal }) {
  const [val, setVal] = useState('')
  const [revealed, setRevealed] = useState(false)
  function submit() {
    if (!val.trim()) return
    setRevealed(true)
    onReveal && onReveal(val)
  }
  if (revealed) {
    return (
      <div>
        <div className="tiny muted">你的想法：{val}</div>
        <div className="mt-8" style={{ fontSize: 14 }}>{revealText}</div>
      </div>
    )
  }
  return (
    <div className="think-first">
      <div className="tiny" style={{ fontWeight: 700, color: 'var(--indigo-deep)' }}>✍️ 先自己想</div>
      <textarea className="archive-note" rows={2} value={val} onChange={(e) => setVal(e.target.value)} placeholder={prompt} />
      <div className="row mt-8" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-primary btn-sm" disabled={!val.trim()} onClick={submit}>提交，再看解释 →</button>
      </div>
    </div>
  )
}

// ── 经典片段卡片（原典 → 现代提示 → 相关卦，四层不混）────────────
function ClassicPassageCard({ passage }) {
  if (!passage) return null
  return (
    <div className="layer-box classic">
      <div className="layer-tag">{passage.source} · {passage.chapter}</div>
      <p className="display" style={{ fontSize: 16 }}>{passage.text}</p>
      <p className="tiny muted mt-8">现代提示（非原典）：{passage.modernNote}</p>
      {passage.relatedHexagrams?.length > 0 && (
        <div className="tiny muted mt-4">
          相关卦：{passage.relatedHexagrams.map((s) => (
            <a key={s} href={`#/hex/${s}`} className="tag-link" style={{ marginRight: 6 }}>{hexName(s)}</a>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 顶层：详情视图 ───────────────────────────────────────
function HexDetail({ profile, params }) {
  const { state, dispatch } = useApp()
  const [mode, setMode] = useState('beginner')
  const stage = hexStage(state, profile.number)
  const rec = hexRecommendation(state, profile.number)
  const detail = yaoMasteryDetail(state, profile.number)
  const depth = hexDepthProgress(state, profile.number)

  // 进入某一卦即打点「阅读 + 原典」学习证据（看过 ≠ 学会，只记录阅读痕迹）
  useEffect(() => {
    const key = hexMasteryKey(profile.number)
    dispatch({ type: 'RECORD_HEX_EVIDENCE', key, kind: 'read' })
    dispatch({ type: 'RECORD_HEX_EVIDENCE', key, kind: 'original' })
  }, [profile.number])

  const N = profile.number
  const prev = HEX_PROFILE_BY_SEQ[N - 1] || HEX_PROFILE_BY_SEQ[64]
  const next = HEX_PROFILE_BY_SEQ[N + 1] || HEX_PROFILE_BY_SEQ[1]

  return (
    <div className="lesson-body">
      <div className="row spread" style={{ alignItems: 'center' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/hex')}>← 64卦档案</button>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/hex/${prev.number}`)}>← {prev.name}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/hex/${next.number}`)}>{next.name} →</button>
        </div>
      </div>

      {/* 卦名头 */}
      <div className="archive-head">
        <div className="archive-glyph-wrap">
          <Glyph lines={profile.binaryPattern} size="lg" />
        </div>
        <div style={{ flex: 1 }}>
          <div className="tiny muted">第 {profile.number} 卦 · {profile.pinyin ? `pinyin：${profile.pinyin}` : ''}</div>
          <h1 className="page-title" style={{ margin: '2px 0' }}>{profile.name}<span className="archive-fullname">{profile.traditionalName}</span></h1>
          <div className="tiny muted" style={{ marginTop: 4 }}>
            上卦 {profile.upperTrigram}（{profile.upperInfo?.nature}）· 下卦 {profile.lowerTrigram}（{profile.lowerInfo?.nature}）
          </div>
          <p className="mt-8" style={{ fontSize: 15 }}>{profile.plain}</p>
        </div>
      </div>

      {/* 学习导航（对接 mastery，不另造等级） */}
      <div className="archive-stage card mt-16">
        <div className="spread" style={{ alignItems: 'center' }}>
          <div>
            <span className="tiny muted">你现在的学习阶段</span>
            <div className="stage-line"><b>{stage.id} {stage.label}</b><span className="tiny muted"> · {stage.tip}</span></div>
          </div>
          <div className="stage-dots">
            {['L0', 'L1', 'L2', 'L3', 'L4', 'L5'].map((s) => {
              const cur = HEX_STAGE_ORDER.indexOf(s)
              const active = HEX_STAGE_ORDER.indexOf(stage.id)
              return <span key={s} className={`stage-dot ${cur <= active ? 'on' : ''}`} title={s} />
            })}
          </div>
        </div>
        {rec && (
          <div className="archive-rec mt-12">
            <div className="tiny" style={{ fontWeight: 700, color: 'var(--amber-deep)' }}>🧭 下一步建议</div>
            <div style={{ fontWeight: 700, marginTop: 4 }}>{rec.title}</div>
            <p className="tiny mt-4">{rec.body}</p>
            <p className="tiny muted mt-4">为什么：{rec.why}</p>
          </div>
        )}
      </div>

      {/* 深度进度（认识→…→独立分析，八阶段） */}
      <div className="card mt-12">
        <div className="spread" style={{ alignItems: 'center' }}>
          <span className="tiny muted">深度进度（基于真实学习证据，不只是「点过页面」）</span>
        </div>
        <div className="mt-12">
          <DepthBar stages={depth} />
        </div>
      </div>

      {/* 模式切换 */}
      <div className="mt-16">
        <Segmented
          items={[
            { value: 'beginner', label: '🌱 初学者' },
            { value: 'deep', label: '🔍 深入' },
            { value: 'research', label: '🧪 研究' },
          ]}
          value={mode}
          onChange={setMode}
        />
      </div>

      {mode === 'beginner' && <BeginnerView profile={profile} />}
      {mode === 'deep' && <DeepView profile={profile} detail={detail} params={params} />}
      {mode === 'research' && <ResearchView profile={profile} />}
    </div>
  )
}

// ── 初学者模式 ───────────────────────────────────────────
function BeginnerView({ profile }) {
  return (
    <div className="mt-16">
      <div className="card">
        <div className="archive-sub">这是什么？</div>
        <p style={{ fontSize: 15 }}>{profile.traditionalName}卦（第{profile.number}卦）。{profile.plain}</p>
      </div>
      <div className="card mt-12">
        <div className="archive-sub">为什么重要？</div>
        <p style={{ fontSize: 15 }}>六十四卦是一套「结构语言」，每一卦都是一块拼图。学它的重点不是背「吉凶」，而是练「时位 / 内外 / 阴阳」这种通用读法。</p>
      </div>
      <div className="card mt-12">
        <div className="archive-sub">先看哪里？</div>
        <div className="row mt-8" style={{ gap: 12 }}>
          <Glyph lines={profile.binaryPattern} size="md" />
          <div style={{ fontSize: 14 }}>
            <div>① 上下卦：上{profile.upperTrigram}（{profile.upperInfo?.nature}）＋ 下{profile.lowerTrigram}（{profile.lowerInfo?.nature}）</div>
            <div>② 六爻阴阳：{profile.binaryPattern}（自下而上，1=阳 0=阴）</div>
            <div>③ 再读卦辞，最后看每一爻。</div>
          </div>
        </div>
      </div>
      <div className="card mt-12">
        <div className="archive-sub">一个例子</div>
        <p className="display" style={{ fontSize: 18 }}>{profile.imagery}</p>
        <p className="tiny muted mt-8">这是〈大象传〉对这卦的一句话点题（一处「怎么读」的示范）。</p>
      </div>
      <div className="card mt-12">
        <div className="archive-sub">一个练习</div>
        <HexPractice profile={profile} />
      </div>
      <Remind icon="🔬">初学时别急着记结论，先把「上下卦 + 六爻阴阳」看清楚，再看卦辞。</Remind>
    </div>
  )
}

// ── 深入模式 ─────────────────────────────────────────────
function DeepView({ profile, detail, params }) {
  const deweiCount = profile.yao.filter((y) => y.dewei).length
  const autoOpenYao = params?.yao != null ? Number(params.yao) : -1

  return (
    <div className="mt-16">
      {/* ① 认识这卦 */}
      <div className="card">
        <SectionTitle n="①" t="认识这卦 · 基本结构" />
        <div className="row mt-8" style={{ gap: 16, flexWrap: 'wrap' }}>
          <Glyph lines={profile.binaryPattern} size="md" />
          <div style={{ flex: 1, minWidth: 220, fontSize: 14 }}>
            <div><b>卦符</b>（自下而上）：{profile.binaryPattern}</div>
            <div><b>上卦（外）</b>：{profile.upperTrigram} ☰ {profile.upperInfo?.nature} · {profile.upperInfo?.keyword}</div>
            <div><b>下卦（内）</b>：{profile.lowerTrigram} {profile.lowerInfo?.symbol} {profile.lowerInfo?.nature} · {profile.lowerInfo?.keyword}</div>
            <div><b>得位</b>：{deweiCount} / 6 爻当位（阳居初三五、阴居二四上）</div>
          </div>
        </div>
      </div>

      {/* ② 读卦辞 */}
      <div className="card mt-12">
        <SectionTitle n="②" t="读卦辞 · 原典 → 现代提示 → 我的理解" />
        <div className="layer-box classic">
          <div className="layer-tag">原典</div>
          <p className="display guaci-quote">{profile.guaci}</p>
          <p className="tiny muted">来源：通行本《周易》卦辞（公版文本）。</p>
        </div>
        <div className="layer-box plain">
          <div className="layer-tag">现代学习提示</div>
          <p style={{ fontSize: 14 }}>{profile.plain}</p>
          <p className="tiny muted mt-4">这是一层概括性白话提示，不是原文的唯一答案。</p>
        </div>
        <div className="layer-box mine">
          <div className="layer-tag">关键词</div>
          <p className="tiny muted">关键词与〈术语百科〉的对应将在后续阶段接入（当前暂不拆分，避免臆断）。</p>
        </div>
        <div className="layer-box mine">
          <div className="layer-tag">我的理解</div>
          <NoteField noteKey={hexMasteryKey(profile.number)} placeholder="我现在怎么理解这一卦？用自己的话写下来……" />
        </div>
      </div>

      {/* ③ 六爻 */}
      <div className="card mt-12">
        <SectionTitle n="③" t="六爻 · 384 爻，每条都可单独学" />
        <p className="tiny muted">自下而上：初、二、三、四、五、上。点开任意一爻，深挖它的位置、阴阳、结构与练习。</p>
        <div className="mt-12" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <YaoItem key={i} profile={profile} index={i} autoOpen={autoOpenYao === i} />
          ))}
        </div>
      </div>

      {/* ④ 看结构 */}
      <div className="card mt-12">
        <SectionTitle n="④" t="看结构 · 中正承乘比应" />
        <div className="struct-table mt-8">
          {[...profile.yao].map((y) => (
            <div key={y.id} className="struct-row">
              <div className="struct-name">{y.name}</div>
              <div className="struct-cell">{y.gangrou}</div>
              <div className="struct-cell">{y.dewei ? '当位' : '失位'}</div>
              <div className="struct-cell">{y.zhong ? '中' : ''}</div>
              <div className="struct-cell">{y.ying ? `应${y.ying.partnerLabel}（${y.ying.favorable ? '正' : '敌'}）` : ''}</div>
            </div>
          ))}
        </div>
        <p className="tiny muted mt-8">
          当位（阳居阳位/阴居阴位）、中（二五）、承（下承上）、乘（上乘下）、比（相邻）、应（初↔四、二↔五、三↔上）——全部由卦符确定性推导，属传统爻位规则，不构成唯一结论。
        </p>
      </div>

      {/* ⑤ 读《易传》 */}
      <div className="card mt-12">
        <SectionTitle n="⑤" t="读《易传》 · 引用十翼课程，不重复存" />
        <div className="tenwings-grid mt-8">
          <TenWingRow label="彖传" node="yz-tuan" text="暂无可靠整理" />
          <TenWingRow label="大象" node="yz-xiang" text={profile.imagery} real />
          <TenWingRow label="小象（六条）" node="yz-xiang" text="暂无可靠整理" />
          {profile.tenWings.wenyan && <TenWingRow label="文言" node="yz-wenyan" text="详见文言传课程" />}
          <TenWingRow label="系辞（相关）" node="yz-xici" text="暂无可靠整理" />
          <TenWingRow label="说卦（取象）" node="yz-shuogua" text="暂无可靠整理" />
          <TenWingRow label="序卦" node="yz-xugua" text="暂无可靠整理" />
          <TenWingRow label="杂卦" node="yz-zagua" text="暂无可靠整理" />
        </div>
      </div>

      {/* ⑥ 看不同传统 */}
      <div className="card mt-12">
        <SectionTitle n="⑥" t="看不同传统 · 同一文本，多条解释路径" />
        <div className="trad-compare mt-8">
          {TRADITION_REF.map((t) => (
            <div key={t.key} className="trad-block">
              <a href={`#${lessonLink(t.node)}`} className="trad-name">{t.label}</a>
              <p className="tiny mt-4">{t.note}</p>
              <p className="tiny muted mt-4">此卦该传统的具体解说「暂无可靠整理」。</p>
            </div>
          ))}
        </div>
        <div className="layer-box plain mt-12">
          <div className="layer-tag">为什么会不同？</div>
          <ul className="archive-ul">
            <li>① 解释对象不同（有的释卦辞，有的释爻，有的释整体的“理”）</li>
            <li>② 所依文本不同（经 / 传是否分读、是否取象数）</li>
            <li>③ 所用方法不同（象数 vs 义理 vs 先天数）</li>
            <li>④ 所处时代不同（面对的问题与需求不同）</li>
          </ul>
          <p className="tiny muted mt-8">「不同」不等于「对错」：比较它们的方法，比判定谁“正确”更有价值。</p>
        </div>
      </div>

      {/* ⑦ 案例（基于该卦真实「常见误解」的自判式分析） */}
      <div className="card mt-12">
        <SectionTitle n="⑦" t="案例 · 一个说法，你来判断" />
        <div className="layer-box plain">
          <div className="layer-tag">案例</div>
          <p style={{ fontSize: 14 }}>有人说：「{profile.myth}」</p>
          <p className="tiny muted mt-8">请先判断：这个说法的盲点在哪里？把它写下来，再展开参考答案。</p>
          <div className="mt-8">
            <NoteField noteKey={`${hexMasteryKey(profile.number)}-case`} placeholder="我的判断：这个说法的问题在于……" />
          </div>
        </div>
      </div>

      {/* ⑧ 易错 */}
      <div className="card mt-12" style={{ borderLeft: '4px solid var(--danger)' }}>
        <SectionTitle n="⑧" t="易错 · 常见误读与反例" />
        <div className="myth-box">
          <div className="tiny" style={{ fontWeight: 700, color: 'var(--danger)' }}>⚠ 常被这样说</div>
          <p className="mt-4" style={{ fontSize: 14 }}>{profile.myth}</p>
        </div>
        <p className="tiny muted mt-8">反例思路：看这卦的卦辞与大象是否支持“绝对化”结论——多数误读来自把一个「时位」读成了「判决」。</p>
      </div>

      {/* ⑨ 练习 */}
      <div className="card mt-12">
        <SectionTitle n="⑨" t="练习 · 判断 / 结构 / 比较" />
        <HexPractice profile={profile} />
      </div>

      {/* ⑩ 我的研究 */}
      <div className="card mt-12">
        <SectionTitle n="⑩" t="我的研究 · 笔记与理解" />
        <NoteField noteKey={`${hexMasteryKey(profile.number)}-study`} placeholder="对照原典与不同传统，写下你自己的判断……" />
      </div>
    </div>
  )
}

function SectionTitle({ n, t }) {
  return <div className="archive-sub" style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>{n} {t}</div>
}

function TenWingRow({ label, text, real, node }) {
  return (
    <div className="tenwing-row">
      <div className="tenwing-label">{label}</div>
      <div className="tenwing-text" style={{ fontFamily: real ? 'var(--font-display)' : 'inherit', color: real ? 'var(--text)' : 'var(--text-3)' }}>
        {text}
      </div>
      <a href={`#${lessonLink(node)}`} className="tenwing-go">去课程 →</a>
    </div>
  )
}

// ── 研究模式 ─────────────────────────────────────────────
function ResearchView({ profile }) {
  return (
    <div className="mt-16">
      <div className="card">
        <SectionTitle n="①" t="文本来源" />
        <ul className="archive-ul mt-8">
          <li>卦辞：通行本《周易》（公版文本）。</li>
          <li>大象：通行本《周易·象传》（公版文本），已核对。</li>
          <li>彖传 / 小象 / 六爻爻辞全文：本轮「暂无可靠整理」，不作伪造出处。</li>
        </ul>
      </div>
      <div className="card mt-12">
        <SectionTitle n="②" t="解释传统" />
        <p className="tiny mt-8">见「深入 · 看不同传统」；本模块不复制内容，统一引用〈历代易学〉课程。</p>
      </div>
      <div className="card mt-12">
        <SectionTitle n="③" t="相关章节" />
        <div className="row mt-8" style={{ gap: 8, flexWrap: 'wrap' }}>
          {['yz-tuan', 'yz-xiang', 'yz-xici', 'yz-wenyan', 'yz-shuogua', 'yz-xugua', 'yz-zagua'].map((nid) => {
            const nd = getCurriculumNode(nid)
            const l = lessonByNode[nid]
            if (!nd || !l) return null
            return <a key={nid} href={`#/lesson/${l.id}`} className="tag-link">{nd.title}</a>
          })}
        </div>
      </div>
      <div className="card mt-12">
        <SectionTitle n="④" t="相关卦（错 / 综 / 互）" />
        <div className="row mt-8" style={{ gap: 8, flexWrap: 'wrap' }}>
          {profile.relations.map((r) => (
            <a key={r.type} href={`#/hex/${r.target}`} className="tag-link">{r.type}：{getHexagramProfile(r.target)?.name}</a>
          ))}
        </div>
        <p className="tiny muted mt-8">不同易学传统对“错/综/互”的用法存在差异，这里仅作结构导航，不作唯一“科学关系”。</p>
      </div>
      <div className="card mt-12">
        <SectionTitle n="⑤" t="相关爻" />
        <div className="row mt-8" style={{ gap: 8, flexWrap: 'wrap' }}>
          {profile.yao.map((y) => (
            <a key={y.id} href={`#/hex/${profile.number}?yao=${y.position}`} className="tag-link">{y.name}</a>
          ))}
        </div>
      </div>
      <div className="card mt-12">
        <SectionTitle n="⑥" t="我的研究笔记" />
        <NoteField noteKey={`${hexMasteryKey(profile.number)}-study`} placeholder="对照原典与不同传统，形成你自己的判断……" />
      </div>
      <Remind icon="📐">研究不是「找出标准答案」，而是「建立在可核对文本上的、可解释的判断」。</Remind>
    </div>
  )
}

// ── 比较两卦 ─────────────────────────────────────────────
function CompareView({ a, b }) {
  const pa = getHexagramProfile(a)
  const pb = getHexagramProfile(b)
  if (!pa || !pb) return <div className="lesson-body"><p className="muted">未找到要比较的卦。</p></div>

  const rows = [
    ['卦名', pa.name + ' ' + pa.traditionalName, pb.name + ' ' + pb.traditionalName],
    ['卦序', `第 ${pa.number} 卦`, `第 ${pb.number} 卦`],
    ['卦象', pa.symbol, pb.symbol],
    ['上下卦', `上${pa.upperTrigram} 下${pa.lowerTrigram}`, `上${pb.upperTrigram} 下${pb.lowerTrigram}`],
    ['卦辞', pa.guaci, pb.guaci],
    ['大象', pa.imagery, pb.imagery],
    ['得位', `${pa.yao.filter((y) => y.dewei).length}/6`, `${pb.yao.filter((y) => y.dewei).length}/6`],
    ['错卦', getHexagramProfile(pa.relations.find((r) => r.type === '错卦').target)?.name, getHexagramProfile(pb.relations.find((r) => r.type === '错卦').target)?.name],
    ['综卦', getHexagramProfile(pa.relations.find((r) => r.type === '综卦').target)?.name, getHexagramProfile(pb.relations.find((r) => r.type === '综卦').target)?.name],
    ['核心提醒', pa.myth, pb.myth],
  ]

  return (
    <div className="lesson-body">
      <div className="row spread" style={{ alignItems: 'center' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/hex/${pa.number}`)}>← 返回</button>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/hex')}>64卦档案</button>
      </div>
      <PageHead title={`比较：${pa.name} vs ${pb.name}`} sub="结构化对照，最后一个问题留给你自己。" />

      <div className="compare-table card">
        <div className="compare-row compare-head">
          <div className="compare-dim"></div>
          <div className="compare-cell"><Glyph lines={pa.binaryPattern} size="sm" />{pa.name}</div>
          <div className="compare-cell"><Glyph lines={pb.binaryPattern} size="sm" />{pb.name}</div>
        </div>
        {rows.map(([dim, ca, cb], i) => (
          <div key={i} className="compare-row">
            <div className="compare-dim">{dim}</div>
            <div className="compare-cell">{ca}</div>
            <div className="compare-cell">{cb}</div>
          </div>
        ))}
      </div>

      <div className="card mt-16">
        <div className="archive-sub">你说说看</div>
        <p className="mt-8" style={{ fontSize: 15 }}>你认为这两个卦<b>最关键的差异</b>在哪里？不要急着看总结，先自己写。</p>
        <div className="mt-8">
          <NoteField noteKey={`compare-${pa.number}-${pb.number}`} placeholder={`${pa.name} 与 ${pb.name} 最关键的差异是……`} />
        </div>
      </div>

      <Remind icon="⚖️">比较的意义在「发现差异背后的结构逻辑」，而不是给两卦排高低。</Remind>
    </div>
  )
}

// ── 随机经典（读一段《易传》，不抽签算命）────────────────────
function ClassicPassageView({ passageId }) {
  const { dispatch } = useApp()
  const [passage, setPassage] = useState(() => getClassicPassage(passageId) || randomClassicPassage())

  useEffect(() => {
    if (passage?.id) {
      const key = `cp-${passage.id}`
      dispatch({ type: 'RECORD_HEX_EVIDENCE', key, kind: 'read' })
      dispatch({ type: 'RECORD_HEX_EVIDENCE', key, kind: 'original' })
    }
    // 仅在切换片段时记录阅读痕迹
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passage?.id])

  if (!passage) return <div className="lesson-body"><p className="muted">这段经典暂时无法读取。</p></div>

  const relateHex = passage.relatedHexagrams || []
  const relateYao = passage.relatedYaos || []
  const terms = passage.relatedTerms || []

  return (
    <div className="lesson-body">
      <div className="row spread" style={{ alignItems: 'center' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/hex')}>← 64卦档案</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setPassage(randomClassicPassage())}>🎲 换一段</button>
      </div>

      <PageHead
        title="📜 随机经典"
        sub="读一段〈易传〉：先自己想一想，再看现代提示，最后连回相关卦与术语。"
      />

      <div className="card">
        <div className="layer-box classic">
          <div className="layer-tag">原典 · {passage.source} · {passage.chapter}</div>
          <p className="display" style={{ fontSize: 18 }}>{passage.text}</p>
          <p className="tiny muted mt-8">来源：{passage.sourceInfo?.edition || '通行本整理'}（{passage.sourceInfo?.confidence === 'verified' ? '已核对' : '通行本公版文本'}）</p>
        </div>
      </div>

      <div className="card mt-12">
        <div className="archive-sub">先自己想，再看现代提示</div>
        <div className="mt-8">
          <ThinkFirst
            prompt="你觉得这一段在说什么？它和哪一卦、哪一爻、哪一个道理相关？"
            revealText={`现代提示（非原典，仅供参考）：${passage.modernNote || '暂无现代提示。'}`}
            onReveal={() => dispatch({ type: 'RECORD_HEX_EVIDENCE', key: `cp-${passage.id}`, kind: 'analyze' })}
          />
        </div>
      </div>

      {(relateHex.length > 0 || relateYao.length > 0 || terms.length > 0) && (
        <div className="card mt-12">
          <div className="archive-sub">关联（跳回卦 / 爻继续学）</div>
          {relateHex.length > 0 && (
            <div className="mt-8">
              <div className="tiny muted">相关卦：</div>
              <div className="row mt-4" style={{ gap: 8, flexWrap: 'wrap' }}>
                {relateHex.map((s) => (
                  <a key={s} href={`#/hex/${s}`} className="tag-link">{hexName(s)}</a>
                ))}
              </div>
            </div>
          )}
          {relateYao.length > 0 && (
            <div className="mt-8">
              <div className="tiny muted">相关爻：</div>
              <div className="row mt-4" style={{ gap: 8, flexWrap: 'wrap' }}>
                {relateYao.map((vid) => {
                  const parts = String(vid).split('-') // hx-{seq}-{index}
                  const seq = Number(parts[1])
                  const index = Number(parts[2])
                  const yao = getHexagramProfile(seq)?.yao?.[index]
                  return <a key={vid} href={`#/hex/${seq}?yao=${index}`} className="tag-link">第{seq}卦 · {yao?.name || '爻'}</a>
                })}
              </div>
            </div>
          )}
          {terms.length > 0 && (
            <div className="mt-8">
              <div className="tiny muted">相关术语：</div>
              <div className="row mt-4" style={{ gap: 8, flexWrap: 'wrap' }}>
                {terms.map((t) => <span key={t} className="pill pill-gray">{t}</span>)}
              </div>
            </div>
          )}
        </div>
      )}

      <Remind icon="📖">这是「随机读一段经典」，不是「随机抽一根签」。把它和正在学的卦/爻对上，才是目的。</Remind>
    </div>
  )
}

// ── 索引（浏览 64 卦）────────────────────────────────────
function HexIndex() {
  const { state } = useApp()
  const [filter, setFilter] = useState('')
  const list = HEXAGRAM_PROFILES.filter((p) => !filter || p.name.includes(filter) || p.traditionalName.includes(filter))

  function randomDive() {
    const kind = Math.floor(Math.random() * 4)
    const r1 = 1 + Math.floor(Math.random() * 64)
    if (kind === 0) navigate(`/hex/${r1}`)
    else if (kind === 1) navigate(`/hex/${r1}?yao=${Math.floor(Math.random() * 6)}`)
    else if (kind === 2) {
      let r2 = 1 + Math.floor(Math.random() * 64)
      if (r2 === r1) r2 = (r2 % 64) + 1
      navigate(`/hex/${r1}?compare=${r2}`)
    } else {
      // 随机经典：读一段〈系辞〉〈文言〉〈大象〉，不是抽签算命
      navigate(`/hex?classic=${randomClassicPassage().id}`)
    }
  }

  return (
    <div className="lesson-body">
      <PageHead
        title="📚 64卦深度档案"
        sub={`每一卦都不是一张卡片，而是一个可钻研的对象：结构 → 卦辞 → 六爻 → 十翼 → 爻位 → 传统 → 案例 → 练习 → 我的理解。`}
        right={<button className="btn btn-primary" onClick={randomDive}>🎲 随机深挖</button>}
      />

      <div className="hex-filter">
        <input className="search-input" placeholder="搜索卦名 / 全称……" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>

      <div className="hex-index-grid">
        {list.map((p) => {
          const stage = hexStage(state, p.number)
          const touched = hexMastery(state, p.number) > 0 || p.yao.some((y) => (state.mastery || {})[y.id] > 0)
          return (
            <button key={p.number} className="hex-index-card" onClick={() => navigate(`/hex/${p.number}`)}>
              <div className="hx-card-top">
                <Glyph lines={p.binaryPattern} size="sm" />
                <div className="hx-seq">{p.number}</div>
              </div>
              <div className="hx-name">{p.name}</div>
              <div className="tiny muted">上{p.upperTrigram} 下{p.lowerTrigram}</div>
              {touched && <div className="hx-stage tiny">{stage.id} {stage.label}</div>}
            </button>
          )
        })}
      </div>

      <Remind icon="🗂️">「随机深挖」是随机选一个学习切口（一卦 / 一爻 / 一组比较 / 一段经典），不是随机算命。</Remind>
    </div>
  )
}

// ── 顶层入口 ─────────────────────────────────────────────
export default function HexArchivePage({ id, params }) {
  if (id === 'compare') return <CompareView a={params?.a} b={params?.b} />
  if (params?.classic) return <ClassicPassageView passageId={params.classic} />
  const profile = id ? getHexagramProfile(id) : null
  if (profile) {
    if (params?.compare) return <CompareView a={profile.number} b={params.compare} />
    return <HexDetail profile={profile} params={params} />
  }
  return <HexIndex />
}