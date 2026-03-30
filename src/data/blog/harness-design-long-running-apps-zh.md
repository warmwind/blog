---
title: "面向长时间运行应用开发的 Harness 设计"
pubDatetime: 2026-03-25T20:00:00+08:00
description: "Anthropic Engineering 文章《Harness design for long-running application development》中文翻译（含原文引用）。"
slug: harness-design-long-running-apps-zh
originalTitle: "Harness design for long-running application development"
originalUrl: https://www.anthropic.com/engineering/harness-design-long-running-apps
---

> 原文标题：Harness design for long-running application development
> 原文链接：https://www.anthropic.com/engineering/harness-design-long-running-apps

# 面向长时间运行应用开发的 Harness 设计

*作者：Prithvi Rajasekaran，Anthropic Labs 团队成员*

我的工作涉及两个相互关联的挑战：让 Claude 生成高质量的前端设计，以及自主构建完整的应用程序。这建立在我们此前围绕[前端设计 skill](https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md) 和[长时间运行的编码 agent harness](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) 所做的早期工作之上——尽管两者最初都遇到了性能瓶颈。

突破性进展来自于将"新颖的 AI 工程方法"应用到不同领域——一个是主观的（设计），一个是客观的（正确性）。受[生成对抗网络（GAN）](https://en.wikipedia.org/wiki/Generative_adversarial_network)的启发，我设计了一种 generator-evaluator agent 结构。evaluator 使用从主观判断中提炼出的具体标准来为输出打分。

这些技术通过两个原则扩展到长时间运行的自主编码：将工作分解为可处理的块，以及使用结构化 artifact 进行跨 session 交接。最终形成了一个三 agent 架构（planner、generator、evaluator），能够在多小时的 session 中产出全栈应用程序。

## 为什么朴素实现会失败

早期的工作表明，[harness 设计对长时间运行的 agentic coding 效果影响显著](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)。一个 initializer agent 将产品规格分解为任务列表，而 coding agent 按顺序实现功能，在 session 之间传递 artifact。

两种持续性的失败模式出现了：

**Context 退化：** 当 context window 填满时，model 会在冗长的任务上失去连贯性。有些会表现出"context 焦虑"——在感知到的 limit 附近过早收工。Context reset——清空 window 并使用结构化交接重新开始——与 compaction（总结早期对话内容但保持同一个 agent）解决的问题不同。使用 Claude Sonnet 4.5 测试表明，context 焦虑过于严重，仅靠 compaction 无法解决。

**自我评估弱点：** 在评估自己的输出时，agent 会自信地赞美平庸的工作。这在缺乏二元验证的主观任务（如设计）中尤为明显。将工作生成与评估分离被证明是有效的；将独立的 evaluator 调优为持怀疑态度，比让 generator 自我批评更加可行。

## 前端设计：让主观质量变得可评分

在没有干预的情况下，Claude 倾向于"安全、可预测的布局——技术上功能正常但视觉上平淡无奇"。

两个洞察塑造了这个 harness：美学不能完全简化为分数，但编码设计原则的评分标准有用；将生成与评分分离可以创造推动更强输出的反馈循环。

四个评分标准同时指导 generator 和 evaluator：

- **设计质量：** 设计是否感觉连贯而非碎片化？颜色、字体排版、布局和图像是否结合在一起建立了独特的情绪和身份。
- **原创性：** 是否有自定义决策的证据，而非模板布局和 AI 模式？人类设计师应能识别出刻意的选择；未修改的库存组件或典型的 AI 标志（白色卡片上的紫色渐变）则不达标。
- **工艺：** 技术执行，包括字体排版层次、间距一致性、色彩协调和对比度——能力而非创意。
- **功能性：** 独立于美学的可用性——用户能否理解界面目的、找到主要操作、无需猜测即可完成任务？

我强调了设计质量和原创性，因为 Claude 在工艺和功能性方面天然表现良好。评分标准明确惩罚通用的"AI 水文"模式，推动美学上的冒险。

evaluator 使用带有详细分数说明的 few-shot 示例进行校准，确保与偏好对齐并减少分数漂移。

反馈循环基于 [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview) 构建。generator 根据 prompt 创建 HTML/CSS/JS 前端。evaluator 使用 Playwright MCP 直接与实时页面交互——在打分和撰写详细评论之前截图并研究实现。这些反馈循环回到 generator 进行迭代。每次生成涉及 5-15 次迭代，每次都推动 generator 朝更独特的方向发展。由于 evaluator 主动浏览页面而非对静态截图打分，完整运行可延伸到四小时。generator 在每次评估后做出策略决策：如果分数趋势良好则完善当前方向，如果方法不奏效则完全转向。

在多次运行中，evaluator 评估在迭代过程中改善后趋于平稳，仍有提升空间。某些生成过程逐步细化；另一些则发生急剧的美学转变。

评分标准的措辞出人意料地引导了 generator。像"最好的设计是博物馆级别"这样的措辞推动了特定的视觉趋同，这表明 prompting 直接塑造了输出特征。

虽然分数通常在迭代中改善，但模式并不是干净的线性关系。后期的实现整体上往往更好，但有时会更偏好早期的迭代。实现复杂度在各轮中增加，因为 generator 追求更有野心的方案。即使是第一次迭代也明显超过了没有任何 prompting 的基线，这表明标准和语言本身就在 evaluator 反馈驱动进一步细化之前将 model 从通用默认值中引导出来。

在一个值得注意的例子中，生成一个荷兰艺术博物馆网站时，到第九次迭代 model 生成了一个干净的深色主题着陆页。在第十次迭代时，它推翻了之前的方案，将其重新构想为空间体验：一个带有 CSS 透视棋盘地板的 3D 房间，艺术品自由挂在墙上，用门廊式导航在画廊房间之间穿行，而非滚动或点击。这代表了"此前从单次生成中从未见过的那种创造性飞跃"。

## 扩展到全栈编码

受 GAN 启发的模式自然适用于全栈开发，其中 code review 和 QA 承担了 generator-evaluator 循环的结构性角色。

### 架构

早期的长时间运行 harness 通过 initializer、coding 和 context reset agent 解决了多 session 连贯性问题。Context reset 至关重要，因为 Sonnet 4.5 表现出强烈的 context 焦虑。Opus 4.5 基本消除了这一行为，允许从本 harness 中移除 context reset。agent 在整个构建过程中持续运行，由 Claude Agent SDK 的自动 compaction 处理 context 增长。

三 agent 系统解决了先前运行中的特定缺陷：

**Planner：** 之前的 harness 需要详细的预先规格。planner agent 接受简单的 1-4 句 prompt 并将其扩展为完整的产品规格。它优先考虑有野心的范围和高层技术设计，而非细粒度的实现细节——避免早期规格错误造成的级联错误。它还识别将 AI 功能编织到规格中的机会。

**Generator：** 一次一个功能的方法有效管理了范围。generator 按 sprint 工作，从规格中顺序挑选功能。每个 sprint 使用 React、Vite、FastAPI 和 SQLite（后来是 PostgreSQL）技术栈实现应用。generator 在 QA 交接前自我评估工作，并使用 git 进行版本控制。

**Evaluator：** 应用程序看起来往往令人印象深刻，但包含真实的 bug。evaluator 使用 Playwright MCP 像用户一样点击浏览运行中的应用程序，测试 UI 功能、API 端点和数据库状态。每个 sprint 根据发现的 bug 和涵盖产品深度、功能性、视觉设计和代码质量的自适应标准进行评分。未达标的标准会触发详细的反馈。

在 sprint 之前，generator 和 evaluator 协商 sprint 合同——在编码开始前定义工作块的"完成"意味着什么。这在高层规格和可测试实现之间架起了桥梁。generator 提出构建内容和验证方法；evaluator 审查以确保构建正确的东西，迭代直到达成一致。

通信使用文件：agent 写入文件，其他人在文件内或通过新文件读取和响应。generator 根据商定的合同构建后交给 QA，保持工作忠实于规格而不过度指定。

### 运行 Harness

对于第一版 harness，我使用 Claude Opus 4.5，将完整 harness 与单 agent 基线进行比较。这是实验开始时 Anthropic 最好的编码 model。

prompt："创建一个 2D 复古游戏制作工具，功能包括关卡编辑器、精灵编辑器、实体行为和可玩的测试模式。"

结果对比：
- 单独运行：20 分钟，$9
- 完整 harness：6 小时，$200

20 倍的成本增加立即显示出明显的质量差异。

**单独运行结果：**

![初始打开界面：单独 harness 创建的复古游戏制作工具](https://www-cdn.anthropic.com/images/4zrzovbb/website/23c98f1d7ae720bfb39190d50e0706c03b177ad8-1999x1320.png)

初始界面似乎满足了预期，但问题浮现：布局以固定高度面板浪费空间；工作流程僵化；创建关卡需要先有精灵和实体但没有 UI 引导；实际游戏是坏的——实体出现了但没有任何东西响应输入。

![在单独 harness 创建的精灵编辑器中创建精灵](https://www-cdn.anthropic.com/images/4zrzovbb/website/24472c85629a6c82a092f25def4a659042be1f7c-1999x1010.png)

代码调查揭示了断裂的实体-运行时连接，界面上没有任何提示。

![尝试（但未成功）玩我创建的关卡](https://www-cdn.anthropic.com/images/4zrzovbb/website/79217dbfce3f31172eb7fd4deee5449023c9b2ac-1999x757.png)

**完整 harness 结果：**

完整 harness 将一句话 prompt 扩展为涵盖十个 sprint 的 16 项功能规格。它超越了单独运行的尝试，添加了精灵动画系统、行为模板、声音和音乐、AI 辅助的精灵生成和关卡设计，以及可分享的游戏导出链接。planner 访问了前端设计 skill，将视觉设计语言作为规格的一部分。

![初始界面：在完整 harness 构建的应用中创建新游戏](https://www-cdn.anthropic.com/images/4zrzovbb/website/a8bef95425966495629095a5cb38bde4a8b13558-1999x997.png)

结果显示出即时的打磨优势：canvas 使用了整个 viewport；面板大小合理；界面具有追踪规格设计方向的一致视觉标识。工作流缺陷仍然存在——精灵和实体仍不明显是前置条件——但这反映了基线产品直觉的局限性，而非 harness 的失败。精灵编辑器更丰富，工具调色板更干净，颜色选择器更好，缩放控件可用。

![精灵编辑器感觉更干净、更易用](https://www-cdn.anthropic.com/images/4zrzovbb/website/c05aa3ef8daaf0ef3d0dba66d6480ab753e9cbaa-1999x1007.png)

由于 planner 将 AI 功能编入规格，应用内置了 Claude 集成，可通过 prompting 生成游戏部件，显著加速工作流。

![使用内置 AI 功能生成关卡](https://www-cdn.anthropic.com/images/4zrzovbb/website/287b35f4683ecb77ac6a8d66bf2b3ed5956d1db9-1999x1008.png)

![使用内置 AI 功能生成关卡](https://www-cdn.anthropic.com/images/4zrzovbb/website/8596eab2b4a07124df41ad6b2f7ff4ff9d9f105f-1999x1000.png)

最大的区别：游戏真正可以运行了。实体会移动和玩耍。物理有粗糙之处——角色跳上平台时会重叠——但核心功能在单独运行失败的地方成功了。玩家遇到了一些 AI 级别构造的限制，会被卡在墙上，这表明仍有改进空间。

![玩我生成的游戏](https://www-cdn.anthropic.com/images/4zrzovbb/website/f2953550e51957a0a49a3792a0df3bcfed0fde48-1994x1654.png)

从日志来看，evaluator 使实现与规格保持一致。每个 sprint 通过 Playwright 操作运行中的应用程序，提交具体的 bug。仅 Sprint 3 就有 27 条涵盖关卡编辑器的标准。

evaluator 发现的示例问题显示它捕获了关键问题：
- 矩形填充工具只在拖拽端点放置瓷砖，而不是填充区域
- 删除键处理器同时需要选择和实体 ID，而点击实体只设置了 ID
- FastAPI 路由排序导致重排序端点被匹配为帧 ID，返回 422 错误

开箱即用，Claude 是一个"糟糕的 QA agent"。早期运行表明它会识别出合理的问题，然后说服自己认为问题不严重。测试是表面化的，遗漏了深层嵌套功能中的微妙 bug。调优循环涉及阅读 evaluator 日志、发现判断偏差并更新 QA prompt。在合理评分之前经历了多个开发周期。即便如此，harness 输出仍显示出局限性：布局问题、不直观的交互、未发现的深层功能 bug。但与单独运行时中央功能无法工作相比，改进是显而易见的。

### 迭代 Harness

初始结果令人鼓舞但笨重、缓慢且昂贵。在不降低性能的情况下简化成为下一步。每个 harness 组件都编码了关于 model 能力的假设，值得进行压力测试——这些假设可能是错误的，并且随着 model 的改进会迅速过时。

[《Building Effective Agents》](https://www.anthropic.com/research/building-effective-agents)中的原则："找到最简单的可能方案，只在需要时增加复杂度"——在 harness 维护中持续出现。最初的激进简化尝试未能复现原始性能，使得承载性组件不清晰。逐一移除组件的方法论方法被证明更好。

与此同时，[Claude Opus 4.6](https://www.anthropic.com/news/claude-opus-4-6) 的发布推动了复杂度降低。发布博客指出 4.6"规划更仔细，在 agentic 任务上持续更久，在更大的代码库中运行更可靠"，具有"更好的 code review 和调试技能"，以及大幅改善的长 context 检索。这些补充了先前的 harness 脚手架。

**移除 sprint 构造：** Sprint 结构为 model 连贯性分解工作。鉴于 4.6 的改进，model 可能在没有分解的情况下处理工作。planner 和 evaluator 都保留了，因为每个都增加了明显的价值。没有 planner 时，generator 范围不足，立即开始构建而没有规格，创建出的应用功能不如 planner 产出的丰富。

没有 sprint 构造，evaluator 转为单次的运行结束检查。Model 能力的提升改变了 generator 可靠处理的边界。在 4.5 上，边界附近的任务需要 evaluator 检查以确保连贯实现。在 4.6 上，model 通常能独立处理以前的边缘案例，使 evaluator 有时成为不必要的开销。然而，对于仍处于能力边界的任务，evaluator 继续提供真实价值。

实际上，evaluator 的价值取决于任务相对于当前 model 可靠性的定位。当任务超出基线单独能力时，evaluator 值得其成本。

在结构简化的同时，我添加了 prompting 以改善 AI 功能集成到应用中——具体来说是构建通过 tool 驱动应用功能的正确 agent。这需要大量迭代，因为相关知识是最新的，训练覆盖率稀薄。但充分的调优产生了正确的 agent 构建。

### 更新后 Harness 的结果

测试 prompt："在浏览器中使用 Web Audio API 构建一个功能齐全的 DAW。"

运行持续约 4 小时，token 成本 $124。大部分时间用于 builder 连贯性，在没有先前 sprint 分解的情况下运行超过两小时。

阶段分解：
| 阶段 | 时间 | 成本 |
|---|---|---|
| Planner | 4.7 分钟 | $0.46 |
| Build 第 1 轮 | 2 小时 7 分钟 | $71.08 |
| QA 第 1 轮 | 8.8 分钟 | $3.24 |
| Build 第 2 轮 | 1 小时 2 分钟 | $36.89 |
| QA 第 2 轮 | 6.8 分钟 | $3.09 |
| Build 第 3 轮 | 10.9 分钟 | $5.88 |
| QA 第 3 轮 | 9.6 分钟 | $4.06 |
| **总计** | **3 小时 50 分钟** | **$124.70** |

planner 将单行 prompt 扩展为完整规格。generator 日志显示了良好的规划、agent 设计、连接和 QA 交接前的测试。

QA agent 仍然捕获了真实的缺陷。第一轮反馈指出"应用强劲，设计保真度出色，AI agent 扎实，后端良好"，但"几个核心 DAW 功能仅是展示而缺乏交互深度：clip 无法在时间线上拖动/移动，没有乐器 UI 面板（合成器旋钮、鼓垫），也没有可视化效果编辑器（EQ 曲线、压缩器仪表）。"

第二轮反馈识别了剩余缺陷：
- 音频录制仍是 stub 状态（按钮可切换但没有麦克风捕获）
- 通过边缘拖拽调整 clip 大小和 clip 分割未实现
- 效果可视化使用数字滑块，不是图形（没有 EQ 曲线）

generator 在单独工作时仍然容易遗漏细节或 stub 功能。QA 继续为 generator 修复最后一英里问题增加价值。

预期结果包括旋律、和声和鼓点创建、歌曲编排以及集成的 agent 辅助。虽然远非专业音乐制作——缺乏 agent 歌曲创作技能，且 Claude 无法听到音频——但核心功能模块存在：可工作的编排视图、混音器、在浏览器中运行的 transport。核心歌曲创作原语已就位；agent 使用 tool 自主驱动它们，通过 prompting 从头到尾创建简单的制作。agent 设置了速度和调式，铺设旋律，构建鼓轨道，调整混音器电平，添加混响。

## 下一步是什么

随着 model 的改进，它们通常能在更复杂的任务上工作更长时间。有时周围的脚手架变得不那么重要，开发者等待下一代 model 看着问题自行解决。反过来，更好的 model 为 harness 创造了空间，使其能够完成超出基线能力的任务。

值得继承的经验：

持续使用当前 model 进行实验、在真实问题上阅读 trace 并调优性能以达到期望结果，仍然是好的实践。复杂任务的工作有时受益于分解——将专门的 agent 应用于不同方面。当新 model 发布时，重新审视 harness——剥离非承载性部件并添加启用更大能力的新部件——被证明是值得的。

我的信念是：随着 model 的改进，有趣的 harness 组合不会减少——而是会转移。AI 工程师的持续工作是找到下一个新颖的组合。

---

## 引用

- 原文：[Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps) — Anthropic Engineering，2026 年 3 月 24 日
- [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)
- [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Claude Opus 4.6 发布博客](https://www.anthropic.com/news/claude-opus-4-6)
- [Anthropic Labs 介绍](https://www.anthropic.com/news/introducing-anthropic-labs)
