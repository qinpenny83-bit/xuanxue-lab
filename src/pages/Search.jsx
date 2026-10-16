// ============================================================
// 🔍 全局搜索页（P2-5）
// 跨卦档 / 术语 / 课程 / 案例 / 词典 / 必背 六类内容统一检索。
// 数据来自 searchIndex.js（纯函数索引），无网络依赖。
// ============================================================
import React, { useMemo, useState } from 'react'
import { PageHead, Segmented } from '../components/ui'
import { navigate } from '../lib/router'
import { searchAll, countMatches, SEARCH_TYPES } from '../data/searchIndex'

const TYPE_KEY = SEARCH_TYPES.reduce((acc, t) => {
  acc[t.key] = t
  return acc
}, {})

function resultHref(r) {
  switch (r.type) {
    case 'hex':
      return `/hex/${r.id}`
    case 'term':
      return `/terms/${r.id}`
    case 'course':
      return r.nodeId ? `/lesson/${r.nodeId}` : `/lesson/${r.id}`
    case 'case':
      return `/case/${r.id}`
    case 'dict':
      return `/dict?term=${encodeURIComponent(r.title)}`
    case 'memorize':
      return '/memorize'
    default:
      return '/'
  }
}

function ResultRow({ r }) {
  const meta = TYPE_KEY[r.type] || { label: r.type, emoji: '🔍' }
  return (
    <button
      className="entry-card"
      style={{ textAlign: 'left', width: '100%', marginBottom: 0, padding: '10px 14px' }}
      onClick={() => navigate(resultHref(r))}
    >
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>{meta.emoji}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{r.title}</div>
          {r.desc && <div className="tiny muted mt-4" style={{ lineHeight: 1.6 }}>{r.desc}</div>}
        </div>
      </div>
    </button>
  )
}

export function SearchPage({ initialQ = '' }) {
  const [q, setQ] = useState(initialQ || '')
  const [type, setType] = useState('all')

  const results = useMemo(() => searchAll(q), [q])
  const counts = useMemo(() => countMatches(q), [q])

  const filtered = type === 'all'
    ? results
    : { [type]: results[type] || [] }

  const totalHits = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <div>
      <PageHead
        title="🔍 全局搜索"
        sub="一次搜遍卦档、术语、课程、案例、词典与必背速记。"
        right={q && totalHits > 0 ? <span className="pill pill-teal">{totalHits} 条</span> : null}
      />

      <div className="card" style={{ padding: '12px 14px' }}>
        <input
          autoFocus
          className="search-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜卦名、术语、课程、案例…例如：乾 / 承乘比应 / 五行 / 变卦"
          style={{ width: '100%', fontSize: 15, padding: '10px 14px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--bg-warm)' }}
        />
        <div className="row mt-10" style={{ gap: 6, flexWrap: 'wrap' }}>
          <button
            className={`btn btn-sm ${type === 'all' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setType('all')}
          >
            全部{q && counts ? ` ${totalHits}` : ''}
          </button>
          {SEARCH_TYPES.map((t) => (
            <button
              key={t.key}
              className={`btn btn-sm ${type === t.key ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setType(t.key)}
            >
              {t.emoji} {t.label}{q && counts[t.key] ? ` ${counts[t.key]}` : ''}
            </button>
          ))}
        </div>
      </div>

      {q && !totalHits && (
        <div className="card mt-12" style={{ textAlign: 'center', padding: '28px 0', color: '#8a8378', fontSize: 14 }}>
          没有搜到「{q}」相关内容。换个说法试试，或去学习地图看看。
        </div>
      )}

      {!q && (
        <div className="card mt-12" style={{ textAlign: 'center', padding: '28px 0', color: '#8a8378', fontSize: 14 }}>
          输入关键词，立即跨六类内容检索。
        </div>
      )}

      {Object.entries(filtered).map(([key, list]) => (
        <section key={key} className="mt-12">
          <div className="spread" style={{ marginBottom: 8 }}>
            <h4 style={{ fontSize: 14, marginBottom: 0 }}>{TYPE_KEY[key].emoji} {TYPE_KEY[key].label}</h4>
            <span className="tiny muted">{list.length} 条</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
            {list.map((r) => (
              <ResultRow key={`${r.type}-${r.id}`} r={r} />
            ))}
          </div>
        </section>
      ))}

      <div className="row mt-16">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/map')}>← 回地图</button>
      </div>
    </div>
  )
}
