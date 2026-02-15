# DDD 后端目录结构设计（Next.js App Router）

以下结构用于在 Next.js 项目中实现 DDD 分层，并保持每个领域拥有独立的 domain/service/infra。对外 API 使用 Next.js 的 `app/api` 路由层。

## 推荐目录结构

```
src/
  server/
    shared/                      # 跨领域共享（基础设施 & 协议）
      db/                        # 数据库连接、连接池、Session 工厂
      llm/                       # 大模型客户端（如 OpenAI/自建）
      telemetry/                 # Langfuse / tracing / metrics
      protocols/                 # UnitOfWork、Logger、MessageBus 等接口
      utils/                     # 通用工具
    users/                       # 用户领域
      domain/                    # 实体、值对象、领域规则
      protocols/                 # 用户领域接口（Repo、Hasher 等）
      services/                  # 应用服务（RegisterUser 等用例）
      infra/                     # 用户领域基础设施实现（DB、第三方）
    orders/                      # 订单领域
      domain/                    # 实体、值对象、领域规则
      protocols/                 # 订单领域接口（Repo、Hasher 等）
      services/                  # 应用服务（RegisterUser 等用例）
      infra/                     # 订单领域基础设施实现（DB、第三方）
    payments/                    # 支付领域
      domain/                    # 实体、值对象、领域规则
      protocols/                 # 支付领域接口（Repo、Hasher 等）
      services/                  # 应用服务（RegisterUser 等用例）
      infra/                     # 支付领域基础设施实现（DB、第三方）

  app/
    api/                         # Next.js API 路由（对外适配层）
      users/
        route.ts
      orders/
        route.ts
      payments/
        route.ts
```

## 分层职责

- `app/api/*/route.ts` 只负责 HTTP 协议适配（解析请求/返回响应）
- `server/<domain>/services` 负责应用服务与用例编排
- `server/<domain>/protocols` 定义领域接口（Repository、外部服务等）
- `server/<domain>/infra` 实现接口（数据库、第三方服务）
- `server/shared` 放跨领域的基础设施与协议（DB/LLM/Langfuse 等）

## 使用原则

- 领域层不依赖基础设施实现，只依赖接口
- API 层不直接访问数据库
- 通过依赖注入将 infra 实现交给 services 使用

