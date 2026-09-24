// ============================================================
// 🎮 易经工坊（Phase 4 · Step 7）
// 四个互动学习工具：卦象实验室 / 八卦闪卡 / 卦象侦探 / 古文破译室
// 全部使用本地确定性引擎（playEngine），无任何外部调用。
// 每次作答通过 RECORD_QUIZ 写入掌握度系统（nodeId 见 playEngine）。
// ============================================================
import React, { useState } from 'react'
import { useApp } from '../store/AppContext'
import { PageHead, Remind, Segmented } from '../components/ui'
import { getHexagram, linesToSymbol, trigramName, hexagramRelations, changeLine, LINE_POSITIONS, lineLabel } from '../data/iching/hexagramTools'
import { BAGUA } from '../data/iching/hexagrams-data'
import { flashcardRound, FLASH_MODES, detectiveRound, DETECTIVE_KINDS, decoderRound, evaluateDecoder } from '../data/iching/playEngine'

// ── 爻线渲染 ──────────────────────────────────────────────
function Yao({ yang, moving, onClick, dim }) {
  return (
    <button
      className={`yao ${yang ? 'yao-yang' : 'yao-yin'} ${moving ? 'yao-moving' : ''} ${dim ? 'yao-dim' : ''}`}
      onClick={onClick}
      aria-label={yang ? '阳爻' : '阴爻'}
    >
      <span className="yao-bar" />
    </button>
  )
}

// 卦画（六爻，自下而上显示；lines 为自下而上的 01 串）
function HexGraph({ lines, movingSet = [], onClickLine, dimSet = [] }) {
  const arr = lines.split('')
  // 显示顺序：上爻在上 → 从 index 5 到 0
  const order = [5, 4, 3, 2, 1, 0]
  return (
    <div className="hex-graph">
      {order.map((i) => (
        <Yao
          key={i}
          yang={arr[i] === '1'}
          moving={movingSet.includes(i)}
          dim={dimSet.includes(i)}
          onClick={onClickLine ? () => onClickLine(i) : undefined}
        />
      ))}
      <div className="hex-axis" />
    </div>
  )
}

// 八卦卦画（三爻）
function TriGraph({ lines }) {
  const arr = lines.split('')
  return (
    <div className="hex-graph tri-graph">
      {[2, 1, 0].map((i) => (
        <Yao key={i} yang={arr[i] === '1'} />
      ))}
      <div className="hex-axis" />
    </div>
  )
}

// ============================================================
// ① 卦象实验室
// ============================================================
const LAB_PRESETS = [
  { label: '乾', lines: '111111' },
  { label: '坤', lines: '000000' },
  { label: '泰', lines: '111000' },
  { label: '否', lines: '000111' },
  { label: '既济', lines: '101010' },
  { label: '未济', lines: '010101' },
  { label: '屯', lines: '100010' },
  { label: '蒙', lines: '010001' },
]

function HexLab() {
  const [lines, setLines] = useState('111000') // 泰
  const [moving, setMoving] = useState(null) // 动爻 index（0-5）

  const hex = getHexagram(lines)
  const lower = lines.slice(0, 3)
  const upper = lines.slice(3, 6)
  const lowerName = trigramName(lower)
  const upperName = trigramName(upper)
  const rel = hexagramRelations(hex)
  const changed = moving !== null ? getHexagram(changeLine(lines, moving)) : null

  function toggle(i) {
    const arr = lines.split('')
    arr[i] = arr[i] === '1' ? '0' : '1'
    setLines(arr.join(''))
    setMoving(null)
  }

  return (
    <div>
      <div className="lab-layout">
        <div className="lab-stage">
          <div className="lab-stage-head">
            <h3 style={{ fontSize: 16 }}>六爻拼装</h3>
            <span className="tiny muted">点击每一爻切换 阳/阴，再点下方某爻设为「动爻」看变卦</span>
          </div>
          <div className="lab-hex-wrap">
            <HexGraph lines={lines} movingSet={moving !== null ? [moving] : []} onClickLine={toggle} />
            <div className="lab-lines-label">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="tiny muted">
                  {lineLabel(i, lines[i] === '1')}
                  {moving === i ? ' · 动' : ''}
                </div>
              ))}
            </div>
          </div>
          <div className="preset-row">
            {LAB_PRESETS.map((p) => (
              <button key={p.label} className="btn btn-sm btn-soft" onClick={() => { setLines(p.lines); setMoving(null) }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="lab-result">
          <div className="spread">
            <h3 style={{ fontSize: 16 }}>结果</h3>
            {hex && <span className="pill pill-amber">第 {hex.seq} 卦</span>}
          </div>
          {hex && (
            <>
              <div className="result-hex-name">
                <span className="result-symbol">{linesToSymbol(hex.lines)}</span>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>{hex.full}</div>
                  <div className="tiny muted">
                    上{hex.upper}（{upperName}·{BAGUA[upperName]?.nature}）＋ 下{hex.lower}（{lowerName}·{BAGUA[lowerName]?.nature}）
                  </div>
                </div>
              </div>
              <p className="muted mt-8" style={{ fontSize: 14 }}>{hex.plain}</p>
              <div className="relation-row mt-12">
                <div className="relation-item">
                  <div className="tiny muted">错卦（阴阳全换）</div>
                  <div className="relation-name">{rel.opposite?.full || '—'}</div>
                </div>
                <div className="relation-item">
                  <div className="tiny muted">综卦（上下颠倒）</div>
                  <div className="relation-name">{rel.reverse?.full || '—'}</div>
                </div>
                <div className="relation-item">
                  <div className="tiny muted">互卦（卦中藏卦）</div>
                  <div className="relation-name">{rel.mutual?.full || '—'}</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {changed && (
        <div className="card mt-16" style={{ borderColor: 'var(--indigo)', borderLeft: '4px solid var(--indigo)' }}>
          <div className="spread">
            <h3 style={{ fontSize: 15 }}>
              {lineLabel(moving, lines[moving] === '1')} 动 → 变卦
            </h3>
            <span className="tiny muted">本卦 {hex?.full} → 变卦 {changed.full}</span>
          </div>
          <div className="change-preview mt-12">
            <div>
              <div className="tiny muted">本卦</div>
              <HexGraph lines={lines} dimSet={[moving]} />
              <div style={{ fontWeight: 700, marginTop: 6 }}>{hex?.full}</div>
            </div>
            <div className="change-arrow">→</div>
            <div>
              <div className="tiny muted">变卦</div>
              <HexGraph lines={changed.lines} movingSet={[moving]} />
              <div style={{ fontWeight: 700, marginTop: 6 }}>{changed.full}</div>
            </div>
          </div>
          <p className="tiny muted mt-8">
            动爻是「变化的起点」：本卦看当下结构，变卦看这个变化指向的新结构。一个爻变了，整个卦的意义就跟着改变。
          </p>
        </div>
      )}
    </div>
  )
}

// ============================================================
// ② 八卦闪卡
// ============================================================
const FLASH_ROUNDS = 8

function FlashCards() {
  const { dispatch } = useApp()
  const [mode, setMode] = useState('symbol-name')
  const [round, setRound] = useState(0)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [best, setBest] = useState(0)
  const [picked, setPicked] = useState(null)
  const [done, setDone] = useState(false)

  // 当前题（每次 round/mode 变化时重新生成）
  const [q, setQ] = useState(() => flashcardRound('symbol-name'))

  function nextRound(m) {
    const mm = m ?? mode
    setQ(flashcardRound(mm))
    setPicked(null)
    if (round + 1 >= FLASH_ROUNDS) {
      setDone(true)
    } else {
      setRound(round + 1)
    }
  }

  function pick(opt) {
    if (picked) return
    setPicked(opt)
    const correct = opt === q.answer
    dispatch({
      type: 'RECORD_QUIZ',
      item: { nodeId: q.nodeId, correct, stepType: 'choice', storeContext: `闪卡·${FLASH_MODES.find((f) => f.value === mode)?.label}` },
    })
    if (correct) {
      const ns = streak + 1
      setStreak(ns)
      setBest((b) => Math.max(b, ns))
      setScore(score + 1)
    } else {
      setStreak(0)
    }
  }

  function restart(m) {
    const mm = m ?? mode
    setMode(mm)
    setRound(0)
    setScore(0)
    setStreak(0)
    setPicked(null)
    setDone(false)
    setQ(flashcardRound(mm))
  }

  function changeMode(m) {
    setMode(m)
    restart(m)
  }

  if (done) {
    return (
      <div className="game-card">
        <div className="center" style={{ padding: '18px 0' }}>
          <div style={{ fontSize: 40 }}>🏁</div>
          <h3 style={{ fontSize: 20, marginTop: 8 }}>本轮完成</h3>
          <p className="muted mt-8">答对 {score}/{FLASH_ROUNDS} · 最长连胜 {best}</p>
          {score === FLASH_ROUNDS ? (
            <p className="tiny mt-8" style={{ color: 'var(--teal-deep)' }}>全对！这部分你已经很熟了。</p>
          ) : score >= FLASH_ROUNDS * 0.75 ? (
            <p className="tiny mt-8" style={{ color: 'var(--amber-deep)' }}>不错，再巩固一下记忆。</p>
          ) : (
            <p className="tiny muted mt-8">别急，先回课堂把八卦结构再看一遍，再回来挑战。</p>
          )}
        </div>
        <button className="btn btn-primary btn-block" onClick={() => restart()}>再来一轮</button>
      </div>
    )
  }

  return (
    <div>
      <div className="game-toolbar">
        <Segmented items={FLASH_MODES.map((f) => ({ value: f.value, label: f.label }))} value={mode} onChange={changeMode} />
        <span className="pill pill-gray">{round + 1}/{FLASH_ROUNDS}</span>
      </div>
      <p className="tiny muted mt-8">{FLASH_MODES.find((f) => f.value === mode)?.desc}</p>

      <div className="game-card mt-12">
        <div className="flash-prompt">
          <div style={{ fontSize: 46, fontWeight: 800, letterSpacing: 4 }}>{q.prompt}</div>
          <div className="tiny muted mt-8">{q.hint}</div>
        </div>

        <div className="option-grid mt-16">
          {q.options.map((opt) => {
            let cls = 'option'
            if (picked) {
              if (opt === q.answer) cls += ' correct'
              else if (opt === picked) cls += ' wrong'
            }
            return (
              <button key={opt} className={cls} onClick={() => pick(opt)} disabled={!!picked}>
                <span className="option-text">{opt}</span>
              </button>
            )
          })}
        </div>

        {picked && (
          <div className={`feedback ${picked === q.answer ? 'good' : 'warn'} mt-16`}>
            <h4>{picked === q.answer ? `✓ 正确 · 连胜 ${streak}` : '✗ 再看看'}</h4>
            <p className="tiny mt-8">{q.explain}</p>
            <div className="row mt-12" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-primary btn-sm" onClick={() => nextRound()}>{round + 1 >= FLASH_ROUNDS ? '看结果' : '下一张 →'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// ③ 卦象侦探
// ============================================================
function HexDetective() {
  const { dispatch } = useApp()
  const [kind, setKind] = useState('opposite')
  const [round, setRound] = useState(0)
  const [score, setScore] = useState(0)
  const [picked, setPicked] = useState(null)
  const [q, setQ] = useState(() => detectiveRound('opposite'))
  const TOTAL = 5

  function start(k) {
    const qq = detectiveRound(k)
    if (!qq) return
    setKind(k)
    setQ(qq)
    setPicked(null)
    setRound(0)
    setScore(0)
  }

  function pick(opt) {
    if (picked) return
    setPicked(opt)
    const correct = opt === q.answer
    dispatch({
      type: 'RECORD_QUIZ',
      item: { nodeId: 'hc-detective', correct, stepType: 'choice', storeContext: `侦探·${DETECTIVE_KINDS.find((d) => d.value === kind)?.label}` },
    })
    if (correct) setScore(score + 1)
  }

  function next() {
    if (round + 1 >= TOTAL) {
      // 本轮结束 → 展示结果
      setPicked('__done__')
      return
    }
    const qq = detectiveRound(kind)
    if (!qq) return
    setQ(qq)
    setPicked(null)
    setRound(round + 1)
  }

  if (picked === '__done__') {
    return (
      <div className="game-card">
        <div className="center" style={{ padding: '18px 0' }}>
          <div style={{ fontSize: 40 }}>🕵️</div>
          <h3 style={{ fontSize: 20, marginTop: 8 }}>侦破完成</h3>
          <p className="muted mt-8">{DETECTIVE_KINDS.find((d) => d.value === kind)?.label} · 答对 {score}/{TOTAL}</p>
          {score === TOTAL ? (
            <p className="tiny mt-8" style={{ color: 'var(--teal-deep)' }}>眼力很准！结构关系你已经拿下了。</p>
          ) : (
            <p className="tiny muted mt-8">再看一遍「错/综/互」的算法，观察每一爻的位置变化，再试一次。</p>
          )}
        </div>
        <button className="btn btn-primary btn-block" onClick={() => start(kind)}>再侦破一轮</button>
      </div>
    )
  }

  return (
    <div>
      <div className="game-toolbar">
        <Segmented items={DETECTIVE_KINDS.map((d) => ({ value: d.value, label: `${d.label}（${d.hint}）` }))} value={kind} onChange={start} />
        <span className="pill pill-gray">{round + 1}/{TOTAL}</span>
      </div>

      <div className="game-card mt-12">
        <div className="spread">
          <h3 style={{ fontSize: 15 }}>
            找出「{DETECTIVE_KINDS.find((d) => d.value === kind)?.label}」
          </h3>
          <span className="tiny muted">目标：{q.target.full}</span>
        </div>

        <div className="detective-target mt-12">
          <div className="detective-symbol" style={{ fontSize: 44, letterSpacing: 2 }}>{q.target.symbol}</div>
          <div className="tiny muted mt-4">{q.target.full} · {q.target.lines}（自下而上）</div>
        </div>

        <div className="option-grid mt-16">
          {q.options.map((opt) => {
            let cls = 'option'
            if (picked && picked !== '__done__') {
              if (opt === q.answer) cls += ' correct'
              else if (opt === picked) cls += ' wrong'
            }
            return (
              <button key={opt} className={cls} onClick={() => pick(opt)} disabled={!!picked}>
                <span className="option-text">{opt}</span>
              </button>
            )
          })}
        </div>

        {picked && picked !== '__done__' && (
          <div className={`feedback ${picked === q.answer ? 'good' : 'warn'} mt-16`}>
            <h4>{picked === q.answer ? '✓ 找到了！' : `✗ 答案是 ${q.answer}`}</h4>
            <p className="tiny mt-8">{q.why}</p>
            <div className="row mt-12" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-primary btn-sm" onClick={next}>{round + 1 >= TOTAL ? '看结果' : '下一个现场 →'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// ④ 古文破译室
// ============================================================
function GuWenDecoder() {
  const { dispatch } = useApp()
  const [q, setQ] = useState(() => decoderRound())
  const [selected, setSelected] = useState([])
  const [meaning, setMeaning] = useState(null)
  const [ownWords, setOwnWords] = useState('')
  const [result, setResult] = useState(null)
  const [step, setStep] = useState('keywords') // keywords → meaning → done

  function toggleToken(t) {
    setSelected((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]))
  }

  function submitKeywords() {
    if (!selected.length) return
    setStep('meaning')
  }

  function submitMeaning() {
    if (!meaning) return
    const ev = evaluateDecoder(q, selected, meaning, ownWords)
    setResult(ev)
    setStep('done')
    dispatch({
      type: 'RECORD_QUIZ',
      item: { nodeId: q.nodeId, correct: ev.quality >= 70, stepType: 'choice', storeContext: '古文破译室' },
    })
  }

  function restart() {
    setQ(decoderRound())
    setSelected([])
    setMeaning(null)
    setOwnWords('')
    setResult(null)
    setStep('keywords')
  }

  const meaningOptions = [q.meaning, ...q.wrongMeanings]

  return (
    <div className="game-card">
      <div className="spread">
        <h3 style={{ fontSize: 15 }}>📜 {q.name}卦 · 卦辞破译</h3>
        {step === 'done' && <span className="pill pill-teal">完成</span>}
      </div>

      <div className="guwen-text mt-12">{q.guaci}</div>
      <p className="tiny muted mt-8">来源：通行本《周易》卦辞（公版文本）。</p>

      {step === 'keywords' && (
        <>
          <p className="mt-16" style={{ fontSize: 15 }}>① 你认为哪些词是理解这段话的「核心关键词」？</p>
          <div className="token-row mt-12">
            {q.tokens.map((t) => (
              <button
                key={t}
                className={`token-chip ${selected.includes(t) ? 'token-on' : ''}`}
                onClick={() => toggleToken(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <button className="btn btn-primary btn-block mt-16" disabled={!selected.length} onClick={submitKeywords}>
            选好了，继续 →
          </button>
        </>
      )}

      {step === 'meaning' && (
        <>
          <p className="mt-16" style={{ fontSize: 15 }}>② 哪一句最接近这卦辞的意思？</p>
          <div className="mt-12">
            {meaningOptions.map((m, i) => (
              <button key={i} className={`option ${meaning === m ? 'correct' : ''}`} onClick={() => setMeaning(m)}>
                <span className="option-text" style={{ fontSize: 14 }}>{m}</span>
              </button>
            ))}
          </div>
          <div className="field mt-12">
            <label className="tiny muted">（可选）用自己的话说一遍：</label>
            <textarea rows={2} value={ownWords} onChange={(e) => setOwnWords(e.target.value)} placeholder="如果你要把这句话讲给一个完全不懂易经的人……" />
          </div>
          <button className="btn btn-primary btn-block mt-16" disabled={!meaning} onClick={submitMeaning}>
            提交我的破译
          </button>
        </>
      )}

      {step === 'done' && result && (
        <div className="mt-16">
          <div className="decoder-result">
            <div className="result-cell">
              <div className="tiny muted">关键词命中</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{result.keyScore}</div>
            </div>
            <div className="result-cell">
              <div className="tiny muted">白话解释</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{result.meaningScore}</div>
            </div>
            <div className="result-cell">
              <div className="tiny muted">综合质量</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{result.quality}</div>
            </div>
          </div>

          <div className={`feedback ${result.quality >= 70 ? 'good' : 'warn'} mt-16`}>
            <h4>{result.note}</h4>
            {result.overWords.length > 0 && (
              <p className="tiny mt-8" style={{ color: 'var(--danger)' }}>
                检测到绝对化表达：{result.overWords.join('、')}。卦辞给的是视角与条件，不是判决。
              </p>
            )}
          </div>

          <div className="card mt-16" style={{ background: 'var(--bg-warm)' }}>
            <h4 style={{ fontSize: 15 }}>📖 传统解释（参考）</h4>
            <p className="mt-8" style={{ fontSize: 14 }}>{q.meaning}</p>
            <p className="tiny muted mt-12">💡 {q.multiNote}</p>
          </div>

          <button className="btn btn-primary btn-block mt-16" onClick={restart}>破译下一卦 →</button>
        </div>
      )}
    </div>
  )
}

// ============================================================
// 工坊主页
// ============================================================
const TOOLS = [
  { value: 'lab', label: '🧩 卦象实验室', desc: '亲手拼装六爻，观察结构、变化与关系' },
  { value: 'flash', label: '🃏 八卦闪卡', desc: '快速记忆：卦符、卦名、自然象、上下卦' },
  { value: 'detective', label: '🔎 卦象侦探', desc: '找出错卦、综卦、互卦，训练结构眼力' },
  { value: 'decode', label: '📜 古文破译室', desc: '拆解卦辞关键词，比较不同解释' },
]

export default function IChingPlayPage() {
  const [tool, setTool] = useState('lab')
  const active = TOOLS.find((t) => t.value === tool)

  return (
    <div className="lesson-body">
      <PageHead title="🎮 易经工坊" sub="玩中学：每个游戏都来自课程中的真实知识点，做完自动计入掌握度。" />

      <div className="tool-tabs">
        {TOOLS.map((t) => (
          <button key={t.value} className={`tool-tab ${tool === t.value ? 'active' : ''}`} onClick={() => setTool(t.value)}>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div className="tool-desc tiny muted" style={{ margin: '10px 2px 0' }}>{active.desc}</div>

      <div className="mt-16">
        {tool === 'lab' && <HexLab />}
        {tool === 'flash' && <FlashCards />}
        {tool === 'detective' && <HexDetective />}
        {tool === 'decode' && <GuWenDecoder />}
      </div>

      <Remind icon="🎯">游戏只负责让你「想练」：真正留在你脑子里的，是每个结构算法、每句卦辞背后的为什么。</Remind>
    </div>
  )
}
