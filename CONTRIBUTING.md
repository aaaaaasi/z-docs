# 贡献指南

感谢你考虑为 Z-Docs 贡献代码！🙏

## 开发环境

| 依赖 | 版本要求 |
|---|---|
| Bun | 1.0+ |
| Node.js | 18+（仅作参考，运行时使用 Bun） |

```bash
# 克隆并安装
git clone https://github.com/aaaaaasi/z-docs.git
cd z-docs
bun install

# 初始化数据库（.env 已提交，含 SQLite 路径配置）
bun run db:push

# 启动协作服务（可选——需要实时协作功能时）
cd mini-services/collab-service && bun install && bun run dev   # :3003

# 启动主应用
cd ../.. && bun run dev   # http://localhost:3000
```

## 架构速览

- **单路由 SPA**：用户可见路由只有 `/`，首页/编辑器/各应用通过客户端视图切换，深度链接 `/?doc=<id>` 走 History API。
- **API 路由**：`src/app/api/**` 提供 40+ REST 端点，全部使用 `import { db } from '@/lib/db'` 访问 Prisma。
- **协作服务**：`mini-services/collab-service` 是独立 Bun 进程（端口 3003），前端通过 `io('/?XTransformPort=3003')` 连接。
- **状态管理**：Zustand（客户端状态）+ TanStack Query（服务端状态）。
- **i18n**：`src/lib/i18n/` 按域拆分词典（dict-editor / dict-sheets / dict-slides…），新增 UI 文案必须同时补中英两份。
- **数据库**：Prisma + SQLite，schema 在 `prisma/schema.prisma`（15 个模型）。修改后运行 `bun run db:push`。

## 质量门（提交前必须通过）

```bash
bun run lint                       # ESLint 零告警
bunx tsc --noEmit -p tsconfig.json # src/ 范围零类型错误
```

另外请确保：
- `bun run dev` 启动无报错，页面正常渲染
- 涉及导出 / 协作 / 表单的改动做一次手工冒烟验证

## 代码规范

- TypeScript strict；ES6+ import/export
- UI 优先使用 `src/components/ui` 中已有的 shadcn/ui 组件，避免重复造轮子
- 遵循现有目录约定：编辑器组件在 `src/components/docs/editor/`，表格在 `sheets/`，以此类推
- 交互反馈使用 sonner Toast；加载态使用骨架屏或 spinner
- 无障碍：语义化标签（`main/header/nav`）、可交互元素提供 `aria-label`、可键盘操作
- 响应式：移动端优先，保证 375px 视口可用
- `z-ai-web-dev-sdk` **只能在服务端（API 路由）使用**，禁止引入客户端代码

## 提交规范

```
<type>: <subject>

<可选正文>
```

常用 type：`feat`（新功能）/ `fix`（修复）/ `docs`（文档）/ `style`（样式）/ `refactor`（重构）/ `perf`（性能）/ `test`（测试）/ `chore`（工程）。

## Pull Request 流程

1. Fork 并创建特性分支：`git checkout -b feat/your-feature`
2. 提交变更并通过质量门
3. 发起 PR，描述清楚改动内容与验证方式（截图/录屏更佳）
4. 等待维护者 review

## 特别说明：为什么仓库里没有 .gitignore？

本仓库**有意不包含任何 ignore 文件**：除 `node_modules/`、`.next/` 等安装/构建可再生的产物外，全部文件（包括开发过程产物 `download/`、`upload/`、`tool-results/`、`worklog.md`）都纳入版本库，以保证开发过程可追溯。克隆后请自行 `bun install` 恢复依赖。

## 行为准则

请保持友善与专业。理性讨论技术方案，尊重每一位贡献者。
