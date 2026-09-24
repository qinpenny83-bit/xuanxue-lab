// ============================================================
// 🔖 易学术语知识百科（R2-2）· 知识连接层 UI
//
// 定位：不是「搜索词典」，而是「从一个词进入整套易经知识网络」。
//   /terms            术语百科首页（搜索 / 精选 / 分类 / 辨析室入口）
//   /terms/:id        术语页（四层解释 + 反向关联 + 小白/深入双模式）
//   /terms/map        术语地图（八层二维关系图）
//   /terms/discern    易学辨析室（先判断 → 看定义 → 原典 → 例子 → 反例 → 传统 → 再回答）
//
// 原则：
//   结构型术语（中/正/得位…）的相关卦/爻全部来自规则引擎 analyzeYao，不手写。
//   一切跳转复用现有页面：/hex /lesson /case；掌握度复用 term-{id}（0–6）。
//   原典只显示已核对片段；不确定传承采保守说法；现代类比标注「非原典」。
// ============================================================
import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useApp } from '../store/AppContext'
import { navigate } from '../lib/router'
import { PageHead, Remind, Segmented, Pill } from '../components/ui'
import {
  ALL_TERMS,
  TERM_CATEGORIES,
  TERM_CATEGORY_BY_ID,
  TERM_COUNT,
  TERM_COUNT_BY_CATEGORY,
  getTerm,
  searchTerms,
  termsByCategory,
} from '../data/iching/termData'
import {
  termNetwork,
  termRelations,
  FEATURED_TERM_IDS,
} from '../data/iching/termGraph'
import {
  DISCERNMENT_GROUPS,
  discernmentsForTerm,
  getDiscernment,
  DISCERNMENT_COUNT,
} from '../data/iching/termDiscern'
import {
  termMastery,
  termMasteryKey,
  termStage,
  termEvidence,
  termRecommendation,
  contrastRecommendation,
  termDefinitionQuestion,
  TERM_EVIDENCE_DIMS,
} from '../data/iching/termMastery'
import { TRADITION_REF, getHexagramProfile } from '../data/iching/hexagramProfile'
import { getClassicPassage } from '../data/iching/classic-passages'
import { V3_LESSONS } from '../data/lessons'

// ── 工具 ──────────────────────────────────────────────
const lessonByNode = {}
for (const l of V3_LESSONS) if (l.nodeId && !lessonByNode[l.nodeId]) lessonByNode[l.nodeId] = l

function lessonLink(nodeId) {
  const l = lessonByNode[nodeId]
  return l ? `/lesson/${l.id}` : '/map'
}

// 爻 id 形如 `hx-1-0`（卦序-卦-位置下标），跳转用
function yaoIndex(yaoId) {
  const parts = String(yaoId).split('-')
  return Number(parts[parts.length - 1] || 0)
}

// 确定性打散选项（答对项固定在 0，展示时轮转以避免「总是 A」）
function rotateOptions(options, salt) {
  if (!options || options.length < 2) return { options: options || [], answer: 0 }
  let h = 0
  for (const ch of salt) h = (h * 31 + ch.charCodeAt(0)) | 0
  const shift = Math.abs(h) % options.length
  const rotated = options.slice(shift).concat(options.slice(0, shift))
  return { options: rotated, answer: (options.length - shift) % options.length }
}

function sourcePill(term) {
  if (term.sourceInfo?.confidence === 'needs_review') {
    return <Pill tone="gray">传承待核</Pill>
  }
  return <Pill tone="teal">通行通识</Pill>
}

// ── 可读的面包屑返回 ──────────────────────────────────────
function BackRow({ to, label }) {
  return (
    <button className="btn btn-ghost btn-sm" onClick={() => navigate(to)}>
      ← {label}
    </button>
  )
}

// ============================================================
// 路由分发
// ============================================================
export default function TermsPage({ id, params }) {
  if (id === 'map') return <TermMap />
  if (id === 'discern') return <DiscernRoom groupId={params?.group} />
  if (id) {
    const term = getTerm(id)
    if (!term) return <TermsHome notFound={id} />
    return <TermDetail termId={term.id} />
  }
  return <TermsHome />
}

// ============================================================
// 术语百科首页
// ============================================================
function TermsHome({ notFound }) {
  const { state } = useApp()
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState(null)
  const results = useMemo(() => (query.trim() ? searchTerms(query.trim()) : null), [query])
  const rec = useMemo(() => contrastRecommendation(state), [state])
  const learning = useMemo(
    () =>
      ALL_TERMS.filter((t) => (state.mastery?.[termMasteryKey(t.id)] || 0) > 0)
        .sort((a, b) => (state.mastery?.[termMasteryKey(b.id)] || 0) - (state.mastery?.[termMasteryKey(a.id)] || 0))
        .slice(0, 6),
    [state.mastery]
  )
  const confused = useMemo(() => {
    const wrong = (state.contrastHistory || []).filter((c) => !c.correct)
    return wrong.slice(-3).reverse()
  }, [state.contrastHistory])

  return (
    <div>
      <PageHead
        title="易学知识百科"
        sub={`从一个词进入整套知识网络 · ${TERM_COUNT} 个术语 · ${TERM_CATEGORIES.length} 个层级 · ${DISCERNMENT_COUNT} 组辨析`}
      />

      {notFound ? (
        <div className="feedback warn">
          <h4>没找到「{notFound}」</h4>
          <p className="tiny mt-8">试试搜索，或从下面的分类进入。</p>
        </div>
      ) : null}

      {/* 搜索 */}
      <div className="term-search-wrap">
        <span className="term-search-ico">⌕</span>
        <input
          className="term-search"
          placeholder="今天想弄懂什么？搜索：中正 / zhongzheng / 王弼 / 卦辞…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* 搜索结果 */}
      {results !== null ? (
        <div className="mt-16">
          <div className="tiny muted" style={{ marginBottom: 10 }}>
            找到 {results.length} 个术语
          </div>
          {results.length === 0 ? (
            <EmptyHit onClear={() => setQuery('')} />
          ) : (
            <TermGrid terms={results.slice(0, 30)} />
          )}
        </div>
      ) : (
        <>
          {/* 易学辨析室入口 */}
          {rec ? (
            <div className="mt-16 discern-hero" onClick={() => navigate(`/terms/discern?group=${rec.groupId}`)}>
              <div className="row" style={{ gap: 14 }}>
                <div className="discern-badge">易学辨析室</div>
                <div style={{ flex: 1 }}>
                  <div className="tiny muted">今天辨析</div>
                  <div className="discern-hero-title">{rec.title}</div>
                  <p className="tiny" style={{ color: 'var(--text-2)', marginTop: 4 }}>{rec.body}</p>
                </div>
                <span className="discern-go">→</span>
              </div>
            </div>
          ) : (
            <div className="mt-16 discern-hero" onClick={() => navigate('/terms/discern')}> 
              <div className="row" style={{ gap: 14 }}>
                <div className="discern-badge">易学辨析室</div>
                <div style={{ flex: 1 }}>
                  <div className="discern-hero-title">把容易混的概念分清</div>
                  <p className="tiny" style={{ color: 'var(--text-2)', marginTop: 4 }}>中 vs 正 · 承 vs 乘 · 错卦 vs 综卦…先判断，再看为什么。</p>
                </div>
                <span className="discern-go">→</span>
              </div>
            </div>
          )}

          {/* 正在学习 / 容易混淆 */}
          {(learning.length > 0 || confused.length > 0) && (
            <div className="grid-2 mt-16">
              {learning.length > 0 && (
                <div className="card">
                  <div className="archive-sub">最近学习</div>
                  <div className="mt-8">
                    {learning.map((t) => (
                      <TermRow key={t.id} term={t} />
                    ))}
                  </div>
                </div>
              )}
              {confused.length > 0 && (
                <div className="card">
                  <div className="archive-sub" style={{ color: 'var(--danger)' }}>最近容易混淆</div>
                  <div className="mt-8">
                    {confused.map((c) => (
                      <div
                        key={c.groupId}
                        className="confused-row"
                        onClick={() => navigate(`/terms/discern?group=${c.groupId}`)}
                      >
                        <span>✗ {getDiscernment(c.groupId)?.title}</span>
                        <span className="btn btn-danger btn-sm">再辨一次</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 推荐理解（精选） */}
          <div className="mt-20">
            <div className="spread" style={{ alignItems: 'baseline' }}>
              <div className="archive-sub">推荐理解 · 核心高频</div>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/terms/map')}>看术语地图 →</button>
            </div>
            <TermGrid terms={FEATURED_TERM_IDS.map(getTerm).filter(Boolean)} className="mt-8" />
          </div>

          {/* 分类浏览 */}
          <div className="mt-20">
            <div className="archive-sub">按层级浏览</div>
            <div className="term-cats mt-8">
              {TERM_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  className={`term-cat ${cat === c.id ? 'on' : ''}`}
                  onClick={() => setCat(cat === c.id ? null : c.id)}
                >
                  <span className="term-cat-lv">L{c.level}</span>
                  {c.label}
                  <span className="term-cat-n">{TERM_COUNT_BY_CATEGORY.find((x) => x.id === c.id)?.count}</span>
                </button>
              ))}
            </div>

            {cat ? (
              <div className="mt-12">
                <p className="tiny muted" style={{ marginBottom: 8 }}>
                  {TERM_CATEGORY_BY_ID[cat].tip}
                </p>
                <TermGrid terms={termsByCategory(cat)} />
              </div>
            ) : null}
          </div>
        </>
      )}

      <Remind icon="🔬">
        这里每一个词都是「解释方式」，不是「确定结论」。理解它，也要知道它的边界——这就是「辨析室」存在的意义。
      </Remind>
    </div>
  )
}

function EmptyHit({ onClear }) {
  return (
    <div className="empty">
      <div style={{ fontSize: 36 }}>🔎</div>
      <h3>没有匹配的术语</h3>
      <p className="muted tiny mt-8">换个词试试（支持中文 / 繁体 / 拼音 / 别名）。</p>
      <button className="btn btn-ghost btn-sm mt-12" onClick={onClear}>清空搜索</button>
    </div>
  )
}

function TermRow({ term }) {
  const { state } = useApp()
  const m = termMastery(state, term.id)
  return (
    <button className="term-row" onClick={() => navigate(`/terms/${term.id}`)}>
      <span className="term-row-name">{term.term}</span>
      <span className="tiny muted">掌握度 {m}/6</span>
      <span className="term-row-go">→</span>
    </button>
  )
}

function TermGrid({ terms, className = '' }) {
  return (
    <div className={`dict-grid ${className}`.trim()}>
      {terms.map((t) => (
        <button key={t.id} className="dict-card term-card" style={{ textAlign: 'left' }} onClick={() => navigate(`/terms/${t.id}`)}>
          <div className="row" style={{ justifyContent: 'space-between', gap: 6 }}>
            <h4>{t.term}</h4>
            <span className="tiny muted">{t.pinyin}</span>
          </div>
          <div className="one">{t.shortDefinition}</div>
        </button>
      ))}
    </div>
  )
}

// ============================================================
// 术语地图（八层二维关系图）
// ============================================================
function TermMap() {
  return (
    <div>
      <BackRow to="/terms" label="术语百科" />
      <PageHead title="术语地图" sub="从上到下是学习顺序：先核心，再结构，最后到历史传统。点任意词进入。" />

      {TERM_CATEGORIES.map((c) => {
        const terms = termsByCategory(c.id)
        return (
          <div key={c.id} className="card termmap-band">
            <div className="row" style={{ gap: 10 }}>
              <div className="termmap-lv">L{c.level}</div>
              <div style={{ flex: 1 }}>
                <div className="archive-sub">{c.label}</div>
                <div className="tiny muted">{c.tip}</div>
              </div>
              <span className="tiny muted">{terms.length} 个</span>
            </div>
            <div className="termmap-nodes mt-12">
              {terms.map((t) => (
                <button key={t.id} className="termmap-node" onClick={() => navigate(`/terms/${t.id}`)}>
                  {t.term}
                </button>
              ))}
            </div>
          </div>
        )
      })}

      <Remind icon="🗺️">
        这幅图是「入门地图」，真正的连接在每一个术语页里：从「中」你能走到乾九二、走到《易传》、走到王弼、走到案例——顺藤摸瓜。
      </Remind>
    </div>
  )
}

// ============================================================
// 术语详情页
// ============================================================
function TermDetail({ termId }) {
  const { state, dispatch } = useApp()
  const term = getTerm(termId)
  const [mode, setMode] = useState('beginner')
  const net = useMemo(() => termNetwork(termId), [termId])
  const stage = termStage(state, termId)
  const mastery = termMastery(state, termId)
  const ev = termEvidence(state, termId)
  const rec = termRecommendation(state, termId)
  const groups = discernmentsForTerm(termId)
  const key = termMasteryKey(termId)
  const readRecorded = useRef(false)

  // 「阅读」证据：进入即打点（只打点，不 bump 掌握度）
  useEffect(() => {
    if (!readRecorded.current) {
      readRecorded.current = true
      dispatch({ type: 'RECORD_TERM_EVIDENCE', key, kind: 'read' })
    }
  }, [key, dispatch])

  if (!term || !net) {
    return (
      <div>
        <BackRow to="/terms" label="术语百科" />
        <div className="empty">未找到该术语。</div>
      </div>
    )
  }

  const cat = TERM_CATEGORY_BY_ID[term.category]
  const deep = mode === 'deep'
  const hexagrams = net.hexagrams || []
  const yaos = net.yaos || []
  const passages = net.classicPassages || []
  const cases = net.cases || []
  const tenWings = net.tenWings || []
  const traditions = net.traditions || []

  return (
    <div className="term-detail">
      <BackRow to="/terms" label="术语百科" />

      {/* 头部 */}
      <div className="card archive-head mt-12" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div className="row wrap" style={{ gap: 8 }}>
            <h1 style={{ fontSize: 30, lineHeight: 1.1 }}>{term.term}</h1>
            <span className="tiny muted">{term.pinyin}</span>
            <Pill tone="amber">L{term.level} · {cat?.label}</Pill>
            <Pill tone="indigo">{stage.label} · 掌握度 {mastery}/6</Pill>
            {sourcePill(term)}
          </div>
          <p className="muted mt-8" style={{ fontSize: 15 }}>{term.shortDefinition}</p>
          <div className="mt-12">
            <Segmented
              items={[
                { value: 'beginner', label: '小白模式' },
                { value: 'deep', label: '深入模式' },
              ]}
              value={mode}
              onChange={setMode}
            />
          </div>
        </div>
      </div>

      {/* Agent 确定性推荐（两模式都显示，紧凑） */}
      {rec && (
        <div className="archive-rec mt-16">
          <div className="tiny" style={{ fontWeight: 700, color: 'var(--amber-deep)' }}>🔎 学习建议</div>
          <div style={{ fontWeight: 700, marginTop: 2 }}>{rec.title}</div>
          <p className="tiny muted mt-4">{rec.body} <b>{rec.why}</b></p>
          {rec.contrast && (
            <button className="btn btn-sm btn-primary mt-8" onClick={() => navigate(`/terms/discern?group=${rec.contrast.id}`)}>
              去辨析「{rec.contrast.title}」→
            </button>
          )}
        </div>
      )}

      {/* ① 一句话 */}
      <LayerBox tone="plain" tag="① 先用一句话理解">
        <p>{term.shortDefinition}</p>
      </LayerBox>

      {/* ② 进一步理解 */}
      {term.beginnerExplanation ? (
        <LayerBox tone="plain" tag="② 进一步理解">
          <p>{term.beginnerExplanation}</p>
        </LayerBox>
      ) : null}

      {/* 例子 + 易错（小白模式也要看到） */}
      {(term.examples?.length > 0) && (
        <LayerBox tone="plain" tag="例子">
          <List items={term.examples.slice(0, 3)} />
        </LayerBox>
      )}

      {(term.commonMistakes?.length > 0) && (
        <LayerBox tone="mine" tag="⚠️ 容易误解">
          <List items={term.commonMistakes} />
        </LayerBox>
      )}

      {/* —— 深入模式 —— */}
      {deep && (
        <>
          {term.coreMeaning ? (
            <LayerBox tone="plain" tag="③ 它为什么重要">
              <p>{term.coreMeaning}</p>
            </LayerBox>
          ) : null}

          {term.originalContext ? (
            <div className="card mt-16">
              <div className="archive-sub">放进《易经》里</div>
              <p className="mt-8" style={{ fontSize: 14 }}>{term.originalContext}</p>
            </div>
          ) : null}

          {/* 原典 */}
          <div className="card mt-16">
            <div className="spread" style={{ alignItems: 'baseline' }}>
              <div className="archive-sub">原典 · 已核对片段</div>
              {passages.length > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: 'RECORD_TERM_EVIDENCE', key, kind: 'original' })}>
                  标记已读
                </button>
              )}
            </div>
            {passages.length === 0 ? (
              <p className="tiny muted mt-8">暂无可靠整理（不编造原文）。</p>
            ) : (
              <div>
                {passages.slice(0, 4).map((p) => (
                  <div key={p.id} className="layer-box classic mt-12">
                    <div className="layer-tag">{p.source} · {p.chapter}</div>
                    <p className="display" style={{ fontSize: 16 }}>{p.text}</p>
                    {p.modernNote && <p className="tiny mt-8">{p.modernNote}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 相关卦 */}
          <div className="card mt-16">
            <div className="archive-sub">相关卦（{hexagrams.length}）</div>
            <div className="chip-grid mt-8">
              {hexagrams.length === 0 ? (
                <span className="tiny muted">暂无关联。</span>
              ) : (
                hexagrams.slice(0, 16).map((h) => (
                  <button key={h.seq} className="hex-chip" onClick={() => { dispatch({ type: 'RECORD_TERM_EVIDENCE', key, kind: 'link' }); navigate(`/hex/${h.seq}`) }}>
                    <span className="hex-chip-symbol">{h.symbol}</span>
                    {h.name}
                  </button>
                ))
              )}
              {hexagrams.length > 16 && <span className="tiny muted">…共 {hexagrams.length} 卦</span>}
            </div>
          </div>

          {/* 相关爻 */}
          <div className="card mt-16">
            <div className="archive-sub">相关爻（{yaos.length}）</div>
            <p className="tiny muted mt-4">由结构引擎推算，与卦档展示严格一致。</p>
            <div className="chip-grid mt-8">
              {yaos.length === 0 ? (
                <span className="tiny muted">暂无关联。</span>
              ) : (
                yaos.slice(0, 12).map((y) => (
                  <button key={y.id} className="yao-chip" onClick={() => { dispatch({ type: 'RECORD_TERM_EVIDENCE', key, kind: 'link' }); navigate(`/hex/${y.hexagramId}?yao=${yaoIndex(y.id)}`) }}>
                    {y.hexagramName}·{y.name}
                    <span className="tiny muted">{y.deweiLabel || y.positionLabel}</span>
                  </button>
                ))
              )}
              {yaos.length > 12 && <span className="tiny muted">…共 {yaos.length} 爻</span>}
            </div>
          </div>

          {/* 相关《易传》 */}
          {tenWings.length > 0 && (
            <div className="card mt-16">
              <div className="archive-sub">相关《易传》· 十翼</div>
              <div className="chip-grid mt-8">
                {tenWings.map((w) => (
                  <button key={w.node} className="term-link-chip" onClick={() => { dispatch({ type: 'RECORD_TERM_EVIDENCE', key, kind: 'link' }); navigate(lessonLink(w.node)) }}>
                    {w.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 不同传统 */}
          {traditions.length > 0 && (
            <div className="card mt-16">
              <div className="archive-sub">不同解释传统</div>
              <p className="tiny muted mt-4">这些是不同读法，不是「唯一正确答案」。</p>
              <div className="mt-8">
                {traditions.map((t) => (
                  <div key={t.key} className="tradition-row">
                    <span>{t.label}</span>
                    <span className="tiny muted">{t.note}</span>
                    <span style={{ marginLeft: 'auto' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => { dispatch({ type: 'RECORD_TERM_EVIDENCE', key, kind: 'link' }); navigate(lessonLink(t.node)) }}>
                        去学习
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 术语关系网络 */}
          <RelationGraph termId={termId} />

          {/* 典型案例 */}
          {cases.length > 0 && (
            <div className="card mt-16">
              <div className="archive-sub">用案例练一练</div>
              <div className="mt-8">
                {cases.map((c) => (
                  <div key={c.id} className="tradition-row">
                    <span>{c.title}</span>
                    <Pill tone="gray">{c.levelName}</Pill>
                    <span style={{ marginLeft: 'auto' }}>
                      <button className="btn btn-teal btn-sm" onClick={() => { dispatch({ type: 'RECORD_TERM_EVIDENCE', key, kind: 'case' }); navigate(`/case/${c.id}`) }}>
                        去挑战
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 易学辨析室 */}
          {groups.length > 0 && (
            <div className="card mt-16">
              <div className="archive-sub">易学辨析室 · 别和这些概念混淆</div>
              <div className="mt-8">
                {groups.map((g) => {
                  const other = getTerm(g.termA === termId ? g.termB : g.termA)
                  return (
                    <div key={g.id} className="tradition-row">
                      <span style={{ fontWeight: 700 }}>{g.title}</span>
                      {other && <span className="tiny muted">看看它和「{other.term}」的边界在哪</span>}
                      <span style={{ marginLeft: 'auto' }}>
                        <button className="btn btn-indigo btn-sm" onClick={() => navigate(`/terms/discern?group=${g.id}`)}>
                          去辨析
                        </button>
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* 现在测一下 */}
      <div className="card mt-16">
        <div className="archive-sub">现在测一下</div>
        <DefinitionQuiz termId={termId} />
      </div>

      {/* 我的理解 + 我的掌握度 */}
      <div className="card mt-16">
        <div className="archive-sub">我的理解（用自己的话说）</div>
        <TermNote termId={termId} />

        <div className="mt-20">
          <div className="archive-sub">我的掌握度</div>
          <div className="row mt-8" style={{ gap: 16, alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <StageDots stage={stage} />
              <EvChips ev={ev} />
            </div>
          </div>
        </div>
      </div>

      <Remind icon="🔬">
        一个词点开后，还能沿着「原典 → 卦 → 爻 → 传统 → 案例」继续走下去，才算真正弄懂。别停在定义上。
      </Remind>
    </div>
  )
}

function LayerBox({ tone, tag, children }) {
  const cls = tone === 'classic' ? 'classic' : tone === 'mine' ? 'mine' : 'plain'
  return (
    <div className={`card mt-16 layer-box ${cls}`} style={{ boxShadow: 'none' }}>
      <div className="layer-tag">{tag}</div>
      {children}
    </div>
  )
}

function List({ items }) {
  return (
    <ul className="archive-ul">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  )
}

function StageDots({ stage }) {
  const order = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5']
  const idx = order.indexOf(stage.id)
  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="tiny muted">学习阶段</span>
        <span className="tiny" style={{ fontWeight: 700 }}>{stage.id} · {stage.label}</span>
      </div>
      <div className="stage-dots mt-8">
        {order.map((s, i) => (
          <span key={s} className={`stage-dot ${i <= idx ? 'on' : ''}`} />
        ))}
      </div>
      <p className="tiny muted mt-8">{stage.tip}{stage.next ? ` 下一步：${stage.next.label}` : ' 已到研究阶段。'}</p>
    </div>
  )
}

function EvChips({ ev }) {
  return (
    <div className="token-row mt-8">
      {TERM_EVIDENCE_DIMS.map((d) => (
        <span key={d.key} className={`ev-chip ${ev[d.key] ? 'on' : ''}`}>
          {ev[d.key] ? '✓' : '·'} {d.label}
        </span>
      ))}
    </div>
  )
}

function TermNote({ termId }) {
  const { state, dispatch } = useApp()
  const key = termMasteryKey(termId)
  const saved = state.termNotes?.[key]?.note || ''
  const [val, setVal] = useState(saved)
  useEffect(() => setVal(saved), [saved])
  return (
    <div className="mt-8">
      <textarea
        className="archive-note"
        rows={3}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="试着一句话解释这个概念，以及它容易和什么混淆…"
      />
      <div className="row mt-8" style={{ justifyContent: 'flex-end', gap: 8 }}>
        <button className="btn btn-ghost btn-sm" disabled={!val} onClick={() => { dispatch({ type: 'DELETE_TERM_NOTE', key }); setVal('') }}>
          清除
        </button>
        <button className="btn btn-primary btn-sm" onClick={() => dispatch({ type: 'SAVE_TERM_NOTE', key, note: val })}>
          保存
        </button>
      </div>
    </div>
  )
}

function DefinitionQuiz({ termId }) {
  const { dispatch } = useApp()
  const q = useMemo(() => termDefinitionQuestion(termId), [termId])
  const groups = useMemo(() => discernmentsForTerm(termId), [termId])
  const [picked, setPicked] = useState(null)
  const rot = useMemo(() => (q ? rotateOptions(q.options, termId) : null), [q, termId])

  // 优先辨析室；否则用「哪句在解释它」定义判断
  if (groups.length > 0 && !q) {
    return (
      <div className="mt-8">
        <p className="tiny muted">这个概念有容易混淆的近邻，去辨析室分清边界。</p>
        <button className="btn btn-indigo mt-8" onClick={() => navigate(`/terms/discern?group=${groups[0].id}`)}>
          去辨析「{groups[0].title}」→
        </button>
      </div>
    )
  }

  if (!q || !rot) {
    return <p className="tiny muted mt-8">这个术语暂无可生成的判断题，先读定义和易错点。</p>
  }

  function pick(i) {
    if (picked !== null) return
    setPicked(i)
    const correct = i === rot.answer
    dispatch({
      type: 'RECORD_QUIZ',
      item: { nodeId: termMasteryKey(termId), correct, stepType: 'mastery', errorType: correct ? undefined : 'E10', storeContext: '术语百科·定义判断' },
    })
  }

  return (
    <div className="mt-8">
      <p style={{ fontWeight: 600, fontSize: 14.5 }}>{q.prompt}</p>
      <div className="mt-8">
        {rot.options.map((opt, i) => {
          let cls = 'option'
          if (picked !== null) {
            if (i === rot.answer) cls += ' correct'
            else if (i === picked) cls += ' wrong'
          }
          return (
            <button key={i} className={cls} onClick={() => pick(i)}>
              <span className="letter">{'ABCD'[i]}.</span> {opt}
            </button>
          )
        })}
      </div>
      {picked !== null && (
        <div className={`feedback ${picked === rot.answer ? 'good' : 'warn'}`}>
          <h4>{picked === rot.answer ? '✓ 说对了' : '✗ 再想一下'}</h4>
          <p className="tiny mt-8">{q.explain}</p>
        </div>
      )}
    </div>
  )
}

// ============================================================
// 术语关系网络（二维概念图）
// ============================================================
function RelationGraph({ termId }) {
  const term = getTerm(termId)
  const rel = termRelations(termId)
  if (!term || !rel) return null
  const groups = [
    { label: '需要先懂', key: 'prerequisites', tone: 'amber', items: rel.prerequisites },
    { label: '相关概念', key: 'related', tone: 'teal', items: rel.related },
    { label: '容易混淆', key: 'contrasts', tone: 'red', items: rel.contrasts },
    { label: '由它引出', key: 'children', tone: 'indigo', items: rel.children },
  ].filter((g) => g.items.length > 0)

  if (groups.length === 0) return null

  return (
    <div className="card mt-16">
      <div className="archive-sub">术语关系网络</div>
      <p className="tiny muted mt-4">点任意词跳过去，继续顺藤摸瓜。</p>

      <div className="relmap mt-12">
        <div className="relmap-center" onClick={() => navigate(`/terms/${termId}`)}>
          {term.term}
        </div>
        <div className="relmap-groups">
          {groups.map((g) => (
            <div key={g.key} className="relmap-group">
              <div className={`relmap-label relmap-label-${g.tone}`}>{g.label}</div>
              <div className="relmap-nodes">
                {g.items.slice(0, 10).map((t) => (
                  <button key={t.id} className={`relmap-node relmap-node-${g.tone}`} onClick={() => navigate(`/terms/${t.id}`)}>
                    {t.term}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 易学辨析室
// ============================================================
const DISCERN_SECTIONS = [
  { id: 'base', label: '基础' },
  { id: 'structure', label: '结构' },
  { id: 'text', label: '文本' },
  { id: 'relation', label: '卦关系' },
  { id: 'method', label: '方法' },
  { id: 'history', label: '历史' },
]

const DISCERN_SECTION_BY_ID = {
  'disc-yin-yang': 'base', 'disc-gangrou-yinyang': 'base', 'disc-gua-yao': 'base',
  'disc-zhong-zheng': 'structure', 'disc-dewei-zhong': 'structure', 'disc-cheng-sheng': 'structure',
  'disc-bi-ying': 'structure', 'disc-xiangying-diying': 'structure', 'disc-dewei-zheng': 'structure',
  'disc-guaci-yaoci': 'text', 'disc-tuanzhuan-daxiang': 'text', 'disc-daxiang-xiaoxiang': 'text', 'disc-jingwen-zhuanwen': 'text',
  'disc-cuogua-zonggua': 'relation', 'disc-bengua-zhigua': 'relation', 'disc-hugua-biangua': 'relation',
  'disc-xiang-shu': 'method', 'disc-xiangshu-yili': 'method', 'disc-zhanzhi-yili': 'method', 'disc-shi-wei': 'method',
  'disc-wangbi-chengyi': 'history', 'disc-zhuxi-wangbi': 'history',
}

function DiscernRoom({ groupId }) {
  const initial = groupId && getDiscernment(groupId) ? groupId : null
  const [active, setActive] = useState(initial)

  if (active) return <DiscernFlow groupId={active} onBack={() => setActive(null)} />

  return (
    <div>
      <BackRow to="/terms" label="术语百科" />
      <PageHead title="易学辨析室" sub={`先判断 → 看定义 → 看原典 → 看例子 → 看反例 → 看传统 → 再回答 · 共 ${DISCERNMENT_COUNT} 组`} />

      {DISCERN_SECTIONS.map((s) => {
        const groups = DISCERNMENT_GROUPS.filter((g) => DISCERN_SECTION_BY_ID[g.id] === s.id)
        if (!groups.length) return null
        return (
          <div key={s.id} className="mt-16">
            <div className="archive-sub">{s.label}</div>
            <div className="grid-2 mt-8">
              {groups.map((g) => (
                <button key={g.id} className="card card-hover discern-card" style={{ textAlign: 'left' }} onClick={() => setActive(g.id)}>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{g.title}</div>
                  <p className="tiny muted mt-8">{g.oneLineDiff}</p>
                </button>
              ))}
            </div>
          </div>
        )
      })}

      <Remind icon="⚖️">
        辨析不是「背标准答案」，而是分清两个概念的边界。先自己判断，再看定义和原典，最后再回答一次。
      </Remind>
    </div>
  )
}

function DiscernFlow({ groupId, onBack }) {
  const { dispatch } = useApp()
  const g = getDiscernment(groupId)
  const [picked, setPicked] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [repick, setRepick] = useState(null)
  const [finalOk, setFinalOk] = useState(false)

  if (!g) {
    return <div className="empty">未找到该辨析组。</div>
  }

  const termA = getTerm(g.termA)
  const termB = getTerm(g.termB)
  const passages = (g.classicPassageIds || []).map(getClassicPassage).filter(Boolean)
  const traditions = (g.traditionKeys || [])
    .map((k) => TRADITION_REF.find((t) => t.key === k))
    .filter(Boolean)
  const hexagrams = (g.relatedHexagramIds || [])
  const yaos = g.relatedYaoIds || []

  function firstPick(i) {
    if (picked !== null) return
    setPicked(i)
    const correct = i === g.practice.answerIndex
    dispatch({ type: 'RECORD_CONTRAST', groupId, termA: g.termA, termB: g.termB, chosen: i, correct })
  }

  function reveal() {
    setRevealed(true)
  }

  function secondPick(i) {
    if (repick !== null) return
    setRepick(i)
    setFinalOk(i === g.practice.answerIndex)
  }

  return (
    <div>
      <BackRow to="/terms/discern" label="辨析室" />

      <div className="card mt-12">
        <div className="row" style={{ gap: 8 }}>
          <div className="discern-badge">易学辨析室</div>
          <h1 style={{ fontSize: 26 }}>{g.title}</h1>
        </div>

        {/* 第一步：先判断 */}
        <div className="mt-16">
          <div className="archive-sub">① 先判断（{g.practice.question}）</div>
          <div className="mt-8">
            {g.practice.options.map((opt, i) => {
              let cls = 'option'
              if (picked !== null) {
                if (i === g.practice.answerIndex) cls += ' correct'
                else if (i === picked) cls += ' wrong'
              }
              return (
                <button key={i} className={cls} onClick={() => firstPick(i)}>
                  <span className="letter">{'ABCD'[i]}.</span> {opt}
                </button>
              )
            })}
          </div>

          {picked !== null && !revealed && (
            <div className={`feedback ${picked === g.practice.answerIndex ? 'good' : 'warn'}`}>
              <h4>{picked === g.practice.answerIndex ? '✓ 判断对了' : '✗ 没关系，这正是要分清的'}</h4>
              <p className="tiny mt-8">先别急着看为什么——下面一层层拆开看边界。</p>
              <button className="btn btn-primary mt-8" onClick={reveal}>看为什么 ↓</button>
            </div>
          )}
        </div>

        {/* 之后的步骤：看定义/原典/例子/反例/传统 */}
        {revealed && (
          <div className="mt-16">
            <div className="archive-sub">② 一句话区别</div>
            <LayerBox tone="plain" tag="一句话区别">
              <p>{g.oneLineDiff}</p>
            </LayerBox>

            <div className="grid-2 mt-12">
              <LayerBox tone="plain" tag={`「${termA?.term || ''}」是什么`}>
                <p className="tiny">{termA?.shortDefinition || ''}</p>
              </LayerBox>
              <LayerBox tone="plain" tag={`「${termB?.term || ''}」是什么`}>
                <p className="tiny">{termB?.shortDefinition || ''}</p>
              </LayerBox>
            </div>

            <p className="tiny muted mt-12" style={{ fontWeight: 700 }}>③ 为什么容易混</p>
            <p className="tiny mt-4">{g.confusionReason}</p>

            {passages.length > 0 && (
              <>
                <p className="tiny muted mt-12" style={{ fontWeight: 700 }}>④ 看原典</p>
                {passages.map((p) => (
                  <div key={p.id} className="layer-box classic mt-8">
                    <div className="layer-tag">{p.source} · {p.chapter}</div>
                    <p className="display" style={{ fontSize: 15 }}>{p.text}</p>
                    {p.modernNote && <p className="tiny mt-8">{p.modernNote}</p>}
                  </div>
                ))}
              </>
            )}

            {g.examples?.length > 0 && (
              <>
                <p className="tiny muted mt-12" style={{ fontWeight: 700 }}>⑤ 看例子</p>
                <List items={g.examples} />
              </>
            )}

            {g.counterExamples?.length > 0 && (
              <>
                <p className="tiny muted mt-12" style={{ fontWeight: 700 }}>⑥ 看反例</p>
                <List items={g.counterExamples} />
              </>
            )}

            {traditions.length > 0 && (
              <>
                <p className="tiny muted mt-12" style={{ fontWeight: 700 }}>⑦ 看不同传统</p>
                <p className="tiny muted">不同读法，不是「唯一正确答案」。</p>
                {traditions.map((t) => (
                  <button key={t.key} className="term-link-chip mt-8" onClick={() => navigate(lessonLink(t.node))}>
                    {t.label}
                  </button>
                ))}
              </>
            )}

            {(hexagrams.length > 0 || yaos.length > 0) && (
              <div className="mt-12">
                <p className="tiny muted" style={{ fontWeight: 700 }}>关联卦 / 爻</p>
                <div className="token-row mt-8">
                  {hexagrams.map((seq) => {
                    const h = requireName(seq)
                    return (
                      <button key={`h${seq}`} className="hex-chip" onClick={() => navigate(`/hex/${seq}`)}>
                        {h.symbol}{h.name}
                      </button>
                    )
                  })}
                </div>
                <div className="token-row mt-8">
                  {yaos.map((yid) => (
                    <button key={yid} className="token-chip" onClick={() => { const [_, seq, idx] = yid.split('-'); navigate(`/hex/${seq}?yao=${idx}`) }}>
                      {yid}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 再回答 */}
            <div className="card mt-12" style={{ background: 'var(--bg-warm)', boxShadow: 'none' }}>
              <div className="archive-sub">⑧ 再回答一次</div>
              <p className="tiny muted mt-4">现在，再看一眼最初的问题。</p>
              <div className="mt-8">
                {g.practice.options.map((opt, i) => {
                  let cls = 'option'
                  if (repick !== null) {
                    if (i === g.practice.answerIndex) cls += ' correct'
                    else if (i === repick) cls += ' wrong'
                  }
                  return (
                    <button key={i} className={cls} onClick={() => secondPick(i)}>
                      <span className="letter">{'ABCD'[i]}.</span> {opt}
                    </button>
                  )
                })}
              </div>
              {repick !== null && (
                <div className={`feedback ${finalOk ? 'good' : 'warn'}`}>
                  <h4>{finalOk ? '✓ 这次清晰了' : '再回看一遍「一句话区别」'}</h4>
                  <p className="tiny mt-8">{g.practice.explain}</p>
                  <div className="row mt-8" style={{ justifyContent: 'flex-end' }}>
                    <button className="btn btn-teal btn-sm" onClick={() => { onBack(); }}>完成 ▸</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// 从卦序取卦名/卦符（轻量，避免重复构建）
function requireName(seq) {
  const p = getHexagramProfile(seq)
  return p ? { name: p.name, symbol: p.symbol } : { name: seq, symbol: '' }
}