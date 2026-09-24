# 玄学实验室 R3 · 现状审计与实施计划

> 「易工坊 × 实验 × 怀疑」核心体验重构
> 生成日期：2026-09-19

---

## 一、R3 现状审计（代码层事实，非估算）

### 易工坊（当前 = `IChingPlay.jsx` + `playEngine.js`）
- 当前功能：① 卦象实验室（六爻拼装 + 变卦 + 错/综/互关系展示）；② 八卦闪卡（4 模式 × 8 题/轮）；③ 卦象侦探（错/综/互 3 关系 × 5 题/轮）；④ 古文破译室（12 题，选关键词→选释义→评分）
- 内容量：4 个互动工具 + 7 道每日谜题 + 12 道破译题；闪卡/侦探为确定性动态出题
- 题型：拼装 / 少选一（闪卡） / 找目标（侦探） / 多步破译
- 数据来源：`hexagrams-data.js`（`BAGUA` 8 + `HEXAGRAMS` 64）、`hexagramTools.js`、`playEngine.js`
- 定位结论：**偏「小游戏/工具箱」，不是「实践工作台」**

### 实验（当前 = `Lab.jsx` + `experiments.js` + `experimentReport.js`）
- 当前功能：13 个「现实记录」实验（`exp-001`~`exp-013`，3~7 天，0–10 滑杆 metrics + 文本 noteFields）→ 趋势报告 → 复盘单选
- 内容量：13 个实验
- 题型：滑杆记录 / 文本 / 假设预设单选 / 复盘单选
- 数据来源：`experiments.js` 纯手工静态
- 定位结论：**「自我观察日记」模型，不是「假设→样本→反例」实验模型**

### 怀疑（当前 = `DoubtLab.jsx` + `doubtLab.js`）
- 当前功能：5 类认知偏差（巴纳姆/确认偏误/选择性记忆/事后解释/基准概率）+ 6 道题（`doubt-001`~`006`），`best/mild/overreach` 三档判分
- 内容量：6 题
- 题型：单选 + 反馈说明
- 数据来源：`doubtLab.js` 纯手工静态
- 定位结论：**孤岛——不写 state、不连 mastery/Agent、无持久化**

### 已有资产盘点（全部可复用，禁止重造）
| 资产 | 数量 | 位置 |
|---|---|---|
| 64 卦数据 | 64 | `data/iching/hexagrams-data.js` |
| 384 爻数据 | 384 | `data/iching/yaoText.js` + `hexagramProfile.js` ALL_YAO |
| 术语 | 205 | `data/iching/termData.js`（8 层） |
| 案例 | 135 | `cases.js` 42 + `cases-v3.js` 12 + `cases-iching-1..10.js` 81 |
| 经典片段 | 83 | `classic-passages.js`（系辞 14 + 文言 5 + 大象动态 64） |
| 课程知识节点 | 173 | `data/curriculum/*`（19 章节） |
| 错误类型 | 10（E01–E10） | `agent/errors.js` |
| 词典词条 | 68 | `data/dictionary.js` |
| 解释传统 | 6（汉易/王弼/唐正义/程颐/朱熹/邵雍） | `hexagramProfile.js` TRADITION_REF |
| 十翼引用 | 7（彖/象/系辞/文言/说卦/序卦/杂卦） | `hexagramProfile.js` TEN_WINGS_REF |
| mastery 能力维度 | 8 维 + L0–L6 | `agent/masteryEngine.js` |
| Agent 引擎 | runAgent + recommend + adaptiveTraining + insight + fingerprint | `agent/*` |

### 关键可复用引擎（函数签名）
- `analyzeYao(lines, index)` → 阴阳/爻位/得位/得中/中正/承/乘/比/应（九项确定性推导，`hexagramProfile.js`）
- `getHexagramProfile(seqOrNameOrLines)` → 完整卦档案（6 爻 + 原典 + 经典/案例关联）
- `getYao(seq, positionIndex)` → 单爻档案（结构 + 爻辞 + 经典/案例关联）
- `getHexagram` / `hexagramRelations` / `lineLabel`（`hexagramTools.js`）
- `casesForHexagram(seq)` / `casesForYao(seq, index)`（`caseGraph.js`）
- `classicPassagesForHexagram` / `daXiangPassage`（`classic-passages.js`）
- `computeMasteryProfile(state)` / `runAgent(state)` / `recommend(state)` / `recordError` / `topErrors`
- `isUnlocked` / `nextLessonCandidate` / `reviewQueue`（`knowledgeMastery.js`）

---

## 二、复用 / 扩展 / 重构清单

### 直接复用（不改）
64 卦、384 爻、术语、135 案例、83 经典、173 课程节点、10 错误类型、`analyzeYao`、`masteryEngine`（8 维）、`runAgent`/`recommend`、`caseGraph`、`classic-passages`、错误博物馆。

### 需要扩展（新增，不破坏现有）
1. `ExperimentProfile` 数据结构 + 实验库（30+ 实验，分 5 类），`samplePool` 直接引用 384 爻 / 64 卦 / 案例 / 经典，**deterministic seed 抽样**。
2. 统一 `LearningEvidence` 记录层（`type: workshop|experiment|doubt` + `action` + `target`），单一 reducer 入口。
3. `实验档案` / `怀疑档案` 派生（基于真实行为，非随机）。
4. Agent 新增输入：`workshopEvidence` / `experimentHistory` / `doubtHistory` / `counterexampleHistory` / `hypothesisRevision`。

### 需要重构（保留能力，改模型）
1. 易工坊：`IChingPlay.jsx` 的 4 个小游戏 → 6 个真正的工作台（卦象拆解 / 384 爻研习 / 经典研读 / 解释构建 / 案例实践 / 我的研究），首页动态读状态。
2. 实验：`Lab.jsx` 的「7 天记录」→「假设→样本→反例→修改假设」科学实验模型（保留旧实验入口或迁移为「观察型实验」）。
3. 怀疑：`DoubtLab.jsx` 的孤岛 6 题 → 6 模块（找漏洞 / 证据审查 / 反例猎人 / 解释拆弹 / 传统冲突 / 怀疑自己），并写 state、连 mastery/Agent。

---

## 三、数据关系图（R3 目标态）

```
                     ┌─────────────────────────────────────────┐
                     │           统一 LearningEvidence          │
                     │  type:[workshop|experiment|doubt]        │
                     │  action:[observe|analyze|compare|         │
                     │           hypothesis|counterexample|      │
                     │           evidence|reflection|independent]│
                     │  target:[term|hexagram|yao|classic|       │
                     │           tradition|case]                 │
                     └──────────────────┬──────────────────────┘
                                        │ feed
        ┌───────────────┬───────────────┼───────────────┬───────────────┐
        ▼               ▼               ▼               ▼               ▼
  易工坊(做)        实验(验)         怀疑(疑)         Agent(荐)      Mastery(量)
  卦象/爻/经典/     ExperimentProfile DoubtTask        runAgent       8维能力档案
  解释/案例/研究     samplePool→       →反例/证据审查  →解释推荐       L0-L6
        │             384爻/64卦/案例/经典             (带why)
        ▼                                                │
   复用 analyzeYao / getHexagramProfile / caseGraph / classic-passages
        └──────────────── 底层知识库（不可重造）──────────────────────┘
```

---

## 四、分阶段实施计划

### Phase 0：数据与统一证据层（地基，先做）
- 新建 `ExperimentProfile` 数据结构 + `data/experimentsV3.js`（30 正式 + 10 高级，5 类，seed 抽样）
- 新建 `data/doubtTasks.js`（90+ 任务，6 类别）
- 新建 `agent/learningEvidence.js`（统一记录 + 派生档案）+ reducer 扩展
- 测试：学习证据测试 + 数据结构测试

### Phase 1：易工坊 6 工作台
- 工作台首页（动态读状态 + 「今天想做什么」）
- 卦象拆解工作台（6 阶段，先思考再揭示）
- 384 爻研习台（5 任务）
- 经典研读台 + 解释构建器（解释链可视化）
- 案例实践（5 模式 + 分析链可视化）
- 我的研究档案

### Phase 2：实验板块
- 实验首页 + 实验模板（①问题②假设③预测④样本⑤观察⑥证据⑦反例⑧修改⑨结论⑩反思）
- 实验设计器（deterministic 模板）
- 实验记录 / 实验档案 / 进阶等级（L0–L6）

### Phase 3：怀疑板块
- 怀疑室首页 + 6 模块（找漏洞 / 证据审查 / 反例猎人 / 解释拆弹 / 传统冲突 / 怀疑自己）
- 怀疑档案 + 怀疑积分（行为记录，非游戏化）

### Phase 4：Agent 联动 + 综合挑战 + 研究人格 + 三板块互跳
- Agent 读取 workshopEvidence/experimentHistory/doubtHistory，推荐带原因
- 每日实践推荐（deterministic）
- 研究人格画像（长期行为统计，不给好坏排名）
- 综合挑战（Lv1–Lv10）

### Phase 5：测试与验收
- 新增 200+ 测试（易工坊 40+ / 实验 50+ / 怀疑 50+ / 学习证据 20+ / Agent 联动 20+ / 持久化 20+）
- 全量回归（320 + 新增）
- 5 场景真实体验测试 + 验收报告

---

## 五、验收标准映射（R3 最终验收）
见 `docs/R3-final-acceptance.md`（实施完成后输出）。