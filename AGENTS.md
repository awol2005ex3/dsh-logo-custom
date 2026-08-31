# AGENTS.md — dsh-logo-custom

供 AI 代理与协作者的代码地图与开发规范。本插件用于替换 DeepSeek Harness 侧边栏左上角的品牌图标和文字。

## 1. 项目定位

本插件采用 **双交付架构**（dual-delivery）：

| 半 | 运行环境 | 文件 | 职责 |
|---|---|---|---|
| 宿主半 (Node) | 服务端 | `src/index.ts` | HTTP 路由、图片持久化、RPC 端点 |
| 浏览器半 (Client) | 浏览器 | `src/client.ts` | DOM 监听、品牌插槽替换、上传面板 |

**原理**：`package.json` 的 `exports["."]` 指向 Node 半，`exports["./client"]` 指向浏览器半。Cordis loader 在启动时加载 Node 半，浏览器 shell 加载 client bundle。

## 2. 代码地图 (Code Map)

```
dsh-logo-custom/
├── package.json              # 插件元数据、exports 声明、dsh 配置
├── tsconfig.json             # TypeScript 编译配置（NodeNext）
├── cordis.patch.yml          # Cordis 插件注册声明
├── scripts/
│   └── wrap-client.mjs       # 将 tsc 产出的 client.js 包装为 CJS 闭包工厂
├── src/
│   ├── index.ts              # 宿主半入口
│   └── client.ts             # 浏览器半（零 import/export 的纯脚本）
└── lib/                      # 编译输出（gitignore）
    ├── index.js
    ├── index.d.ts
    └── client.js             # 被 wrap-client.mjs 处理后成为浏览器 bundle
```

### 2.1 `src/index.ts` — 宿主半

- **导出契约**：必须导出 `name`、`inject`、`Config`、`apply` 四个标识符
- **依赖注入**：`inject = ['connection', 'webServer']`
- **HTTP 路由**：通过 `registerImageRoutes()` 统一注册每个图片类型的两条路由（GET/DELETE 一条，POST 一条）
  - 品牌图标：`/dsh-logo-custom/logo` + `/dsh-logo-custom/upload`
  - 品牌文字：`/dsh-logo-custom/wordmark` + `/dsh-logo-custom/wordmark-upload`
- **RPC 端点**（可选的，客户端已改用 fetch 直接调用 HTTP）：
  - `logo-custom/status` — 查询两图状态
  - `logo-custom/remove` — 删除两图
- **存储**：图片保存在 `~/.dsh/data/dsh-logo-custom/logo.{ext}` 和 `wordmark.{ext}`

### 2.2 `src/client.ts` — 浏览器半

- **零 import/export**：不能使用 ESM 语法，只能用 `module.exports` 结尾
- **`el()` 工具函数**：创建 DOM 元素，`on` 前缀属性自动转为 `addEventListener`
- **DOM 监听**：通过 `MutationObserver` 监听 `[data-slot="sidebar.brand.mark"]` 和 `[data-slot="sidebar.brand.name"]` 元素
- **品牌图标替换**：创建 `<img>` 元素替换 slot 内容，`?rev=N` 参数防缓存
- **品牌文字替换**：同上，不同 CSS 样式（`WORDMARK_IMG_CSS`）
- **上传面板**：浮动按钮 + 弹出面板，两个独立上传区域（图标 + 文字）
- **初始化**：使用 `fetch` 直接调用 HTTP 端点恢复 Logo，不依赖 RPC
- **防重复挂载**：使用 `window.__dshLogoCustomMounted` 标志

## 3. 开发流程

```bash
# 安装依赖
npm install

# 类型检查
npm run typecheck

# 编译（tsc + wrap-client.mjs）
npm run build

# 安装到 web profile
npx @deepseek-ai/dsh plugin --profile web add .

# 重启生效
npx @deepseek-ai/dsh --profile web restart

# 验证配置
npx @deepseek-ai/dsh --profile web --dump-config
```

**质量门顺序**：`typecheck` → `build` → `plugin add` → 重启 → 验证

## 4. 关键约束 / 已踩坑

1. **`exports["./package.json"]` 必须存在** — host 用 `require.resolve` 读取元数据，缺失会导致客户端 404
2. **client.ts 不能有 `import`/`export`** — tsc 会追加 `export {}` 使经典脚本解析失败，wrap-client.mjs 会剥掉它
3. **client.ts 不能用 TS 特有语法** — `enum`/`namespace`/`satisfies`/参数属性等在浏览器环境会报错
4. **`module.exports` 必须在文件末尾** — loader 从中读取 `name`/`inject`/`apply`
5. **HTTP 路由必须返回** — 不返回响应会挂起连接
6. **图片上传用 multipart/form-data** — 不能用 JSON
7. **文件类型验证在服务端** — 浏览器端验证可被绕过
8. **`ctx.webServer.register` 返回 disposer** — 必须在 `ctx.effect` 中清理
9. **`el()` 的 `onClick` 要转小写** — 属性名 `onClick` → `addEventListener('click', ...)`，否则事件不触发
10. **`?rev=` 查询参数不影响 exact 路由匹配** — webServer 内部用 `new URL(req.url).pathname` 提取路径，查询参数被剥离
11. **`Cache-Control: no-cache` 不够** — 浏览器 `<img>` 仍可能缓存，必须配合 `?rev=N` 参数强制刷新
12. **RPC 通道 `/rpc` 冲突** — 多个插件共享 `/rpc` 通道可能导致 handler 未注册，改用 `fetch` 直接调用 HTTP 端点更可靠
13. **React 重渲染会清除注入的 DOM** — 使用 `MutationObserver` 持续监听并重新注入 `<img>` 元素

## 5. 开发约定

1. **具名导出** — Node 半所有导出必须具名，禁止 `export default`
2. **可逆注册** — 所有 `register`/`handle` 必须在 `ctx.effect` 中清理
3. **不臆造 API** — 只使用 `dsh-plugin-dev` skill 中定义的 API
4. **日志使用 ctx.logger** — 禁止 `console.log`
5. **客户端用 fetch 代替 RPC** — 避免 RPC 通道冲突，直接调用 HTTP 端点

## 6. 如何扩展

| 任务 | 入口 | 改动位置 |
|------|------|----------|
| 新增图片类型（如 favicon） | `src/index.ts` `apply()` | 调用 `registerImageRoutes()` 传新前缀和路径 |
| 修改上传限制 | `src/index.ts` | `ALLOWED_TYPES` 数组 |
| 修改品牌图标样式 | `src/client.ts` | `LOGO_IMG_CSS` 常量 |
| 修改品牌文字样式 | `src/client.ts` | `WORDMARK_IMG_CSS` 常量 |
| 修改面板样式 | `src/client.ts` | `PANEL_CSS` 常量 |
| 修改存储路径 | `src/index.ts` `Config` | `storageDir` 默认值 |

## 7. API 契约速查

### 7.1 HTTP 路由

```
品牌图标：
  GET    /dsh-logo-custom/logo        → 图片二进制
  POST   /dsh-logo-custom/upload      → { ok, url?, error? }
  DELETE /dsh-logo-custom/logo        → { ok, error? }

品牌文字：
  GET    /dsh-logo-custom/wordmark    → 图片二进制
  POST   /dsh-logo-custom/wordmark-upload → { ok, url?, error? }
  DELETE /dsh-logo-custom/wordmark    → { ok, error? }
```

### 7.2 浏览器 DOM 锚点

```css
/* 侧边栏品牌图标容器 */
[data-slot="sidebar.brand.mark"]

/* 侧边栏品牌名称容器 */
[data-slot="sidebar.brand.name"]

/* 侧边栏底部操作区（挂载按钮） */
[data-slot="sidebar.footer.action"]
```

## 8. 参考

- **harness 源码**：`D:\workspace_node\deepseek-harness\packages\client\ui-sidebar\src\client\SidebarRoot.tsx`
- **官方品牌插件**：`D:\workspace_node\deepseek-harness\packages\client\ui-brand-official\src\client\index.ts`
- **同类插件**：`dsh-any-background`、`dsh-role-manager`
- **开发技能**：`.opencode\skills\dsh-plugin-dev\SKILL.md`