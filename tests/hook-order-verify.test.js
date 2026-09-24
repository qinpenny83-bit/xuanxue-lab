// ============================================================
// 回归验证：React Hook 顺序（提前 return 之后不得再调用 Hook）
//   修复依据：线上白屏 Minified React error #310（rendered fewer hooks）
//   对所有 src 下 jsx/js 组件做 AST 级检查，任一违规即失败
// ============================================================
import { describe, it, expect } from 'vitest'
import { parse } from '@babel/parser'
import fs from 'fs'
import path from 'path'

const HOOKS = new Set(['useState', 'useEffect', 'useMemo', 'useContext', 'useReducer', 'useRef', 'useCallback', 'useApp'])

function hasEarlyReturn(statement) {
  if (statement.type === 'ReturnStatement') return true
  if (statement.type === 'IfStatement') {
    const collect = (n) => {
      if (!n || typeof n !== 'object') return false
      if (n.type === 'ReturnStatement') return true
      if (n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression') return false
      for (const key of Object.keys(n)) {
        const v = n[key]
        if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === 'string' && collect(c)) return true }
        else if (v && typeof v.type === 'string' && collect(v)) return true
      }
      return false
    }
    return collect(statement)
  }
  return false
}

function collectHooks(statements) {
  const out = []
  const walk = (node) => {
    if (!node || typeof node !== 'object') return
    if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') return
    if (node.type === 'CallExpression' && node.callee?.type === 'Identifier' && HOOKS.has(node.callee.name)) {
      out.push({ line: node.loc.start.line, name: node.callee.name })
    }
    for (const key of Object.keys(node)) {
      const v = node[key]
      if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === 'string') walk(c) }
      else if (v && typeof v.type === 'string') walk(v)
    }
  }
  for (const s of statements) walk(s)
  return out
}

function findComponentFns(ast) {
  const fns = []
  const handleVar = (d) => {
    for (const decl of d.declarations) {
      if (decl.init?.type === 'ArrowFunctionExpression' && decl.id?.type === 'Identifier') fns.push({ name: decl.id.name, fn: decl.init })
    }
  }
  for (const n of ast.program.body) {
    if (n.type === 'ExportNamedDeclaration' && n.declaration) {
      const d = n.declaration
      if (d.type === 'FunctionDeclaration' && d.id) fns.push({ name: d.id.name, fn: d })
      else if (d.type === 'VariableDeclaration') handleVar(d)
    }
    if (n.type === 'FunctionDeclaration' && n.id) fns.push({ name: n.id.name, fn: n })
    if (n.type === 'VariableDeclaration') handleVar(n)
  }
  return fns
}

function collectSourceFiles(dir) {
  const files = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) files.push(...collectSourceFiles(p))
    else if (/\.(jsx|js)$/.test(e.name)) files.push(p)
  }
  return files
}

describe('React Hook 顺序（回归线上 #310 白屏）', () => {
  it('所有组件的 Hook 调用均位于任何提前 return 之前', () => {
    const files = collectSourceFiles('src')
    expect(files.length).toBeGreaterThan(0)
    const violations = []
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8')
      let ast
      try {
        ast = parse(src, { sourceType: 'module', plugins: ['jsx'] })
      } catch {
        continue
      }
      for (const { name, fn } of findComponentFns(ast)) {
        if (!fn.body || fn.body.type !== 'BlockStatement') continue
        const top = fn.body.body
        const earlyIdx = top.findIndex(hasEarlyReturn)
        if (earlyIdx === -1) continue
        const boundary = top[earlyIdx].loc.start.line
        const hooksAfter = []
        for (let i = earlyIdx + 1; i < top.length; i++) {
          for (const h of collectHooks([top[i]])) hooksAfter.push(h)
        }
        if (hooksAfter.length > 0) {
          const at = hooksAfter.map((h) => `${h.name}@${h.line}`).join(', ')
          violations.push(`${file} :: ${name} :: 提前 return 在 ${boundary} 行，其后仍有 Hook 调用：${at}`)
        }
      }
    }
    expect(violations, violations.join('\n')).toEqual([])
  })
})
