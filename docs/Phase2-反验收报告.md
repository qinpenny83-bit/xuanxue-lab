# Phase 2 反验收报告

> 目的：证明 Phase 2 不是「UI + 数据结构」堆砌，而是真正形成 Evidence → Learning State → Experiment → Revision → Agent 闭环。
> 本轮只验证、只报告，不修改任何业务逻辑。

---

## 总判定

**核心 8 项验收：6 PASS / 2 FAIL**

| # | 项目 | 判定 |
|---|------|------|
| 1 | Evidence-first | ❌ FAIL（引擎层通过，用户可见层未接入） |
| 2 | Mastery | ❌ FAIL（view×100 防刷通过，但真实行为不驱动 masterProfile） |
| 3 | Experiment → Evidence | ✅ PASS |
| 4 | BeliefRevision | ✅ PASS |
| 5 | Agent 推荐变化 | ✅ PASS（方向不同，但有文本误报缺陷） |
| 6 | 三个真实场景 | ✅ PASS（三信号全部触发） |
| 7 | 防刷 | ✅ PASS |
| 8 | 25 个实验抽检 | ✅ PASS |

UI 体验与 4 个次要缺陷单列，未计入 PASS/FAIL。

---

## 1. Evidence-first —— FAIL

**引擎层已通过**：构造「旧 fingerprint 显示证据能力强 + 最新 Evidence 为 3 次 construct 无 evidence」的冲突场景，`recommendByEvidence` 与 `runAgent().evidenceRecommendation` 均返回 `primary = WEAK_EVIDENCE`，主事实源确为 Evidence：

- 使用到的 Evidence：3 条 `construct`（`trace.evidenceIds` 指向它们）
- 使用的 reason code：`WEAK_EVIDENCE, NO_COUNTEREXAMPLE, TRADITION_GAP, UNDERUSED_CLASSIC, READY_FOR_INDEPENDENCE`
- 推荐原因：最近 3 次都已形成结论，但没有一次主动补充证据

**但用户可见层 FAIL**：`runAgent` 同时输出两条互相矛盾的推荐——
- `evidenceRecommendation.primary = WEAK_EVIDENCE`（证据优先）
- `nextAction.type = lesson, title = "阴阳不是好坏"`（旧 fingerprint 路径）

而首页 `Home.jsx:48` 与成长页 `Growth.jsx:413` 实际渲染的是 `agent.nextAction`（旧路径），`agent.evidenceRecommendation` / `agent.unifiedState` **计算了但从未在任何页面展示**。也就是说，Evidence-first 推荐引擎建好了、单测也过了，但用户看到的「下一步」仍是旧的 fingerprint 路径，证据优先在用户层面并未生效。

---

## 2. Mastery —— FAIL

- **A（view×100）通过**：连开同一卦 100 次，`computeMasteryProfile = L0`，`evidenceMasteryContribution = {}`，无任何强项。
- **B（真实行为）FAIL**：完成 `analyze / evidence / counterexample / revise / reflect` 后，产生的是 `mastery.contribution`（一套新分数：reasoning 22、evidence 12、counterexample 12、uncertainty 12），而 **`masteryProfile.level` 仍是 L0、`overall = 0`，未随行为变化**。
- **C（重复错误）通过**：重复 E07 只进错误博物馆（`errorPatterns`），不转换成能力（`profile.level = L0`，contribution 封顶 ≤ 60）。

**根因**：系统中存在两套彼此不合并的能力体系——
1. `computeMasteryProfile(caseAttempts)`：L0–L6 等级，只在 `COMPLETE_CASE` / `RECORD_MASTER_CHALLENGE` 时更新；
2. `evidenceMasteryContribution(evidence)`：实验/工作台行为产生的「调节分」。

证据行为永远不改写 `masteryProfile`（等级/雷达/READY_FOR_INDEPENDENCE 都基于它），只改 `contribution`。因此一个只做实验、不做案例的用户，Evidence 分数再高，等级也永远停在 L0——「按现有 masteryEngine 规则产生变化」这一条不成立。

---

## 3. Experiment → Evidence —— PASS

完整跑「得位一定好吗？」十步流，9 个产生动作的步骤全部写入真实 Evidence（`hypothesis, predict, sample, observe, evidence, counterexample, revise, construct(=conclusion), reflect`）。校验通过：

- 每步 targetId 正确 = `exp-s-dewei`
- context 保存用户输入（conclusion 的 context = 用户结论原文）
- reducer 真实闭环：`RECORD_EVIDENCE ×9 + RECORD_EXPERIMENT_RUN` 后，`store.evidence(experiment)=9`、`experimentRuns=1`、`beliefRevisions=1`
- 可按 targetId 从 store 找回全部 9 条（`filterEvidence` 返回 9 条）

---

## 4. BeliefRevision —— PASS

一条真实记录结构（7 字段全部真实存在，`revisedClaim` 来自用户 conclusion 输入，非系统生成）：

```json
{
  "originalClaim": "得位通常意味着更好的判断",
  "originalConfidence": 80,
  "counterEvidence": ["乾卦某爻得位却被相邻阴爻所乘", "观察到得位且爻辞为凶的一爻"],
  "revisedClaim": "得位只提供一类位置信息，不能单独推出吉凶",
  "revisedConfidence": 45,
  "reason": "原来的假设太绝对了",
  "timestamp": 1600000000500
}
```

---

## 5. Agent 推荐变化 —— PASS（含缺陷）

- **用户 A**（10× construct，无 evidence/counterexample）→ `primary = WEAK_EVIDENCE`
- **用户 B**（大量 evidence/counterexample/revise + beliefRevision）→ items 含正面 `BELIEF_REVISION`，`WEAK_EVIDENCE` 消失

两者方向明显不同，都不是「继续学习基础知识」。

**但存在缺陷（见 §7/§9）**：用户 B 的 `primary` 实际是 `LOW_UNCERTAINTY` 而非 `BELIEF_REVISION`，因为 revise 文本「原来的假设**太绝对**了」被关键字误判为「绝对化措辞」，而 `LOW_UNCERTAINTY` 优先级 8 高于正面 `BELIEF_REVISION` 的优先级 5。

---

## 6. 三个真实场景

### 场景 1 · 证据不足 → PASS
```
construct ×3（无 evidence）
→ Evidence：3 条 construct
→ LearningState：WEAK_EVIDENCE.active（meta: constructN=3, evidenceN=0, "高信心但无依据"）
→ ReasonCode：WEAK_EVIDENCE
→ Recommendation：做一次「证据审查」实验 → 命中实验《一条证据够不够？》
```

### 场景 2 · 反例与观点修正 → PASS
```
提出假设 → 抽样 → 找反例 → 修改结论（+ beliefRevision）
→ NO_COUNTEREXAMPLE 消失（counterN>0）
→ BELIEF_REVISION.active=true（正面信号）
→ 系统识别「用户已根据证据修正」：BELIEF_REVISION 进入推荐 items
```
（注：primary 被 LOW_UNCERTAINTY 抢占，见 §9 缺陷②）

### 场景 3 · 重复错误 → PASS
```
E07 ×3
→ ErrorEvidence + errorPatterns{E07:3}
→ LearningState：REPEATED_ERROR.active
→ ReasonCode：REPEATED_ERROR（trace.errorCodes=[E07]）
→ Recommendation：回到 E07 做针对性训练
```

---

## 7. 防刷 —— PASS

- Test1 同卦 view×100：`contribution = {}`、无强项 ✅
- Test2 同对象 view×4：均为 `PASSIVE_VIEW`，无贡献 ✅
- Test3 重复相同 construct×50：去重后 `uniqueTargets=1`、`score=12` ✅
- Test4 重复同实验×5：Evidence 条数 10（追加，属事实记录），但 `synthesis.uniqueTargets=1`、`score≤12` 未膨胀 ✅

结论：**机械点击无法成为高手**。cap=60、同对象去重、递减收益同时生效。

---

## 8. 25 个实验抽检 —— PASS

30 个实验（结构 8 / 文本 6 / 传统 6 / 认知 5 / 证据 5）逐项检查：

- `question / hypothesis / samplePool / samplingMethod(=deterministic-sample) / steps(10步) / relatedTerms / reflectionQuestions` 全部完整
- 每个实验都能确定性抽样出真实实体，同 seed 两次结果一致（可复现）
- 异常实验：**无**

实验要求的是「提出假设 → 预测 → 抽样观察 → 找反例 → 修正」的开放流程，**不是换皮选择题**；但「验证」依赖用户自述、无内容质量门槛（见 §9 缺陷③，属体验/防刷层面的「换皮填空题」风险）。

---

## 9. UI 人工体验

**做得好的 3 处**
1. 十步流每次只显示一步，有「第 N/10 步」+ 进度条 + 每步标题/提示，节奏清晰，用户始终知道自己在哪一步、要做什么。
2. 样本用真实数据内联展示（爻位结构/得位/中正/应与爻辞原文），看到的不是抽象描述，而是可对照的真实材料。
3. 反例步给「需修改/维持/不确定」三选一，完成后「观点变化记录」明确对照 originalClaim → revisedClaim 并列出反例，档案页以「假设 → 反例 → 结论」回顾，留下了真实属于自己的研究记录。

**最明显的 3 个问题**
1. 抽样本（sample）步是一键「已查看样本，继续→」，系统自动代填；预测与观察之间也缺少「为什么先写预测再看样本」的解释。整体是「按步骤填表」的驱动感强于「我在推理」。
2. observe / evidence / counterexample 三步都是「对着同一批样本写文字」，observe 与 evidence 高度重叠，10 步偏长，中途容易产生重复、无聊感。
3. 假设被预填充（seededHypothesis），且 evidence/counterexample 仅要求 ≥1 字符即判「有效」，可填「无」或乱写跳过，削弱了「真的在验证假设」的力度——存在「换皮填空题」而非真实验证的风险。

---

## 10. 测试

- 反验收前基线：536/536 通过
- 新增反验收测试：**21 个**（`tests/r3-phase2-reverse-acceptance.test.js`，其中 5 个为「记录型」测试，故意按当前行为断言以便固化缺陷证据，未修业务逻辑）
- 当前全量：**557 / 557 通过**，生产依赖关系未受影响

---

## 需下一阶段解决的问题清单

| # | 问题 | 严重程度 | 触发方式 | 涉及文件 | 建议解决方式 |
|---|------|---------|---------|---------|------------|
| ① | Evidence-first 推荐未接入用户界面，用户看到的「下一步」仍是旧 fingerprint 路径（nextAction） | 高 | 首页/成长页查看推荐 | `src/agent/localAgentEngine.js`、`src/pages/Home.jsx:48`、`src/pages/Growth.jsx:413` | 让首页/成长页优先渲染 `agent.evidenceRecommendation`（或合成进 `nextAction`），保留旧路径作为兜底/兼容 |
| ② | 能力分裂：证据行为只改 `mastery.contribution`，不改 `masteryProfile`（L0–L6 等级/雷达/READY_FOR_INDEPENDENCE 均读 masteryProfile） | 高 | 只做实验/工作台、不做案例的用户等级永远 L0 | `src/agent/unifiedLearningState.js`、`src/agent/masteryEngine.js`、`src/store/reducer.js` | 定义 Evidence→Mastery 的确定性合并规则，把 contribution 回填进 masteryProfile 的对应维度（保持封顶/去重），统一为单一能力事实源 |
| ③ | TextSignals 关键字误报：「太绝对了」（批评绝对化）被判定为「绝对化措辞」，且 LOW_UNCERTAINTY(优先级8) 压过正面 BELIEF_REVISION(优先级5) | 中 | 用户 revise 文本含「绝对/一定」等字样且无 reflect 动作时 | `src/lib/textSignals.js`、`src/agent/evidenceRecommendation.js`、`src/agent/unifiedLearningState.js` | 对「否定绝对化」的语式做排除（如"太绝对/不那么绝对"）；或把正面确认类 reason code 的优先级调到干预型之上 |
| ④ | Evidence ID 唯一性缺陷：id = `ev-<source>-<timestamp>-`，不含 action、`__seq` 恒为空，同源同毫秒不同动作会撞 ID（已实测 `trace.evidenceIds` 出现重复 ID） | 低 | 同一来源同毫秒写入多条 Evidence | `src/agent/learningEvidence.js` | id 加入 action/自增序号，保证每次 createEvidence 唯一；同时校验推荐 trace 的 evidenceIds 去重 |
| ⑤ | 卦类实验样本 ID 含 `undefined`（如 `4-undefined`）：hexagram 描述符缺 `id` 字段，startExperiment 拼出 `N-undefined` | 低 | 打开任何卦类(text/tradition/cognitive-evidence)实验 | `src/data/experiments-v3.js`（resolveDescriptor hexagram 分支）、`src/agent/experimentEngine.js` | hexagram 描述符补 `id: seq`，或 startExperiment 对 hexagram 用 `s.seq` 作为 id 而不再拼 `${seq}-${pos}` |

---

## 最终回答

**这个系统目前是「半成品学习 Agent」**：闭环的「后端」已经真正打通——Evidence 真实落库、十步实验真实产出 BeliefRevision、Evidence→LearningState→ReasonCode→Recommendation 的规则链全部确定性地工作，防刷也确实有效。但它还没有成为一个「以证据为准的学习 Agent」，因为：

1. 用户界面实际展示的推荐仍是旧 fingerprint 路径，Evidence-first 并未真正接管用户看到的那条「下一步」；
2. 证据行为没有回填到唯一的能力等级（masteryProfile），导致「做了很多实验的人」与「只做案例的人」被两套分数分别评定，闭环在「能力」这一环上断裂。

这两点是下一阶段应优先修复的**结构性缺口**，其余（文本误报、ID 唯一性、undef string id）属于修复成本较低的收尾项。