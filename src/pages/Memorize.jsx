// ============================================================
// 📖 必背速记（R10）
// 定位：记忆自测工具——术语百科负责「查」，这里负责「记 + 测」。
// 分层：L1 字母表 / L2 规则口诀 / L3 六十四卦 / L4 神煞口诀。
// 交互：卡片点击翻面；勾选「已记住」写入 localStorage；乱序抽查自测。
// 数据：全部来自 mustMemorize.js（通行通识 / 课程节点 / hexagrams-data）。
// ============================================================
import React, { useMemo, useState } from 'react'
import { useApp } from '../store/AppContext'
import { PageHead, Pill, Segmented } from '../components/ui'
import { MEMORIZE_GROUPS, getMemorizeGroup } from '../data/mustMemorize'
import { getCurriculumNode } from '../data/curriculum'
import { navigate } from '../lib/router'

// —— 单张卡片：front 常显，点击翻面显示 back + tip ——
function MemoCard({ item, memorized, onToggle, compact }) {
  const [flipped, setFlipped] = useState(false)
  const done = memorized
  return (
    <div className={`card ${done ? 'memorized-card' : ''}`} style={{ marginBottom: 0, padding: '10px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{item.front}</div>
          {flipped && (
            <div className="mt-8" style={{ fontSize: 13, lineHeight: 1.6 }}>
              <div style={{ color: 'var(--teal-deep, #0f7b6c)', fontWeight: 600 }}>{item.back}</div>
              {item.tip && <div className="tiny mt-8" style={{ color: '#666' }}>💡 {item.tip}</div>}
              {item.lessonId && (
                <button
                  className="btn btn-ghost btn-sm mt-8"
                  style={{ marginRight: 6 }}
                  onClick={(e) => { e.stopPropagation(); navigate(`/lesson/${item.lessonId}`) }}
                >
                  📚 去课程复习
                </button>
              )}
            </div>
          )}
        </div>
        <button
          className={`btn btn-sm ${done ? 'btn-primary' : 'btn-ghost'}`}
          style={{ flexShrink: 0, padding: '2px 8px', fontSize: 12 }}
          onClick={(e) => { e.stopPropagation(); onToggle(item.id) }}
          title={done ? '取消已记住' : '标记为已记住'}
        >
          {done ? '✓ 已记住' : '记住了'}
        </button>
      </div>
      {!compact && (
        <button className="btn btn-ghost btn-sm mt-8" style={{ fontSize: 12 }} onClick={() => setFlipped(!flipped)}>
          {flipped ? '收起答案 ▲' : '看答案 ▼'}
        </button>
      )}
    </div>
  )
}

// —— 进度条：已背 X/Y ——
function GroupProgress({ items, memorized }) {
  const done = items.filter((it) => memorized.includes(it.id)).length
  const pct = items.length ? Math.round((done / items.length) * 100) : 0
  return (
    <div className="row" style={{ alignItems: 'center', gap: 8, margin: '6px 0 10px' }}>
      <div style={{ flex: 1, height: 8, background: 'var(--bg-warm, #f0ece4)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--teal-deep, #0f7b6c)', borderRadius: 4 }} />
      </div>
      <span className="tiny" style={{ flexShrink: 0 }}>已记住 {done}/{items.length}（{pct}%）</span>
    </div>
  )
}

// —— 乱序抽查：逐张翻牌自测 ——
function DrillView({ group, memorized, onToggle, onExit }) {
  const deck = useMemo(() => [...group.items].sort(() => Math.random() - 0.5), [group])
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [marked, setMarked] = useState([])
  const item = deck[idx]

  function mark() {
    if (!memorized.includes(item.id)) onToggle(item.id)
    setMarked((m) => [...m, item.id])
    next()
  }
  function skip() {
    setMarked((m) => [...m, item.id])
    next()
  }
  function next() {
    setFlipped(false)
    setIdx((i) => i + 1)
  }
  function restart() {
    setIdx(0)
    setFlipped(false)
    setMarked([])
  }

  if (!item) {
    return (
      <div className="feedback good mt-12">
        <h4>🎉 本轮抽查完成</h4>
        <p className="tiny mt-8">共 {deck.length} 张卡片，其中 {marked.length} 张已过目，本轮新标记 {marked.filter((x) => memorized.includes(x)).length} 张。</p>
        <div className="row mt-8" style={{ gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={restart}>🔄 再来一轮</button>
          <button className="btn btn-ghost btn-sm" onClick={onExit}>← 返回列表</button>
        </div>
      </div>
    )
  }

  return (
    <div className="card mt-12">
      <div className="spread">
        <h4 style={{ fontSize: 15 }}>{group.emoji} {group.label} · 乱序抽查</h4>
        <span className="pill pill-gray">第 {idx + 1}/{deck.length} 张</span>
      </div>
      <div className="mt-12" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 800, padding: '18px 0' }}>{item.front}</div>
        {flipped ? (
          <div className="mt-8">
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--teal-deep, #0f7b6c)' }}>{item.back}</div>
            {item.tip && <div className="tiny mt-8" style={{ color: '#666' }}>💡 {item.tip}</div>}
          </div>
        ) : (
          <button className="btn btn-ghost mt-8" onClick={() => setFlipped(true)}>翻牌看答案 👁️</button>
        )}
      </div>
      <div className="row mt-12" style={{ justifyContent: 'space-between', gap: 8 }}>
        <button className="btn btn-ghost btn-sm" onClick={skip}>跳过</button>
        {flipped && (
          <button className="btn btn-primary btn-sm" onClick={mark}>{memorized.includes(item.id) ? '已记住，下一张 →' : '记住了，下一张 →'}</button>
        )}
      </div>
      <button className="btn btn-ghost btn-sm mt-8" style={{ fontSize: 12 }} onClick={onExit}>← 退出抽查</button>
    </div>
  )
}

export function MemorizePage() {
  const { state, dispatch } = useApp()
  const memorized = state.memorized || []
  const [groupId, setGroupId] = useState('alpha')
  const [drill, setDrill] = useState(false)
  const group = getMemorizeGroup(groupId) || MEMORIZE_GROUPS[0]

  function toggle(id) {
    dispatch({ type: 'TOGGLE_MEMORIZE', itemId: id })
  }

  const totalDone = MEMORIZE_GROUPS.flatMap((g) => g.items).filter((it) => memorized.includes(it.id)).length
  const total = MEMORIZE_GROUPS.flatMap((g) => g.items).length

  if (drill) {
    return (
      <div>
        <PageHead
          title="🎲 必背抽查"
          sub={`${group.emoji} ${group.label} · 随机翻牌，检验记忆`}
          right={<Pill tone="gray">{totalDone}/{total}</Pill>}
        />
        <DrillView group={group} memorized={memorized} onToggle={toggle} onExit={() => setDrill(false)} />
        <div className="row mt-12">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/map')}>← 回地图</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHead
        title="📖 必背速记"
        sub="字母表 → 规则口诀 → 64 卦 → 神煞。点卡片看答案，勾「已记住」存档，再用乱序抽查检验。"
        right={<Pill tone={totalDone === total ? 'teal' : 'gray'}>{totalDone}/{total} 已背</Pill>}
      />

      <Segmented
        items={MEMORIZE_GROUPS.map((g) => ({
          value: g.id,
          label: `${g.emoji} ${g.label}`,
        }))}
        value={groupId}
        onChange={setGroupId}
      />

      <div className="mt-12">
        <div className="spread">
          <div>
            <h4 style={{ fontSize: 15, marginBottom: 2 }}>{group.emoji} {group.label}</h4>
            <p className="tiny" style={{ marginBottom: 0, color: '#666' }}>{group.desc}（对应主线 {group.stage}）</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setDrill(true)}>🎲 乱序抽查</button>
        </div>
        <GroupProgress items={group.items} memorized={memorized} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 10 }}>
          {group.items.map((it) => (
            <MemoCard key={it.id} item={it} memorized={memorized.includes(it.id)} onToggle={toggle} />
          ))}
        </div>
      </div>

      <div className="row mt-12">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/map')}>← 回地图</button>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/path')}>去求学主线 →</button>
      </div>
    </div>
  )
}
