---
title: 使用 Deep Agents、LangSmith 和 Parallel 构建企业尽职调查 Agent
pubDatetime: 2026-05-12T11:00:00+08:00
description: 本文介绍如何结合 LangChain Deep Agents、LangSmith 可观测性和 Parallel Task API，构建一个自动化企业尽职调查 Agent，实现多维度公司研究与结构化情报报告。
slug: company-due-diligence-agent-deep-agents-langsmith-parallel-zh
originalTitle: "Building a company due diligence agent with Deep Agents, LangSmith and Parallel"
originalUrl: https://www.langchain.com/blog/building-a-company-due-diligence-agent-with-deep-agents-langsmith-and-parallel
---

原文标题：Building a company due diligence agent with Deep Agents, LangSmith and Parallel<br>
原文链接：https://www.langchain.com/blog/building-a-company-due-diligence-agent-with-deep-agents-langsmith-and-parallel

# 使用 Deep Agents、LangSmith 和 Parallel 构建企业尽职调查 Agent

![](https://cdn.prod.website-files.com/65c81e88c254bb0f97633a71/69fc07193192cebc73980fd3_logo%20and%20title%20-%2020%20characters%20max%20(6).png)

*通过 agentic orchestration 和结构化网络情报，自动化多步骤公司研究流程。*

公司尽职调查是金融服务领域中随处可见的工作流程。PE 分析师筛选交易，银行信贷团队评估借款方，合规团队为新实体办理入驻手续，保险承保人评估商业保单持有人。这类研究遵循一种固定模式：选定一家公司，从多个维度进行调查，最终产出一份结构化的情报报告，每项结论都有来源追踪。

本 cookbook 构建了一个 agent，通过结合 LangChain 的 [Deep Agents](https://docs.langchain.com/oss/python/deepagents/overview) 进行 orchestration，以及 [Parallel 的 Task API](https://docs.parallel.ai/task-api/task-quickstart) 进行网络研究，来自动化上述工作流程。Deep Agents 负责规划、subagent 委派和上下文管理。Parallel 负责实际的研究工作，通过 [Basis](https://docs.parallel.ai/task-api/guides/access-research-basis) 返回带有逐字段引用、推理追踪和校准置信度分数的结构化发现。当某个研究方向的发现引发新问题时，Parallel 的[交互式研究](https://docs.parallel.ai/task-api/guides/interactions)功能允许 agent 在保留先前研究线程完整上下文的情况下，链式发起后续查询。

## 概述

该 agent 协调五条研究主线，每条由一个专属 subagent 处理：

- **企业概况** — 法律实体结构、主要高管、创立历史、员工人数、办公地点
- **财务状况** — 融资历史、营收信号、估值指标、盈利能力标志
- **诉讼与监管** — 诉讼案件、SEC 备案、制裁筛查、监管行动、和解情况
- **新闻与声誉** — 近期媒体报道、领导层变动、争议标记、媒体情绪
- **竞争格局** — 识别前三名直接竞争对手及目标公司的市场定位

一旦 `competitive-landscape` 返回命名列表，orchestrator 便会**针对每个竞争对手**分别派发一个独立的 `competitor-analysis` subagent，并行执行——这是 Deep Agents 经典的扇出结构，每个实例在各自独立的上下文中运行。随后，orchestrator 读取所有工作文件，交叉核对矛盾之处和低置信度发现，在发现差异时通过 Parallel 的 Search API 进行专项查询，最终撰写包含风险标记和引用追踪的最终报告。

尽职调查需要这种多步骤架构，因为早期发现会改变后续需要调查的内容。如果企业概况揭示目标公司是某子公司，财务分析就需要覆盖母公司。如果诉讼扫描发现 SEC 调查，风险评估就会随之改变。Deep Agents 的规划工具使 orchestrator 能够在发现结果改变研究计划时做出调整。

每条研究主线使用 `pro-fast` 处理器调用 Task API。经 Rivian Automotive（纳斯达克：RIVN）端到端验证：九次调用，约 23 分钟完成。当前费率请参阅 [Parallel 定价](https://docs.parallel.ai/getting-started/pricing)。

## 实现

```python
uv pip install deepagents langchain-parallel langchain-anthropic
```

```python
export ANTHROPIC_API_KEY="your-anthropic-api-key"
export PARALLEL_API_KEY="your-parallel-api-key"
```

### 定义 Parallel 研究工具

我们定义两个工具。第一个封装 Parallel 的 Task API，用于支持 Basis 置信度处理的结构化研究。第二个使用 LangChain 集成的网络搜索工具，用于合成阶段的快速事实查询。

```python
from typing import Optional

from langchain_core.tools import tool
from langchain_parallel import (
    ParallelTaskRunTool,
    ParallelWebSearchTool,
    parse_basis,
)


@tool
def research_task(
    query: str,
    output_description: str,
    previous_interaction_id: Optional[str] = None,
) -> dict:
    """Run structured web research via Parallel's Task API.

    Returns findings with per-field citations and confidence scores (Basis).
    Use previous_interaction_id to chain follow-up queries that build on
    prior research context.
    """
    runner = ParallelTaskRunTool(
        processor="pro-fast",
        task_output_schema=output_description,
    )
    invoke_args: dict = {"input": query}
    if previous_interaction_id:
        invoke_args["previous_interaction_id"] = previous_interaction_id

    result = runner.invoke(invoke_args)
    parsed = parse_basis(result)

    output = result["output"]
    findings = output.get("content") if isinstance(output, dict) else output

    response: dict = {
        "findings": findings,
        "citations_by_field": parsed["citations_by_field"],
        "interaction_id": parsed["interaction_id"],
    }
    if parsed["low_confidence_fields"]:
        response["low_confidence_warning"] = (
            "These fields came back with low confidence and should be "
            "verified, ideally by chaining a follow-up query with "
            "previous_interaction_id: "
            + ", ".join(parsed["low_confidence_fields"])
        )
    return response


# Quick search tool for fast factual lookups during synthesis
quick_search = ParallelWebSearchTool()
```

该工具在原始 API 调用的基础上额外完成三件事：调用 `parse_basis(result)` 提取逐字段引用及低置信度字段名称；将这些字段名称作为显式的 `low_confidence_warning` 暴露在工具返回值中，使调用该工具的 subagent 推理循环能够决定是否发起后续链式查询；并返回 `interaction_id`，以便链式调用通过 `previous_interaction_id` 锚定到同一研究线程。

### 定义研究 subagent

每条研究主线都有其专属的 subagent，配备专门的系统提示词和对 `research_task` 工具的访问权限。

```python
corporate_profile_subagent = {
    "name": "corporate-profile",
    "description": "Research corporate structure, leadership, founding history, and headcount",
    "system_prompt": """You are a corporate research analyst.

Given a company, use the research_task tool to find:
- Legal entity name, incorporation state/country, founding date
- Current CEO and key executives (names, titles, approximate tenure)
- Headquarters location and major office locations
- Employee headcount (current and recent trend)
- Corporate structure (parent company, major subsidiaries)

For the output_description parameter, request these as structured fields.

If the result includes a low_confidence_warning, chain a follow-up query
using the returned interaction_id to verify the flagged fields.

Write your findings (including citations_by_field) to corporate-profile.md.""",
    "tools": [research_task],
}
```

其他阶段一的 subagent（`financial-health`、`litigation-regulatory`、`news-reputation`、`competitive-landscape`）遵循相同结构，各有其专注的提示词。完整集合见 [`agent.py`](https://github.com/parallel-web/parallel-cookbook/blob/306f5f6416817542df78136c412db2ca0bcebf35/python-recipes/parallel-deepagents-due-diligence/agent.py)。

阶段二的扇出 subagent 针对 `competitive-landscape` 识别出的每个竞争对手各调用一次：

```python
competitor_analysis_subagent = {
    "name": "competitor-analysis",
    "description": "Produce a focused profile of one named competitor",
    "system_prompt": """You are a competitive intelligence researcher.

The orchestrator will pass you a single competitor name and the original
DD target. Make one research_task call requesting:
- Corporate snapshot (HQ, public/private, headcount, founding year)
- Most recent revenue and growth signals
- Funding or market cap status
- Product / positioning vs. the original DD target
- Recent strategic moves in the last 12 months
- Notable strengths and weaknesses relative to the target

Write your findings to competitor-<slug>.md.""",
    "tools": [research_task],
} 
```

### 创建 orchestrator agent

主 agent 协调各 subagent，审查发现结果中的矛盾，并生成最终报告。我们为其配置 [`FilesystemBackend`](https://docs.langchain.com/oss/python/deepagents/filesystem)，使工作文件和最终备忘录持久化存储到磁盘的 `./reports/` 目录下，而不是随 agent 状态消失。

```python
from pathlib import Path

from deepagents import create_deep_agent
from deepagents.backends.filesystem import FilesystemBackend

REPORTS_DIR = Path("./reports")
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

diligence_instructions = """\
You are a senior due diligence analyst managing a team of specialized
researchers. Your job is to produce a comprehensive company intelligence
report with verifiable claims.

## Your Process

1. **Plan the research**: Use write_todos to lay out the diligence as a
   checklist. Phase 1 dispatches the five Phase-1 subagents. Phase 2
   dispatches one competitor-analysis subagent per competitor identified
   by competitive-landscape.

2. **Phase 1 — parallel research**: Use the task tool to dispatch
   corporate-profile, financial-health, litigation-regulatory,
   news-reputation, and competitive-landscape concurrently.

3. **Phase 2 — competitor fan-out**: Read competitive-landscape.md and
   parse the three named competitors. Dispatch a separate
   competitor-analysis subagent instance per competitor, in parallel.

4. **Review and cross-reference**: Read every workpaper. Look for
   contradictions, low-confidence findings, and gaps. Use quick_search
   for ad-hoc lookups during synthesis.

5. **Synthesize the report** with: executive summary, corporate profile,
   financial overview, litigation and regulatory risk assessment, news
   and reputation analysis, competitive landscape (with per-competitor
   sub-sections), confidence and verification notes, and key risk flags.

## Citation and Confidence Guidelines

- Include source URLs for key claims.
- Call out any finding where confidence was low. These need human verification.
- If two tracks produced contradictory information, note the discrepancy
  explicitly with citations from both sources.
"""

agent = create_deep_agent(
    model="anthropic:claude-sonnet-4-6",
    tools=[quick_search],
    subagents=[
        corporate_profile_subagent,
        financial_health_subagent,
        litigation_subagent,
        news_reputation_subagent,
        competitive_landscape_subagent,
        competitor_analysis_subagent,
    ],
    system_prompt=diligence_instructions,
    backend=FilesystemBackend(root_dir=REPORTS_DIR, virtual_mode=True),
)
```

### 运行 agent

```python
result = agent.invoke({
    "messages": [{
        "role": "user",
        "content": "Conduct a full due diligence report on Rivian Automotive",
    }]
})

print(result["messages"][-1].content)
```

### 流式获取执行进度

对于耗时较长的尽职调查任务，可以流式获取 agent 的执行进度，实时查看规划、工具调用和 subagent 活动。传入 `subgraphs=True` 以接收来自 subagent 内部执行的事件。

```javascript
for chunk in agent.stream(
    {"messages": [{"role": "user", "content": "Conduct a full due diligence report on Rivian Automotive"}]},
    stream_mode="updates",
    subgraphs=True,
    version="v2",
):
    if chunk.get("type") == "updates":
        source = f"[subagent: {chunk['ns']}]" if chunk.get("ns") else "[orchestrator]"
        print(f"{source} {chunk.get('data')}")
```

## 使用 LangSmith 实现可观测性

### 为何可观测性在 FSI 中至关重要

在 FSI 中，监管机构、审计人员和风险团队越来越期望企业能够还原 AI 辅助输出的生成过程，尤其是当这些输出影响到重大业务决策时。六个月后，内部审计员、合规审查员、模型风险团队、投资委员会或监管机构可能会询问某份 AI 辅助尽职调查备忘录是如何产生的：哪些来源支撑了每项重要结论？附加的置信度是多少？人工审查或覆盖输出发生在哪里？agent 的执行过程是否有足够完整的日志可供还原？在 FSI 中，"agent 给了我一个答案"并不是可辩护的控制立场。

该 agent 叠加了非确定性（LLM 输出、提示词敏感性、开放网络），花费真实资金进行真实的网络研究，最终生成一份监管机构日后可能审计的备忘录。每项声明都必须追溯到带有明确置信度标签的一手来源，且这种映射关系在运行结束数月后仍需可供审计。一旦 agent 投入生产，其大多数故障也会在那里浮现——上线前的测试很少能捕获这些问题。追踪记录是运行结束后留存下来的工件。

这正是追踪记录在 FSI 中尤为重要的原因：

- **日志记录日益被强制要求。** 欧盟《AI 法案》要求对高风险 AI 系统进行自动事件日志记录，美国银行监管机构在实践中也将模型风险管理预期应用于 AI agent，即便正式范围尚未厘清。追踪记录正是这两个框架所预设的工件。
- **决策可解释性需要逐声明的溯源支撑。** 当 AI 输入进入受监管的决策流程（如消费者信贷、投资建议，或任何受信义义务约束的流程）时，机构必须解释该输入是如何形成的。Basis 载荷（来源 URL 和逐输出置信度）正是使这种解释在运行结束数月后仍可复现的基础。
- **第三方 AI 需要持续监督。** 该技术栈使用了外部模型提供商和外部研究 API（Parallel）。追踪记录记录了向每个提供商发送了什么、收到了什么回应，以及这些输出如何影响最终备忘录，从而支持问题调查和供应商监督。
- **操作韧性依赖快速根因分析。** 如果 agent 故障导致重大运营中断或需上报的 ICT 事件，追踪记录为团队提供了还原、修复和上报的具体起点。

### 合规与审计的当前运作方式

FSI 团队已有一套证明研究备忘录生成过程的体系：分析师工作底稿、引用列表、来源审批、版本历史和合规审查。这套模式之所以有效，是因为分析师是问责的基本单元。当审查员、审计员或合规审查人询问某项结论是如何得出的，分析师可以逐步梳理推理过程，以工作底稿和引用支撑最终交付物。AI agent 改变了这一模式。

"分析师"不再只是一个人，而是由 LLM 调用、工具调用、检索来源、中间输出和状态转换组成的图结构。除非在运行时捕获这些步骤，最终备忘录或许得以留存，但产生它的过程可能消散在难以事后还原的日志、上下文窗口和供应商调用之中。追踪记录恢复了这个关联点。它成为机器端的工作底稿：一份可检查的记录，说明哪些来源支撑了每项重要结论、附加了何种置信度、调用了哪些工具、人工审查发生在何处，以及最终输出是如何产生的。

### LangSmith 捕获的内容

LangSmith 无需修改任何 agent 代码，即可记录该 agent 中每个 Deep Agents 步骤和每次 `ParallelTaskRunTool` 调用：subagent 构建的提示词、Parallel 返回的 URL、带置信度的 Basis 载荷，以及结构化发现。每次运行还会按节点分解成本，覆盖每次模型调用、工具调用和 subagent，让你清楚地看到哪个步骤消耗了多少 token 和时间。当两次运行的成本差异悬殊时，追踪记录会显示差异究竟来自 subagent 推理、额外的 Parallel 调用，还是最终的合成阶段。

### 追踪记录呈现的内容

打开任意一次运行，首先看到的是 orchestrator 的计划：一份四阶段的 TODO，在任何 subagent 运行之前便已规划好研究策略。

![Orchestrator 在运行开始时由 write_todos 生成的四阶段计划。](https://cdn.prod.website-files.com/65c81e88c254bb0f97633a71/69fbd5b1c7636f0d319369f3_01-orchestrator-plan.png)

*Orchestrator 在运行开始时由 write_todos 生成的四阶段计划。*

阶段一随后并行派发全部五个研究 subagent：`corporate-profile`、`financial-health`、`litigation-regulatory`、`news-reputation` 和 `competitive-landscape`。每个 subagent 在派发工具调用中以纯文本英语接收专注的任务说明。点击追踪记录中的任意 `task` 节点，即可看到该 subagent 的详细执行情况：它发出的提示词、进行的 Parallel 调用，以及返回的来源。

![阶段一扇出：五个研究 subagent 并行派发。](https://cdn.prod.website-files.com/65c81e88c254bb0f97633a71/69fbd62197a2044d0db7ffc0_02-phase1-fanout.png)

*阶段一扇出：五个研究 subagent 并行派发。*

阶段一完成后，orchestrator 扇出各竞争对手分析（阶段二），交叉核对工作底稿中的矛盾（阶段三），并合成最终备忘录（阶段四）。每次工具调用均沿途被捕获。

选择任意 subagent 的 `research_task`，即可看到 Parallel 返回的完整结构化发现：每个字段、每段摘录和每个 URL，包括超出工作底稿摘要部分的内容。

![某 subagent 的 research_task 输出：Parallel 返回的结构化发现。](https://cdn.prod.website-files.com/65c81e88c254bb0f97633a71/69fbd81fc6bfd0781c79c411_03-research-task.png)

*某 subagent 的 research_task 输出：Parallel 返回的结构化发现。*

### 引用与置信度

对于合规审查员而言，相关视图是 `parallel_task_run` 内的 Basis 载荷。Parallel 为每项输出附加了来源 URL、置信度标签（高 / 中 / 低）以及说明答案组装方式的单行推理追踪。

![Basis 载荷：来源 URL、置信度标签和推理追踪。](https://cdn.prod.website-files.com/65c81e88c254bb0f97633a71/69fbd7ee90598597f1c65594_04-basis-payload.png)

*Basis 载荷：来源 URL、置信度标签和推理追踪。*

在上述 Rivian 企业概况调用中，agent 的 `medium`（中等）置信度输出依据四个来源：SEC.gov 上的 Rivian 10-K 和 2026 年年报、第三方转载的 2026 年代理声明，以及维基百科。两份 SEC 一手备案文件、一份二手转载和一份三手来源的组合，正是合规审查员想要标记的溯源模式。借助追踪记录，溯源关系可以逐声明检查，这类溯源模式也可在多次运行中加以改进。缺乏此层次的工作底稿会将相同的四个 URL 并列罗列，无法区分哪些是一手来源。

### 超越单次追踪

对于一份尽职调查备忘录，追踪记录就是审计线索。对于一个季度内运行的多份备忘录，你还需要模式发现：哪个 subagent 产生最多低置信度输出，哪些目标公司触发最多链式 Parallel 后续查询，哪些来源开始返回更薄的内容。LangSmith 正是在追踪记录基础上构建了跨运行分析能力。对于大规模开展尽职调查的 FSI 团队，这一能力将审计线索转化为一种运营规范。

## 适用场景

该架构适用于任何在公司层面运行结构化研究工作流程的团队，包括交易筛选、信贷承销、KYB/KYC 入驻、M&A 目标评估和供应商风险评估。

本文所述的五条研究主线只是一个起点。可根据工作流程需要替换相应主线：为合规密集型尽职调查添加管理背景调查和受益所有权追踪，为 M&A 筛选添加知识产权组合分析，为供应商评估添加 SOC 2 验证。每条额外的主线都是一个新的 subagent 字典，配以系统提示词和相同的 `research_task` 工具。

## 资源

- [完整源代码](https://github.com/parallel-web/parallel-cookbook/tree/main/python-recipes/parallel-deepagents-due-diligence)
- [Deep Agents 文档](https://docs.langchain.com/oss/python/deepagents/overview)
- [Parallel Task API](https://docs.parallel.ai/task-api/task-quickstart)
- [Parallel Basis 与引用](https://docs.parallel.ai/task-api/guides/access-research-basis)
- [Parallel 交互式研究](https://docs.parallel.ai/task-api/guides/interactions)
- [`langchain-parallel` SDK](https://github.com/parallel-web/langchain-parallel)
- [获取 Parallel API 密钥](https://platform.parallel.ai/)

---

## 引用

- 原文：[Building a company due diligence agent with Deep Agents, LangSmith and Parallel](https://www.langchain.com/blog/building-a-company-due-diligence-agent-with-deep-agents-langsmith-and-parallel)
- [Deep Agents documentation](https://docs.langchain.com/oss/python/deepagents/overview)
- [Parallel Task API documentation](https://docs.parallel.ai/task-api/task-quickstart)
- [Full source code on GitHub](https://github.com/parallel-web/parallel-cookbook/tree/main/python-recipes/parallel-deepagents-due-diligence)
