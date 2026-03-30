---
title: "从 model 到 agent：为 Responses API 配备 computer environment"
pubDatetime: 2026-03-15T22:00:00+08:00
description: "OpenAI 工程文章《From model to agent: Equipping the Responses API with a computer environment》中文翻译（含原文引用）。"
slug: from-model-to-agent-responses-api-computer-environment
originalTitle: "From model to agent: Equipping the Responses API with a computer environment"
originalUrl: https://openai.com/index/equip-responses-api-computer-environment
---

> 原文标题：From model to agent: Equipping the Responses API with a computer environment  
> 原文链接：https://openai.com/index/equip-responses-api-computer-environment

![](https://images.ctfassets.net/kftzwdyauwt9/1j8ghdf39iWtEXQAL8Wjf5/37b3a6136cb493574a71ffe483a03467/OAI_Equip_Responses_API_with_a_computer_environment_The_shell_tool_is_just_another_tool_desktop-light__3_.svg?w=3840&q=90)

我们正处在一个从“使用 model（擅长特定任务）”向“使用 agent（能处理复杂工作流）”迁移的阶段。仅通过 prompt 使用 model，你能调用的是训练得到的智能；而给 model 配备一个 computer environment，则可以覆盖更广泛的场景，例如运行服务、向 API 请求数据，或生成更有用的产物（如电子表格、报告）。

当你尝试构建 agent 时，会出现一些实际问题：中间文件放在哪里、如何避免把大表格粘贴进 prompt、如何在不制造安全负担的前提下提供网络访问、如何在不自建工作流系统的情况下处理超时与重试。

与其让开发者自行搭建执行环境，我们构建了必要组件，为 [Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses) 配备 computer environment，以便可靠执行真实世界任务。

OpenAI 的 Responses API 与 shell tool、托管的 container workspace 结合后，正是为了解决这些问题而设计。model 负责提出步骤与命令；平台在隔离环境中执行，并提供用于输入输出的 filesystem、可选结构化存储（如 SQLite）以及受限网络访问。

在本文中，我们将拆解如何为 agent 构建 computer environment，并分享一些早期经验：如何让生产工作流更快、更可复现、更安全。

## shell tool

一个好的 agent workflow，始于紧凑的执行循环：model 提出一个动作（如读文件或通过 API 拉取数据），平台执行动作，结果再反馈到下一步。我们先从 shell tool 讲起（这是观察该循环最直接的方式），然后再介绍 container workspace、networking、可复用 skills 与 context compaction。

要理解 shell tool，先要理解 language model 一般如何使用 tools：例如调用函数或与 computer 交互。训练过程中，model 会看到 tools 的使用方式及其结果（逐步演示）。这会让 model 学会何时使用 tool、如何使用 tool。所谓“使用 tool”，本质上是 model 提出 tool call，它本身不能独立执行调用。

shell tool 会显著增强 model：它通过 command line 与 computer 交互，可完成广泛任务，从文本检索到在 computer 上发送 API 请求。基于熟悉的 Unix 工具链，shell tool 开箱即用提供了 grep、curl、awk 等能力。

相较于只执行 Python 的 code interpreter，shell tool 支持更广的场景，例如运行 Go 或 Java 程序、启动 NodeJS server。这种灵活性使 model 能完成更复杂的 agentic tasks。

## 编排 agent loop

单独的 model 只能提出 shell commands，但这些命令如何执行？我们需要 orchestrator：获取 model 输出、调用 tools、并将 tool 响应回传给 model，循环往复，直到任务完成。

Responses API 是开发者与 OpenAI models 交互的方式。配合 custom tools 时，Responses API 会把控制权交还客户端，客户端需要自己的 harness 来运行 tools。但该 API 也可以开箱即用地在 model 与 hosted tools 之间做 orchestration。

当 Responses API 接收 prompt 时，它会组装 model context：用户 prompt、历史会话状态、tool instructions。要让 shell execution 生效，prompt 需要提到使用 shell tool，且所选 model 必须经过提出 shell commands 的训练——GPT‑5.2 及之后的模型具备此能力。在这些上下文基础上，model 决定下一步动作。若选择 shell execution，会返回一条或多条 shell commands 给 Responses API 服务；API 服务将命令转发给 container runtime，流式回传 shell 输出，并将其注入下一次请求的上下文。随后 model 可以检查结果、发出后续命令，或生成最终回答。Responses API 会重复此循环，直到 model 返回不含新增 shell commands 的完成结果。

当 Responses API 执行 shell command 时，会维持到 container service 的流式连接。随着输出产生，API 会近实时转发给 model，让 model 决定继续等待输出、执行下一条命令，或进入最终响应。

![](https://images.ctfassets.net/kftzwdyauwt9/5XFQ2SSueNXO1UHX1Gx6J4/1065aa14107b9bb4682d44f0991cc832/OAI_Equip_Responses_API_with_a_computer_environment_Agent_loop__Responses_API_orchestrates_model_and_shell_execution_in_cont.svg?w=3840&q=90)

![](https://images.ctfassets.net/kftzwdyauwt9/5TOlwyV32C5GOvMzLCcuSq/2210a01520870c4e688fe27aece58d85/OAI_Equip_Responses_API_with_a_computer_environment_Streaming_shell_command_execution_output_desktop-light__3_.svg?w=3840&q=90)

model 可以在一步中提出多条 shell commands，Responses API 也可通过独立 container sessions 并发执行。每个 session 独立流式输出，API 再将这些流复用为结构化 tool outputs 注入上下文。换言之，agent loop 能并行工作，例如同时检索文件、抓取数据、验证中间结果。

当命令涉及文件操作或数据处理时，shell 输出可能非常大，消耗 context budget 却不提供高价值信号。为此，model 可为每条命令指定输出上限。Responses API 会强制执行该上限，并返回一个有界结果：保留开头与结尾，并标注中间被省略内容。例如可将输出限制为 1,000 字符，并保留首尾：

`text at the beginning ... 1000 chars truncated ... text at the end`

并发执行与有界输出结合后，agent loop 既快又节省上下文，使 model 可以围绕关键结果持续推理，而不是被原始终端日志淹没。

## 当 context window 变满：compaction

agent loops 的一个潜在问题是任务可能运行很久。长任务会填满 context window，而 context window 对跨轮次、跨 agent 的连续性很关键。想象一个 agent 调用 skill、接收响应、追加 tool calls 与推理摘要——有限的 context window 会很快被占满。为了让 agent 在继续运行时保住关键上下文并去除无关信息，我们需要一种机制。

我们没有要求开发者自建总结或状态迁移系统，而是在 Responses API 中加入了原生 compaction，并使其与 model 行为及训练方式对齐。

最新模型经过训练，可分析先前会话状态并生成 compaction item，以加密且 token-efficient 的表示保留关键历史状态。完成 compaction 后，下一个 context window 由该 compaction item 与上一窗口中的高价值部分组成。这样在长时、多步骤、tool-driven 会话中，即便跨越窗口边界，workflow 仍可保持连贯。[Codex 依赖该机制](https://openai.com/index/unrolling-the-codex-agent-loop/) 来支撑长时间编码任务与迭代式工具执行而不降低质量。

compaction 既可使用内置 server-side 方案，也可通过独立 `/compact` endpoint。server-side compaction 允许配置阈值，系统会自动处理时机，省去复杂客户端逻辑。它还能在 compaction 前容忍少量超限输入，使接近上限的请求仍可先处理并压缩，而不是直接拒绝。随着模型训练迭代，原生 compaction 方案也会随 OpenAI 模型版本演进。

Codex 在作为早期用户的同时也参与了 compaction 系统建设。当一个 Codex 实例遇到 compaction 错误时，我们会拉起第二个实例来排查。结果是，Codex 通过“解决这个问题”获得了原生且有效的 compaction 系统。Codex 能检查并改进自身，这已成为 OpenAI 工作中一个特别有意思的部分。多数工具只要求用户学会使用；Codex 会与我们一起学习。

## Container context

接下来是状态与资源。container 不只是运行命令的地方，也是 model 的工作上下文。在 container 内，model 可读取文件、查询数据库、并在网络策略控制下访问外部系统。

container context 的第一部分是 filesystem，用于上传、组织和管理资源。我们构建了 [container and file APIs](https://developers.openai.com/api/reference/resources/containers)，为 model 提供可用数据“地图”，帮助其执行定向文件操作，而不是进行宽泛且噪声较大的扫描。

一种常见反模式是把所有输入都塞进 prompt 上下文。输入规模增长后，这会变得昂贵，也更难让 model 定位信息。更好的模式是把资源先放进 container filesystem，再由 model 决定用 shell commands 打开、解析、转换哪些内容。与人类似，model 在信息组织良好时表现更好。

container context 的第二部分是数据库。在很多场景中，我们建议开发者将结构化数据存入数据库（如 SQLite）并通过查询使用。比如，不必把整张电子表格复制到 prompt 中，你可以提供数据表说明（有哪些列、列含义是什么），然后让 model 按需提取行。

例如当你问“本季度哪些产品销量下滑？”，model 可以只查询相关行，而无需扫描整张表。这更快、更便宜，也更容易扩展到大数据集。

container context 的第三部分是网络访问，这是 agent workload 的关键组成。agent workflow 可能需要抓取实时数据、调用外部 API、安装包。同时，给 container 不受限互联网访问也存在风险：可能把信息暴露给外部网站、无意触达敏感内部或第三方系统、并让凭证泄露与数据外流更难防护。

为在不削弱 agent 可用性的前提下处理这些问题，我们让托管 containers 使用 sidecar egress proxy。所有外发网络请求都会经过集中策略层，由其执行 allowlist 与访问控制，并保留可观测性。凭证方面，我们在出口层使用按域名作用域的 secret injection。model 与 container 只看到占位符；原始 secret 值留在 model 不可见范围内，仅在已批准目标上应用。这样在支持鉴权外部调用的同时，降低泄露风险。

![](https://images.ctfassets.net/kftzwdyauwt9/2rdxS5bXiQLnB1Vg05psLC/2ed0d4804552378d2b84afa12ce61b28/OAI_Equip_Responses_API_with_a_computer_environment_Inside_the_runtime_container_desktop-light__3_.svg?w=3840&q=90)

![](https://images.ctfassets.net/kftzwdyauwt9/5jdZBRDhIKcZYnInY56pfP/1da57e4e1067b57e0e6fa66a794c0807/OAI_Equip_Responses_API_with_a_computer_environment_Controlled_network_access_via_access_egress_proxy_-_container_setup_desk.svg?w=3840&q=90)

## Agent skills

shell commands 很强大，但许多任务会反复出现相同的多步骤模式。agent 每次运行都要重新发现流程——重新规划、重新发命令、重新学习约定——这会导致结果不一致并浪费执行。 [Agent skills](https://agentskills.io/home) 把这些模式封装为可复用、可组合构件。具体来说，一个 skill 是一个文件夹 bundle，包含 `SKILL.md`（元数据与说明）以及配套资源（例如 API 规格、UI 资源）。

这种结构与前文 runtime architecture 自然契合。container 提供持久文件与执行上下文，shell tool 提供执行接口。两者具备后，model 就能在需要时通过 shell commands（`ls`、`cat` 等）发现 skill 文件、理解说明，并在同一 agent loop 中执行 skill 脚本。

我们提供了在 OpenAI 平台管理 skills 的 [APIs](https://developers.openai.com/api/reference/resources/skills)。开发者可上传并存储 skill 文件夹为版本化 bundle，后续再按 skill ID 取回。在把 prompt 送入 model 前，Responses API 会加载 skill 并将其纳入 model context。该序列是确定性的：

- 拉取 skill 元数据（名称与描述）；
- 拉取 skill bundle，复制到 container 并解包；
- 用 skill 元数据与 container 路径更新 model context。

在判断某个 skill 是否相关时，model 会逐步探索其说明，并通过 container 中的 shell commands 执行其脚本。

![](https://images.ctfassets.net/kftzwdyauwt9/7gic678N6fNMJxo5Gu63Xp/0927d6d543c4427268891853a2d04b23/OAI_Equip_Responses_API_with_a_computer_environment_Skill_loading_pipeline_desktop-light__4_.svg?w=3840&q=90)

## agents 是如何被构建出来的

把这些组件拼起来：Responses API 提供 orchestration，shell tool 提供可执行动作，hosted container 提供持久 runtime context，skills 叠加可复用 workflow 逻辑，compaction 让 agent 能在保留关键上下文的前提下长时间运行。

借助这些 primitives，一条 prompt 就能扩展为端到端 workflow：发现合适 skill、抓取数据、转为本地结构化状态、高效查询并生成可持久化产物。

![](https://images.ctfassets.net/kftzwdyauwt9/2HpM23YXC1Pl0UC2j3E2ZN/18288c2295455fe4b32c26fed6f8bb15/OAI_Equip_Responses_API_with_a_computer_environment_Request_lifecycle_-_1_Skill_discovery_desktop-light__3_.svg?w=3840&q=90)

## 构建你自己的 agent

若你想看 shell tool 与 computer environment 结合端到端 workflow 的深入示例，可参考我们的 [developer blog post](https://developers.openai.com/blog/skills-shell-tips) 与 [cookbook](https://developers.openai.com/cookbook/examples/skills_in_api)。其中演示了如何打包 skill 并通过 Responses API 执行。

我们很期待开发者基于这组 primitives 构建出的东西。language models 的目标不止于生成文本、图像和音频——我们会继续演进平台，使其在大规模处理复杂真实任务方面更强。

## 引用

- 原文：
  https://openai.com/index/equip-responses-api-computer-environment
- OpenAI Developers（文中提及）：
  https://developers.openai.com/blog/skills-shell-tips
- OpenAI Cookbook（文中提及）：
  https://developers.openai.com/cookbook/examples/skills_in_api
