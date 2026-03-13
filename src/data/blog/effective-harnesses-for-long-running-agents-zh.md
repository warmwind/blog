---
title: Effective harnesses for long-running agents（中文翻译）
pubDatetime: 2026-03-13T23:05:00+08:00
description: Anthropic Engineering 文章《Effective harnesses for long-running agents》中文翻译（含原文与原图引用）。
slug: effective-harnesses-for-long-running-agents-zh
---

原文：Anthropic Engineering — *Effective harnesses for long-running agents*  
链接：<https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents>

原图链接：

- 封面图：<https://cdn.sanity.io/images/4zrzovbb/website/32ea71b3e8e87a990f6df4c4def2b9e52815e977-2400x1260.png>
- 文中动图：<https://cdn.sanity.io/images/4zrzovbb/website/f94c2257964fb2d623f1e81f874977ebfc0986bc-1920x1080.gif>

---

随着 AI agent 能力增强，开发者越来越多地让它们承担复杂任务，这些任务可能持续数小时甚至数天。不过，让 agent 在多个 context window 之间持续、稳定地推进工作，仍是一个开放问题。

长时运行 agent 的核心挑战在于：它们必须在离散的 session 中工作，而每个新 session 开始时都没有之前的记忆。可以把它想象成一个软件项目由轮班工程师接力完成，但每位接班工程师都不知道上一个班次发生了什么。由于 context window 有限，而多数复杂项目无法在一个 window 内完成，agent 需要一种跨 coding session 衔接的方法。

我们开发了一个两部分方案，使 Claude Agent SDK 能在多个 context window 上有效工作：

- 初始化 agent（initializer agent）：首次运行时搭建环境。
- 编码 agent（coding agent）：后续每个 session 进行增量推进，并为下一次 session 留下清晰工件。

配套代码见 quickstart：<https://github.com/anthropics/claude-quickstarts/tree/main/autonomous-coding>

## 长时运行 agent 问题

Claude Agent SDK 是一个通用且强大的 agent harness，既擅长编码，也适用于需要工具调用来收集上下文、规划和执行的任务。它有上下文管理能力（如 compaction），能让 agent 在不耗尽 context window 的情况下继续任务。从理论上讲，这应该允许 agent 无限期持续有效工作。

但 compaction 本身并不足够。即使是前沿编码模型（如 Opus 4.5）在 Claude Agent SDK 上跨多个 context window 循环运行，如果只给高层提示词（如“构建 claude.ai 的 clone”），也难以产出生产级 Web 应用。

失败主要表现为两类：

第一，agent 往往一次做太多，试图“一把做完”。这会导致模型在实现中途耗尽上下文，下一 session 接手时面对的是“半完成且缺少文档”的状态。接手 session 只能猜测此前发生了什么，并花大量时间让基础应用重新可用。即便有 compaction，也不总能把足够清晰的交接信息传给下一次 agent。

第二，项目后期常出现“过早完成判定”。当已有部分功能后，后续 agent 看到已有进展，就宣告任务完成。

因此问题可分解为两部分：

1. 首次运行需要建立初始环境，为后续按步骤、按功能推进打基础。
2. 每次 session 都要做增量推进，同时在结束时留下“干净状态”。

“干净状态”指的是接近可合并到主分支的状态：没有重大 bug、代码有序且有文档，下一位开发者可以直接开始新功能，而无需先清理无关问题。

我们在内部实验中使用了两段式方案：

- 初始化 agent：首个 session 使用专门 prompt，要求模型创建 `init.sh`、`claude-progress.txt`（记录历次 session 进展）以及初始 git commit（记录新增文件）。
- 编码 agent：后续每个 session 都做增量推进并留下结构化更新。¹

关键洞察是：在新 context window 下让 agent 快速理解当前状态。我们通过 `claude-progress.txt` + git 历史来实现。这个做法的灵感来自高效软件工程师的日常实践。

## 环境管理

在更新后的 Claude 4 提示词指南中，我们分享了多 context window 工作流最佳实践，其中包括“首个 context window 使用不同 prompt”的 harness 结构。这个“不同 prompt”要求初始化 agent 搭建后续 coding agent 所需的全部上下文环境。下面是关键组件。

### 功能清单（Feature list）

为了解决“一次做太多”或“过早判定完成”，我们让初始化 agent 基于用户初始需求，写出全面的功能需求文件。在 claude.ai clone 示例中，这个清单包含 200+ 个功能点，例如“用户可以打开新对话、输入问题、回车并看到 AI 回复”。这些功能初始都标记为失败（failing），让后续 coding agent 对“完整功能”有清晰边界。

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

我们要求 coding agent 只能通过修改 `passes` 字段来更新这个文件，并使用强措辞（例如“删除或修改测试不可接受，否则会导致功能缺失或 bug”）。实验后我们选择 JSON，因为模型相较 Markdown 更不容易不当修改或覆盖 JSON 文件。

### 增量推进（Incremental progress）

有了初始环境脚手架后，我们让 coding agent 每次只做一个功能。这个增量方式对抑制“一次做太多”非常关键。

即便是增量推进，也必须要求模型在改动后留下“干净状态”。实践中最有效的方法是要求模型：

- 用描述清晰的提交信息提交 git commit；
- 在进度文件中写本次总结。

这样模型可以用 git 回滚坏改动并恢复到可工作状态，也避免后续 agent 花时间猜前情、反复修基础。

### 测试（Testing）

我们观察到的另一个主要失败模式是：Claude 在缺乏充分测试时就把功能标记为完成。

若不显式提示，Claude 往往会做代码修改，也会跑单元测试或用 curl 测开发服务，但未必能判断功能是否真正端到端可用。

在 Web 应用场景中，一旦明确要求使用浏览器自动化工具、并按真实用户方式做端到端验证，Claude 在功能验收上表现明显更好。

文中配图为 Claude 通过 Puppeteer MCP server 测试 claude.ai clone 时的截图/动图。

提供这类测试工具后，agent 能识别并修复很多“仅看代码看不出来”的问题。

仍有局限：例如 Claude 视觉能力和浏览器自动化工具能力边界，会导致某些 bug 难以识别。文中提到，Puppeteer MCP 下 Claude 无法看到浏览器原生 alert modal，因此依赖这类 modal 的功能会更容易出错。

## 快速进入状态（Getting up to speed）

在上述机制下，每个 coding agent session 都先执行一组步骤：

- 运行 `pwd`，确认当前目录（只能编辑该目录文件）。
- 读取 git log 和 progress 文件，了解最近工作。
- 读取 feature list，选择最高优先级且未完成的功能。

这种方式还能节省 token（不必每轮重新摸索测试方法）。初始化 agent 还会写 `init.sh`，用于启动开发服务并在实现新功能前先跑基础 E2E 测试。

在 claude.ai clone 案例中，这意味着 agent 每轮都会：

1. 启本地开发服务；
2. 用 Puppeteer MCP 新建对话、发送消息、接收回复；
3. 若发现基础功能已损坏，先修复，再做新功能。

如果直接开始新功能，通常会让问题更糟。

文中给出了一段典型 session 起始流程（摘要）：

- 先获取当前项目状态（目录、进度、功能清单、近期提交）
- 启动服务
- 做基础验证
- 再进入下一功能开发

## 四类失败模式与解决方案（原文表格）

1. **过早宣布项目完成**  
   - 初始化 agent：建立结构化 feature list（JSON）  
   - 编码 agent：每轮先读 feature list，选一个未完成功能推进

2. **会话结束时留下 bug 或未记录进展**  
   - 初始化 agent：建立初始 git 仓库与进度文件  
   - 编码 agent：开局读进度和 git，跑基础测试；收尾写 commit 和进度更新

3. **功能过早标为完成**  
   - 初始化 agent：建立 feature list  
   - 编码 agent：自验证，只有充分测试后才标记 passing

4. **每轮都花时间摸索怎么运行应用**  
   - 初始化 agent：写 `init.sh`  
   - 编码 agent：开局直接读取并执行 `init.sh`

## 未来工作

这项研究展示了长时运行 harness 的一种有效方案，使模型能跨多个 context window 做增量推进。但仍有开放问题。

最关键的是：跨上下文时，单一通用 coding agent 是否最佳？还是多 agent 架构（如测试 agent、QA agent、代码清理 agent）能做得更好？

此外，这个 demo 主要针对全栈 Web 应用开发。下一步方向是将这些结论推广到其他领域，如科研或金融建模中的长时 agent 任务。

## 致谢（原文）

作者 Justin Young。感谢 David Hershey、Prithvi Rajasakeran、Jeremy Hadfield、Naia Bouscal、Michael Tingley、Jesse Mu、Jake Eaton、Marius Buleandara、Maggie Vo、Pedram Navid、Nadine Yasser、Alex Notov 等贡献者。

该工作来自 Anthropic 多个团队协作，特别是 code RL 与 Claude Code 团队。欢迎有兴趣的候选人申请：<http://anthropic.com/careers>

## 脚注

1. 文中将 initializer 与 coding 称为“不同 agent”，仅因初始用户 prompt 不同。其 system prompt、工具集与整体 harness 其余部分保持一致。

---

## 引用

- Anthropic Engineering, *Effective harnesses for long-running agents*  
  <https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents>
- Claude Agent SDK  
  <https://platform.claude.com/docs/en/agent-sdk/overview>
- Claude 4 多 context window 最佳实践  
  <https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices#multi-context-window-workflows>
- Autonomous coding quickstart  
  <https://github.com/anthropics/claude-quickstarts/tree/main/autonomous-coding>
