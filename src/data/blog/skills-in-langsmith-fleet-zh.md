---
title: Skills in LangSmith Fleet
pubDatetime: 2026-04-02T22:00:00+08:00
description: LangChain 博客文章《Skills in LangSmith Fleet》的中文翻译（含原文引用）。
slug: skills-in-langsmith-fleet-zh
originalTitle: "Skills in LangSmith Fleet"
originalUrl: https://blog.langchain.com/skills-in-langsmith-fleet/
---

> 本篇超出 7 天窗口（原文发布于 2026-03-25，翻译时已超过 7 天）

原文标题：Skills in LangSmith Fleet<br>
原文链接：https://blog.langchain.com/skills-in-langsmith-fleet/

![](https://blog.langchain.com/content/images/size/w760/format/webp/2026/03/Fleet-Skills.png)

Fleet 现已支持可共享的 skills，让你能够为团队中的 agent 装备专门任务所需的知识。可以从提示词或手动方式创建 skill，也可以从模板开始，或从之前的 agent 对话中生成。将 skill 共享到你的工作区后，它们会自动保持同步。

## Agent 最有用的时候，是它们了解你的业务

Agent 现在已经非常擅长推理。它们能够规划、使用工具并从错误中恢复。但没有领域知识的推理走不了多远。一个不了解你 SLA 等级的客户支持 agent 会把每张工单同等对待。

让 agent 真正有用的大量知识存在于人们的脑海中：你的团队如何处理边缘情况、处理退货时应该遵循哪些步骤、客户沟通中应该采用什么语气。还有一些知识散落在文档里，分布在 wiki、Notion 页面和 Slack 消息中。

随着团队和企业专业知识的积累，这个问题会不断加剧。当某人找到了处理某项任务的正确方式，这些知识就留在了他们身上。当他们离开时，知识也随之消失。

Skills 通过将这些知识编码化来帮助解决这个问题，使 agent 可以直接使用。今天，我们在 LangSmith Fleet 中推出可共享的 skills。

## Skills 为你的 Agent 提供企业知识

一个 skill 是一组指令和领域知识，你将其附加到某个 agent 上。可以把它理解为一份持久性的简报文档，塑造 agent 在特定任务或领域中的行为方式。一个 skill 可能包含：

- 如何根据团队的 SLA 等级对支持工单进行分类
- 公司为写作 agent 制定的品牌语调指南
- 处理退款请求的分步工作流程

你的 agent 只会在与当前任务相关时才加载某个 skill。这让 agent 保持专注和高效。

你只需编写一次知识，将其共享到工作区，每个 agent 都能使用它。新加入的队友能够更快上手，因为他们使用的 agent 已经掌握了操作指南。即使有人离开公司，他们注入到 skills 中的知识仍然留在团队中。

![Skill in Fleet](https://blog.langchain.com/content/images/2026/03/Group-2147239271.png)

## 创建 Skills 的方式

Fleet 提供了多种创建 skills 的方式：

- **AI 辅助创建：** 打开 Chat，描述你希望 skill 做什么。Fleet 会提出澄清性问题并生成 skill。你也可以随时将之前的对话转换为可复用的 skill。
- **创建 Agent 时自动生成：** 创建新 agent 时，如果 agent 会受益于 skills，Fleet 会自动生成相关的 skills。这些 skills 默认对该 agent 私有，你可以从那里将它们共享到工作区。
- **从模板开始：** Fleet 附带了针对常见场景的预置 skills，例如客户简报、SEO 审计和深度研究。
- **手动编写：** 对于希望完全掌控的团队，你可以手动编写 skills。

任何 skill 都可以在团队内共享，并且在改进时保持同步。最接近实际工作的人创建 skill，团队其他成员在自己的 agent 中使用它，无需额外协调。

![Fleet Skill Library](https://blog.langchain.com/content/images/2026/03/Group-2147239269.png)

## Skills 是可移植的

在 Fleet 中创建的 skills 是可移植的。你可以下载 skill 文件，如果你正在用代码开发 agent，可以通过 LangSmith CLI 将工作区中的任何 skill 直接拉取到本地开发环境：

```
$ langsmith fleet skills pull web-research --format pretty
Installed skill "web-research" to ~/.agents/skills/web-research
  Linked: ~/.claude/skills/web-research

web-research-test/
├── SKILL.md
└── references/
    └── search-tips.md
```

一条命令即可安装 skill 并将其链接到你选择的编码 agent——Claude Code、Cursor、Codex，或同时链接到所有这些工具。Fleet agent 使用的同一份领域知识，无需任何人重写或复制粘贴，就能在你用代码构建的 agent 中使用。

## 接下来的计划

我们正在积极扩展 LangSmith Fleet 的 skills 能力，重点关注团队协作。即将推出的两项功能：

- **版本锁定与回滚：** 将 agent 锁定到某个运行良好的 skill 版本。如果 skill 的更新效果不理想，可以回滚到之前的版本，而不会影响使用同一 skill 的其他 agent。
- **多所有者权限：** 目前只有 skill 的创建者可以编辑它。我们正在添加指定多个所有者的功能，以便团队协作维护 skills。

随着 agent 承担更高风险的工作，指令的质量将成为区分"通用能力 agent"和"在特定任务上可靠出色的 agent"的关键因素。Skills 就是你弥合这一差距的方式。

## 引用

- [Skills in LangSmith Fleet](https://blog.langchain.com/skills-in-langsmith-fleet/)
- [Introducing LangSmith Fleet](https://blog.langchain.com/introducing-langsmith-fleet/)
- [LangSmith 文档](https://docs.langchain.com/)
