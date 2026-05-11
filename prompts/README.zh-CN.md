# EssayCraft Prompt Registry 说明

这份文档说明每个 AI API 使用哪个 `system prompt`、`user prompt` 在哪里组装、以及实际会发送哪些上下文字段。所有可编辑的系统提示词都放在根目录 `prompts/` 下；代码只负责读取这些文件、填充变量、裁剪上下文、校验 JSON schema 和保护文本范围。

## 总原则

- 语义判断交给 LLM provider。代码只做路由、上下文整理、schema 校验、range 安全和 UI preview。
- `ESSAYCRAFT_FORCE_MOCK_AI=1` 时才使用 mock。否则有 DeepSeek key 就走 provider；没有 key 或 provider 失败就显示 unavailable，不伪装成本地 AI。
- `module.text` 永远只保存学生正文。patch/note、annotations、sources 都是独立 metadata。
- Edit 小按钮默认只传局部上下文，避免每次 rewrite/translate 都把整篇文章发给模型。
- Chat、全局 Refresh、Generate Next 需要全局理解，因此可以传当前模块全文。

## Prompt 文件地图

| 功能 | API | System prompt 文件 | User prompt 组装位置 |
| --- | --- | --- | --- |
| Chat / Rewrite / Academic / Analyze / Edit Translate / Explain | `/api/assist` | `prompts/assist/system.md` | `src/lib/prompts.ts` 的 `buildAssistMessages()` |
| 全局 Refresh 高亮 | `/api/refresh` | `prompts/refresh/unit-label-system.md` | `src/lib/prompts.ts` 的 `buildRefreshUnitMessages()` |
| 局部 Refresh 标签 | `/api/refresh` | `prompts/refresh/unit-label-system.md` | `src/lib/prompts.ts` 的 `buildRefreshUnitMessages()`，由前端传 `selectedRange` 和 `instruction` |
| Apply Notes & Refresh | `/api/refresh` | `prompts/refresh/revision-system.md` | `src/lib/prompts.ts` 的 `buildRefreshMessages()` |
| Generate Next | `/api/generate-next` | `prompts/module-transitions/*.md` + `prompts/generate-next/system-suffix.md` | `src/lib/prompts.ts` 的 `buildGenerateNextMessages()` |
| Generate Next annotation rules | `/api/generate-next` | `prompts/generate-next/annotation-rules.md` | 拼进 Generate Next user prompt |
| Generate Next schema repair | `/api/generate-next` | `prompts/generate-next/schema-repair-system.md` | `src/app/api/generate-next/route.ts` |
| Generate Next contract repair | `/api/generate-next` | `prompts/generate-next/contract-repair-system.md` | `src/app/api/generate-next/route.ts` |
| 独立 Reference Translation | `/api/translate` | `prompts/translate/system.md` | `src/lib/prompts.ts` 的 `buildTranslateMessages()` |
| 通用 JSON repair | task router | `prompts/repair/json-system.md` | `src/lib/ai/taskRouter.ts` |

## `/api/assist` 上下文分档

`/api/assist` 同时负责 Chat 和 Edit 模式。为了降低延迟，它现在按动作分成不同 context profile。

### 1. Chat: `chat-full-module`

用途：右侧 Chat 模式中关于当前 module 的普通提问。

发送内容：

- `projectTitle`
- `topic`
- 当前 module number/title
- 用户原始聊天消息
- 当前 module 全文 `text`
- 当前选区/活动句子，如果有
- annotation summary，只是数量、label 分布和少量例子，不发送所有 annotation 原始对象
- open notes summary，只发送相关 note 摘要
- source summary，只发送数量和前几个 source card 摘要
- 最近 6 条聊天历史

不做的事：

- 不返回 `proposedText`
- 不返回 `replaceRange`
- 不修改正文

### 2. Rewrite / Academic: `edit-selection`

用途：Edit 模式前两个蓝色按钮，返回可 Apply 的 replacement preview。

发送内容：

- `projectTitle`
- `topic`
- 当前 module number/title
- action 字符串，里面包含按钮内置动作和用户 instruction textarea
- `selectedRange`
- `selected clean text`
- `surrounding paragraph/context`
- 选区内 notes，作为 instructions，不作为正文
- 选区内 active annotation context
- source summary

刻意不发送：

- 当前 module 全文
- 全部 annotations
- 全部 patches
- 全部 sources 原始详情
- 聊天历史

原因：Rewrite/Academic 是局部修改，模型只需要选区、附近段落、项目标题和用户指令。这样 token 量通常接近 `selected words + surrounding paragraph + 固定提示词`，不再接近整篇文章。

返回要求：

- `kind: "edit"`
- `proposedText`
- 精确的 `replaceRange`
- `reply` 只是一句简短说明

### 3. Edit Translate: `translation-selection`

用途：Edit 模式 Translate 按钮。它不是独立 `/api/translate` modal，而是 `/api/assist` 的只读 inspect response。

发送内容：

- selected clean text
- surrounding paragraph/context
- 用户 instruction textarea，例如 `translate into Chinese` / `请翻译成中文`
- project/module context

不发送全文，不修改正文，不创建 snapshot。

返回要求：

- `kind: "inspect"`
- `reply` 只放翻译结果或很短说明
- 不允许 `proposedText`
- UI 只有 Copy / Dismiss

### 4. Analyze: `analysis-selection`

用途：Edit 模式 Analyze 按钮。它是只读评论，不是改写。

发送内容：

- selected clean text
- surrounding paragraph/context
- 用户 instruction textarea
- notes inside selection，如果有
- active annotation context

如果用户写 `用中文`，模型应使用中文回答。Analyze 不修改正文。

### 5. Explain: `highlight-explanation`

用途：解释当前 active highlighted sentence/range 为什么被标成某个 label。

发送内容：

- active/selected clean text
- active annotation label/comment/range
- surrounding paragraph/context
- 可选用户 instruction

Explain 只解释 highlight，不做一般性分析；没有 active highlight 时前端会禁用按钮。

### 6. 局部 Refresh 按钮

Edit 模式第三个蓝色按钮 `Refresh` 不走 `/api/assist`，而是走 `/api/refresh`。前端会先把残缺选区扩展到完整句子，再发送：

- 当前 module 全文，用于全局语境
- `selectedRange`
- 用户 instruction textarea，例如“这里应该是 evidence，不是 background”
- annotations/sources 摘要

返回的是局部标签解释/结果，不直接改写正文。

## `/api/refresh`

### 全局 Refresh Highlighting

System prompt: `prompts/refresh/unit-label-system.md`

发送内容：

- `projectTitle`
- `topic`
- current module number
- full essay context
- sentence/rhetorical units，每个 unit 有 `index/start/end/text`
- 可选本地 instruction

当前策略是让 AI 先看 full essay context，再给每个 unit 打标签。这样保留上下文，但 unit text 会让正文在 prompt 中出现第二次。它比逐句独立请求更能保留 essay 逻辑，也比多轮并行省 API 调用次数。

### Apply Notes & Refresh

System prompt: `prompts/refresh/revision-system.md`

仅在存在 open notes/patches 时使用。发送当前 module text 和 notes，返回 revision preview。Accept 后才修改正文并清除已应用 notes。

## `/api/generate-next`

Generate Next 使用 transition prompt，而不是普通 Chat prompt。

文件：

- `prompts/module-transitions/module-1-to-2.md`
- `prompts/module-transitions/module-2-to-3.md`
- `prompts/module-transitions/module-3-to-4.md`
- `prompts/module-transitions/module-4-to-5.md`
- `prompts/module-transitions/module-5-to-6.md`
- `prompts/generate-next/system-suffix.md`

发送内容：

- topic/project context
- source module number/title/text
- source annotations
- source patches
- source cards
- transition-specific instruction
- annotation rules

Generate Next 需要生成下一个 module，因此会比局部 Edit 更贵、更慢。

## `/api/translate`

这是独立 Reference Translation / preview-only route，目前不是主要工作流。Edit mode Translate 已经走 `/api/assist`，更适合选区翻译。

发送内容：

- topic
- module number
- selected range
- scoped text to translate

不修改正文，不创建 snapshot。

## 修改 prompt 时的注意事项

- 想改 AI 的“角色/输出规则”，改 `prompts/**/system.md`。
- 想改“发送哪些字段”，改 `src/lib/prompts.ts`。
- 想改 Generate Next 每个 module 的课程逻辑，改 `prompts/module-transitions/*.md` 和 `src/lib/moduleTransitionPrompts.ts`。
- 不要在 prompt 里要求模型返回自然语言解释后再返回 JSON。所有 API 都要求 strict JSON。
- Rewrite/Academic 必须只返回 replacement text，不要出现 “Here is a revised version” 这类 meta text。
- Translate/Analyze/Explain 必须是 read-only，不能包含 Apply 所需字段。
