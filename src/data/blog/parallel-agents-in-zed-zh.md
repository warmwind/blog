---
title: "Zed 中的并行 Agents"
pubDatetime: 2026-04-25T10:00:00+08:00
description: "Zed 推出并行 Agents 功能，通过全新的线程侧边栏（Threads Sidebar）支持在同一窗口内并行运行多个 agent，并提供对文件夹、代码仓库访问权限的精细控制。"
slug: parallel-agents-in-zed-zh
originalTitle: "Parallel Agents in Zed"
originalUrl: https://zed.dev/blog/parallel-agents
---

原文标题：Parallel Agents in Zed<br>
原文链接：https://zed.dev/blog/parallel-agents

# Zed 中并行 Agents 正式发布

作者：Mikayla Maki、Richard Feldman

2026 年 4 月 22 日

![Zed 并行 Agents 全屏截图](https://zed.dev/img/post/parallel-agents/full-screen.webp)

Zed 现在允许你在同一窗口内协调多个 agent，每个 agent 并行运行。全新的线程侧边栏（Threads Sidebar）让你可以精确控制 agent 能够访问哪些文件夹和代码仓库，并在线程运行时实时监控进度。

所有这一切都以 Zed 标志性的流畅 120 fps 运行，支持你喜欢的任何 agent，并且完全开源。

## 多线程，一个窗口

线程侧边栏让你一目了然地总览所有线程，按项目分组，让你能够：

- 按线程自由混搭不同的 agent，因为 Zed 允许你为每个 agent 自主选择。

- 跨项目工作，让一个 agent 线程跨代码仓库进行读写操作。

- 按需隔离工作树（worktree），并逐线程自行决定是否隔离。

![线程侧边栏概览](https://zed.dev/img/post/parallel-agents/diagram.webp)

侧边栏让你可以快速进行停止线程、归档线程、启动新线程等常见操作。即使在多个项目同时运行多个 agent 的复杂工作流中，侧边栏也能让你在 agent 工作期间轻松保持有条不紊。

## 全新的默认布局

随着线程侧边栏成为我们在项目中导航的主要方式，我们重新考量了各面板的位置排布。线程现在默认停靠在左侧，紧邻 Agent 面板，而项目面板和 Git 面板则位于右侧。

![Zed 全新默认布局](https://zed.dev/img/post/parallel-agents/layout.webp)

我们认为这种布局更适合 agentic 工作流，能够在你切换线程时始终将 agent 线程置于视图中心。如果你偏好其他排列方式，可以在底部工具栏右键单击任意面板图标来更改其停靠位置，或在设置编辑器中进行调整。对于现有用户，新布局为可选启用。

![在 Zed 中自定义面板布局](https://zed.dev/img/post/parallel-agents/customize.webp)

如果你已经习惯了旧版布局，我们鼓励你在切换回去之前先尝试新布局。在花一点时间适应之后，它会感觉更加自然。

## Agent 与编辑器：相辅相成

问十位不同的程序员如何使用 AI，你可能得到十种不同的答案。一个极端是完全沉浸于"vibes 驱动"，另一个极端是关闭所有 AI 功能。我们发现，打造高质量软件最有效的方式介于两者之间：既使用 AI，又直接与代码互动。

正如我们的联合创始人兼 CEO Nathan Sobo 在 2025 年所写的那样："作为软件工程师，我们应该用可靠、设计良好、易于修改且令人愉悦使用的系统来衡量我们的贡献，而不是代码生成量。"那篇文章引入了"agentic engineering"这一术语，用来描述"结合人类工艺与 AI 工具构建更好软件"的艺术，我们最近也看到这个术语在社区中越来越流行。

Zed 中的并行 agents 正是围绕这一原则构建的。多 agent 编排并非新概念，但我们相信自己打造了一套优秀的大规模 agent 协作体验。我们花了数天时间向系统加载数百个线程，打磨细节、精炼开发者可能从未注意到的每个角落。我们经历了多轮 UX 迭代和无数小时的内部讨论。这让我们花费了更长的时间，说实话，这一度让我们有些抓狂。但最终的成果更令人满意，它让开发者能够用 agent 完成更具挑战性的工作，同时不必牺牲自己的工艺水准。

## 开始使用

并行 Agents 已在最新版 Zed 中推出。你可以下载 Zed，或更新至最新版本即可获得该功能。

你可以通过左下角的图标打开线程侧边栏，或使用快捷键：macOS 上为 `option-cmd-j`，Linux 和 Windows 上为 `ctrl-option-j`。希望你享受这种全新的掌控感！

---

## 引用

- 原文：[Parallel Agents in Zed](https://zed.dev/blog/parallel-agents)
