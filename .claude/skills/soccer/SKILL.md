---
name: soccer
description: Write a soccer star blog post for Oscar's blog. Creates a Chinese-language article from an 80后球迷 perspective about a football legend, covering career trajectory, honors, unique qualities, and a thematic angle. Also downloads and compresses 5 high-quality images via Google Images. Use this skill whenever the user wants to write about a football/soccer player, mentions "写球星", "足球", "soccer star", or gives a player name to write about.
argument-hint: "<player name in Chinese or English>"
---

# Write Soccer Star Blog Post

球星：$ARGUMENTS

为 Oscar 的博客撰写一篇足球球星文章，以80后球迷视角回忆一位足球传奇。

## Inputs

通过 $ARGUMENTS 传入：
- 球星姓名（中文或英文）
- 如果 $ARGUMENTS 为空，询问用户想写哪位球星

## Workflow

### 1. 搜集球星资料

从以下渠道获取球星信息，交叉验证确保准确：

1. **Wikipedia**：完整职业轨迹、效力球队、转会时间线、荣誉列表
2. **National Football Teams / Transfermarkt**：国家队数据、进球记录
3. **其他来源**：搜索"球星名 career highlights"，参考 2-3 篇高质量文章

需要收集的信息：
- 完整球队轨迹（青年队 → 各俱乐部 → 退役）及每站的关键数据
- 国家队生涯（出场数、进球数、大赛表现）
- 主要荣誉（联赛冠军、杯赛、国际大赛、个人奖项）
- 球员特点与踢球风格
- 标志性时刻或故事
- 外界评价的核心共识

### 2. 确定主题角度

每篇文章需要一个独特的主题角度，用"关键词+关键词"概括球星最本质的特质。这个角度贯穿标题和全文。

**已有文章的主题角度参考**：
- 巴蒂斯图塔："忠诚+担当"
- 罗伯特·巴乔："天才+脆弱"（忧郁、浪漫）
- 克林斯曼："流动+高效"
- 罗纳尔多："天赋+毁灭力"（外星人降临与凡人的代价）

主题角度应从球星的职业轨迹和选择中自然生长出来，不是贴标签。

### 3. 准备图片素材（5 张）

通过 Google Images 搜索球星的高清照片，覆盖其职业生涯的不同阶段。

**搜索方法**：
1. 使用 Chrome DevTools MCP 工具打开 Google Images：
   ```
   navigate_page → https://www.google.com/search?q=<player name>+<club/era>&tbm=isch&tbs=isz:l
   ```
   添加 `tbs=isz:l` 过滤大尺寸图片。

2. 使用 `take_snapshot` 获取页面元素，然后 `click` 图片缩略图打开预览面板。

3. 使用 `evaluate_script` 提取预览面板中的全尺寸图片 URL：
   ```javascript
   () => {
     const imgs = document.querySelectorAll('img[jsname]');
     const results = [];
     for (const img of imgs) {
       if (img.naturalWidth > 400 && img.src && !img.src.startsWith('data:') && !img.src.includes('encrypted-tbn')) {
         results.push({src: img.src, width: img.naturalWidth, height: img.naturalHeight});
       }
     }
     return results;
   }
   ```

4. 点击多个搜索结果，收集足够的候选图片 URL。

**图片覆盖要求**：
- 5 张图片应覆盖球星职业生涯的不同阶段（不同俱乐部、国家队等）
- 优先选择比赛动作照（进球、带球、庆祝），避免肖像照、红毯照、发布会照
- 每张图片必须清晰，人物可辨认

**搜索关键词示例**（分阶段搜索）：
- `<player> <early club> goal`
- `<player> <peak club> action`
- `<player> <national team> world cup`
- `<player> <later club> celebration`

**保存路径**：`public/media/football/<slug>/`
- 文件命名应反映内容，如 `barcelona.jpg`、`inter-milan.jpg`、`brazil-2002.jpg`

**图片压缩（必须）**：
下载后使用 `sips` 压缩每张图片：
- 最大宽度：1600px
- 质量参数：formatOptions 85（如超过 500KB 则降低）
- 单张图片不超过 500KB

```bash
# 需要缩小的图片（宽度超过 1600px）
sips --resampleWidth 1600 -s formatOptions 85 <file> --out <file>.tmp && mv <file>.tmp <file>

# 只需压缩的图片
sips -s formatOptions 85 <file> --out <file>.tmp && mv <file>.tmp <file>
```

压缩后必须用 Read 工具逐张验证图片仍清晰可用。如果图片损坏或不清晰，重新下载。

### 4. 撰写文章

**语言与视角**：中文，以"80后球迷"的第一人称集体视角书写。不是个人日记，而是一代球迷的共同记忆。

**文章结构**：

1. **开头**：以"如果你是80后球迷，[球星名]这个名字……"引入，点出这位球星在一代人记忆中的定位
2. **球员特点**：用画面感的语言描述他的踢球方式和独特之处
3. **职业轨迹**：按时间线讲述球队轨迹，突出关键转折和选择
4. **荣誉与数据**：以列表或段落形式呈现主要荣誉
5. **外界评价**：3 条核心共识，用加粗关键词 + 冒号 + 解释的格式
6. **主题升华**：将球星的独特之处提炼为一种"坐标"，与同代球星对比，回扣主题角度
7. **参考链接**：Wikipedia + National Football Teams（或其他权威来源）

**图片嵌入规则**：
- 图片必须放在与其内容相关的段落**上方**
- 例如：讲国际米兰的段落上方放国际米兰时期的图片
- 图片 alt text 格式：`球星名（时期/场景描述）`
- 开头放 1 张代表性图片，其余 4 张按生涯时间线穿插在正文中

**写作风格**：
- 不煽情、不堆砌形容词，用克制的笔触写出力量感
- 多用具体细节（某场比赛、某个进球、某个选择）而非空洞评价
- 适度引用数据，但不要变成统计报告
- 与同代球星的对比自然带出，不刻意拉踩
- 结尾留有余韵，不要总结陈词式收尾

**Frontmatter 模板**：
```yaml
---
title: "球星名：主题短语"
pubDatetime: <ISO8601+08:00>
description: "一位80后球迷视角下的[球星名]：球队轨迹、荣誉、[主题关键词]与[主题关键词]的独特[定位]。"
slug: <english-kebab-case>
postType: soccer
---
```

**注意**：
- `postType` 必须设为 `soccer`
- `slug` 使用英文 kebab-case，体现球星名和主题
- `title` 中不要使用中文双引号 `""`，用 `「」` 替代避免 YAML 解析错误

**文章路径**：`src/data/blog/<slug>.md`

### 5. 构建校验

执行构建确认渲染通过：
```bash
pnpm build
```

如果构建失败，修复问题后重新构建。

### 6. 质量检查清单

- [ ] 标题格式为 `球星名：主题短语`
- [ ] description 包含"80后球迷视角"和主题关键词
- [ ] postType 设为 `soccer`
- [ ] 文章以"如果你是80后球迷"开头
- [ ] 包含完整职业轨迹（球队、时间线、关键数据）
- [ ] 包含荣誉列表
- [ ] 包含 3 条外界评价核心共识
- [ ] 包含主题升华段落，与同代球星对比
- [ ] 5 张图片已下载到 `public/media/football/<slug>/`
- [ ] 图片覆盖职业生涯不同阶段
- [ ] 图片是清晰的比赛/动作照（非肖像、红毯、发布会）
- [ ] 所有图片已压缩（≤500KB，最大宽度 1600px）
- [ ] 每张图片放在与其内容匹配的段落上方
- [ ] 参考链接包含 Wikipedia 等权威来源
- [ ] `pnpm build` 通过

### 7. 完成报告

完成后向用户汇报：
- 球星名（中文 + 英文）
- 主题角度
- 文章路径和 slug
- 配图数量及覆盖阶段
- 构建结果
