// 临时诊断脚本：在 Node 中加载生产构建的 localAgentEngine chunk 并执行 runAgent
import { runAgent } from '../dist/assets/localAgentEngine-CRmJOI8M.js'
import { initialState } from '../src/lib/storage.js'

try {
  const a = runAgent(initialState)
  console.log('runAgent OK ->', a.nextAction?.type, '|', a.nextAction?.title)
  console.log('learningState:', a.learningState?.phase)
  console.log('fingerprint.ready:', a.fingerprint?.ready)
} catch (e) {
  console.log('runAgent ERROR:', e.constructor.name)
  console.log('message:', e.message)
  console.log('stack:')
  console.log((e.stack || '').split('\n').slice(0, 12).join('\n'))
}
