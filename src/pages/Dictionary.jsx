// ============================================================
// 玄学词典：不必是百科，而是「学习入口」。每个词条都能继续学。
// ============================================================
import React, { useState } from 'react'
import { DICTIONARY, getTerm } from '../data/dictionary'
import { getNode } from '../data/knowledge'
import { LESSONS } from '../data/lessons'
import { getCase } from '../data/cases'
import { navigate } from '../lib/router'
import { PageHead, Remind } from '../components/ui'

export function DictionaryPage({ selected }) {
  const [active, setActive] = useState(selected ? getTerm(selected)?.term : null)

  const current = active ? getTerm(active) : null

  if (current) {
    return <TermDetail term={current} onBack={() => { setActive(null); navigate('/dict') }} />
  }

  return (
    <div>
      <PageHead title="📖 玄学词典" sub="不是百科，而是你「顺藤摸瓜」的学习入口。" />
      <div className="dict-grid">
        {DICTIONARY.map((d) => (
          <button key={d.term} className="dict-card" style={{ textAlign: 'left' }} onClick={() => setActive(d.term)}>
            <div style={{ fontSize: 26 }}>{d.emoji}</div>
            <h4 className="mt-8">{d.term}</h4>
            <div className="one">{d.oneLine}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

function TermDetail({ term, onBack }) {
  const relatedLessons = term.related
    .map((id) => getNode(id))
    .filter(Boolean)
    .map((n) => ({ node: n, lesson: LESSONS.find((l) => l.nodeId === n.id) }))
  const cs = term.caseRef ? getCase(term.caseRef) : null

  return (
    <div className="lesson-body">
      <button className="btn btn-ghost btn-sm" onClick={onBack}>← 词典</button>

      <div className="card mt-12">
        <div style={{ fontSize: 40 }}>{term.emoji}</div>
        <h1 className="page-title" style={{ fontSize: 28 }}>{term.term}</h1>
        <p className="muted" style={{ fontSize: 15 }}>{term.oneLine}</p>

        <div className="mt-16" style={{ background: 'var(--bg-warm)', borderRadius: 12, padding: 16 }}>
          <div className="tiny" style={{ color: 'var(--amber-deep)', fontWeight: 700 }}>一句话</div>
          <p className="mt-8">{term.oneLine}</p>
        </div>

        <div className="mt-12" style={{ background: 'var(--bg-warm)', borderRadius: 12, padding: 16 }}>
          <div className="tiny" style={{ color: 'var(--teal-deep)', fontWeight: 700 }}>生活例子</div>
          <p className="mt-8">{term.lifeExample}</p>
        </div>

        {term.symbol && (
          <div className="mt-12" style={{ background: 'var(--bg-warm)', borderRadius: 12, padding: 16 }}>
            <div className="tiny" style={{ color: 'var(--indigo-deep)', fontWeight: 700 }}>图示 / 结构</div>
            <p className="mt-8 display" style={{ fontSize: 20 }}>{term.symbol}</p>
          </div>
        )}

        <div className="mt-12" style={{ background: 'rgba(194,91,72,0.06)', borderRadius: 12, padding: 16 }}>
          <div className="tiny" style={{ color: 'var(--danger)', fontWeight: 700 }}>容易误解</div>
          <p className="mt-8">{term.misunderstanding}</p>
        </div>

        <div className="feedback good mt-12">
          <h4>想想看</h4>
          <p className="tiny mt-8">{term.question}</p>
        </div>

        {cs && (
          <div className="mt-16 row spread" style={{ alignItems: 'center' }}>
            <span className="tiny muted">🕵️ 用一个案例练一练：{cs.title}</span>
            <button className="btn btn-teal btn-sm" onClick={() => navigate(`/case/${cs.id}`)}>去挑战</button>
          </div>
        )}

        {relatedLessons.length > 0 && (
          <div className="mt-16">
            <div className="tiny muted" style={{ marginBottom: 8 }}>继续学：</div>
            {relatedLessons.map(({ node, lesson }) => (
              <div key={node.id} className="row spread" style={{ padding: '10px 12px', background: 'var(--bg-warm)', borderRadius: 12, marginBottom: 8 }}>
                <span>{node.emoji} {node.title}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate(lesson ? `/lesson/${lesson.id}` : `/dict?term=${encodeURIComponent(node.title)}`)}>
                  {lesson ? '去上课' : '查看'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Remind icon="🔬">词典里的每一个概念，都是一个「解释方式」，不是「确定结论」。理解它，也要知道它的边界。</Remind>
    </div>
  )
}