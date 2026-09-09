# 安全策略

## 报告漏洞

如果你发现了安全漏洞，请**不要**通过公开 Issue 报告。

请通过 [GitHub Security Advisories](https://github.com/aaaaaasi/z-docs/security/advisories/new) 私下报告，我们会在 72 小时内回应。

## 支持版本

| 版本 | 支持状态 |
|---|---|
| 1.0.x | ✅ 支持 |

## 安全设计要点

- 会话认证校验 `Sec-Fetch-Site` 同源，跨站请求拒绝（403）
- AI SDK（z-ai-web-dev-sdk）仅在服务端 API 路由调用，密钥永不下发客户端
- 游客模式数据仅存于本设备 localStorage，不上传
- 用户内容通过 Prisma 参数化查询入库，避免注入
