import { describe, it, expect } from 'vitest';
import { CURRICULUM_NODES } from '../src/data/curriculum/index.js';

// 结构完整性：每个知识节点都必须带 microExperiment（低门槛动手实践），
// 保证每个核心知识点都留给学习者一次动手观察的机会。
describe('microExperiment 结构完整性', () => {
  it('所有节点都有 microExperiment', () => {
    const missing = CURRICULUM_NODES.filter((n) => !n.microExperiment).map((n) => n.id);
    expect(missing).toEqual([]);
  });

  it('microExperiment 格式合法（title/text 均为非空字符串）', () => {
    const bad = CURRICULUM_NODES.filter(
      (n) =>
        !n.microExperiment ||
        typeof n.microExperiment.title !== 'string' ||
        !n.microExperiment.title.trim() ||
        typeof n.microExperiment.text !== 'string' ||
        !n.microExperiment.text.trim()
    ).map((n) => n.id);
    expect(bad).toEqual([]);
  });
});
