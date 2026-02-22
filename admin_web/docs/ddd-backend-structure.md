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

## MQTT 通讯协议（平台-智能体-语音端）

本节定义“平台 ↔ 智能体 / 语音端”的对外通讯协议。后端服务内部仍采用内存事件总线驱动领域事件；跨进程/跨设备通讯统一使用 MQTT。

### 角色

- 平台（Platform）：路由与编排中心，负责鉴权授权、幂等、重试、审计、观测
- 智能体（Agent）：订阅命令、上报事件与状态
- 语音端（Voice）：上报会话与意图、接收中文反馈展示

### Topic 命名规范

统一以版本与租户开头，便于授权与演进：

- 平台 → 智能体（命令）：`v1/t/{tenantId}/agent/{agentId}/cmd`
- 智能体 → 平台（命令回执）：`v1/t/{tenantId}/platform/cmd/ack`
- 智能体 → 平台（命令结果）：`v1/t/{tenantId}/platform/cmd/result`
- 智能体 → 平台（业务事件）：`v1/t/{tenantId}/platform/event`
- 智能体状态（建议 retained）：`v1/t/{tenantId}/agent/{agentId}/state`
- 智能体在线（建议 retained，含 LWT）：`v1/t/{tenantId}/agent/{agentId}/presence`
- 语音端 → 平台（输入）：`v1/t/{tenantId}/platform/voice/in`
- 平台 → 语音端（输出）：`v1/t/{tenantId}/voice/{voiceId}/out`

约定：

- 命令 topic 不使用 retained
- state/presence 建议使用 retained，订阅者可立即获得最新状态

### 消息信封（Envelope）

所有 topic 的 payload 统一使用 JSON 信封，便于网关通用处理、审计与追踪：

```json
{
  "ver": "1.0",
  "id": "msg_01H...",
  "ts": 1730000000000,
  "trace_id": "tr_01H...",
  "tenant_id": "t_001",
  "sender": { "type": "platform|agent|voice", "id": "..." },
  "type": "command.request|command.ack|command.result|event.publish|query.request|query.result|error",
  "reply_to": "msg_01H...",
  "idempotency_key": "cmd_01H...",
  "payload": {}
}
```

字段说明：

- `id`：消息唯一标识
- `trace_id`：端到端追踪标识
- `reply_to`：响应/回执对应的请求消息 id
- `idempotency_key`：用于“至少一次投递”下的幂等去重（命令必须携带）

### 语义分层（DDD 友好）

- `command.*`：要求执行的指令（平台 → 智能体为主）
- `event.publish`：事实已发生的事件（智能体 → 平台为主）
- `query.*`：只读查询（任意方向）
- `error`：统一错误响应（中文 message）

### 命令载荷示例

平台下发命令（发布到 `.../cmd`）：

```json
{
  "ver": "1.0",
  "id": "msg_01H...",
  "ts": 1730000000000,
  "trace_id": "tr_01H...",
  "tenant_id": "t_001",
  "sender": { "type": "platform", "id": "platform" },
  "type": "command.request",
  "idempotency_key": "cmd_01H...",
  "payload": {
    "name": "smart_home.control",
    "action": "turn_on",
    "params": { "device_id": "lamp_7" },
    "timeout_ms": 15000
  }
}
```

智能体回执（发布到 `.../platform/cmd/ack`）：

```json
{
  "ver": "1.0",
  "id": "msg_01H...",
  "ts": 1730000000000,
  "trace_id": "tr_01H...",
  "tenant_id": "t_001",
  "sender": { "type": "agent", "id": "agent_001" },
  "type": "command.ack",
  "reply_to": "msg_01H...",
  "payload": { "status": "accepted" }
}
```

智能体结果（发布到 `.../platform/cmd/result`，对用户可见内容用中文）：

```json
{
  "ver": "1.0",
  "id": "msg_01H...",
  "ts": 1730000000000,
  "trace_id": "tr_01H...",
  "tenant_id": "t_001",
  "sender": { "type": "agent", "id": "agent_001" },
  "type": "command.result",
  "reply_to": "msg_01H...",
  "payload": {
    "status": "succeeded",
    "output": { "device_id": "lamp_7", "state": "on" },
    "user_message": "已为你打开客厅灯。"
  }
}
```

### 事件载荷示例

智能体上报事件（发布到 `.../platform/event`）：

```json
{
  "ver": "1.0",
  "id": "msg_01H...",
  "ts": 1730000000000,
  "trace_id": "tr_01H...",
  "tenant_id": "t_001",
  "sender": { "type": "agent", "id": "agent_001" },
  "type": "event.publish",
  "payload": {
    "event_name": "agent.task.completed",
    "data": { "task_id": "task_123", "result": "..." }
  }
}
```

### 可靠性约定（QoS / 幂等 / 保序）

- QoS 建议：
  - 命令/回执/结果：QoS 1（至少一次）
  - state/presence：QoS 1 + retained
- 幂等：
  - 平台下发命令必须携带 `idempotency_key`
  - 智能体按 `idempotency_key` 去重，重复投递需返回一致的处理结果
- 保序：
  - 若某类事件需要严格保序，可按聚合/实体维度拆分 topic，例如 `.../agg/{aggregateId}/events`

### 在线与状态（Retained + LWT）

- 智能体上线时发布 `presence: online=true`（retained）
- 智能体设置遗嘱消息（LWT）到同一 presence topic，异常断线时 broker 自动发布 `online=false`（retained）

presence 示例：

```json
{ "online": true, "ts": 1730000000000 }
```

### 安全约定

- Broker 强制 TLS
- 身份认证：JWT 或 mTLS（二选一，智能体/设备优先 mTLS）
- 授权：按 `tenantId` 与 `agentId/voiceId` 做 topic ACL，禁止跨租户与越权发布/订阅

### 客户端 Key 换 MQTT 短期凭证（推荐）

系统以客户端 key 确定客户端归属时，推荐将 key 作为“长期设备身份凭据”，用于向平台换取短期 MQTT 连接凭证（JWT）。不要直接把客户端 key 当作 MQTT 的长期密码使用。

流程：

1. 客户端启动后，通过 HTTPS 调用平台接口换取 MQTT token（携带客户端 key）
2. 平台校验 key 与归属关系，生成短期 JWT，并返回连接信息与过期时间
3. 客户端使用 JWT 连接 EMQX（8883）
4. 客户端在 JWT 过期前自动刷新并重连或续连（按客户端库能力实现）

平台接口建议：

- `POST /api/mqtt/credentials`

请求示例：

```json
{
  "client_key": "ck_***",
  "client_id": "agent_001"
}
```

响应示例：

```json
{
  "mqtt": {
    "host": "your-broker-host",
    "port": 8883,
    "protocol": "mqtts"
  },
  "credentials": {
    "username": "agent_001",
    "token": "jwt_***",
    "expires_in_seconds": 3600
  },
  "policy": {
    "tenant_id": "t_001",
    "publish": [
      "v1/t/t_001/platform/event",
      "v1/t/t_001/agent/agent_001/state",
      "v1/t/t_001/agent/agent_001/presence"
    ],
    "subscribe": [
      "v1/t/t_001/agent/agent_001/cmd"
    ]
  }
}
```

JWT 建议携带的核心声明：

- `tenant_id`：租户归属
- `client_id`：客户端标识（如 agentId/voiceId）
- `scopes`：允许的 topic 范围（发布/订阅）
- `exp`：过期时间（建议 15 分钟到 1 小时）

好处：

- 客户端环境变量只需要保存 broker 地址与 client_key（或更进一步只保存用于换取 token 的注册信息），MQTT token 为短期票据
- 平台可随时吊销/封禁某个 client_key，或动态收缩其 topic 权限

