---
title: "不用 Embedding 构建知识 Agent"
pubDatetime: 2026-03-23T18:00:00+08:00
description: "Vercel 博客《Build knowledge agents without embeddings》中文翻译（含原文引用）。介绍用文件系统和 bash 替代向量数据库构建知识 Agent 的方法。"
slug: build-knowledge-agents-without-embeddings-zh
originalTitle: "Build knowledge agents without embeddings"
originalUrl: https://vercel.com/blog/build-knowledge-agents-without-embeddings
---

原文标题：Build knowledge agents without embeddings<br>
原文链接：https://vercel.com/blog/build-knowledge-agents-without-embeddings

# 不用 Embedding 构建知识 Agent

*使用 Vercel Sandbox、Chat SDK 和 AI SDK 部署 Agent*

*作者：Ben Sabic、Hugo Richard — 2026 年 3 月 19 日*

大多数知识 Agent 都遵循一个可预见的模式：团队选择一个向量数据库，构建分块流水线，选定一个 Embedding 模型，然后调整检索参数。

几周过去了，Agent 对某个问题给出了错误答案。调试变得无从下手——到底检索了哪个分块？为什么那个分块排名最高？

这种模式在 Vercel 的内部工作以及在平台上构建 Agent 的团队中反复出现。向量方法在语义相似性上表现尚可，但在从结构化数据中检索特定值时却力不从心。关键的失败模式是隐蔽的：Agent 自信地返回错误的分块，从问题到答案没有任何可追溯的路径。

Vercel 尝试了另一种方法——用文件系统替换向量流水线，给 Agent 赋予 `bash` 权限。他们的销售电话摘要 Agent 的成本从大约 1.00 美元降至约 0.25 美元每次调用，而且输出质量还提升了。Agent 只是在做它本来就擅长的事情：读文件、执行 `grep`、浏览目录。

因此，Vercel 开源了 Knowledge Agent Template——一个基于文件系统的生产就绪 Agent 实现，构建在 Vercel 基础设施之上。

## 模板功能

Knowledge Agent Template 是一个开源的、基于文件系统的 Agent 架构，可以 fork、自定义和部署。用户可以接入任意数据源：GitHub 仓库、YouTube 转录文本、Markdown 文件等文档，或自定义 API。部署选项包括 Web 聊天应用、GitHub Bot、Discord Bot，或同时跨多个平台部署。

模板集成了三个核心技术：Vercel Sandbox、AI SDK 和 Chat SDK。用户一键部署到 Vercel，配置数据源，即可开始回答问题。

## 基于文件的搜索：Vercel Sandbox

这种方法完全不需要向量数据库、分块流水线和 Embedding 模型。

Agent 在隔离的 Vercel Sandbox 中使用 `grep`、`find` 和 `cat` 命令。

**运行流程：**

1. 通过管理界面添加数据源，存储在 Postgres 中
2. 内容通过 Vercel Workflow 同步到快照仓库
3. 当 Agent 需要搜索时，Vercel Sandbox 加载快照
4. Agent 的 `bash` 和 `bash_batch` 工具执行文件系统命令
5. Agent 返回带有可选引用的答案

结果是确定性的、可解释的、高性能的。当 Agent 给出错误答案时，你可以打开追踪记录看到：它执行了 `grep -r "pricing" docs/`，读取了 `docs/plans/enterprise.md`，然后提取了错误的段落。你修复文件或调整 Agent 的搜索策略即可。整个调试过程只需几分钟。

向量系统的问题则完全不同。如果 Agent 检索到一个不好的分块，你首先需要确定选中了哪个分块，然后分析评分（为什么是 0.82 而不是 0.79）。根因可能在分块边界、Embedding 模型选择或相似度阈值。文件系统搜索消除了这种不确定性——不必猜测分块选择，也无需盲目调优检索评分。你调试的是问题，而不是流水线。

**对比：**

| 维度 | Embedding 方式 | 文件系统方式 |
|------|---------------|-------------|
| 评分机制 | 黑盒评分 | 透明命令 |
| 可调试性 | 难以调试 | 直接检查文件 |
| 配置要求 | 需要调优 | 开箱即用 |

大语言模型天生就理解文件系统。训练数据包含了海量代码仓库：目录导航、文件搜索、复杂代码库状态管理。如果 Agent 能出色地对代码执行文件系统操作，那对其他场景同样适用。这就是文件系统加 bash 方法的核心理念。

这种方法利用的是模型已有的能力，而不是引入新技能。无需维护 Embedding 流水线，也不用扩展向量数据库。添加数据源、同步、搜索，就这么简单。

## Chat SDK：一个 Agent，覆盖所有平台

一套知识库、一个代码库、一个事实来源，服务所有平台。然而工程团队用 Slack，社区聚在 Discord，Bug 报告堆积在 GitHub。一个能同时理解所有平台的 Agent 就是统一方案。

Chat SDK 将知识 Agent 连接到用户所在的每个平台。导入所需的适配器，将每个适配器指向同一个 Agent 流水线，Agent 就能在所有 Chat SDK 支持的平台上运行。

**Chat SDK 实现示例：**

```typescript
import { Chat } from "chat";
import { createSlackAdapter } from "@chat-adapter/slack";
import { createDiscordAdapter } from "@chat-adapter/discord";
import { createRedisState } from "@chat-adapter/state-redis";

const bot = new Chat({
  userName: "knowledge-agent",
  adapters: {
    slack: createSlackAdapter(),
    discord: createDiscordAdapter(),
  },
  state: createRedisState(),
});

bot.onNewMention(async (thread, message) => {
  await thread.subscribe();
  const result = await agent.stream({ prompt: message.text });
  await thread.post(result);
});
```

每个适配器处理平台特定的需求（认证、事件格式、消息传递），而 Agent 本身保持不变。`onNewMention` 事件在 Bot 收到提及时触发，无论在哪个平台。Agent 处理消息文本，通过同一个文件系统后端流水线流式返回响应，然后将结果发布回对话线程。

模板默认包含 GitHub 和 Discord 适配器。Chat SDK 已支持 Slack、Microsoft Teams、Google Chat 等更多平台。[适配器目录](https://chat-sdk.dev/adapters)列出了所有官方和社区适配器。

## 与 AI SDK 深度集成

`@savoir/sdk` 包提供了工具，可以将任何基于 AI SDK 的 Agent 或应用连接到知识库。导入工具，将客户端指向你的实例 URL，然后将工具传递给 Agent 即可建立连接。

```javascript
import { generateText } from 'ai'
import { createSavoir } from '@savoir/sdk'

const savoir = createSavoir({
  apiUrl: process.env.SAVOIR_API_URL!,
  apiKey: process.env.SAVOIR_API_KEY,
})

const { text } = await generateText({
  model: yourModel, // 任何 AI SDK 兼容的模型
  tools: savoir.tools, // bash 和 bash_batch 工具
  maxSteps: 10,
  prompt: 'How do I configure authentication?',
})

console.log(text)
```

如果你打算扩展 SDK 功能并发布，可以将包名从 `@savoir/sdk` 自定义为你自己的标识符。

模板内置了智能复杂度路由。每个传入的问题会被分类复杂度，然后路由到合适的模型。简单问题交给快速、低成本的模型，困难问题使用更强大的模型。成本优化自动完成，无需手动配置。

该方案通过 Vercel AI Gateway 支持任何 AI SDK 模型提供商。

## 内置管理工具

模板提供了全面的管理功能：使用统计、错误日志、用户管理、数据源配置和内容同步控制。无需外部可观测性工具。

模板还附带了一个 AI 驱动的管理 Agent。你可以提问："过去 24 小时发生了哪些错误？"或"用户最常问的问题是什么？"管理 Agent 使用内部工具（`query_stats`、`query_errors`、`run_sql` 和 `chart`）直接给出答案。用 Agent 来调试 Agent。

## 开始使用

构建实用的知识 Agent 不需要向量数据库、Embedding 模型或分块流水线。所需的基本要素是文件系统、bash，以及将 Agent 放到用户已有的沟通渠道中。

Knowledge Agent Template 把这些要素组合在一起，让你专注于 Agent 的知识内容，而不是检索机制。

[部署 Knowledge Agent Template](https://vercel.link/deploy-knowledge-agent-template)

---

## 引用

- 原文：[Build knowledge agents without embeddings](https://vercel.com/blog/build-knowledge-agents-without-embeddings) — Vercel Blog，2026 年 3 月 19 日
- [Knowledge Agent Template](https://vercel.com/templates/template/chat-sdk-knowledge-agent)
- [Vercel Sandbox 文档](https://vercel.com/docs/vercel-sandbox/run-commands-in-sandbox)
- [Chat SDK 适配器目录](https://chat-sdk.dev/adapters)
- [Vercel AI Gateway](https://vercel.com/ai-gateway)
