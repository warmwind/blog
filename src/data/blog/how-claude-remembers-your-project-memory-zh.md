---
title: "Claude 如何记住你的项目"
pubDatetime: 2026-03-18T10:00:00+08:00
description: "Claude Code 文档《How Claude remembers your project》中文翻译（含原文引用）。"
slug: how-claude-remembers-your-project-memory-zh
originalTitle: "How Claude remembers your project"
originalUrl: https://code.claude.com/docs/en/memory
---

原文标题：How Claude remembers your project  <br>
原文链接：https://code.claude.com/docs/en/memory

# Claude 如何记住你的项目

> 使用 CLAUDE.md 文件为 Claude 提供持久指令，并通过 auto memory 让 Claude 自动积累学习内容。

每个 Claude Code session 都从全新的 context window 开始。跨 session 传递知识依靠两种机制：

- **CLAUDE.md 文件**：由你编写，用于给 Claude 提供持久上下文的指令
- **Auto memory**：Claude 根据你的纠正和偏好自行写入的笔记

本页涵盖以下内容：

- [编写与组织 CLAUDE.md 文件](#claudemd-文件)
- 使用 `.claude/rules/` [将规则限定到特定文件类型](#使用-clauderules-组织规则)
- [配置 auto memory](#auto-memory)，让 Claude 自动记笔记
- 当指令未被遵循时如何[排查问题](#排查-memory-问题)

## CLAUDE.md 与 auto memory

Claude Code 有两套互补的 memory 系统。两者都会在每次对话开始时加载。Claude 会将它们作为 context，而不是强制配置。你的指令越具体、越简洁，Claude 的遵循一致性通常越高。

|                      | CLAUDE.md 文件 | Auto memory |
| :------------------- | :------------- | :---------- |
| **谁来写** | 你 | Claude |
| **包含内容** | 指令与规则 | 学习记录与模式 |
| **作用域** | 项目、用户或组织 | 每个 working tree |
| **加载到** | 每个 session | 每个 session（前 200 行） |
| **适用场景** | 编码规范、工作流、项目架构 | 构建命令、调试经验、Claude 发现的偏好 |

当你想引导 Claude 行为时，使用 CLAUDE.md 文件。Auto memory 让 Claude 能在不需要你手工维护的情况下从纠正中学习。

Subagents 也可以维护自己的 auto memory。详见 [subagent configuration](https://code.claude.com/docs/en/sub-agents#enable-persistent-memory)。

## CLAUDE.md 文件

CLAUDE.md 文件是 markdown 文件，用于为项目、个人工作流或整个组织提供持久指令。你用纯文本编写这些文件；Claude 会在每个 session 开始时读取。

### 选择 CLAUDE.md 文件的放置位置

CLAUDE.md 文件可以放在多个位置，不同位置具有不同作用域。更具体的位置优先级高于更宽泛的位置。

| 作用域 | 位置 | 用途 | 使用示例 | 共享范围 |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------- |
| **托管策略** | • macOS：`/Library/Application Support/ClaudeCode/CLAUDE.md`<br />• Linux 和 WSL：`/etc/claude-code/CLAUDE.md`<br />• Windows：`C:\Program Files\ClaudeCode\CLAUDE.md` | 由 IT/DevOps 管理的组织级指令 | 公司编码规范、安全策略、合规要求 | 组织内所有用户 |
| **项目指令** | `./CLAUDE.md` 或 `./.claude/CLAUDE.md` | 团队共享的项目指令 | 项目架构、编码规范、常见工作流 | 通过版本控制共享给团队成员 |
| **用户指令** | `~/.claude/CLAUDE.md` | 适用于所有项目的个人偏好 | 代码风格偏好、个人工具快捷方式 | 仅你本人（所有项目） |

工作目录及其上级目录层级中的 CLAUDE.md 会在启动时完整加载。子目录中的 CLAUDE.md 会在 Claude 读取对应子目录文件时按需加载。完整解析顺序见 [How CLAUDE.md files load](#how-claudemd-文件如何加载)。

对于大型项目，你可以用 [project rules](#使用-clauderules-组织规则) 将指令拆分成主题文件。Rules 可以把指令限定到特定文件类型或子目录。

### 设置项目级 CLAUDE.md

项目级 CLAUDE.md 可存放在 `./CLAUDE.md` 或 `./.claude/CLAUDE.md`。创建该文件并添加适用于项目协作者的指令：构建与测试命令、编码规范、架构决策、命名约定和常见工作流。这些指令会通过版本控制共享给团队，因此应聚焦项目级标准而非个人偏好。

> 运行 `/init` 可自动生成初始 CLAUDE.md。Claude 会分析你的代码库并生成包含构建命令、测试指令和项目约定的文件。若 CLAUDE.md 已存在，`/init` 会建议改进而不是覆盖。你可以在此基础上补充 Claude 无法自行发现的指令。  
> 设置 `CLAUDE_CODE_NEW_INIT=true` 可启用交互式多阶段流程。`/init` 会询问你要设置哪些内容：CLAUDE.md 文件、skills、hooks。随后它会通过 subagent 探索代码库、通过追问补齐信息，并在写入任何文件前给出可审阅方案。

### 编写有效指令

CLAUDE.md 文件会在每个 session 开始时加载进 context window，与对话共同消耗 tokens。由于它们是 context 而非强制配置，写法会影响 Claude 遵循指令的可靠性。具体、简洁、结构清晰的指令效果最好。

**体量**：每个 CLAUDE.md 目标控制在 200 行以内。文件过长会占用更多 context 并降低遵循度。若指令增长较大，可使用 [imports](#导入额外文件) 或 [`.claude/rules/`](#使用-clauderules-组织规则) 拆分。

**结构**：使用 markdown 标题和列表组织相关指令。Claude 扫描结构的方式与人类类似：有组织的分段比密集段落更易遵循。

**具体性**：写成可验证的具体指令。例如：

- “使用 2-space 缩进”，而不是“把代码格式化好”
- “提交前运行 `npm test`”，而不是“先测试你的改动”
- “API handlers 放在 `src/api/handlers/`”，而不是“保持文件结构整洁”

**一致性**：若两条规则互相冲突，Claude 可能会任意选择其一。请定期检查 CLAUDE.md、子目录嵌套 CLAUDE.md 和 [`.claude/rules/`](https://code.claude.com/docs/en/memory#organize-rules-with-clauderules) 中是否存在过时或冲突指令。在 monorepo 中，可使用 [`claudeMdExcludes`](https://code.claude.com/docs/en/memory#exclude-specific-claudemd-files) 排除其他团队与你无关的 CLAUDE.md。

### 导入额外文件

CLAUDE.md 可使用 `@path/to/import` 语法导入其他文件。导入文件会在启动时展开，并与引用它的 CLAUDE.md 一并加载进 context。

支持相对路径与绝对路径。相对路径基于“包含该导入语句的文件”解析，而不是工作目录。导入文件也可以递归导入其他文件，最大深度为 5 层。

如果你想拉入 README、package.json 和工作流指南，可在 CLAUDE.md 任意位置使用 `@` 语法：

```text
See @README for project overview and @package.json for available npm commands for this project.

# Additional Instructions
- git workflow @docs/git-instructions.md
```

如果你有不希望提交到仓库的个人偏好，可导入 home 目录中的文件。导入语句写在共享 CLAUDE.md 中，但被引用文件仅存在于你的机器：

```text
# Individual Preferences
- @~/.claude/my-project-instructions.md
```

> Claude Code 在项目中首次遇到 external imports 时，会弹出审批对话框并列出文件。若你拒绝，导入会保持禁用，且该对话框不会再次出现。

如需更结构化地组织指令，见 [`.claude/rules/`](#使用-clauderules-组织规则)。

### How CLAUDE.md 文件如何加载

Claude Code 会从当前工作目录开始向上逐层遍历目录树读取 CLAUDE.md。也就是说，如果你在 `foo/bar/` 运行 Claude Code，它会加载 `foo/bar/CLAUDE.md` 与 `foo/CLAUDE.md` 的指令。

Claude 还会发现当前工作目录下子目录中的 CLAUDE.md。它们不会在启动时加载，而是在 Claude 读取对应子目录文件时被纳入。

如果你在大型 monorepo 中工作，且会拾取到其他团队的 CLAUDE.md，可使用 [`claudeMdExcludes`](https://code.claude.com/docs/en/memory#exclude-specific-claudemd-files) 跳过。

#### 从额外目录加载

`--add-dir` 参数可让 Claude 访问主工作目录之外的额外目录。默认情况下，这些目录中的 CLAUDE.md 不会加载。

若要同时加载这些额外目录中的 CLAUDE.md（包括 `CLAUDE.md`、`.claude/CLAUDE.md`、`.claude/rules/*.md`），设置环境变量 `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD`：

```bash
CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1 claude --add-dir ../shared-config
```

### 使用 `.claude/rules/` 组织规则

对于更大的项目，你可以使用 `.claude/rules/` 目录将指令拆分到多个文件中。这能让指令更模块化，也更便于团队维护。Rules 还可以[限定到特定文件路径](#路径限定规则)，这样只有 Claude 处理匹配文件时才会加载到 context，减少噪音并节省 context 空间。

> Rules 会在每个 session 或打开匹配文件时加载到 context。对于不需要常驻 context 的任务型指令，请使用 [skills](https://code.claude.com/docs/en/skills)：只有当你调用它们，或 Claude 判断与你提示相关时才会加载。

#### 设置 rules

在项目的 `.claude/rules/` 目录放置 markdown 文件。每个文件聚焦一个主题，并使用描述性文件名，如 `testing.md` 或 `api-design.md`。所有 `.md` 文件都会递归发现，因此你可按 `frontend/` 或 `backend/` 子目录组织：

```text
your-project/
├── .claude/
│   ├── CLAUDE.md           # Main project instructions
│   └── rules/
│       ├── code-style.md   # Code style guidelines
│       ├── testing.md      # Testing conventions
│       └── security.md     # Security requirements
```

不含 [`paths` frontmatter](#路径限定规则) 的 rules 会在启动时加载，优先级与 `.claude/CLAUDE.md` 相同。

#### 路径限定规则

Rules 可通过 YAML frontmatter 的 `paths` 字段限定到特定文件。只有当 Claude 处理与指定模式匹配的文件时，这些条件 rules 才会生效。

```markdown
---
paths:
  - "src/api/**/*.ts"
---

# API Development Rules

- All API endpoints must include input validation
- Use the standard error response format
- Include OpenAPI documentation comments
```

未设置 `paths` 的 rules 会无条件加载并作用于所有文件。路径限定规则在 Claude 读取到匹配文件时触发，而不是每次工具调用都触发。

在 `paths` 中使用 glob 模式可按扩展名、目录或组合方式匹配文件：

| Pattern | 匹配 |
| ---------------------- | ---------------------------------------- |
| `**/*.ts` | 任意目录下所有 TypeScript 文件 |
| `src/**/*` | `src/` 目录下所有文件 |
| `*.md` | 项目根目录下 Markdown 文件 |
| `src/components/*.tsx` | 指定目录下 React components |

你可以指定多个模式，也可用 brace expansion 一次匹配多种扩展名：

```markdown
---
paths:
  - "src/**/*.{ts,tsx}"
  - "lib/**/*.ts"
  - "tests/**/*.test.ts"
---
```

#### 用 symlink 跨项目共享 rules

`.claude/rules/` 目录支持 symlink，因此你可维护一套共享 rules，并链接到多个项目中。symlink 会被正常解析与加载，循环 symlink 会被检测并妥善处理。

这个示例同时链接一个共享目录和单个文件：

```bash
ln -s ~/shared-claude-rules .claude/rules/shared
ln -s ~/company-standards/security.md .claude/rules/security.md
```

#### 用户级 rules

`~/.claude/rules/` 中的个人 rules 会作用于你机器上的所有项目。可用于非项目特定的偏好：

```text
~/.claude/rules/
├── preferences.md    # Your personal coding preferences
└── workflows.md      # Your preferred workflows
```

用户级 rules 先于项目 rules 加载，因此项目 rules 的优先级更高。

### 面向大团队管理 CLAUDE.md

对于在多团队中部署 Claude Code 的组织，你可以集中管理指令，并控制加载哪些 CLAUDE.md 文件。

#### 部署组织级 CLAUDE.md

组织可部署集中管理的 CLAUDE.md，使其作用于机器上的所有用户。该文件不能被个人设置排除。

1. 在托管策略路径创建文件：
   - macOS：`/Library/Application Support/ClaudeCode/CLAUDE.md`
   - Linux 和 WSL：`/etc/claude-code/CLAUDE.md`
   - Windows：`C:\Program Files\ClaudeCode\CLAUDE.md`
2. 使用配置管理系统部署：
   - 使用 MDM、Group Policy、Ansible 等工具分发到开发机器。其他组织级配置见 [managed settings](https://code.claude.com/docs/en/permissions#managed-settings)。

托管 CLAUDE.md 与 [managed settings](https://code.claude.com/docs/en/settings#settings-files) 的用途不同。设置用于技术强制，CLAUDE.md 用于行为引导：

| 关注点 | 配置位置 |
| :--------------------------------------------- | :-------------------------------------------------------- |
| 屏蔽特定 tools、commands 或文件路径 | Managed settings：`permissions.deny` |
| 强制 sandbox 隔离 | Managed settings：`sandbox.enabled` |
| 环境变量与 API provider 路由 | Managed settings：`env` |
| 认证方式与组织锁定 | Managed settings：`forceLoginMethod`、`forceLoginOrgUUID` |
| 代码风格与质量准则 | Managed CLAUDE.md |
| 数据处理与合规提醒 | Managed CLAUDE.md |
| Claude 的行为指令 | Managed CLAUDE.md |

设置规则由客户端强制执行，不取决于 Claude 的决策。CLAUDE.md 指令会影响 Claude 的行为，但不属于硬性强制层。

#### 排除特定 CLAUDE.md 文件

在大型 monorepo 中，上层目录的 CLAUDE.md 可能包含与你工作无关的指令。`claudeMdExcludes` 可按路径或 glob 模式跳过特定文件。

下面示例排除了顶层 CLAUDE.md 以及父目录中的一个 rules 目录。将其放入 `.claude/settings.local.json`，使排除仅在本机生效：

```json
{
  "claudeMdExcludes": [
    "**/monorepo/CLAUDE.md",
    "/home/user/monorepo/other-team/.claude/rules/**"
  ]
}
```

模式会基于绝对文件路径按 glob 语法匹配。你可在任意 [settings layer](https://code.claude.com/docs/en/settings#settings-files) 配置 `claudeMdExcludes`：user、project、local 或 managed policy。数组会跨层合并。

托管策略 CLAUDE.md 不能被排除。这确保组织级指令始终生效。

## Auto memory

Auto memory 让 Claude 在无需你手工编写的情况下跨 session 积累知识。Claude 会在工作中为自己保存笔记：构建命令、调试经验、架构笔记、代码风格偏好和工作流习惯。Claude 不会在每个 session 都保存内容。它会根据这些信息在未来对话中的潜在价值决定是否记忆。

> Auto memory 需要 Claude Code v2.1.59 或更高版本。可用 `claude --version` 查看版本。

### 启用或禁用 auto memory

Auto memory 默认开启。你可在 session 中打开 `/memory` 并使用 auto memory 开关，或在项目设置中设置 `autoMemoryEnabled`：

```json
{
  "autoMemoryEnabled": false
}
```

如需通过环境变量禁用 auto memory，设置 `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`。

### 存储位置

每个项目在 `~/.claude/projects/<project>/memory/` 下拥有独立 memory 目录。`<project>` 路径来源于 git 仓库，因此同一仓库内所有 worktrees 与子目录共享一个 auto memory 目录。若不在 git 仓库内，则使用项目根目录。

若要将 auto memory 存到其他位置，在 user 或 local settings 中设置 `autoMemoryDirectory`：

```json
{
  "autoMemoryDirectory": "~/my-custom-memory-dir"
}
```

该设置可来自 policy、local、user settings。为防止共享项目将 auto memory 重定向到敏感位置，不接受 project settings（`.claude/settings.json`）中的该项。

该目录包含 `MEMORY.md` 入口文件与可选主题文件：

```text
~/.claude/projects/<project>/memory/
├── MEMORY.md          # Concise index, loaded into every session
├── debugging.md       # Detailed notes on debugging patterns
├── api-conventions.md # API design decisions
└── ...                # Any other topic files Claude creates
```

`MEMORY.md` 是 memory 目录的索引。Claude 会在 session 期间读写该目录文件，并通过 `MEMORY.md` 追踪信息存放位置。

Auto memory 是 machine-local 的。同一 git 仓库下所有 worktrees 与子目录共享一个 auto memory 目录。文件不会跨机器或云环境共享。

### 工作机制

每次对话开始时会加载 `MEMORY.md` 的前 200 行。超出 200 行的内容不会在 session 启动时加载。Claude 会把详细内容移动到独立主题文件，以保持 `MEMORY.md` 简洁。

该 200 行限制仅适用于 `MEMORY.md`。CLAUDE.md 文件无论长度都会完整加载，但较短文件通常更易获得稳定遵循。

`debugging.md` 或 `patterns.md` 等主题文件不会在启动时加载。Claude 仅在需要信息时，通过标准文件工具按需读取。

Claude 会在 session 期间读写 memory 文件。当你在 Claude Code 界面看到 “Writing memory” 或 “Recalled memory” 时，Claude 正在主动更新或读取 `~/.claude/projects/<project>/memory/`。

### 审计与编辑 memory

Auto memory 文件是可随时编辑或删除的纯 markdown。你可运行 [`/memory`](#通过-memory-查看与编辑) 在 session 内浏览并打开 memory 文件。

## 通过 `/memory` 查看与编辑

`/memory` 命令会列出当前 session 加载的所有 CLAUDE.md 与 rules 文件，允许你开关 auto memory，并提供打开 auto memory 文件夹的链接。选择任一文件即可在编辑器中打开。

当你让 Claude 记住某件事，例如 “always use pnpm, not npm” 或 “remember that the API tests require a local Redis instance”，Claude 会保存到 auto memory。若你希望写入 CLAUDE.md，请直接告诉 Claude（如 “add this to CLAUDE.md”），或通过 `/memory` 手动编辑。

## 排查 memory 问题

以下是 CLAUDE.md 与 auto memory 的常见问题以及调试步骤。

### Claude 没有遵循我的 CLAUDE.md

CLAUDE.md 内容是以 user message 形式注入到 system prompt 之后，而不是 system prompt 本身。Claude 会读取并尝试遵循，但无法保证严格合规，尤其在指令模糊或冲突时。

调试步骤：

- 运行 `/memory` 确认 CLAUDE.md 是否已加载。若列表中没有，Claude 就看不到该文件。
- 检查相关 CLAUDE.md 是否位于当前 session 会加载的位置（见 [选择 CLAUDE.md 文件的放置位置](#选择-claudemd-文件的放置位置)）。
- 将指令写得更具体。“Use 2-space indentation” 通常优于 “format code nicely”。
- 检查不同 CLAUDE.md 间是否存在冲突。若两个文件对同一行为给出不同指引，Claude 可能任意选择。

对于你希望提升到 system prompt 层级的指令，可使用 [`--append-system-prompt`](https://code.claude.com/docs/en/cli-reference#system-prompt-flags)。该参数需每次调用都传入，更适合脚本与自动化场景，而非交互式使用。

> 使用 [`InstructionsLoaded` hook](https://code.claude.com/docs/en/hooks#instructionsloaded) 可记录“哪些指令文件被加载、何时加载、为何加载”。这对调试路径限定 rules 或子目录懒加载文件很有帮助。

### 我不知道 auto memory 保存了什么

运行 `/memory` 并选择 auto memory 文件夹，即可查看 Claude 保存内容。所有内容均为纯 markdown，可读、可改、可删。

### 我的 CLAUDE.md 过大

超过 200 行的文件会占用更多 context，并可能降低遵循度。可将细节内容拆分到 `@path` 导入文件（见 [导入额外文件](#导入额外文件)），或拆分到 `.claude/rules/` 文件中。

### `/compact` 后指令似乎丢失

CLAUDE.md 在 compact 后会完整保留。执行 `/compact` 后，Claude 会从磁盘重新读取 CLAUDE.md 并重新注入 session。若某条指令在 compact 后消失，说明它只出现在对话中，而未写入 CLAUDE.md。把它写入 CLAUDE.md 才能跨 session 持久化。

关于体量、结构与具体性的建议，见 [编写有效指令](#编写有效指令)。

## 相关资源

- [Skills](https://code.claude.com/docs/en/skills)：将可复用工作流打包，并按需加载
- [Settings](https://code.claude.com/docs/en/settings)：使用 settings files 配置 Claude Code 行为
- [Manage sessions](https://code.claude.com/docs/en/sessions)：管理 context、恢复对话与并行运行 sessions
- [Subagent memory](https://code.claude.com/docs/en/sub-agents#enable-persistent-memory)：让 subagents 维护各自 auto memory

## 引用

- 原文：How Claude remembers your project  
  https://code.claude.com/docs/en/memory
