---
title: "构建带 Skills 的 ADK Agent：开发者指南"
pubDatetime: 2026-04-02T15:00:00+08:00
description: "Google Developers Blog《Developer's Guide to Building ADK Agents with Skills》中文翻译（含原文引用）。介绍 ADK 的 SkillToolset 如何通过渐进式披露（Progressive Disclosure）架构让 Agent 按需加载领域知识，并实现自我扩展能力。"
slug: developers-guide-to-building-adk-agents-with-skills-zh
originalTitle: "Developer's Guide to Building ADK Agents with Skills"
originalUrl: https://developers.googleblog.com/developers-guide-to-building-adk-agents-with-skills/
---

> 原文标题：Developer's Guide to Building ADK Agents with Skills
> 原文链接：[developers.googleblog.com](https://developers.googleblog.com/developers-guide-to-building-adk-agents-with-skills/)
> 发布时间：2026 年 4 月 1 日
> 作者：Lavi Nigam（Developer Relations Engineer）、Shubham Saboo（Senior AI Product Manager）

![Developer's Guide to Building ADK Agents with Skills](https://storage.googleapis.com/gweb-developer-goog-blog-assets/images/part1-cover.original.png)

## 引言

你的 AI Agent 能够遵循指令，但它能自己编写新指令吗？Agent Development Kit（ADK）的 SkillToolset 使 Agent 能够按需加载领域专业知识。通过合适的 Skill 配置，你的 Agent 还能在运行时生成全新的专业能力。无论你需要安全审查清单、合规审计，还是数据管道验证器，工作流程都很简单：生成、加载、使用。

SkillToolset 通过 **渐进式披露（Progressive Disclosure）** 实现这一点。这种架构模式让 Agent 仅在需要时精确加载上下文，而不是将数千个 Token 塞进一个单体 System Prompt 中。

在本指南中，我们将逐步介绍四种实用的 Skill 模式：

1. **内联清单（Inline Checklist）：** 一种基础的硬编码 Skill 实现。
2. **基于文件的 Skill（File-based Skill）：** 加载外部指令和参考资源。
3. **外部导入（External Import）：** 利用社区驱动的 Skill 仓库。
4. **Skill 工厂（Skill Factory）：** 一种自我扩展模式，Agent 按需编写新的 Skill。

每种模式都建立在前一种的基础上，最终形成一个能够动态扩展自身能力的 Agent 架构。

## 单体 Prompt 的问题

大多数 AI Agent 直接从 System Prompt 获取领域知识。开发者通常会将合规规则、风格指南、API 参考文档和故障排查流程串联成一个庞大的指令字符串。

当 Agent 只有两三个能力时，这种方式还行得通。然而，当你扩展到十个以上的任务时，将所有指令都串联到 System Prompt 中会在每次 LLM 调用时消耗数千个 Token——无论用户的具体查询是否真的需要那些知识。

Agent Skills 规范通过 **渐进式披露** 解决了这一问题。它将知识加载分为三个不同的层级：

- **L1 元数据（每个 Skill 约 100 Token）：** 仅包含 Skill 名称和描述。在启动时为所有 Skill 加载，充当 Agent 扫描以决定相关内容的菜单。
- **L2 指令（< 5,000 Token）：** 完整的 Skill 正文。仅在 Agent 显式激活特定 Skill 时通过 API 加载。
- **L3 资源（按需）：** 外部参考文件，如风格指南或 API 规范。仅在 Skill 指令需要时加载。

![Progressive Disclosure 架构](https://storage.googleapis.com/gweb-developer-goog-blog-assets/images/part1-progressive-disclosure_1.original.png)

通过这种架构，一个拥有 10 个 Skill 的 Agent 在每次调用时仅以大约 1,000 Token 的 L1 元数据启动，而非单体 Prompt 中的 10,000 Token。这意味着基线上下文使用量减少了约 90%。

ADK 通过 `SkillToolset` 类实现这一点，它自动生成三个工具：`list_skills`（L1）、`load_skill`（L2）和 `load_skill_resource`（L3）。

## 模式 1：内联 Skills _（便签条）_

最简单的模式：一个包含 `name`、`description` 和 `instructions` 的 Python 对象，直接在 Agent 代码中定义。最适合小型、稳定且很少变化的规则。

```python
# ADK 伪代码：模式 1：内联 Skill

seo_skill = models.Skill(
    frontmatter=models.Frontmatter(
        name="seo-checklist",
        description="SEO optimization checklist for blog posts. Covers title tags, meta descriptions, heading structure, and readability.",
    ),
    instructions=(
        "When optimizing a blog post for SEO, check each item:\n"
        "1. Title: 50-60 chars, primary keyword near the start\n"
        "2. Meta description: 150-160 chars, includes a call-to-action\n"
        "3. Headings: H2/H3 hierarchy, keywords in 2-3 headings\n"
        "4. First paragraph: Primary keyword in first 100 words\n"
        "5. Images: Alt text with keywords, compressed, descriptive names\n"
        "Review the content against each item and suggest improvements."
    ),
)
```

![内联 Skill SEO 审查](https://storage.googleapis.com/gweb-developer-goog-blog-assets/images/part1-inline-skill-seo-review.original.png)

`frontmatter` 字段成为 L1 元数据，LLM 在每次调用时都能看到。`instructions` 成为 L2，仅在 Agent 判断此 Skill 相关时加载。当被问到"帮我审查这篇博客文章的 SEO"时，Agent 会加载此 Skill 并系统地检查每一项。

## 模式 2：基于文件的 Skills（参考活页夹）

内联 Skill 适合简单的清单。但如果你的 Skill 需要参考文档（风格指南、API 规范），你就需要一个目录。

基于文件的 Skill 存放在自己的目录中，包含一个 SKILL.md 文件和可选的引用、资产和脚本子目录。SKILL.md 以 YAML Frontmatter 开头，后跟 Markdown 指令。

```
skills/blog-writer/
├── SKILL.md           # L2：指令
└── references/
    └── style-guide.md # L3：按需加载
```

![L3 资源加载](https://storage.googleapis.com/gweb-developer-goog-blog-assets/images/part2-l3-resource-loading.original.png)

这种设计将知识分散到两个层级。`SKILL.md` 指令（L2）告诉 Agent 该遵循哪些步骤。`references/style-guide.md` 文件（L3）为每个步骤提供详细的领域知识。Agent 仅在其指令通过 `load_skill_resource` 工具指示时才加载参考资源。

```python
# ADK 伪代码：模式 2：基于文件的 Skill

blog_writer_skill = load_skill_from_dir(
    pathlib.Path(__file__).parent / "skills" / "blog-writer"
)
```

基于文件的 Skill 使知识可复用。任何遵循 [agentskills.io](https://agentskills.io/specification) 规范的 Agent 都可以加载同一目录。但在这种场景下，你仍然需要自己编写 `SKILL.md`。

## 模式 3：外部 Skills（导入）

外部 Skills 的工作方式与基于文件的 Skills 完全相同。唯一的区别在于目录的来源。你不再自己编写 SKILL.md，而是从社区仓库（如 [awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills)）下载，然后用同样的 `load_skill_from_dir` 调用加载。

```python
# ADK 伪代码：模式 3：外部 Skill（相同 API，不同来源）

content_researcher_skill = load_skill_from_dir(
    pathlib.Path(__file__).parent / "skills" / "content-research-writer"
)
```

代码与模式 2 完全相同。[agentskills.io](https://agentskills.io/specification) 规范定义了通用的目录格式，因此 `load_skill_from_dir` 不在乎 SKILL.md 是你自己写的还是下载的。Google 也使用相同格式发布官方 ADK 开发 Skills，可通过 `npx skills add google/adk-docs -y -g` 安装。

这三种模式覆盖了已经存在的 Skills——无论是你自己编写的还是找到的。模式 4 闭合了这个循环：Agent 自己编写 Skills。

## 模式 4：Skill 工厂——自我编写的 Meta Skills

Meta Skill 是一种以生成新 `SKILL.md` 文件为目的的 Skill。配备 Meta Skill 的 Agent 变成了可自我扩展的——它可以在运行时编写和加载新的 Skill 定义，无需人工干预即可扩展自身能力。

Skill Creator 是一个内联 Skill，其指令解释了如何编写有效的 `SKILL.md` 文件。关键在于 `resources` 字段。它将 [agentskills.io](https://agentskills.io/specification) 规范本身和一个可工作的示例作为 L3 参考资源嵌入。当被要求创建新 Skill 时，Agent 读取这些参考资源并生成符合规范的 `SKILL.md`。

```python
# ADK 伪代码：模式 4：Meta Skill（Skill 工厂）

skill_creator = models.Skill(
    frontmatter=models.Frontmatter(
        name="skill-creator",
        description=(
            "Creates new ADK-compatible skill definitions from requirements."
            " Generates complete SKILL.md files following the Agent Skills"
            " specification at agentskills.io."
        ),
    ),
    instructions=(
        "When asked to create a new skill, generate a complete SKILL.md file.\n\n"
        "Read `references/skill-spec.md` for the format specification.\n"
        "Read `references/example-skill.md` for a working example.\n\n"
        "Follow these rules:\n"
        "1. Name must be kebab-case, max 64 characters\n"
        "2. Description must be under 1024 characters\n"
        "3. Instructions should be clear, step-by-step\n"
        "4. Reference files in references/ for detailed domain knowledge\n"
        "5. Keep SKILL.md under 500 lines, put details in references/\n"
        "6. Output the complete file content the user can save directly\n"
    ),
    resources=models.Resources(
        references={
            "skill-spec.md": "# Agent Skills Specification (agentskills.io)...",
            "example-skill.md": "# Example: Code Review Skill...",
        }
    ),
)
```

![Meta Skill Creator 输出](https://storage.googleapis.com/gweb-developer-goog-blog-assets/images/part3-meta-skill-creator-output.original.png)

`resources` 字段是 `models.Resources` 类发挥关键作用的地方。引用将 agentskills.io 规范嵌入为 `skill-spec.md`，将一个可工作的代码审查 Skill 嵌入为 `example-skill.md`。当 Agent 调用 `load_skill_resource("skill-creator", "references/skill-spec.md")` 时，它会获取完整的规范——定义了有效 Skill 应如何构建。

**生成 Skills 的最佳实践：** 虽然自动生成 Skills 是一个强大的工作流，但我们建议保持 Human-in-the-Loop 来审查最终的 SKILL.md。作为构建 _任何_ Skill 的标准实践，你应该测试其有效性。你可以通过使用 ADK 构建健壮的评估（Eval）来轻松做到这一点，以确保你的 Skill 在部署前完全按预期工作。

## Skill 工厂实战

向 Agent 提问：_"我需要一个新的 Skill，用于审查 Python 代码中的安全漏洞。"_

Agent 加载 Skill Creator，通过 `load_skill_resource` 读取规范和示例，然后生成一个完整的 Python 安全审查 Skill——带有有效的 kebab-case 命名、涵盖输入验证、身份认证和加密的结构化指令，以及基于严重性的报告格式。

## 将所有部分组合在一起

定义好所有四个 Skill 后，将它们打包到 `SkillToolset` 并交给 Agent 只需几行代码：

```python
# ADK 伪代码：组装 Skill 工厂

skill_toolset = SkillToolset(
    skills=[seo_skill, blog_writer_skill, content_researcher_skill, skill_creator]
)

root_agent = Agent(
    model="gemini-2.5-flash",
    name="blog_skills_agent",
    description="A blog-writing agent powered by reusable skills.",
    instruction=(
        "You are a blog-writing assistant with specialized skills.\n"
        "Load relevant skills to get detailed instructions.\n"
        "Use load_skill_resource to access reference materials.\n"
        "Follow each skill's step-by-step instructions.\n"
        "Always explain which skill you're using and why."
    ),
    tools=[skill_toolset],
)
```

![SkillToolset 流程](https://storage.googleapis.com/gweb-developer-goog-blog-assets/images/part2-skilltoolset-flow.original.png)

列表中的前三个 Skill 处理 SEO、写作和研究。第四个 `skill_creator` 是工厂。问这个 Agent _"创建一个用于编写技术博客引言的 Skill"_，它会当场生成一个新的 SKILL.md：

```markdown
# Generated by skill-creator
---
name: blog-intro-writer
description: Writes compelling technical blog introductions. Hooks the reader
  with a problem statement, establishes relevance, and previews what they will learn.
---

When writing a blog introduction, follow this structure:
1. Open with a specific problem the reader recognizes
2. State why it matters now (new release, scaling pain, common mistake)
3. Preview what the post covers in one sentence
4. Keep it under 100 words
```

Agent 使用 `seo-checklist` 和 `blog-writer` Skills 处理现有任务。当它需要一个尚不具备的能力时，它自己写了一个。这个新 Skill 遵循同样的 [agentskills.io](https://agentskills.io/specification) 规范，因此你可以将它保存到 `skills/blog-intro-writer/SKILL.md`，并在下次会话中通过 `load_skill_from_dir` 加载它。

`SkillToolset` 自动生成三个工具，直接对应渐进式披露的三个层级：`list_skills`（L1，自动注入）、`load_skill`（L2，按需）和 `load_skill_resource`（L3，按需）。

## 开始之前的几个专业建议

- **Description 就是你的 API 文档。** `description` 字段是 LLM 在 L1 层级看到的内容，用于决定是否加载某个 Skill。_"SEO optimization checklist for blog posts"_ 告诉 Agent 确切的激活时机。_"A helpful skill"_ 则完全没有帮助。
- **从内联开始，逐步升级到文件。** 不要过度工程化。如果你的 Skill 只需要 10 行指令就能搞定，保持内联即可。当你需要参考文档或希望跨 Agent 复用时，再迁移到基于文件的 Skill。
- **像审查依赖一样审查生成的 Skills。** Meta Skill 的输出会成为你的 Agent 行为。将生成的 SKILL.md 文件当作代码审查对待——部署前先读一遍。

## 开始使用

准备好构建你自己的 Skill 工厂了吗？查看 [ADK Skills 文档](https://google.github.io/adk-docs/skills/) 了解 `SkillToolset` 和渐进式披露，克隆 [GitHub 仓库](https://github.com/google/adk-samples/tree/main/python/agents/agent-skills-tutorial) 运行全部四种模式。

---

## 引用

- 原文：[Developer's Guide to Building ADK Agents with Skills](https://developers.googleblog.com/developers-guide-to-building-adk-agents-with-skills/) — Google Developers Blog, 2026-04-01
- [ADK Skills 文档](https://google.github.io/adk-docs/skills/)
- [Agent Skills 规范（agentskills.io）](https://agentskills.io/specification)
- [ADK Skills 教程代码示例](https://github.com/google/adk-samples/tree/main/python/agents/agent-skills-tutorial)
- [agentskills.io 采用情况（40+ 产品）](https://agentskills.io/#adoption)
