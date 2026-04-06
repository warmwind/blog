---
name: blog-translation-strict
description: 严格技术文章翻译与发布到 warmwind/blog。用于把海外 AI 技术文章翻译成中文并发布，要求：仅翻译+引用，不加额外观点；保留并内嵌原图；图片位置尽量与原文一致；提交并推送到 github.com/warmwind/blog。
---

## 输入

- 原文 URL
- 目标语言（默认中文）
- 可选：目标 slug / 发布时间

## 硬性要求（必须满足）

1. **只翻译 + 引用**，不加入额外分析、总结、延伸观点。
2. **保留原文引用**：通过 frontmatter 中的 `originalTitle`、`originalUrl` 保留原文信息，并在正文开头明确展示"原文标题 / 原文链接"，便于直接回溯来源。
3. **电影剧情文规则**：正文以"详细剧情梳理"为主，不写推荐向介绍；优先基于可验证的剧透影评提炼完整情节线。
4. **图片必须内嵌展示**（Markdown `![]()`），不能只放裸链接。
5. **标题规则**：文章标题必须直接使用原文标题（不加中文翻译后缀、不在标题中混入中文）；专有名词保留英文（如 Claude、Agent、Harness、RAG、Context Window 等）。
6. **原文信息规则**：必须在 frontmatter 中填写 `originalTitle`、`originalUrl`，并在正文开头展示"原文标题 / 原文链接"。
7. **术语一致**：agent / harness / eval / context window 等术语统一翻译，不随意漂移。
8. **链接规则**：翻译文中的内部链接必须改为原站绝对链接（禁止保留相对链接如 `/en/...`、`/index/...`）。
9. **必须去重**：绝不翻译已经翻译过的原文（按原文 URL、标题、slug 三重检查）。
10. **时效性要求**：优先选择发布时间在最近 7 天内的文章；若无可用文章，才可放宽到最近 14 天，并在文首注明"本篇超出 7 天窗口"。
11. **新鲜度权重**：多篇候选同时满足时，按"越新越优先"排序（发布时间越近，优先级越高）。
12. **发布前本地构建校验**：在 blog 仓库执行一次构建（如 `pnpm build`）确保渲染通过。
13. **提交到 blog 仓库并 push**：`/Users/oscarjiang/Projects/githubs/blog` → `origin/main`。

## 执行流程

1. 抓取候选原文（优先正文可读内容）。
2. **先做时效检查**：优先保留发布时间在最近 7 天内的候选文章。
3. **做新鲜度排序**：候选按发布时间降序排序（越新越优先）。
4. **再做去重检查**：在 `src/data/blog/*.md` 中检索原文 URL、标题关键词、候选 slug；命中则跳过并改选新文章。
5. 若是电影图文：去 TMDB 对应电影的 posters / backdrops 页面下载 1 张海报 + 5 张剧照，保存到 `blog/public/media/...` 后再引用本地路径。
6. 提取可用图片 URL（至少封面图、正文关键配图）。
7. 将原文中的站内相对链接统一改写为原站绝对链接。
8. 逐段翻译，保留原有结构层级（标题、小节、列表、代码块）。
9. 按原文结构放置图片（内嵌，不展示裸链接清单）。
10. 在文末添加"引用"小节，仅列原文及必要官方链接。
11. 写入 blog 文章目录：`src/data/blog/<slug>.md`，并确保 frontmatter 中 `title` 为原文标题、`originalTitle` 为原文标题、`originalUrl` 为原文 URL；正文开头增加"原文标题 / 原文链接"引用块。
12. 在 blog 仓库执行构建校验（如 `pnpm build`）。
13. `git add/commit/push` 到 `warmwind/blog`。

## Frontmatter 模板

```yaml
---
title: <原文标题>
pubDatetime: <ISO8601+08:00>
description: <一句话描述：某文章中文翻译（含原文引用）>
slug: <kebab-case-slug>
originalTitle: <原文标题>
originalUrl: <原文 URL>
---
```

## 质量检查清单

- [ ] 没有新增"译者观点/总结"段落
- [ ] 所有图片都可见（非纯链接）
- [ ] 图片位置与原文语义对应
- [ ] 原文发布时间在最近 7 天内（若超过需满足放宽条件并注明）
- [ ] 原文 URL 未在历史翻译中出现（去重通过）
- [ ] 标题/slug 未与既有文章重复
- [ ] frontmatter 中 `title` 为原文标题，无中文翻译后缀
- [ ] frontmatter 中 `originalTitle`、`originalUrl` 已填写
- [ ] 正文开头已展示"原文标题 / 原文链接"
- [ ] 无相对链接残留（`/en/...`、`/index/...` 等）
- [ ] 引用链接可访问
- [ ] 本地构建通过（如 `pnpm build`）
- [ ] `git status` 干净且已 push
