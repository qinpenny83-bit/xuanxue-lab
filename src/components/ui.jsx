// ============================================================
// 共享 UI 原子组件：进度环 / 进度条 / 徽章 / 提醒 / 空状态 / 弹层。
// ============================================================
import React from 'react'

export function Bar({ value = 0, max = 100, tone = 'amber', className = '' }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)))
  return (
    <div className={`bar ${className}`}>
      <div className={`bar-fill ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Ring({ value = 0, size = 84, stroke = 8, label = '%', sub }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(28,26,23,0.08)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--amber)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div className="ring-center" style={{ fontSize: size / 4, fontWeight: 700 }}>
        <div style={{ textAlign: 'center' }}>
          {Math.round(pct)}
          {label}
          {sub ? <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 500 }}>{sub}</div> : null}
        </div>
      </div>
    </div>
  )
}

export function Pill({ tone = 'gray', children }) {
  return <span className={`pill pill-${tone}`}>{children}</span>
}

export function LevelChip({ level, name }) {
  return (
    <span className="level-chip">
      <span>Lv.{level}</span>
      <span>{name}</span>
    </span>
  )
}

export function Remind({ children, icon = '🔬' }) {
  return (
    <div className="remind">
      <span className="r-ico">{icon}</span>
      <div>{children}</div>
    </div>
  )
}

export function EmptyState({ title, desc, action }) {
  return (
    <div className="empty">
      <div style={{ fontSize: 40, marginBottom: 8 }}>🗂️</div>
      <h3>{title}</h3>
      {desc ? <p className="muted" style={{ marginTop: 6 }}>{desc}</p> : null}
      {action ? <div className="mt-16">{action}</div> : null}
    </div>
  )
}

export function Modal({ onClose, children, title }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {title ? <h3 style={{ marginBottom: 12 }}>{title}</h3> : null}
        {children}
      </div>
    </div>
  )
}

export function PageHead({ title, sub, right }) {
  return (
    <div className="spread" style={{ alignItems: 'flex-end', marginBottom: 18 }}>
      <div>
        <h1 className="page-title">{title}</h1>
        {sub ? <p className="page-sub" style={{ marginBottom: 0 }}>{sub}</p> : null}
      </div>
      {right}
    </div>
  )
}

export function Segmented({ items, value, onChange }) {
  return (
    <div style={{ display: 'inline-flex', background: 'var(--bg-warm)', borderRadius: 999, padding: 3 }}>
      {items.map((it) => (
        <button
          key={it.value}
          className={value === it.value ? 'btn btn-sm' : 'btn btn-sm btn-ghost'}
          style={value === it.value ? { fontSize: 13 } : { border: 'none', fontSize: 13 }}
          onClick={() => onChange(it.value)}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}