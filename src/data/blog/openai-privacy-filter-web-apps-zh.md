---
title: 如何使用 OpenAI Privacy Filter 构建可扩展的 Web 应用
pubDatetime: 2026-04-28T10:30:00+08:00
description: OpenAI 发布了 Privacy Filter——一个开源 PII 检测器，本文展示了三个基于 gradio.Server 构建的应用，展示其在文档、图像和文本粘贴场景中的能力。
slug: openai-privacy-filter-web-apps-zh
originalTitle: How to build scalable web apps with OpenAI's Privacy Filter
originalUrl: https://huggingface.co/blog/openai-privacy-filter-web-apps
---

原文标题：How to build scalable web apps with OpenAI's Privacy Filter<br>
原文链接：https://huggingface.co/blog/openai-privacy-filter-web-apps

OpenAI 本周在 Hub 上发布了 Privacy Filter：一个开源的个人身份信息（PII）检测器，能够在 128k 上下文的单次前向传播中跨八个类别标注文本。[模型卡片](https://huggingface.co/openai/privacy-filter)。我们花了几个小时进行构建，最终完成了三个应用，每个应用都展示了其能力的不同切面。

- [**Document Privacy Explorer**](https://huggingface.co/spaces/ysharma/OPF-Document-PII-Explorer)：上传 PDF 或 DOCX，在文档中以高亮形式显示每个检测到的 PII 片段。
- [**Image Anonymizer**](https://huggingface.co/spaces/ysharma/OPF-Image-Anonymizer)：上传图像，返回带有黑色遮挡条的图像，遮挡姓名、电子邮件和账号。图像还可在画布上编辑，以便在下载前进行自定义标注。
- [**SmartRedact Paste**](https://huggingface.co/spaces/ysharma/OPF-SmartRedact-Paste)：粘贴敏感文本，分享显示脱敏版本的公开 URL，并为自己保留一个私密的原文查看链接。

三个应用都基于 [gradio.Server](https://huggingface.co/blog/introducing-gradio-server) 构建，使您能够将自定义 HTML/JS 前端与 Gradio 的队列、ZeroGPU 分配和 `gradio_client` SDK 配对使用。在所有这些应用中，**`gradio.Server`** 扮演着相同的后端角色，而这种一致性正是它真正强大之处。

## 模型介绍

Privacy Filter 是一个拥有 15 亿参数、5000 万活跃参数的模型，采用宽松的 Apache 2.0 许可证。PII 类别包括 `private_person`、`private_address`、`private_email`、`private_phone`、`private_url`、`private_date`、`account_number`、`secret`。上下文窗口为 128,000 个 token。在 [PII-Masking-300k 基准测试](https://huggingface.co/datasets/ai4privacy/pii-masking-300k)上达到最先进性能。完整的数字和方法论见[官方发布博客](https://openai.com/index/introducing-openai-privacy-filter/)。

## 1. Document Privacy Explorer

在 [ysharma/OPF-Document-PII-Explorer](https://huggingface.co/spaces/ysharma/OPF-Document-PII-Explorer) 试用。

<video autoplay loop muted playsinline>
  <source src="https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/blog/openai-privacy-filter-web-apps/doc-pii-explorer.mp4" type="video/mp4">
</video>

**用户问题。** 您想阅读一份包含大量 PII 的文档（合同、简历、导出的聊天记录），并以高亮形式按类别显示每个检测到的片段，侧边栏有过滤器，顶部有摘要仪表板。阅读体验应该像普通文档一样，而不是表单。

**Privacy Filter 在这里的作用。** 整个文件通过单次 128k 上下文前向传播处理，因此无需分块、无需拼接，片段偏移量直接与渲染的文本对齐。BIOES 解码在长歧义段中保持片段边界清晰。

**`gr.Server` 在这里的作用。** 您可以用 `gr.HighlightedText` 和侧边栏在 Blocks 中实现这一功能，它也会起作用。我们想要的阅读体验（衬线正文、按类别过滤在客户端切换 CSS 类而非重新运行模型、不强制页面重新渲染的摘要仪表板）比用组件拼凑更容易手工制作。`gr.Server` 让我们将阅读器视图作为单个 HTML 文件提供，并在一个队列端点后面暴露模型：

```python
import gradio as gr
from fastapi.responses import HTMLResponse
from gradio.data_classes import FileData

server = gr.Server()

@server.get("/", response_class=HTMLResponse)
async def homepage():
    return FRONTEND_HTML                           # reader view; see app.py

@server.api(name="analyze_document")
def analyze_document(file: FileData) -> dict:
    text = extract_text(file["path"])              # PyMuPDF / python-docx
    source_text, spans = run_privacy_filter(text)  # single 128k pass
    return {
        "text":  source_text,
        "spans": spans,                            # [{start, end, label}, ...]
        "stats": compute_stats(source_text, spans),
    }
```

注意装饰器：`@server.api(name="analyze_document")`，而不是普通的 `@server.post`。这是将处理程序接入 Gradio 队列的部分，使并发上传得到序列化，`@spaces.GPU` 在 ZeroGPU 上正确组合，同一端点可以从浏览器和 `gradio_client` 访问，无需重复代码。浏览器通过 Gradio JS 客户端调用它：

```html
<script type="module">
import { Client, handle_file } from "https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js";
const client = await Client.connect(window.location.origin);

async function uploadFile(file) {
  const result = await client.predict("/analyze_document", { file: handle_file(file) });
  renderResults(result.data[0]);                   // { text, spans, stats }
}
</script>
```

## 2. Image Anonymizer

在 [ysharma/OPF-Image-Anonymizer](https://huggingface.co/spaces/ysharma/OPF-Image-Anonymizer) 试用。

<video autoplay loop muted playsinline>
  <source src="https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/blog/openai-privacy-filter-web-apps/image-pii-redact.mp4" type="video/mp4">
</video>

**用户问题。** 您想分享一张带有 PII 黑色遮挡条的图像或截图（Slack 对话、收据、Stripe 仪表板）。您想要开关遮挡条、拖动重新定位，或手动绘制一个遮挡条覆盖模型遗漏的内容，然后导出结果。

**Privacy Filter 在这里的作用。** Tesseract 运行 OCR 并返回每个单词的边界框。后端使用字符偏移到框的映射重建完整文本，然后对整个文本运行一次 Privacy Filter。检测到的字符片段与单词映射对照，并按行合并为像素矩形。

**`gr.Server` 在这里的作用。** `gr.ImageEditor` 支持分层标注，是图像脱敏的合理起点。我们想要的工作流程（每个遮挡条的类别元数据、一次性切换某类别的所有遮挡条、客户端以自然分辨率导出 PNG 无需服务器往返）在自定义 `<canvas>` 前端上构建更简洁。`gr.Server` 从一个队列端点返回像素矩形，让画布处理其他所有事情：

```python
@server.api(name="anonymize_screenshot")
def anonymize_screenshot(image: FileData) -> dict:
    img = Image.open(image["path"]).convert("RGB")
    full_text, char_to_box = ocr_image(img)        # per-word boxes + char map
    spans = run_privacy_filter(full_text)
    boxes = spans_to_pixel_boxes(spans, char_to_box)
    return {
        "image_data_url": pil_to_base64(img),
        "width":  img.width,
        "height": img.height,
        "boxes":  boxes,                           # [{x, y, w, h, label, text}, ...]
    }
```

前端使用 `client.predict("/anonymize_screenshot", { image: handle_file(file) })` 调用它，与上面相同的模式。切换、拖动、新遮挡条绘制和 PNG 导出都在浏览器中完成，编辑永远不需要往返服务器。

## 3. SmartRedact Paste

在 [ysharma/OPF-SmartRedact-Paste](https://huggingface.co/spaces/ysharma/OPF-SmartRedact-Paste) 试用。

<video autoplay loop muted playsinline>
  <source src="https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/blog/openai-privacy-filter-web-apps/smartredact-paste.mp4" type="video/mp4">
</video>

**用户问题。** 您想要一个在分享前进行脱敏的粘贴板。您粘贴一行日志、一封电子邮件、一个支持工单。您会收到两个 URL。公开的 URL 提供带有 `<PRIVATE_PERSON>`、`<PRIVATE_EMAIL>`、`<ACCOUNT_NUMBER>` 占位符的脱敏版本，遵循[官方博客示例](https://openai.com/index/introducing-openai-privacy-filter/#:~:text=coherent%20masking%20boundaries.-,Example%20input%20text,-Subject%3A%20Q2%20Planning)中的脱敏约定。私密 URL 受您保留的令牌保护，并显示带有高亮片段的原文。

**Privacy Filter 在这里的作用。** 将存储的粘贴中每个检测到的片段替换为 `<CATEGORY>` 占位符。这就是整个脱敏步骤。多语言文本（西班牙语、法语、中文、印地语以及模型卡片示例中的其他语言）无需任何更改即可通过同一次调用处理。

**`gr.Server` 在这里的作用。** 此应用需要同一粘贴 ID 的两个不同 GET 路由，一个公开，一个令牌保护，URL 形状很重要，因为揭示 URL 是您保留的东西。`gr.Server` 在这里有效，因为它底层是一个 FastAPI 应用——这也是为什么 `@server.api` 和普通 `@server.get` 可以在同一进程中并排存在的原因。注意：这也可以通过 `gr.Blocks()` 实现，通过[使用 FastAPI 挂载自定义路由](https://www.gradio.app/docs/gradio/mount_gradio_app)：

```python
# Model call → queued endpoint. Hit from the browser via
# client.predict("/create_paste", { text, ttl }).
@server.api(name="create_paste")
def create_paste(text: str, ttl: str = "never") -> dict:
    source_text, spans = run_privacy_filter(text)
    redacted = redact(source_text, spans)          # <CATEGORY> placeholders
    pid, reveal_token = secrets.token_urlsafe(6), secrets.token_urlsafe(22)
    PASTES[pid] = Paste(pid, reveal_token, source_text, redacted, spans,
                        expires_at=_ttl(ttl))      # see app.py
    return {
        "view_path":   f"/view/{pid}",
        "reveal_path": f"/view/{pid}?token={reveal_token}",
    }

# View page → plain FastAPI GET. No model, no queue needed, and we
# actually want the bespoke URL shape `/view/{pid}?token=...` that a
# queued endpoint couldn't give us.
@server.get("/view/{pid}", response_class=HTMLResponse)
async def view_paste(pid: str, token: str | None = None):
    p = _store_get(pid)                            # see app.py for store
    if p is None:
        return HTMLResponse(_not_found(), status_code=404)
    revealed = bool(token) and secrets.compare_digest(token, p.reveal_token)
    return HTMLResponse(_render_view(p, revealed))
```

一个守护线程每 30 秒清理过期的粘贴。整个服务（包括存储）大约有 200 行应用代码，因为所有内容都在一个进程中。

## `gradio.Server` 提供什么

三个应用的分工完全相同——任何涉及模型的内容都通过 `@server.api`，其他所有内容都保留在普通 FastAPI 路由上：

| 应用 | 队列计算（`@server.api`） | 普通 FastAPI 路由 |
|------|--------------------------|-----------------|
| Document Privacy Explorer | `analyze_document` — 提取、检测、统计 | `GET /` 提供自定义阅读器视图 |
| Image Anonymizer | `anonymize_screenshot` — OCR、检测、片段→像素框 | `GET /` + `GET /examples/*` 提供画布 UI 和预加载示例 |
| SmartRedact Paste | `create_paste` — 检测、脱敏、生成 ID | `GET /` 组合页面，`GET /view/{pid}?token=...` 公开 + 令牌保护视图，`GET /api/paste/{pid}` JSON 查询 |

`@server.api` 为您提供 Gradio 的队列（序列化请求、ZeroGPU 上正确的 `@spaces.GPU` 组合、进度事件），也是浏览器通过 [`@gradio/client`](https://www.gradio.app/guides/getting-started-with-the-js-client) 访问的端点。同一端点也是 `gradio_client` 用户从 Python 访问的端点——一个函数，两个 SDK，无需重复代码。普通的 `@server.get`/`@server.post` 保留给静态界面：HTML 页面、文件查询、廉价的字典读取。这是来自 [gradio.Server 介绍文章](https://huggingface.co/blog/introducing-gradio-server)的经验法则，也是让这三个应用尽管 UI 截然不同却感觉一致的原因。

## 试用

- [Document Privacy Explorer](https://huggingface.co/spaces/ysharma/OPF-Document-PII-Explorer)
- [Image Anonymizer](https://huggingface.co/spaces/ysharma/OPF-Image-Anonymizer)
- [SmartRedact Paste](https://huggingface.co/spaces/ysharma/OPF-SmartRedact-Paste)

上传一份简历、一张 Slack 对话截图、一行包含令牌的日志。有趣的地方在于看看 Privacy Filter 在您真正关心的文本上能捕获什么（偶尔也会遗漏什么）。

## 推荐阅读

- OpenAI 的发布文章：[Introducing OpenAI Privacy Filter](https://openai.com/index/introducing-openai-privacy-filter/)
- 模型卡片：[openai/privacy-filter on Hugging Face](https://huggingface.co/openai/privacy-filter)
- [模型卡片上的脱敏示例和分类法](https://cdn.openai.com/pdf/c66281ed-b638-456a-8ce1-97e9f5264a90/OpenAI-Privacy-Filter-Model-Card.pdf)

## 引用

- 原文：[How to build scalable web apps with OpenAI's Privacy Filter](https://huggingface.co/blog/openai-privacy-filter-web-apps)
- [openai/privacy-filter 模型](https://huggingface.co/openai/privacy-filter)
- [gradio.Server 介绍](https://huggingface.co/blog/introducing-gradio-server)
