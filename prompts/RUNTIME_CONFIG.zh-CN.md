# EssayCraft AI 运行配置

可编辑文件：`prompts/ai-runtime.json`

这个文件保存 AI 任务的默认时间限制、默认输出 token 上限，以及 DeepSeek thinking 参数。代码仍然允许 `.env.local` 覆盖这些值：

1. 如果 `.env.local` 设置了对应环境变量，优先使用 `.env.local`。
2. 如果没有设置环境变量，使用 `prompts/ai-runtime.json`。
3. 如果 JSON 文件缺失或格式错误，使用代码里的安全默认值。

## timeoutsMs

单位是毫秒。

| 任务 | API / 入口 | 当前默认 |
| --- | --- | --- |
| `chatModule` | Chat | `60000` |
| `rewriteSelection` | Edit / Rewrite | `60000` |
| `academicRewrite` | Edit / Academic | `60000` |
| `analyzeSelection` | Edit / Analyze | `60000` |
| `translateSelection` | Edit / Translate 和 `/api/translate` | `60000` |
| `explainHighlight` | Edit / Explain | `60000` |
| `refreshAnnotations` | 全局 Refresh 和局部 Refresh | `300000` |
| `applyNotesRevision` | Apply Notes & Refresh | `120000` |
| `generateNextModule` | Generate Module N+1 | `300000` |
| `citationReview` | Module 5 Refresh review | `120000` |
| `finalReview` | Module 6 Refresh review | `120000` |

## maxTokens

`maxTokens.default` 是兜底值。具体任务可以单独覆盖：

- `assist`
- `assistAnalyze`
- `translateSelection`
- `refreshAnnotations`
- `generateNextModule`

当前默认是 `32768`。Generate Next 和 Refresh 也使用这个上限，避免长文档或 review 输出被过早截断。

## DeepSeek thinking / reasoning

`deepseekThinking` 控制 DeepSeek 请求里的 thinking 参数：

- `disabled`：默认值，适合当前 demo 和 flash/pro 普通调用。
- `enabled`：尝试打开 provider 的 reasoning/thinking 模式。如果当前模型或 DeepSeek API 不支持，可能导致 provider 返回错误。
- `omit`：完全不发送 thinking 字段。

也可以在 `.env.local` 里用 `ESSAYCRAFT_DEEPSEEK_THINKING=disabled|enabled|omit` 覆盖。

## 运行 Details / Stop

所有 AI 操作运行时，底部工具栏会显示 `Details`。打开后可以看到：

- action
- started time
- `Stop` 按钮

`Stop` 会取消浏览器端当前请求并恢复 UI。服务端或供应商侧请求可能已经发出，因此终端里偶尔仍可能在稍后看到该请求结束的日志。
