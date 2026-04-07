---
title: "Moda 如何用 Deep Agents 构建生产级 AI 设计 Agent"
pubDatetime: 2026-03-25T22:00:00+08:00
description: "LangChain Blog 文章《How Moda Builds Production-Grade AI Design Agents with Deep Agents》中文翻译（含原文引用）。"
slug: moda-production-grade-ai-design-agents-deep-agents-zh
originalTitle: "How Moda Builds Production-Grade AI Design Agents with Deep Agents"
originalUrl: https://blog.langchain.com/how-moda-builds-production-grade-ai-design-agents-with-deep-agents/
---

原文标题：How Moda Builds Production-Grade AI Design Agents with Deep Agents<br>
原文链接：https://blog.langchain.com/how-moda-builds-production-grade-ai-design-agents-with-deep-agents/

# Moda 如何用 Deep Agents 构建生产级 AI 设计 Agent

Moda 使用基于 Deep Agents 构建、通过 LangSmith 进行追踪的多 Agent 系统，让非设计师也能创建和迭代专业级视觉作品。

---

![封面图](https://blog.langchain.com/content/images/size/w1200/2026/03/Nullframe-Moda.png)

Moda 是一个面向非设计师的 AI 原生设计平台，服务对象包括营销人员、创始人、销售人员和小企业主——他们需要专业级的演示文稿、社交媒体帖子、宣传册和 PDF，但没有设计背景。可以把它想象成 Canva 或 Figma，但配备了 Cursor 风格的 AI 侧边栏，能够直接在一个完全可编辑的 2D 矢量画布上构建和迭代设计。

![Moda 聊天界面](https://blog.langchain.com/content/images/2026/03/moda-chat.png)

Moda 的核心是一个基于 **Deep Agents** 构建的多 Agent 系统，**LangSmith** 提供可观测性层，让团队能够快速迭代并自信地发布。

## 挑战：让 AI 擅长视觉设计

AI 代码生成之所以运作良好，部分原因在于 HTML 和 CSS 已经有了 Flexbox 和 grid 等布局抽象。你描述的是关系和相对大小，而不是像素坐标。

视觉设计没有等价物。最接近的标准是 PowerPoint 的 XML 规范，这是一种有 40 年历史的格式，充满了冗长的绝对 XY 坐标，而 LLM 在这方面的推理能力很差。使用 XML 的工具生成的设计看起来和其他所有 AI 生成的幻灯片一样。

Moda 需要一个能够生成真正好看的设计的系统，以及一个能够在生产质量级别处理复杂、多轮、视觉基础任务的 Agent 架构。

## Agent Harness：基于 Deep Agents 构建

Moda 的 AI 系统由三个 Agent 组成：

1. **Design Agent：** Cursor 风格侧边栏背后的主要 Agent，负责处理画布上所有实时设计创建和迭代
2. **Research Agent：** 从外部来源（例如公司网站）获取并存储结构化内容到 Moda 内的每用户文件系统中
3. **Brand Kit Agent：** 从网站、上传的品牌手册或现有幻灯片中摄入品牌资产（颜色、字体、标志、品牌语调），确保每个设计从一开始就符合品牌形象

**Research Agent 和 Brand Kit Agent 都运行在 Deep Agents 上。** 这些是团队最新的 Agent，他们在上面投入了大量精力。Design Agent 运行在自定义的 LangGraph 循环上——这是 Deep Agents 推出之前的较早实现——团队正在积极评估将其迁移过来。

所有三个 Agent 共享相同的整体架构：轻量级分类步骤、主 Agent 循环、动态上下文加载，以及在 LangSmith 中的完整追踪。

## Context Engineering：细节决定成败

让一个设计 Agent 产出真正优质的输出——在视觉上连贯且品牌准确（而不仅仅是技术上正确）——需要大量有意识的 context engineering。

以下是 Moda 总结出的经验。

### 自定义 DSL 替代原始场景图

构建设计 Agent 最困难的部分之一是弄清楚如何以 LLM 能有效推理的方式表示视觉布局。原始画布状态冗长、坐标密集且 token 开销高——与模型思考结构和布局的方式天然不匹配。

Moda 开发了一个上下文表示层，为 Agent 提供更简洁、更紧凑的画布视图，从而降低 token 成本并提高输出质量。具体细节是专有的，但总体原则与使 LLM 在 Web 开发中表现出色的原则相同：给模型提供它可以推理的布局抽象，而不是原始数字坐标。

> "LLM 不擅长数学。PowerPoint 的 XML 规范有一堆 XY 坐标——这作为数据表示是可以的，但对于 LLM 来说，这不是描述它想要把东西放在哪里的好方式。"
> — Ravi Parikh，Moda.app 联合创始人

Deep Agents 和 LangSmith 在这里至关重要。团队广泛使用 LangSmith traces 来评估不同的上下文表示如何影响 Agent 行为，迭代要包含哪些信息、如何组织它，以及缓存断点在哪里对成本和延迟影响最大。

### Triage → Skills → 主循环

每个请求在到达主 Agent 之前都会通过一个轻量级分类节点（使用快速且低成本的 Haiku 模型）。分类节点对输出格式（幻灯片、PDF、LinkedIn 轮播图、标志等）进行分类，并预加载相关的 **skills**——这些是包含设计最佳实践、格式指南和特定任务创意指令的 Markdown 文档。

Skills 以 human messages 的形式注入，**prompt caching 断点**放置在 system prompt 之后和 skills 块之后。这使得 system prompt 保持固定并始终被缓存，同时允许每个请求动态注入上下文。

主 Agent 也可以在循环中途拉取额外的 skills（如果它判断需要的话）。分类步骤只是预先加载高置信度的 skills，以避免不必要的额外轮次。

### 动态 Tool 加载

设计 Agent 始终在上下文中运行 12-15 个核心 tool。另外约 30 个 tool 可以通过 Agent 调用的 `RequestToolActivation` tool 按需加载，例如当它识别到需要解析上传的 PowerPoint 文件等专业需求时。

每个额外的 tool 在前缀中花费 50-300 个 token，加载新 tool 会破坏 prompt caching。但数学计算是合算的：绝大多数请求不需要额外的 tool，所以保持上下文精简总体上是赢的。

> "如果我只看数据，大多数请求不需要激活任何额外的 tool，只在上下文中保留 12 到 15 个 tool 的感觉真的很好。"
> — Ravi Parikh

### 将 Context 缩放到画布大小

不是每个请求都需要完整查看整个项目。对于较小的画布，Agent 使用当前状态的完整视图。对于更大的项目——例如 20 页的幻灯片——Moda 动态管理 Agent 接收的上下文量，给它一个更高层级的摘要，并让它通过 tool 按需拉取细节。

这在不牺牲 Agent 跨复杂多页项目做出明智设计决策的能力的同时，保持了 token 使用量的可控。LangSmith 的每节点成本追踪使得在上下文丰富度和效率之间找到合适的平衡变得简单直接。

## UX：设计领域的 Cursor 时刻

Moda 最刻意的产品选择之一是交互模型。与"生成并替换"的流程——AI 产出静态输出并交接——不同，Moda 的 AI 直接在一个完全可编辑的 2D 矢量画布上工作。Agent 创建的每个元素都可以立即被用户选择、移动、调整大小和设置样式。

这改变了用户与 AI 之间的关系，从"接受或拒绝"变为真正的协作。AI 生成一个坚实的起点，用户进行精细调整。两者都不需要完成所有工作。

Cursor 风格的侧边栏强化了这一点：它始终存在，始终感知画布上的内容，为迭代式的来回互动而设计，而非一次性生成。尤其对非设计师来说，这消除了面对空白画布的恐惧感，同时让他们掌控最终结果。

![Moda UI](https://blog.langchain.com/content/images/2026/03/moda-ui.png)

## 使用 LangSmith 实现可观测性

由于所有三个 Agent 都通过 LangSmith 进行追踪，Ravi 对每次执行都有完整的可见性。每当他在积极开发时，都会保持 LangSmith 打开。

关键工作流：

- **Prompt 与 tool 迭代：** 做一个更改，运行一次查询，立即拉出 trace 查看 Agent 做了什么以及为什么
- **成本追踪：** token 成本按节点分解，昂贵的步骤一目了然
- **Cache 命中分析：** 鉴于动态 skill 和 tool 加载，这尤其重要；快速展示缓存在哪里有效、在哪里失效
- **错误诊断：** 在 tool 调用失败和意外模型行为变成面向用户的问题之前将其浮现

> "如果我在迭代 prompt，如果我在迭代 tool 集，我会做一个更改，运行一次查询，然后在 LangSmith 中拉出那个 trace，看看发生了什么……它让我们更快了。"
> — Ravi Parikh

Moda 还没有运行正式的 evals，但已在路线图上。目前，LangSmith traces 作为捕获回归和验证改进的主要反馈循环。

## 成果与未来计划

Moda 在做企业销售的 B2B 公司中找到了强劲的早期产品-市场契合：这些团队需要快速获得精美、品牌准确的 pitch deck。完全可编辑画布与 Deep Agents 驱动后端的组合意味着用户获得的是一个可以真正精细调整的专业起点，而不是一个无法改动的静态输出。

接下来的计划：连接已有的 memory 原语、完成 Design Agent 的 Deep Agents 迁移，以及扩展品牌上下文系统以支持多团队、多品牌的企业客户。

想要构建生产级 AI Agent？[开始使用 LangChain Deep Agents](https://github.com/langchain-ai/deepagents?ref=blog.langchain.com)

---

## 引用

- 原文：[How Moda Builds Production-Grade AI Design Agents with Deep Agents](https://blog.langchain.com/how-moda-builds-production-grade-ai-design-agents-with-deep-agents/) — LangChain Blog，2026 年 3 月 24 日
