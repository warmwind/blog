---
name: publish-soccer-xiaohongshu
description: "将博客中的足球球星文章发布到小红书。从代码库选择球星文章，生成小红书风格图文笔记，通过 Chrome 浏览器自动发布。Use when the user wants to publish soccer to Xiaohongshu, 发小红书, 发布足球小红书, publish soccer to RED, 发球星笔记."
argument-hint: "<player slug or Chinese name>"
---

# 发布足球球星到小红书

将博客中已有的足球球星文章改编为小红书风格的图文笔记，通过 Chrome 浏览器自动发布。

发布球星：$ARGUMENTS

## Inputs

通过 `$ARGUMENTS` 传入：
- 球星文章 slug（如 `ronaldo-the-phenomenon`）或中文球星名（如 `罗纳尔多`）
- 如果 `$ARGUMENTS` 为空，列出 `src/data/blog/` 下所有 `postType: soccer` 的文章供用户选择

## Workflow

### 1. 检查已发布记录

读取 `.claude/skills/publish-soccer-xiaohongshu/published.txt` 文件（如果存在），获取已发布到小红书的球星文章 slug 列表（每行一个 slug）。

### 2. 选择并读取球星文章

根据 `$ARGUMENTS` 在 `src/data/blog/` 目录下找到对应的足球文章：
- 如果传入 slug，直接读取 `src/data/blog/<slug>.md`
- 如果传入中文球星名，遍历所有 `.md` 文件，筛选 `postType: soccer` 的文章，匹配 `title` 字段
- 如果为空，列出所有**未发布**的足球文章供用户选择（排除 `published.txt` 中已有的 slug）

**如果选中的文章已在 `published.txt` 中，提示用户该球星已发布过，询问是否仍要继续。**

读取文章的完整 markdown 文件，提取：
- Frontmatter：title, slug, description, pubDatetime, postType
- 正文内容
- 所有图片路径，转为绝对路径：项目根目录 + `public/` 下的相对路径

### 3. 生成小红书笔记内容

将球星文章改编为小红书图文笔记。

**标题格式**（严格控制在 20 字以内，包括特殊符号）：
```
球星名｜一句抓人的概括
```
示例：`罗纳尔多｜被伤病偷走巅峰的外星人`

**重要：生成标题时必须逐字计数确认不超过 20 字。生成 3 个备选标题供用户选择，风格各异（情怀型、冲击型、反差型等）。**

**正文风格**：
- 保持原文80后球迷的叙事口吻，精简为小红书节奏
- 用简洁有力的短段落，每段 2-3 句
- 保留关键转折点、荣誉数据、主题升华
- 段落之间用换行分隔，不需要 emoji 装饰
- 正文不要包含话题标签文字，话题通过编辑器的原生话题功能添加（见 5.5）
- **话题标签必须在正文最后一段之后换行输出**，不能和正文在同一行

**话题标签**（5-8 个，通过小红书原生话题功能添加，不是正文纯文本）：
- 必选：球星名话题（如 `#罗纳尔多`）、`#足球`
- 根据球星选择：`#世界杯` `#巴西足球` `#意甲` `#西甲` `#英超` `#皇家马德里` `#国际米兰` 等
- 选 1-2 个小红书热门话题：如 `#80后的回忆` `#藏不住了我是球迷` `#足球我最熟` 等

**注意：话题名称要使用小红书平台上实际存在的原生话题（通过搜索确认），优先选择浏览量大的话题。**

**正文长度**：小红书正文字数上限为 1000 字（包括话题标签占用的字数）。正文本身控制在 750-900 字左右，为话题标签预留空间。

**生成后向用户展示完整的笔记内容（标题 + 正文 + 话题），等待用户确认或修改后再进入发布流程。**

### 4. 准备图片

从球星的媒体目录 `public/media/football/<player-slug>/` 中收集所有 `.jpg` / `.jpeg` / `.png` / `.webp` 图片。

球星文章通常包含 5 张图片，覆盖不同时期（不同俱乐部、国家队等）。确认所有图片文件存在。

### 5. 通过 Chrome 浏览器发布

使用 Chrome DevTools MCP 工具操作浏览器完成发布。

**前置条件**：用户需要已在 Chrome 中登录小红书。

#### 5.1 打开发布页面

1. 使用 `list_pages` 获取当前标签页状态
2. 使用 `navigate_page` 导航到：`https://creator.xiaohongshu.com/publish/publish`
3. 使用 `take_snapshot` 确认页面已加载且用户已登录
4. 如果未登录，提示用户先在 Chrome 中登录小红书创作者中心

#### 5.2 切换到图文模式

点击「上传图文」tab 切换到图文模式（默认可能是视频模式）。

#### 5.3 上传图片

**方法一（推荐）：通过本地 CORS HTTP 服务器 + JavaScript 注入**

由于 `upload_file` MCP 工具一次只能上传一个文件，且 `file://` 协议在浏览器中被 CORS 限制，使用以下方案：

1. 先用 `upload_file` 上传第一张图片到页面的 file input
2. 启动一个带 CORS 头的本地 HTTP 服务器来 serve 图片目录：
   ```bash
   cat << 'PYEOF' > /tmp/cors_server.py
   from http.server import HTTPServer, SimpleHTTPRequestHandler
   import os
   class CORSHandler(SimpleHTTPRequestHandler):
       def __init__(self, *args, **kwargs):
           super().__init__(*args, directory='<IMAGE_DIR>', **kwargs)
       def end_headers(self):
           self.send_header('Access-Control-Allow-Origin', '*')
           self.send_header('Access-Control-Allow-Methods', 'GET')
           super().end_headers()
   HTTPServer(('127.0.0.1', 18923), CORSHandler).serve_forever()
   PYEOF
   python3 /tmp/cors_server.py &
   ```
3. 通过 `evaluate_script` 注入 JavaScript，fetch 剩余图片并通过 DataTransfer API 设置到 file input：
   ```javascript
   async () => {
     const baseUrl = 'http://127.0.0.1:18923';
     const files = ['image2.jpg', 'image3.jpg', ...]; // 剩余图片文件名
     const fetched = [];
     for (const name of files) {
       const resp = await fetch(`${baseUrl}/${name}`);
       if (!resp.ok) continue;
       const blob = await resp.blob();
       fetched.push(new File([blob], name, { type: 'image/jpeg' }));
     }
     const input = document.querySelectorAll('input[type="file"][accept=".jpg,.jpeg,.png,.webp"]')[0];
     if (!input) return 'ERROR: file input not found';
     const dt = new DataTransfer();
     for (const file of fetched) dt.items.add(file);
     input.files = dt.files;
     input.dispatchEvent(new Event('change', { bubbles: true }));
     return { count: fetched.length };
   }
   ```
4. 关闭本地 HTTP 服务器：`kill %1`
5. 使用 `take_snapshot` 或 `take_screenshot` 确认图片全部上传成功（页面应显示 `N/18`）

**方法二（退化）：逐张 upload_file**

如果方法一失败，逐张使用 `upload_file` 上传每张图片。

#### 5.4 填写标题

1. 使用 `take_snapshot` 找到标题输入框
2. 使用 `fill` 输入标题

#### 5.5 填写正文

小红书编辑器使用 TipTap/ProseMirror 富文本编辑器。

1. 使用 `click` 点击正文编辑区（`contenteditable` 元素）
2. 使用 `evaluate_script` 通过 `document.execCommand('insertText', false, content)` 插入正文
3. 使用 `take_snapshot` 确认正文已写入
4. 检查字数计数器（页面底部 `xxx/1000`），确认未超限。如果超限，精简正文重新写入

#### 5.6 添加话题标签

**重要：话题必须通过小红书原生话题功能添加，不能作为纯文本写在正文中。** 纯文本 `#话题` 不会被小红书识别为可点击的原生话题。

操作步骤（对每个话题重复）：
1. 确保光标在正文末尾（`Control+End`）
2. 输入 `#话题关键词`（如 `#罗纳尔多`），等待话题搜索下拉框出现
3. 使用 `take_snapshot` 确认下拉框出现，从搜索结果中 `click` 选择对应话题（优先选浏览量大的）
4. 话题添加成功后会在正文中显示为蓝色高亮 `[话题]` 标记
5. 输入空格后继续添加下一个话题

添加完所有话题后，使用 `take_screenshot` 确认话题均已添加。

#### 5.7 确认发布

1. 使用 `take_screenshot` 截取当前页面状态，向用户汇报填写结果
2. **必须等待用户明确确认后**，才点击发布按钮——发布是不可逆操作
3. 用户确认后，使用 `click` 点击「发布」按钮
4. 使用 `take_screenshot` 确认发布成功（页面应返回空白上传页）

### 6. 记录已发布

发布成功后，将文章 slug 追加写入 `.claude/skills/publish-soccer-xiaohongshu/published.txt`（每行一个 slug），避免下次重复发布。

### 7. 完成报告

发布成功后，向用户汇报：
- 球星名称（中文 + 英文原名）
- 小红书笔记标题
- 上传图片数量
- 话题标签列表
- 发布状态

### 8. 失败处理

| 场景 | 处理 |
|---|---|
| 未登录小红书 | 提示用户先在 Chrome 中访问 creator.xiaohongshu.com 并登录 |
| 图片上传失败 | 重试一次 CORS 方案，仍失败则退化为逐张 upload_file |
| 正文写入困难 | 退化方案：将生成的内容复制到系统剪贴板（`pbcopy`），提示用户手动粘贴 |
| 正文超过 1000 字 | 精简正文，确保正文 + 话题标签总计不超过 1000 字 |
| 页面结构变化 | 使用 `take_snapshot` 重新观察，尝试用 `evaluate_script` 通过 JS 操作 |
| 发布失败 | 展示错误信息，让用户手动处理 |

### 9. 注意事项

- **不要在未经用户确认的情况下点击发布按钮**
- 小红书编辑器页面结构可能随版本更新变化，优先用 `take_snapshot` 观察实际结构
- 如果自动化遇到无法解决的困难，退化为：生成内容 → 复制到剪贴板 → 用户手动发布
- 球星文章的图片目录命名规则为 `public/media/football/<slug>/`，其中 `<slug>` 是球星名相关的短名（如 `ronaldo`、`zidane`），不一定与文章 slug 完全一致——需要从文章正文中的图片路径提取实际目录名
