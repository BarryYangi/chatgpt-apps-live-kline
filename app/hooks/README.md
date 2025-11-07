# OpenAI Apps SDK Hooks 详解

本目录封装了一组围绕 OpenAI Apps SDK（ChatGPT 小组件运行环境）的 React Hooks，帮助你以简洁、安全、SSR 友好的方式访问和控制宿主提供的能力（如工具调用、显示模式、外链打开、会话消息等）。

这些 Hooks 主要通过 `window.openai` 与宿主通信，并在非 ChatGPT 环境或 SSR（服务器端渲染）时进行安全回退。索引导出见 `app/hooks/index.ts`。

- OpenAI API hooks：`useCallTool`、`useSendMessage`、`useOpenExternal`、`useRequestDisplayMode`
- OpenAI state hooks：`useDisplayMode`、`useWidgetProps`、`useWidgetState`、`useOpenAIGlobal`
- 其他：`useMaxHeight`、`useIsChatGptApp`
- 类型：从 `./types` 导出常用类型（如 `DisplayMode`、`CallToolResponse` 等）

> 运行前提：在 ChatGPT Apps/Widget 宿主中，SDK 会注入 `window.openai` 对象以及 `openai:set_globals` 事件用于全局状态同步；这些 Hook 已在代码中做了环境检测，确保非宿主环境下也能安全运行（返回空值或采用降级策略）。

---

## useCallTool

- 位置：`app/hooks/use-call-tool.ts`
- 作用：在小组件内直接调用 MCP（Model Context Protocol）工具。
- 签名：`(name: string, args: Record<string, unknown>) => Promise<CallToolResponse | null>`
- 返回：工具响应（`{ result: string }`）或 `null`（当不在宿主环境/SDK 不可用时）。
- 关键实现：检测 `window.openai.callTool` 是否存在，存在则调用，否则返回 `null`。

示例：

```tsx
const callTool = useCallTool();

async function handleFetch() {
  const res = await callTool("search_database", { query: "user data", limit: 10 });
  console.log(res?.result);
}
```

使用建议：
- 确保在用户手势或合适的时机触发，以便宿主能正确授权（如网络、权限等）。
- 对返回 `null` 做兼容处理，以支持本地开发或浏览器直接打开页面的场景。

---

## useSendMessage

- 位置：`app/hooks/use-send-message.ts`
- 作用：向当前 ChatGPT 会话发送后续消息（Follow-up）。
- 签名：`(prompt: string) => Promise<void>`
- 行为：若 `window.openai.sendFollowUpMessage` 存在，则调用；否则返回已完成的 Promise（空操作）。

示例：

```tsx
const sendMessage = useSendMessage();
await sendMessage("Tell me more about this topic");
```

使用建议：
- 适用于在工具执行后，向用户推送说明、结果总结或继续引导对话。
- 在非宿主环境下为 NOOP，不会抛错。

---

## useOpenExternal

- 位置：`app/hooks/use-open-external.ts`
- 作用：通过宿主安全地打开外部链接，兼容桌面/移动原生客户端；失败时回退到 `window.open`。
- 签名：`(href: string) => void`
- 行为：优先调用 `window.openai.openExternal({ href })`；若不可用或抛错，使用 `window.open(href, "_blank", "noopener,noreferrer")`。

示例：

```tsx
const openExternal = useOpenExternal();
openExternal("https://example.com");
```

使用建议：
- 在 ChatGPT 原生容器内，使用宿主能力能获得更一致的体验（如应用内浏览、权限策略）。

---

## useRequestDisplayMode

- 位置：`app/hooks/use-request-display-mode.ts`
- 作用：向宿主请求调整小组件显示模式（`pip` | `inline` | `fullscreen`）。
- 签名：`(mode: DisplayMode) => Promise<{ mode: DisplayMode }>`
- 行为：若 `window.openai.requestDisplayMode` 存在则调用宿主 API；否则直接返回传入的 `mode` 作为回退值。宿主可能拒绝请求或在移动端将 `pip` 强制为 `fullscreen`。

示例：

```tsx
const requestDisplayMode = useRequestDisplayMode();
const { mode: granted } = await requestDisplayMode("fullscreen");
```

使用建议：
- UI 需要根据“实际授予的模式”来渲染，而不是仅依据请求值。

---

## useDisplayMode

- 位置：`app/hooks/use-display-mode.ts`
- 作用：获取当前小组件显示模式；基于 `useOpenAIGlobal("displayMode")` 实现。
- 返回：`"pip" | "inline" | "fullscreen" | null`

示例：

```tsx
const displayMode = useDisplayMode();
if (displayMode === "fullscreen") {
  // 展示完整界面
}
```

---

## useWidgetProps

- 位置：`app/hooks/use-widget-props.ts`
- 作用：读取工具输出（`toolOutput`）作为组件 Props；当不可用时返回指定默认值。
- 签名：`<T extends Record<string, unknown>>(defaultState?: T | (() => T)) => T`
- 行为：从 `useOpenAIGlobal("toolOutput")` 读取；若为 `null/undefined`，返回 `defaultState` 或其计算结果。

示例：

```tsx
const props = useWidgetProps<{ userId: string; name: string }>({ userId: "123", name: "John" });
```

使用建议：
- 将工具的结构化输出直接映射到 UI Props，简化数据流。

---

## useWidgetState

- 位置：`app/hooks/use-widget-state.ts`
- 作用：管理“随小组件生命周期持久化”的状态；与宿主进行双向同步（最小化/恢复后仍存在）。
- 签名（函数重载）：
  - `useWidgetState<T extends UnknownObject>(defaultState: T | (() => T)) => readonly [T, Dispatch<SetStateAction<T>>]`
  - `useWidgetState<T extends UnknownObject>(defaultState?: T | (() => T | null) | null) => readonly [T | null, Dispatch<SetStateAction<T | null>>]`
- 初始化逻辑：
  1. 若宿主提供了 `window.openai.widgetState`，以其为初始值；
  2. 否则使用 `defaultState` 或其惰性计算结果；
- 同步逻辑：
  - 订阅宿主状态变化，`widgetStateFromWindow` 变化时更新本地 state；
  - 本地 `setWidgetState` 更新时会调用 `window.openai.setWidgetState(newState)` 以同步至宿主。

示例：

```tsx
interface MyState { count: number; user: string }
const [state, setState] = useWidgetState<MyState>({ count: 0, user: "guest" });

const increment = () => setState(prev => ({ ...prev, count: prev.count + 1 }));
```

使用建议：
- 只用于可序列化的轻量状态；较大或敏感数据建议后端持久化。
- 注意：当传入 `null` 时不会调用 `setWidgetState`（实现中进行了判空保护）。

---

## useOpenAIGlobal

- 位置：`app/hooks/use-openai-global.ts`
- 作用：订阅并读取某个 `window.openai` 全局字段（低层 Hook）。
- 签名：`<K extends keyof OpenAIGlobals>(key: K) => OpenAIGlobals[K] | null`
- 机制：基于 `useSyncExternalStore`，通过监听自定义事件 `openai:set_globals`（`SET_GLOBALS_EVENT_TYPE`）实现稳定同步与驱动渲染。

示例：

```tsx
const theme = useOpenAIGlobal("theme"); // "light" | "dark" | null
```

使用建议：
- 更推荐用上层封装（如 `useDisplayMode`、`useMaxHeight`）以获得明确的返回类型与业务语义；
- 需要订阅其他未封装字段时再直接使用该 Hook。

---

## useMaxHeight

- 位置：`app/hooks/use-max-height.ts`
- 作用：获取宿主为小组件提供的最大可用高度（像素）。
- 返回：`number | null`

示例：

```tsx
const maxHeight = useMaxHeight();
const style = { maxHeight: maxHeight ?? "100vh", overflow: "auto" };
```

## useTheme
- 位置：`app/hooks/use-theme.ts`
- 作用：获取当前宿主环境下的主题模式（`"light"` 或 `"dark"`）。
- 签名：`() => "light" | "dark" | null`
- 原理：基于 `useOpenAIGlobal("theme")`，对原始宿主注入的主题值做类型约束，SSR 下安全返回 `null`。

示例：

```tsx
const theme = useTheme();
if (theme === "dark") {
  // 切换到暗色 UI
}
```

使用建议：
- 可用于自适应组件/样式。如结合 Tailwind `dark` 类或自定义变量切换主题。
- 主题模式仅在 ChatGPT 小组件容器内由宿主提供，浏览器/SSR 环境将返回 `null`，需自行降级或适配（例如默认 light）。



---

## useIsChatGptApp

- 位置：`app/hooks/use-is-chatgpt-app.ts`
- 作用：判断是否运行在 ChatGPT App 容器内。
- 返回：`boolean`（从 `window.__isChatGptApp` 读取，SSR 时为 `false`）。
- 实现：用 `useSyncExternalStore` 返回静态快照，不进行事件订阅。

示例：

```tsx
const isApp = useIsChatGptApp();
if (!isApp) {
  // 显示 Web 端的替代 UI 或提示
}
```

---

## 常用类型与事件（来自 `app/hooks/types.ts`）

- `DisplayMode`：`"pip" | "inline" | "fullscreen"`
- `RequestDisplayMode`：`(args: { mode: DisplayMode }) => Promise<{ mode: DisplayMode }>`
- `CallToolResponse`：`{ result: string }`
- `CallTool`：`(name: string, args: Record<string, unknown>) => Promise<CallToolResponse>`
- `OpenAIGlobals`：宿主注入的全局字段集合（主题、布局限制、工具输入/输出、`setWidgetState` 等）
- 事件：`SET_GLOBALS_EVENT_TYPE = "openai:set_globals"`，事件类型为 `SetGlobalsEvent<{ globals: Partial<OpenAIGlobals> }>`

---

## 设计与使用要点

- SSR 安全：所有 Hook 在访问 `window` 前均做了 `typeof window !== "undefined"` 检查；SSR 渲染时返回 `null`/NOOP，避免报错。
- 空值处理：读取宿主状态时常见返回 `null`，使用时应进行判空或提供默认值（如 `useWidgetProps`）。
- 回退策略：API 不存在或失败时，采用合理回退（如 `useOpenExternal` 回退到 `window.open`，`useRequestDisplayMode` 回退返回传入模式）。
- 最佳实践：
  - 可视区域/布局：配合 `useDisplayMode`、`useMaxHeight` 自适应 UI。
  - 数据流：工具输出通过 `useWidgetProps` 进 UI；临时交互状态通过 `useWidgetState` 持久化。
  - 互操作：调用工具（`useCallTool`）后可用 `useSendMessage` 向会话追加说明或下一步建议。

---

## 故障排查

- 直接在浏览器打开：`window.openai` 不存在，部分 Hook 将返回 `null` 或 NOOP。这是预期行为。
- 移动端 PiP：宿主可能将 `pip` 强制为 `fullscreen`，请以 `useRequestDisplayMode` 返回的 `mode` 为准。
- 事件未触发：若发现 `useOpenAIGlobal` 未更新，请确认宿主是否按 SDK 规范派发了 `openai:set_globals` 事件。

---

## 参考

- OpenAI Apps SDK（ChatGPT Widgets）概念与 API：请参阅官方文档。
- 本项目实现参考了官方示例（见部分文件顶部注释中的来源链接）。

