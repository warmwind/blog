---
title: Claude Code Memory 实战：把“每次重来”变成“持续进化”
pubDatetime: 2026-03-03T08:20:00+08:00
description: 基于 Claude Code 官方 Memory 文档，系统讲清 CLAUDE.md、.claude/rules 与 Auto memory 的分工、加载机制、常见误区与团队落地方法。
slug: claude-code-memory-practical-guide
---

很多团队在使用编码 Agent 一段时间后都会遇到同一个问题：

> 为什么它在这个会话里很懂我，换个会话又像“失忆”了？

`Memory` 机制就是解决这个问题的关键。

这篇文章基于 Claude Code 官方文档，尝试用工程视角回答三个问题：

1. **哪些信息该写成“规则”？哪些该交给“自动记忆”？**
2. **规则为什么会“有时生效、有时失效”？**
3. **团队怎么把 Memory 做成可维护的系统，而不是一坨越来越长的提示词？**

---

## 一、先建立正确心智模型：Memory 不是“魔法配置”，而是“上下文供给系统”

Claude Code 里有两套互补机制：

- **CLAUDE.md 系列文件**：你写给它的长期指令
- **Auto memory**：它根据交互自己沉淀的经验笔记

最重要的一点是：

> 这些内容是“会话启动时的上下文”，不是硬性强制策略。

这意味着写法会直接影响执行效果：

- 具体、可验证的规则（例如“提交前运行 `npm test`”）更稳定
- 模糊、抽象、互相冲突的规则（例如“尽量规范一点”）容易漂移

如果你把 Memory 理解成“知识输入层”而不是“配置开关”，很多现象就能解释通了。

---

## 二、CLAUDE.md：你定义“该怎么做”

官方给的层次很清晰，可以理解成四层作用域：

1. **组织级（Managed policy）**：公司统一要求
2. **项目级（Project）**：仓库共享规范
3. **用户级（User）**：你的个人偏好
4. **本地级（Local）**：只在本机、当前项目生效的私有偏好

### 2.1 什么时候该写进 CLAUDE.md？

适合写入“稳定、可复用、可检查”的约束，例如：

- 代码风格和目录约定
- 构建、测试、发布流程
- 架构边界与禁区（哪些层不允许直接依赖）
- 团队固定工作流（PR 模板、回归 checklist）

不适合写入的内容：

- 临时任务指令
- 高频变化、无法维护的细碎例外
- 明显属于个人临时偏好的内容（应放 `CLAUDE.local.md`）

### 2.2 常见误区

**误区 A：把 CLAUDE.md 当“百科全书”**  
文件越来越长，最后谁也不看、模型也不稳。

**误区 B：把冲突规则堆在一起**  
比如“必须严格分层”与“允许业务急用时跨层调用”并存，没有优先级说明。

**误区 C：只写原则，不写可执行动作**  
比如“注意性能”不如“列表接口默认分页且限制上限 100”。

---

## 三、.claude/rules：把规则从“大文件”拆成“可组合模块”

当项目变大后，推荐把规则拆到 `.claude/rules/`，并按主题管理（如 `testing.md`、`security.md`、`api-design.md`）。

更实用的是**路径作用域规则（paths frontmatter）**：

- 只在处理 `src/api/**/*.ts` 时加载 API 规则
- 只在处理 `frontend/**/*` 时加载前端规则

这有两个直接好处：

1. **减少噪音**：当前任务只加载相关规则
2. **节省上下文预算**：提升规则命中率

一句话：

> `.claude/rules` 不是“更多规则”，而是“更精准地给规则”。

---

## 四、Auto memory：你不写，它也会学

Auto memory 默认开启。它会在项目维度沉淀经验，例如：

- 常用构建命令
- 排障路径
- 某个仓库的历史偏好

### 4.1 关键机制（容易被忽略）

- 启动时默认只加载 `MEMORY.md` 前 200 行
- 详细内容应拆到 topic 文件（按需读取）
- 它是机器本地的项目记忆，不自动跨机器同步

这意味着你应该把 `MEMORY.md` 当成**索引页**，不是日志堆放处。

### 4.2 Auto memory 适合记什么？

适合：

- 反复出现、能节省未来决策时间的“经验型信息”
- 调试踩坑与已验证 workaround

不适合：

- 瞬时上下文
- 敏感信息
- 大段可在仓库文档中找到的重复内容

---

## 五、团队落地建议：从“会写提示词”升级到“会设计记忆系统”

下面是一个可执行的最小方案：

### 第一步：建立三层结构

- `./CLAUDE.md`：项目通用规则（短、稳、可验证）
- `./.claude/rules/*.md`：按主题和路径细分
- `./CLAUDE.local.md`：个人本地偏好（不入库）

### 第二步：给规则做“瘦身目标”

- 每个文件控制在合理长度（官方建议 CLAUDE.md 保持简洁）
- 每条规则可以被“是/否”验证
- 删除过期规则，避免“历史包袱”误导模型

### 第三步：把 Auto memory 当“经验缓存”

- 定期审阅 `MEMORY.md` 索引
- 把长篇经验迁移到 topic 文件
- 删除低价值和重复记录

---

## 六、一个实用判断题：这条信息该放哪？

- **长期稳定、团队共享、可执行** → `CLAUDE.md / .claude/rules`
- **个人偏好、仅本机有效** → `CLAUDE.local.md`
- **由交互沉淀、经验导向、未来可能复用** → `Auto memory`
- **一次性任务上下文** → 不进 Memory，留在当前会话即可

---

## 结语

Memory 的本质不是“让 Agent 记住一切”，而是：

> 在每次会话开始时，给它刚好够用、结构清晰、可执行的长期上下文。

你真正要优化的，不是“记忆数量”，而是**记忆质量与加载精度**。

当这套机制稳定下来，Agent 的表现通常会从“偶尔惊艳”变成“稳定可靠”。

---

## 原始链接（官方文档）

- Claude Code Memory：
  https://code.claude.com/docs/en/memory

## 推荐延伸阅读（重要）

- Claude Code 文档索引（总入口）：
  https://code.claude.com/docs/llms.txt
- Subagents 与持久记忆：
  https://code.claude.com/docs/en/sub-agents#enable-persistent-memory
- Skills（何时用规则，何时用技能）：
  https://code.claude.com/docs/en/skills
- Settings（包括 `claudeMdExcludes` 等配置层）：
  https://code.claude.com/docs/en/settings
- Permissions / Managed settings（组织级策略）：
  https://code.claude.com/docs/en/permissions#managed-settings
