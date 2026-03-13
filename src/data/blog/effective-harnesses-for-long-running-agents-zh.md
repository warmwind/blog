---
title: 长时运行 Agent 的有效 Harness（译）
pubDatetime: 2026-03-13T23:05:00+08:00
description: Anthropic Engineering《Effective harnesses for long-running agents》中文翻译与要点整理，保留原图链接与原文引用。
slug: effective-harnesses-for-long-running-agents-zh
---

> 原文：Anthropic Engineering — *Effective harnesses for long-running agents*  
> 链接：<https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents>

## 原图（保留原始链接）

- 封面图：  
  <https://cdn.sanity.io/images/4zrzovbb/website/32ea71b3e8e87a990f6df4c4def2b9e52815e977-2400x1260.png>
- 文中演示动图（Claude 测试 claude.ai clone）：  
  <https://cdn.sanity.io/images/4zrzovbb/website/f94c2257964fb2d623f1e81f874977ebfc0986bc-1920x1080.gif>

---

随着 AI Agent 能力增强，开发者越来越多地让它们承担跨数小时甚至数天的复杂任务。但一个开放问题是：**如何让 Agent 在多个 context window 之间保持稳定、持续推进**。

长时运行 Agent 的核心挑战在于：它以离散 session 执行，而每个新 session 默认“不记得”之前发生过什么。可以把它想象成一个轮班的软件团队：每位新工程师接班时都没有上个班次的记忆。

由于 context window 有上限，多数复杂项目又无法在单一窗口完成，Agent 需要一种跨 session 的“工作交接机制”。

Anthropic 在 Claude Agent SDK 上给出的方案是两段式：

1. **Initializer agent**：首次运行时初始化环境
2. **Coding agent**：后续每个 session 只做增量推进，并留下结构化工件供下一次接班

配套代码见 quickstart：<https://github.com/anthropics/claude-quickstarts/tree/main/autonomous-coding>

---

## 一、长时运行 Agent 的问题在哪里

Claude Agent SDK 本身已经具备上下文管理能力（例如 compaction）。理论上它可以长时间工作；但实测中仅靠 compaction 仍不够。

文中案例：即便是前沿 coding model，给一个高层提示词如“做一个 claude.ai clone”，多窗口循环后仍会出现典型失败。

### 失败模式 1：一次想做太多（one-shot）

模型会倾向于在单 session 中完成过多内容，结果在实现中途耗尽上下文，留下半成品和不完整状态。下一 session 只能“猜”之前做了什么，先花大量时间恢复基础可运行状态。

### 失败模式 2：过早宣布完成

当项目已做出一些可见进展后，后续 agent 可能“看到像样子了”就宣布 done，实际仍有大量功能未达成。

这将问题拆成两部分：

1. 首轮先搭好能支持长期迭代的环境底座
2. 后续每轮必须增量推进，并在结束时把环境收敛到“干净状态”

这里的“干净状态”指：代码可读、主要 bug 已收敛、文档/进度可追踪，下一轮无需先做无关清理。

---

## 二、两段式方案：Initializer + Coding

Anthropic 内部实验采用：

- **Initializer agent（首轮专用）**：生成 `init.sh`、`claude-progress.txt`、初始 git commit
- **Coding agent（后续轮次）**：每轮做增量特性，完成后写入结构化更新

关键洞察是：让每个新窗口的 agent 能在最短时间“读懂现场”。

实现上依赖两条主线：

1. `claude-progress.txt`（人类可读的进度交接）
2. git 历史（机器可验证的代码状态）

这本质是把优秀工程团队的交接纪律显式化。

---

## 三、环境管理的关键组件

### 1）Feature list：防 one-shot、防早停

为防止“全做一把梭”与“提前完工”，initializer 会把原始需求展开成结构化 feature 列表（JSON），并默认全部标记为未通过（`passes=false`）。

示例（原文）：

```json
{
  "category": "functional",
  "description": "New chat button creates a fresh conversation",
  "steps": [
    "Navigate to main interface",
    "Click the 'New Chat' button",
    "Verify a new conversation is created",
    "Check that chat area shows welcome state",
    "Verify conversation appears in sidebar"
  ],
  "passes": false
}
```

文中强调：后续 coding agent 应只修改 `passes` 状态，不应随意删改测试定义（以免“通过删除标准”制造假完成）。

他们实验里发现 JSON 比 Markdown 更稳：模型更不容易误改结构或整段覆盖。

### 2）Incremental progress：每轮只推进一个 feature

在有 feature list 的前提下，后续 agent 被明确要求“一次只做一个 feature”。这是抑制“做太多导致崩盘”的关键。

同时，每次改动后都要求：

- 形成 git commit（描述清晰）
- 更新 progress 文件

这样可直接利用 git 回退坏改动，并让下一轮无需猜测前情。

### 3）Testing：防“以为做完”

另一个高频失败是“功能被标记完成，但端到端不可用”。

若不显式约束，模型常见行为是：

- 做了代码改动
- 跑了单元测试或 curl
- 但未完成真实用户路径验证

在 Web 场景中，要求模型使用浏览器自动化、按“真人操作路径”做 E2E 验证后，表现显著提升。模型能发现很多“只看代码看不出来”的 bug。

原文也提到边界：受限于视觉能力和自动化工具本身，某些 UI 缺陷仍可能漏掉（例如某些浏览器原生 modal 交互）。

---

## 四、每轮 session 的标准上手步骤

在上述环境下，每个 coding agent session 都先做固定动作：

1. `pwd` 确认目录
2. 读 git log 和 progress 文件，理解最近改动
3. 读 feature list，选最高优先级未完成项
4. 运行 `init.sh` 启动开发环境
5. 先做一次基础端到端健康检查
6. 再进入新 feature 实现

这样做有两类收益：

- **效率**：减少每轮重新摸索“怎么跑起来”的 token 消耗
- **稳定性**：先验证基本面，再加新功能，避免“坏上加坏”

---

## 五、原文总结的 4 类典型失败与对应策略

1. **过早宣布项目完成**  
   - 策略：结构化 feature list + 每轮只选一个未完成项

2. **会话结束后环境脏乱、不可接班**  
   - 策略：会话开始先读 progress/git 并做健康检查；会话结束必须 commit + progress update

3. **功能未充分测试就标记通过**  
   - 策略：强制自验证，只有通过细致测试后才标记 passing

4. **新 session 先花时间搞清怎么启动项目**  
   - 策略：由 initializer 生成 `init.sh`，后续统一入口

---

## 六、未来方向（原文）

文中明确指出仍有开放问题：

- 单一通用 coding agent 是否跨上下文最优？
- 多 agent 架构（测试 agent、QA agent、cleanup agent）是否更优？
- 这些方法能否迁移到 Web 开发之外（如科研、金融建模）？

---

## 译者注

这篇文章最值得借鉴的点，不是“让模型更聪明”，而是把软件工程中本来就有效的纪律（交接、版本管理、测试闭环）显式写入 harness。

换句话说，它把“长上下文难题”转化成“工程交接系统设计”问题。

在生产环境里，这比单纯调 prompt 更稳。

---

## 参考

- Anthropic Engineering, *Effective harnesses for long-running agents*  
  <https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents>
- Claude Agent SDK Overview  
  <https://platform.claude.com/docs/en/agent-sdk/overview>
- Claude multi-context window best practices  
  <https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices#multi-context-window-workflows>
- Anthropic quickstart (autonomous coding)  
  <https://github.com/anthropics/claude-quickstarts/tree/main/autonomous-coding>
