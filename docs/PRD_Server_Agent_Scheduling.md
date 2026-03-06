# 服务端调度 Agent 系统 PRD

> **版本**: v0.6  
> **日期**: 2026-03-03  
> **状态**: 草稿（已根据评审决策更新）

---

## 1. 背景与目标

### 1.1 现状

当前系统已具备以下基础能力：

| 模块 | 现状 |
|------|------|
| **多租户体系** | `tenants / users / tenant_users` 表，RBAC 鉴权 |
| **Client 接入** | `clients` 表支持不同类型客户端注册，MQTT 心跳维持在线状态 |
| **Agent 会话与任务** | `agent_sessions / agent_tasks / agent_task_runs / agent_task_events` 实现基本任务树与执行记录 |
| **MQTT 通信** | MQTT Broker 作为消息中枢；服务端订阅 `client/+/status`，命令下发走 `client/{clientId}/command` |
| **MCP 工具** | Skills / MCPs 可在租户级配置并绑定给 Client |

### 1.2 问题与机会

- **缺乏服务端 Agent 调度层**：Agent 编排逻辑分散在客户端，服务端只做任务存储，无法统一定义和运行 Agent。
- **Agent 之间关系平铺**：没有父子包含（树形嵌套）关系，无法实现复杂多级编排。
- **缺少人机协同机制**：Agent 遇到不确定情况时没有标准化的"暂停 → 请求真人确认 → 恢复"流程。
- **信息流通不透明**：Agent 间消息传递缺乏统一 MQTT Topic 规范，难以监控和回放。

### 1.3 目标

1. **在后台可视化配置 Agent**：每个 Agent 有自己的角色定义（System Prompt）、可用工具、归属的 Client 执行节点，并可绑定一名真人负责人。
2. **树形 Agent 层级**：支持父子 Agent 嵌套，实现复杂业务的多级编排（父 Agent 拆解任务，子 Agent 专项执行）。
3. **以 MQTT 为统一信息流**：所有 Agent 间通信、任务下发、状态上报、人机协同消息，均通过规范化的 MQTT Topic 流转。
4. **人机协同（Human-in-the-Loop）**：Agent 遇到置信度低或需要授权的场景时，自动暂停任务，向绑定真人推送确认请求；真人做出决策后，Agent 恢复执行。

---

## 2. 核心概念

```
Tenant（租户）
└── Agent（服务端配置的 Agent）
    ├── parent_agent_id → 父 Agent（可选；无父则为顶级 Orchestrator）
    ├── assigned_client_id → 绑定的执行 Client（可选；纯云端推理 Agent 可不绑定）
    ├── bound_user_id → 绑定的真人负责人（可选）
    ├── system_prompt → 角色/能力定义
    ├── tool_ids[] → 可用 MCP 工具列表
    └── children: Agent[]（子 Agent）
```

**核心角色说明**：

| 角色 | 说明 |
|------|------|
| **Orchestrator Agent** | 顶级调度 Agent，接收用户指令，拆解任务，向子 Agent 下发子任务 |
| **Specialist Agent** | 专项 Agent（如微信运营、爬取、报表），实际执行具体任务 |
| **Shadow Agent（云端）** | 不绑定 Client，纯服务端运行（如数据分析、知识检索） |
| **真人负责人（Operator）** | 绑定在 Agent 上的 `tenant_users` 成员，负责人机协同决策 |

---

## 3. 功能需求

### 3.1 Agent 配置管理（后台）

**F-01: Agent CRUD**

管理员可在 Web 控制台的 `/dashboard/workspaces/agents` 页面中：

- **创建 Agent**：填写名称、描述、选择父 Agent（不选则为顶级）、选择执行 Client（可选）、绑定真人（可选）、编写 System Prompt、选择可用 MCP 工具列表。
- **编辑 Agent**：修改以上所有配置。
- **启用/禁用 Agent**：`status` 字段控制，禁用后 Orchestrator 不再向其分派任务。
- **删除 Agent**：软删除（`archived`），已有历史记录不清除。

**F-02: 树形可视化展示**

- Agent 列表以**树形**展示父子关系，可折叠展开。
- 展示每个 Agent 当前运行状态：`idle` / `running` / `waiting_human` / `offline`（绑定 Client 离线）。

**F-03: Agent 绑定真人**

- 每个 Agent 最多绑定 **1 名真人负责人**（`bound_user_id`）。
- 绑定真人在 Agent 发出"需要确认"请求时收到通知（Web 实时推送 + 可选外部通知）。
- 管理员可随时修改绑定关系。

**F-00: API 工具配置与 Agent 绑定**

> 让 Agent 可以像调用 MCP 工具一样，调用任意外部 HTTP API；同时也支持外部系统通过标准化接口触发 Agent 执行。

#### F-00a：后台配置 API 工具库

管理员在 `/dashboard/workspaces/api-tools` 管理 **API 工具**（Scope：全局 / 租户级）：

| 配置项 | 说明 |
|--------|------|
| 名称 / 描述 | 供 LLM Tool Schema 使用，description 注入 System Prompt |
| Scope | `global`（Saas 管理员维护，所有租户可用）/ `tenant`（租户私有） |
| Method | GET / POST / PUT / DELETE / PATCH |
| URL 模板 | 支持路径占位符，如 `https://his.hospital.com/api/patients/{patientId}` |
| Headers | JSON，支持 `{{ env.HIS_API_KEY }}` 引用密钥变量 |
| Body 模板 | JSON 模板，LLM 自动填充 `{{ patientId }}`、`{{ diagnosis }}` 等变量 |
| 参数定义 | `[{ name, type, description, required, in: "body"|"path"|"query" }]` |
| 认证方式 | `none` / `api_key`（Header 或 Query）/ `bearer` / `basic` |
| 认证配置 | 加密存储，前端只展示 `****`，运行时注入 |
| 超时 | 默认 10000 ms |
| 重试次数 | 默认 2 次，失败后触发 `task/failed` MQTT 通知 |
| 响应映射 | JSONPath 提取 LLM 需要的字段（如 `$.data.appointmentId`） |

#### F-00b：将 API 工具绑定给特定 Agent

在 Agent 配置表单的"工具清单"区域，支持 **MCP 工具** 与 **API 工具** 混合绑定：

```
工具来源 (type):
  ├── mcp   → 已配置的 MCP / Skill ID
  └── api   → 已配置的 API 工具 ID（agent_api_tools.id）
```

- Agent 可以绑定任意数量 API 工具；
- Agent Runner 在生成 LLM Tools Schema 时，自动将 API 工具转化为标准函数描述；
- LLM 决策调用某 API 时，Runner 实际发起 HTTP 请求，返回结果注入上下文；
- API 调用明细写入 `agent_task_events`（含请求/响应摘要，脱敏 auth 信息）。

#### F-00c：外部系统通过 API 触发 Agent（标准调度入口）

每个 Agent（含 Orchestrator 和各子 Agent）对外提供标准化 HTTP 触发接口：

```
POST /api/agents/{agentId}/trigger
Authorization: Bearer <api-trigger-key>
```

请求体：
```json
{
  "sessionId": "可选，继续已有会话",
  "input": "帮患者张三预约内科今天下午的号",
  "context": { "patientId": "P12345", "wardId": "W02" },
  "callbackUrl": "可选，任务完成后 Webhook 回调 URL"
}
```

响应（**异步模式，立即返回**）：
```json
{
  "taskId": "01959b2f-xxxx",
  "sessionId": "01959b1f-xxxx",
  "status": "accepted",
  "trackUrl": "/api/tasks/01959b2f-xxxx/status"
}
```

两种入口区别：

| 入口 | Path | 说明 |
|------|------|------|
| **全局触发** | `POST /api/agents/trigger` | 不指定 Agent，由 Orchestrator 路由分配 |
| **单 Agent 触发** | `POST /api/agents/:id/trigger` | 跳过 Orchestrator，直接启动指定 Agent |

Callback Webhook payload（任务完成/失败时推送外部系统）：
```json
{
  "taskId": "01959b2f-xxxx",
  "agentId": "agent-uuid",
  "status": "succeeded",
  "result": {
    "summary": "已为张三成功预约内科2026-03-03 14:30号源，预约号 A0056",
    "data": { "appointmentId": "A0056", "time": "2026-03-03T14:30:00+08:00" }
  },
  "completedAt": "2026-03-03T15:35:00+08:00"
}
```

API Trigger Key 由后台管理页面生成，明文仅展示一次，后续仅显示前缀（如 `atk_A1B2****`）。

---

### 3.2 MQTT 信息流规范

#### 3.2.1 Topic 命名规则

```
{scope}/{tenantId}/{entityType}/{entityId}/{action}
```

#### 3.2.2 核心 Topic 列表

| Topic 模式 | 方向 | 说明 |
|---|---|---|
| `agent/{tenantId}/{agentId}/task/assign` | 服务端 → Agent/Client | Orchestrator 向子 Agent 分派子任务 |
| `agent/{tenantId}/{agentId}/task/result` | Agent/Client → 服务端 | 子 Agent 上报任务执行结果 |
| `agent/{tenantId}/{agentId}/task/cancel` | 服务端 → Agent/Client | 取消任务 |
| `agent/{tenantId}/{agentId}/status` | Agent/Client → 服务端 | Agent 心跳与状态上报 |
| `agent/{tenantId}/{agentId}/log` | Agent/Client → 服务端 | 执行日志流（监控用） |
| `agent/{tenantId}/{agentId}/task/failed` | Agent/Client → 服务端 | Agent 执行失败通知（由真人决策后续） |
| `agent/{tenantId}/{agentId}/human/request` | 服务端 → 真人 Web | Agent 暂停，推送人机协同确认请求 |
| `agent/{tenantId}/{agentId}/human/response` | 真人 Web → 服务端 | 真人做出确认/拒绝/修改决策 |
| `agent/{tenantId}/orchestrator/command` | 用户/系统 → Orchestrator | 向顶级 Orchestrator 下发新任务指令 |
| `agent/{tenantId}/{userId}/notify` | 服务端 → 特定真人 | 向指定真人推送通知 |
| `agent/{tenantId}/broadcast/notify` | 服务端 → 所有订阅方 | 全租户广播（如紧急停止所有 Agent） |
| `client/{clientId}/status` *(已有)* | Client → 服务端 | Client 心跳/上下线（保持不变） |
| `client/{clientId}/command` *(已有)* | 服务端 → Client | 命令下发（保持不变） |

#### 3.2.3 消息体格式（统一 JSON Envelope）

```json
{
  "msgId": "uuid-v7",
  "type": "task.assign | task.result | human.request | human.response | ...",
  "tenantId": "uuid",
  "agentId": "uuid",
  "sessionId": "uuid",
  "taskId": "uuid",
  "ts": 1740960000000,
  "payload": {},
  "meta": {}
}
```

---

### 3.3 Agent 调度流程

#### 3.3.1 正常执行流程

```
用户指令
  │ Pub: agent/{tenantId}/orchestrator/command
  ▼
[Orchestrator Agent（服务端进程）]
  │ 调用 LLM 拆解任务: task A → [subtask-1, subtask-2]
  │ Pub: agent/{tenantId}/{childAgentId-1}/task/assign
  │ Pub: agent/{tenantId}/{childAgentId-2}/task/assign
  ▼
[子 Agent / 绑定 Client]
  │ Sub: agent/{tenantId}/{agentId}/task/assign
  │ 执行任务...
  │ Pub: agent/{tenantId}/{agentId}/task/result
  ▼
[Orchestrator Agent]
  │ Sub: agent/{tenantId}/+/task/result
  │ 汇总结果，判断是否完成
  ▼
写入 agent_task_events（审计/回放）
写入 agent_tasks（状态更新）
```

#### 3.3.2 人机协同流程（Agent 不确定时）

```
[子 Agent]
  │ 遇到低置信度场景，无法自主决策
  │ 任务状态 → lifecycle=blocked
  │ Pub: agent/{tenantId}/{agentId}/human/request
  │   payload: { question, context, options[], taskId, runId, expiresAt }
  ▼
[服务端 MQTT 消费者]
  │ Sub: agent/{tenantId}/+/human/request
  │ 写入 agent_human_requests 表
  │ 向绑定真人推送 Web 实时通知
  ▼
[真人负责人（Web 控制台）]
  │ 查看确认弹窗或通知面板
  │ 选择: 确认 / 拒绝 / 修改参数
  │ POST /api/human-requests/{requestId}/respond
  ▼
[服务端 API]
  │ 写入 agent_human_requests.decision & response_data
  │ Pub: agent/{tenantId}/{agentId}/human/response
  │   payload: { decision: 'approve|reject|modify', data }
  ▼
[子 Agent]
  │ Sub: agent/{tenantId}/{agentId}/human/response
  │ 根据决策恢复执行或终止任务
```

---

### 3.4 服务端 Agent 进程设计

**F-04: Agent Runner（纯 MQTT 事件驱动）**

Agent Runner **无需独立微服务或消息队列（BullMQ 等）**，完全基于 MQTT 实现事件驱动，运行在 Next.js 后端的**持久 MQTT 订阅进程**中。

#### 架构设计

```
服务端启动时
  │
  ▼
[Agent Runner 进程（Next.js 后台常驻）]
  │ 读取数据库：查询当前租户所有 status=active 的 Agent
  │
  ├─ 为每个 Agent 在 MQTT Broker 上建立订阅：
  │   ├── Sub: agent/{tenantId}/{agentId}/task/assign
  │   └── Sub: agent/{tenantId}/{agentId}/human/response
  │
  └─ 消息到达时（事件触发）：
      ├── 收到 task/assign  → 调用 LLM 推理 → 调用 MCP 工具 → Pub task/result 或 task/failed
      └── 收到 human/response → 根据决策继续/终止任务
```

#### 核心职责

1. **订阅**自己的 MQTT Topic（任务分派、人机响应），事件到达时触发处理逻辑。
2. **调用 LLM** 进行推理（使用 `llm_provider_configs` 中租户配置的模型）。
3. **调用 MCP 工具**（绑定的 skills/MCPs）。
4. **向子 Agent 发布**任务分派消息（`task/assign`）。
5. **上报结果**（`task/result`）或失败通知（`task/failed`）。
6. **Agent 配置变更时动态更新订阅**：新建/删除 Agent 后，Runner 动态增删对应 MQTT 订阅，无需重启进程。

#### 与现有 MQTT 消费者的关系

| 现有消费者（已实现） | 新增 Agent Runner |
|-------------------|-----------------|
| 订阅 `client/+/status`，维护 Client 在线状态 | 订阅 `agent/{tenantId}/+/task/assign` 等，驱动 Agent 执行 |
| 写入 `clients.run_status` / `last_seen_at` | 写入 `agent_tasks` / `agent_task_runs` / `agent_task_events` |

两者均运行在服务端同一 MQTT 连接进程中，共享 Broker 连接，通过 Topic 前缀区分职责。

**F-05: Agent 生命周期状态机**

```
         ┌─────────┐
         │  idle   │◄──────────────────────────────┐
         └────┬────┘                               │
              │ 收到 task.assign                    │ 任务完成/失败
              ▼                                    │
         ┌─────────┐    LLM 置信低/需授权    ┌──────┴──────┐
         │ running │──────────────────────►│waiting_human│
         └────┬────┘                      └──────┬──────┘
              │                                  │ 收到 human.response(approve)
              │ 错误/超时                         │
              ▼                                  ▼
         ┌─────────┐                       恢复执行
         │  error  │◄── decision=reject
         └─────────┘
```

---

### 3.5 人机协同通知

**F-06: 实时通知推送**

当 Agent 发出 `human.request` 时，系统通知绑定真人：

- **Web 控制台内**：顶部导航栏铃铛图标显示红点，打开后展示「等待确认」列表。
- **可选外部通知**：Webhook 推送（企业微信、钉钉、邮件）。

**F-07: 确认超时处理**

- `agent_human_requests` 记录 `expires_at`，超时时间在 Agent 配置中设置（`timeout_minutes`，默认 30 分钟）。
- **超时后统一视为任务失败**：无论任何场景，只要责任真人在限时内未响应，系统自动将关联任务标记为 `failed`，并通过 MQTT 发布失败事件通知相关方。
- 失败后真人可在管理面板查看历史记录，并手动重新下发任务。

**F-08: Agent 失败通知（MQTT 驱动）**

- Agent 执行失败时，**不自动重新分派**，而是通过 MQTT 发布失败通知。
- 失败消息发布到：`agent/{tenantId}/{agentId}/task/failed`
- 消息 payload 包含：`{ taskId, runId, errorMessage, failedAt }`
- 服务端消费该 Topic，将状态写入 `agent_task_runs.error` + `agent_task_events`，并通过 `agent/{tenantId}/{agentId}/human/request` 推送给绑定真人，由真人决定下一步（重试 / 放弃 / 修改参数后重试）。

**F-09: 总管理员全局监控视图**

- 租户内拥有 `admin` 或 `owner` 角色的成员，可在 `/dashboard/workspaces/agents/audit` 页面查看：
  - **所有 Agent** 的运行状态列表（不限于自己绑定的 Agent）。
  - **所有人机协同交互记录**：哪个 Agent 向哪个真人发了什么请求，真人如何决策。
  - **全局消息流**：订阅 `agent/{tenantId}/+/human/request` 和 `agent/{tenantId}/+/human/response`，实时展示所有人机交互消息。
  - 可以**代理响应**任何悬挂中的人机协同请求（当绑定真人长时间未响应时）。

---

### 3.6 Agent 自我优化机制（Self-Optimization）

#### 设计思路

每次真人与 Agent 的交互（确认、拒绝、修改、任务完成/失败）都是一条**隐式训练数据**。系统通过持续收集这些反馈信号，定期驱动 Agent 对自身的 **System Prompt** 和**决策规则**进行迭代优化，使 Agent 越用越聪明、越来越少需要打扰真人。

```
反馈信号来源
  ├── 人机协同请求 → 真人决策（approve/reject/modify）
  ├── 任务最终结果（succeeded/failed）
  └── 任务完成后真人对整体效果的评分（可选）
       ↓
[反馈日志 agent_feedback_logs]
       ↓
[优化触发器：达到阈值 或 定期触发]
       ↓
[优化 Agent（LLM）]
  分析反馈模式 → 生成优化建议 → 草稿新 System Prompt
       ↓
[人工审核（Admin/真人负责人）]
  审核并决定：采纳 / 修改后采纳 / 拒绝
       ↓
[写入 agent_prompt_versions，激活新版本]
```

**F-10: 反馈自动采集**

每次以下事件发生时，系统自动记录一条反馈日志到 `agent_feedback_logs`：

| 触发事件 | 反馈信号 | 含义 |
|---------|---------|------|
| 真人在人机协同中选择 **approve** | `+1 正向` | Agent 的判断与真人一致，方向正确 |
| 真人在人机协同中选择 **reject** | `−1 负向` | Agent 不应该在此处暂停，或判断方向错误 |
| 真人在人机协同中选择 **modify** | `±修正` | Agent 方向对但细节有偏差，记录修改前后的差异 |
| 任务最终 **succeeded** | `+1 正向` | 完整任务链路走通 |
| 任务最终 **failed**（超时/错误） | `−1 负向` | 记录失败阶段和错误类型 |
| 真人主动给任务效果打分（1-5星） | `评分信号` | 可选，用于任务完成后的人工评价 |

**F-11: 自动优化分析（定期触发）**

- **触发条件**：满足以下任一条件时触发优化分析：
  - 累积新反馈 ≥ `optimization_threshold`（Agent 配置，默认 20 条）。
  - 定期触发（如每周一次，由 Cron Job 驱动）。
- **优化过程**：
  1. 读取该 Agent 最近 N 条 `agent_feedback_logs`。
  2. 调用 LLM（使用租户配置的分析模型），输入：
     - 当前 System Prompt。
     - 反馈日志摘要（高频 reject 场景、modify 的修正模式、失败任务的错误分布）。
  3. LLM 输出"优化建议报告" + "建议的新 System Prompt 草稿"。
  4. 将结果写入 `agent_prompt_versions`，状态为 `draft`（待审核）。
- **通过 MQTT 通知**：优化建议生成后，发布消息到 `agent/{tenantId}/{agentId}/optimization/ready`，通知绑定真人和 Admin 前来审核。

**F-12: 人工审核优化建议**

- 管理员/真人负责人在 `/dashboard/workspaces/agents/:id/optimization` 页面看到待审核的 System Prompt 草稿。
- 界面展示：
  - **左侧**：当前生效的 System Prompt（`current` 版本）。
  - **右侧**：LLM 建议的新版本（Diff 高亮显示差异）。
  - **中间**：优化报告摘要（"过去 N 次交互中，真人在 X 类场景下频繁拒绝 Agent 的暂停请求，建议..."）。
- 操作：
  - **采纳**：直接激活新版本，原版本降级为历史版本。
  - **修改后采纳**：在草稿基础上手动微调后激活。
  - **拒绝**：记录拒绝原因，继续使用当前版本。

---

#### 反馈数据循环图

```
真人操作
  │ approve/reject/modify/rating
  ▼
agent_feedback_logs（持续累积）
  │ 达到阈值 or 定期
  ▼
[优化分析 LLM]
  │ 分析反馈模式
  │ 生成新 System Prompt 草稿
  ▼
agent_prompt_versions（status=draft）
  │ Pub: agent/{tenantId}/{agentId}/optimization/ready
  ▼
[Admin/真人 审核页面]
  │ 采纳 / 修改后采纳 / 拒绝
  ▼
agent_prompt_versions（status=active）
  │ agents.system_prompt 自动更新为最新激活版本
  ▼
Agent 下次执行时使用新 Prompt
```

---

## 4. 数据库设计

### 4.1 新增表：`agents`（迁移文件：`011_agents.sql`）

```sql
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT uuidv7(),

  tenant_id UUID NOT NULL,
  parent_agent_id UUID,                    -- 父 Agent（NULL = 顶级 Orchestrator）

  name VARCHAR(255) NOT NULL,
  description TEXT,
  avatar_url TEXT,

  system_prompt TEXT,                      -- Agent 角色定义 Prompt
  llm_config JSONB DEFAULT '{}'::jsonb,    -- { provider_id, model, temperature, max_tokens }

  assigned_client_id UUID,                -- 绑定的执行 Client（NULL = 纯云端 Agent）
  bound_user_id UUID,                     -- 绑定的真人负责人（tenant_users.user_id）

  tool_ids UUID[] DEFAULT '{}'::uuid[],   -- 可用的 MCP/Skill IDs

  status VARCHAR(20) DEFAULT 'active' NOT NULL,
  -- active / disabled / archived

  timeout_minutes INTEGER DEFAULT 30,
  -- 人机协同超时分钟数（超时后任务自动失败）

  order_no INTEGER DEFAULT 0,             -- 同级排序

  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  extra JSONB DEFAULT '{}'::jsonb,

  CONSTRAINT agents_status_check CHECK (status IN ('active', 'disabled', 'archived'))
);

CREATE INDEX idx_agents_tenant_id ON agents(tenant_id);
CREATE INDEX idx_agents_parent_agent_id ON agents(parent_agent_id);
CREATE INDEX idx_agents_tenant_status ON agents(tenant_id, status);
CREATE INDEX idx_agents_assigned_client_id ON agents(assigned_client_id);
CREATE INDEX idx_agents_bound_user_id ON agents(bound_user_id);
CREATE INDEX idx_agents_tool_ids ON agents USING GIN (tool_ids);

CREATE TRIGGER update_agents_updated_at
BEFORE UPDATE ON agents
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE agents IS '服务端 Agent 配置表（树形层级，可绑定真人和 Client）';
COMMENT ON COLUMN agents.parent_agent_id IS '父 Agent ID（NULL 表示顶级 Orchestrator）';
COMMENT ON COLUMN agents.assigned_client_id IS '绑定的执行 Client（NULL 表示纯云端 Agent）';
COMMENT ON COLUMN agents.bound_user_id IS '绑定的真人负责人（用于人机协同通知）';
COMMENT ON COLUMN agents.timeout_minutes IS '人机协同超时分钟数（超时后任务自动失败）';
```

### 4.2 新增表：`agent_human_requests`（迁移文件：`012_agent_human_requests.sql`）

```sql
CREATE TABLE agent_human_requests (
  id UUID PRIMARY KEY DEFAULT uuidv7(),

  tenant_id UUID NOT NULL,
  agent_id UUID NOT NULL,
  session_id UUID NOT NULL,
  task_id UUID NOT NULL,
  run_id UUID,

  -- 请求内容
  question TEXT NOT NULL,
  context JSONB DEFAULT '{}'::jsonb,       -- 上下文（当前执行摘要）
  options JSONB DEFAULT '[]'::jsonb,       -- 可选选项 [{label, value}]

  assigned_user_id UUID NOT NULL,          -- 需要响应的真人 user_id

  status VARCHAR(20) DEFAULT 'pending' NOT NULL,
  -- pending / responded / timeout / canceled

  expires_at TIMESTAMP WITH TIME ZONE,

  -- 真人响应
  decision VARCHAR(20),                    -- approve / reject / modify
  response_data JSONB DEFAULT '{}'::jsonb,
  responded_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  extra JSONB DEFAULT '{}'::jsonb,

  CONSTRAINT agent_human_requests_status_check CHECK (
    status IN ('pending', 'responded', 'timeout', 'canceled')
  ),
  CONSTRAINT agent_human_requests_decision_check CHECK (
    decision IS NULL OR decision IN ('approve', 'reject', 'modify')
  )
);

CREATE INDEX idx_agent_human_requests_tenant_id ON agent_human_requests(tenant_id);
CREATE INDEX idx_agent_human_requests_agent_id ON agent_human_requests(agent_id);
CREATE INDEX idx_agent_human_requests_task_id ON agent_human_requests(task_id);
CREATE INDEX idx_agent_human_requests_assigned_user_id ON agent_human_requests(assigned_user_id);
CREATE INDEX idx_agent_human_requests_status ON agent_human_requests(status);
CREATE INDEX idx_agent_human_requests_expires_at ON agent_human_requests(expires_at);

CREATE TRIGGER update_agent_human_requests_updated_at
BEFORE UPDATE ON agent_human_requests
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE agent_human_requests IS 'Agent 人机协同请求表';
COMMENT ON COLUMN agent_human_requests.question IS 'Agent 向真人提出的问题描述';
COMMENT ON COLUMN agent_human_requests.options IS '可选选项数组（空则为自由文本决策）';
COMMENT ON COLUMN agent_human_requests.decision IS '真人决策（approve/reject/modify）';
COMMENT ON COLUMN agent_human_requests.response_data IS '真人补充数据（modify 时的修改参数）';
```

### 4.3 `agent_tasks` 表扩展（迁移文件：`013_agent_tasks_extend.sql`）

```sql
ALTER TABLE agent_tasks
  ADD COLUMN agent_id UUID,             -- 负责执行此任务的服务端 Agent ID
  ADD COLUMN human_request_id UUID;     -- 关联的人机协同请求 ID（lifecycle=blocked 时写入）

CREATE INDEX idx_agent_tasks_agent_id ON agent_tasks(agent_id);

COMMENT ON COLUMN agent_tasks.agent_id IS '负责执行该任务的服务端 Agent ID';
COMMENT ON COLUMN agent_tasks.human_request_id IS '任务 blocked 时关联的人机协同请求 ID';
```

### 4.4 新增表：`agent_feedback_logs`（迁移文件：`014_agent_feedback.sql`）

```sql
CREATE TABLE agent_feedback_logs (
  id UUID PRIMARY KEY DEFAULT uuidv7(),

  tenant_id UUID NOT NULL,
  agent_id UUID NOT NULL,
  session_id UUID NOT NULL,
  task_id UUID NOT NULL,
  run_id UUID,
  human_request_id UUID,            -- 关联的人机协同请求（可为空）

  signal_type VARCHAR(30) NOT NULL,
  -- human_approve / human_reject / human_modify
  -- task_succeeded / task_failed
  -- user_rating

  signal_value NUMERIC(3,1),        -- 量化分值：+1 / −1 / 1-5（评分）

  before_data JSONB DEFAULT '{}'::jsonb,  -- 修改前的内容（modify 时记录）
  after_data JSONB DEFAULT '{}'::jsonb,   -- 修改后的内容（modify 时记录）
  context JSONB DEFAULT '{}'::jsonb,      -- 任务上下文快照（当前步骤、错误信息等）

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  extra JSONB DEFAULT '{}'::jsonb,

  CONSTRAINT agent_feedback_logs_signal_type_check CHECK (
    signal_type IN (
      'human_approve', 'human_reject', 'human_modify',
      'task_succeeded', 'task_failed', 'user_rating'
    )
  )
);

CREATE INDEX idx_agent_feedback_logs_agent_id ON agent_feedback_logs(agent_id);
CREATE INDEX idx_agent_feedback_logs_task_id ON agent_feedback_logs(task_id);
CREATE INDEX idx_agent_feedback_logs_tenant_agent_created ON agent_feedback_logs(tenant_id, agent_id, created_at DESC);
CREATE INDEX idx_agent_feedback_logs_signal_type ON agent_feedback_logs(agent_id, signal_type);

COMMENT ON TABLE agent_feedback_logs IS 'Agent 反馈日志表（用于自我优化训练数据积累）';
COMMENT ON COLUMN agent_feedback_logs.signal_type IS '反馈信号类型';
COMMENT ON COLUMN agent_feedback_logs.signal_value IS '量化分值（approve=+1, reject=-1, rating=1-5）';
COMMENT ON COLUMN agent_feedback_logs.before_data IS 'modify 类型时记录修改前的方案';
COMMENT ON COLUMN agent_feedback_logs.after_data IS 'modify 类型时记录真人修改后的方案';
```

### 4.5 新增表：`agent_prompt_versions`（迁移文件：`014_agent_feedback.sql` 续）

```sql
CREATE TABLE agent_prompt_versions (
  id UUID PRIMARY KEY DEFAULT uuidv7(),

  tenant_id UUID NOT NULL,
  agent_id UUID NOT NULL,

  version_no INTEGER NOT NULL,       -- 版本号（自增，应用层维护）
  system_prompt TEXT NOT NULL,       -- 该版本的 System Prompt 内容

  status VARCHAR(20) DEFAULT 'draft' NOT NULL,
  -- draft（待审核）/ active（当前生效）/ retired（已停用）/ rejected（被拒绝）

  -- 优化报告
  optimization_report TEXT,          -- LLM 生成的优化分析报告
  feedback_count INTEGER DEFAULT 0,  -- 本次优化分析时采用的反馈条数
  feedback_from_at TIMESTAMP WITH TIME ZONE,  -- 反馈数据起始时间
  feedback_to_at TIMESTAMP WITH TIME ZONE,    -- 反馈数据结束时间

  -- 审核信息
  reviewed_by UUID,                  -- 审核人 user_id
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_note TEXT,                  -- 审核备注（拒绝原因 / 修改说明）

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  extra JSONB DEFAULT '{}'::jsonb,

  CONSTRAINT agent_prompt_versions_status_check CHECK (
    status IN ('draft', 'active', 'retired', 'rejected')
  ),
  CONSTRAINT agent_prompt_versions_unique UNIQUE (agent_id, version_no)
);

CREATE INDEX idx_agent_prompt_versions_agent_id ON agent_prompt_versions(agent_id);
CREATE INDEX idx_agent_prompt_versions_agent_status ON agent_prompt_versions(agent_id, status);
CREATE INDEX idx_agent_prompt_versions_created_at ON agent_prompt_versions(created_at);

CREATE TRIGGER update_agent_prompt_versions_updated_at
BEFORE UPDATE ON agent_prompt_versions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE agent_prompt_versions IS 'Agent System Prompt 版本管理表（优化建议草稿→审核→激活）';
COMMENT ON COLUMN agent_prompt_versions.version_no IS '版本号（从 1 递增）';
COMMENT ON COLUMN agent_prompt_versions.status IS '版本状态：draft=待审核 / active=当前生效 / retired=已停用 / rejected=被拒绝';
COMMENT ON COLUMN agent_prompt_versions.optimization_report IS 'LLM 优化分析报告（说明为何做此修改）';
COMMENT ON COLUMN agent_prompt_versions.feedback_count IS '本次分析采用的反馈日志条数';
```

### 4.6 `agents` 表扩展（新增优化相关字段）

```sql
ALTER TABLE agents
  ADD COLUMN optimization_threshold INTEGER DEFAULT 20,
  -- 累积多少条反馈后触发自动优化分析
  ADD COLUMN current_prompt_version_id UUID;
  -- 当前激活的 Prompt 版本 ID（对应 agent_prompt_versions.id）

COMMENT ON COLUMN agents.optimization_threshold IS '触发自动优化的反馈累积阈值（默认20条）';
COMMENT ON COLUMN agents.current_prompt_version_id IS '当前生效的 System Prompt 版本 ID';
```

### 4.7 新增表：`agent_api_tools`（迁移文件：`015_agent_api_tools.sql`）

> 存储后台配置的外部 HTTP API 工具，可全局共享或租户私有，供 Agent 像 MCP 工具一样调用。

```sql
CREATE TABLE agent_api_tools (
  id UUID PRIMARY KEY DEFAULT uuidv7(),

  tenant_id UUID,                           -- NULL = 全局工具（SaaS 管理员维护，所有租户可用）
  name VARCHAR(100) NOT NULL,               -- 工具标识名（英文，用于 LLM Function 定义）
  display_name VARCHAR(200),                -- 前台展示名
  description TEXT NOT NULL,               -- 工具描述（注入 LLM Tool Schema）
  scope VARCHAR(10) DEFAULT 'tenant' NOT NULL, -- global / tenant

  -- HTTP 请求配置
  method VARCHAR(10) DEFAULT 'POST' NOT NULL,  -- GET / POST / PUT / DELETE / PATCH
  url_template TEXT NOT NULL,               -- URL 模板，支持 {变量} 路径占位符
  headers_template JSONB DEFAULT '{}'::jsonb,  -- 请求头模板（支持 {{ env.KEY }} 引用）
  body_template JSONB DEFAULT '{}'::jsonb,     -- 请求体模板（支持 {{ param }} 变量）
  query_template JSONB DEFAULT '{}'::jsonb,    -- Query String 模板

  -- LLM 参数定义（用于生成 Tool Schema）
  parameters JSONB DEFAULT '[]'::jsonb,
  -- [{ "name", "type", "description", "required", "in": "body|path|query" }]

  -- 认证配置
  auth_type VARCHAR(20) DEFAULT 'none' NOT NULL, -- none / api_key / bearer / basic
  auth_config JSONB DEFAULT '{}'::jsonb,          -- 加密存储认证信息

  -- 行为配置
  timeout_ms INTEGER DEFAULT 10000,
  retry_count INTEGER DEFAULT 2,

  -- 响应处理
  response_mapping JSONB DEFAULT '{}'::jsonb,
  -- { "outputField": "$.data.id" }  JSONPath 提取结果字段映射

  status VARCHAR(20) DEFAULT 'active' NOT NULL,  -- active / disabled

  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  extra JSONB DEFAULT '{}'::jsonb,

  CONSTRAINT agent_api_tools_scope_check CHECK (scope IN ('global', 'tenant')),
  CONSTRAINT agent_api_tools_method_check CHECK (method IN ('GET','POST','PUT','DELETE','PATCH')),
  CONSTRAINT agent_api_tools_auth_type_check CHECK (auth_type IN ('none','api_key','bearer','basic')),
  CONSTRAINT agent_api_tools_status_check CHECK (status IN ('active', 'disabled'))
);

CREATE INDEX idx_agent_api_tools_tenant_id ON agent_api_tools(tenant_id);
CREATE INDEX idx_agent_api_tools_scope ON agent_api_tools(scope);
CREATE INDEX idx_agent_api_tools_status ON agent_api_tools(status);

CREATE TRIGGER update_agent_api_tools_updated_at
BEFORE UPDATE ON agent_api_tools
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE agent_api_tools IS '后台配置的外部 HTTP API 工具表（可全局共享或租户私有，绑定给 Agent 使用）';
COMMENT ON COLUMN agent_api_tools.url_template IS 'URL 模板，支持 {变量} 路径占位符';
COMMENT ON COLUMN agent_api_tools.parameters IS 'LLM 调用时填充的参数定义列表';
COMMENT ON COLUMN agent_api_tools.auth_config IS '认证配置（加密存储，前端脱敏显示）';
COMMENT ON COLUMN agent_api_tools.response_mapping IS 'JSONPath 响应字段提取映射';
```

### 4.8 `agents` 表扩展（新增 API 工具绑定字段）

```sql
ALTER TABLE agents
  ADD COLUMN api_tool_ids UUID[] DEFAULT '{}'::uuid[];

CREATE INDEX idx_agents_api_tool_ids ON agents USING GIN (api_tool_ids);

COMMENT ON COLUMN agents.api_tool_ids IS '绑定的 API 工具 ID 列表（对应 agent_api_tools.id）';
```

### 4.9 新增表：`agent_trigger_keys`（迁移文件：`015_agent_api_tools.sql` 续）

> 管理外部系统调用 Agent 触发接口所用的 API Key，支持全局（Orchestrator 入口）或指定 Agent。

```sql
CREATE TABLE agent_trigger_keys (
  id UUID PRIMARY KEY DEFAULT uuidv7(),

  tenant_id UUID NOT NULL,
  agent_id UUID,                           -- NULL = 全局触发（路由到顶级 Orchestrator）

  name VARCHAR(100) NOT NULL,              -- Key 描述（如"HIS系统集成Key"）
  key_hash VARCHAR(128) NOT NULL,          -- API Key SHA-256 哈希
  key_prefix VARCHAR(10) NOT NULL,         -- 前缀展示（如 "atk_A1B2"）

  scopes TEXT[] DEFAULT ARRAY['trigger'],  -- 权限域：trigger / read_status / respond_human

  expires_at TIMESTAMP WITH TIME ZONE,     -- NULL 表示永不过期
  last_used_at TIMESTAMP WITH TIME ZONE,

  status VARCHAR(20) DEFAULT 'active' NOT NULL,  -- active / revoked

  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

  CONSTRAINT agent_trigger_keys_status_check CHECK (status IN ('active', 'revoked'))
);

CREATE INDEX idx_agent_trigger_keys_tenant_id ON agent_trigger_keys(tenant_id);
CREATE INDEX idx_agent_trigger_keys_agent_id ON agent_trigger_keys(agent_id);
CREATE INDEX idx_agent_trigger_keys_key_prefix ON agent_trigger_keys(key_prefix);

COMMENT ON TABLE agent_trigger_keys IS '外部系统触发 Agent 的 API Key 管理表';
COMMENT ON COLUMN agent_trigger_keys.key_hash IS 'API Key SHA-256 哈希（明文仅创建时展示一次）';
COMMENT ON COLUMN agent_trigger_keys.scopes IS '权限域：trigger=触发任务, read_status=查询状态, respond_human=代理人机响应';
```

---

## 5. API 设计

### 5.1 Agent 管理 API

| Method | Path | 说明 |
|--------|------|------|
| `GET` | `/api/agents` | 获取租户所有 Agent（树形结构） |
| `POST` | `/api/agents` | 创建新 Agent |
| `GET` | `/api/agents/:id` | 获取单个 Agent 详情 |
| `PUT` | `/api/agents/:id` | 更新 Agent 配置 |
| `DELETE` | `/api/agents/:id` | 归档 Agent（软删除） |
| `GET` | `/api/agents/:id/status` | 获取 Agent 实时运行状态 |
| `POST` | `/api/agents/:id/dispatch` | 内部手动下发指令（调试用） |

### 5.4 API 工具管理 API

| Method | Path | 说明 |
|--------|------|------|
| `GET` | `/api/api-tools` | 获取可用 API 工具列表（全局 + 租户） |
| `POST` | `/api/api-tools` | 创建新 API 工具 |
| `GET` | `/api/api-tools/:id` | 获取单个 API 工具详情 |
| `PUT` | `/api/api-tools/:id` | 更新 API 工具配置 |
| `DELETE` | `/api/api-tools/:id` | 删除 / 禁用 API 工具 |
| `POST` | `/api/api-tools/:id/test` | **测试调用**（发起一次真实请求验证配置是否正确） |

### 5.5 Agent 外部触发接口

| Method | Path | 说明 |
|--------|------|------|
| `POST` | `/api/agents/trigger` | **全局触发**，由 Orchestrator 自动路由分配给合适子 Agent |
| `POST` | `/api/agents/:id/trigger` | **单 Agent 触发**，跳过 Orchestrator，直接启动指定 Agent |
| `GET` | `/api/tasks/:taskId/status` | 轮询任务执行状态（含进度、日志摘要） |

### 5.6 API Trigger Key 管理

| Method | Path | 说明 |
|--------|------|------|
| `GET` | `/api/agents/:id/trigger-keys` | 获取该 Agent 的所有 Trigger Key 列表 |
| `POST` | `/api/agents/:id/trigger-keys` | 生成新 Key（**明文仅返回一次**） |
| `DELETE` | `/api/agents/:id/trigger-keys/:keyId` | 撤销 Key |
| `GET` | `/api/agents/trigger-keys` | 获取全局触发 Key 列表（路由 Orchestrator 用） |
| `POST` | `/api/agents/trigger-keys` | 生成全局触发 Key |

### 5.2 人机协同 API

| Method | Path | 说明 |
|--------|------|------|
| `GET` | `/api/human-requests` | 获取当前用户待处理的协同请求列表 |
| `GET` | `/api/human-requests/:id` | 获取单个请求详情 |
| `POST` | `/api/human-requests/:id/respond` | 真人提交决策 |

### 5.3 Agent 自我优化 API

| Method | Path | 说明 |
|--------|------|------|
| `GET` | `/api/agents/:id/feedback` | 获取 Agent 反馈日志列表 |
| `GET` | `/api/agents/:id/prompt-versions` | 获取 Agent 所有 Prompt 版本历史 |
| `POST` | `/api/agents/:id/optimize` | 手动触发一次优化分析（异步） |
| `POST` | `/api/agents/:id/prompt-versions/:versionId/review` | 审核优化建议（采纳/拒绝/修改后采纳） |
| `POST` | `/api/agents/:id/tasks/:taskId/rate` | 真人对已完成任务进行效果评分（1-5星） |

---

## 6. 前端功能需求

### 6.1 Agent 配置页面（`/dashboard/workspaces/agents`）

-   **树形列表**：左侧展示 Agent 层级树，右侧展示选中 Agent 的详细配置表单。
-   **状态徽章**：
    -   `idle` → 绿色圆点
    -   `running` → 蓝色旋转动画
    -   `waiting_human` → 橙色铃铛闪烁
    -   `offline` → 灰色（绑定 Client 离线）
-   **配置表单字段**：
    -   基本信息：名称、描述、头像
    -   父 Agent：下拉选择（不选则为顶级）
    -   执行端：下拉选择已注册 Client（可选）
    -   真人绑定：下拉选择租户成员（可选）
    -   System Prompt：Markdown 编辑器
    -   LLM 配置：选择模型 Provider & 参数（temperature、max_tokens）
    -   工具列表：多选 MCP/Skill
    -   超时时间（分钟）：设置完后超时未回应则任务失败

### 6.2 人机协同通知面板

  - 操作按钮：「批准」/ 「拒绝」/ 「修改后批准」（展开填参表单）。
- **MQTT 实时驱动**：订阅 `agent/{tenantId}/{currentUserId}/notify`，新请求到来时前端自动刷新列表并弹出提示 Toast。

### 6.3 Agent 监控面板（`/dashboard/workspaces/agents/:id/monitor`）

- 实时日志流（订阅 `agent/{tenantId}/{agentId}/log`）。
- 当前任务树（正在执行 Session 中各子任务状态）。
- 「紧急停止」按钮：发布 `agent/{tenantId}/broadcast/notify`，强制中断所有进行中任务。

### 6.4 🔐 总管理员全局审计页面（`/dashboard/workspaces/agents/audit`）

> 仅 `admin` / `owner` 角色可见

- **全局 Agent 状态总览**：以看板形式展示租户内所有 Agent 当前状态（idle / running / waiting_human / offline / error）。
- **人机交互实时流**：
  - 订阅 `agent/{tenantId}/+/human/request` 和 `agent/{tenantId}/+/human/response`
  - 以时间线形式展示所有人机交互事件：「Agent X 向用户 Y 发送了确认请求」「用户 Y 批准了请求」
- **失败事件面板**：
  - 订阅 `agent/{tenantId}/+/task/failed`
  - 展示所有失败任务，支持管理员直接代理处理（标记处理 / 分配给其他真人）。
- **历史交互查询**：
  - 按时间范围、Agent、真人筛选 `agent_human_requests` 历史记录。
  - 每条记录可展开查看完整问题、上下文、真人决策内容。
- **代理响应**：管理员可对任意 `pending` 状态的人机协同请求直接操作（批准 / 拒绝），无需等待绑定真人。

### 6.5 Agent 优化审核页面（`/dashboard/workspaces/agents/:id/optimization`）

- **反馈统计看板**：
  - 最近 N 条反馈的正负比例饼图。
  - 高频 reject/modify 场景 Top 5 列表（帮助理解 Agent 的薄弱点）。
  - 任务成功率趋势折线图。
- **待审核优化建议**（当有 `draft` 版本时显示橙色提示）：
  - 左右对比视图：当前 Prompt vs 建议新 Prompt（逐行 Diff 高亮）。
  - 优化报告卡片：LLM 解释为什么建议这样改，引用了哪些具体反馈案例。
  - 操作按钮：「采纳」/ 「修改后采纳」（内联编辑）/ 「拒绝并说明原因」。
- **版本历史列表**：所有历史版本，可展开对比，支持回滚到任意历史版本。
- **手动触发优化**：「立即分析」按钮，不等阈值直接触发一次优化分析。
- **MQTT 实时提示**：订阅 `agent/{tenantId}/{agentId}/optimization/ready`，有新优化建议时前端自动弹出提示。

---

## 7. 非功能性需求

| 指标 | 要求 |
|------|------|
| **MQTT 消息延迟** | Agent 间任务分派端到端延迟 < 500ms（P99） |
| **人机协同响应通知** | 真人 Web 收到通知延迟 < 2s |
| **Agent 并发数** | 单租户最多支持 50 个并发运行的 Agent 实例 |
| **任务幂等性** | 利用 `agent_tasks.idempotency_key` 防止重复下发 |
| **MQTT ACL** | 每个 Agent/Client 只能订阅/发布自己被授权的 Topic，不能跨租户 |
| **审计日志** | 所有 Agent 执行步骤、人机协同决策全部写入 `agent_task_events` |

---

## 8. 实现优先级与里程碑

### Phase 1 — 基础 Agent 配置管理（MVP）

- [ ] 数据库迁移：`011_agents.sql`、`012_agent_human_requests.sql`、`013_agent_tasks_extend.sql`
- [ ] API：Agent CRUD（`/api/agents`）
- [ ] 前端：Agent 配置树形页面（不含实时状态）
- [ ] 服务端 MQTT 消费者：订阅 `agent/{tenantId}/+/task/result` 更新任务状态

### Phase 2 — Agent 运行时与层级调度

- [ ] Orchestrator Agent Runner（服务端后台 Worker）
- [ ] 父子 Agent 任务分派（`task/assign` 发布 + 子 Agent 订阅）
- [ ] Agent 状态机（idle / running / error）
- [ ] 前端树形列表实时状态徽章

### Phase 3 — 人机协同

- [ ] `agent_human_requests` 表与 API
- [ ] Agent 触发 `human/request` → 暂停任务流程
- [ ] 真人通知面板（MQTT 实时推送）
- [ ] 人机决策投递与 Agent 恢复执行
- [ ] 超时自动处理定时任务（Cron Job）

### Phase 4 — 可观测性与增强

- [ ] Agent 监控面板（日志流 + 任务树）
- [ ] 外部通知渠道（Webhook / 企业微信 / 钉钉）
- [ ] 多级 Agent 嵌套（3+ 层）压力测试
- [ ] MQTT ACL 精细化权限控制

### Phase 5 — Agent 自我优化

- [ ] 数据库迁移：`014_agent_feedback.sql`（`agent_feedback_logs` + `agent_prompt_versions`）
- [ ] 反馈自动采集：人机协同响应 & 任务结果写入 `agent_feedback_logs`
- [ ] 任务完成后真人评分 API & 前端交互
- [ ] 优化分析触发器（阈值检测 + 每周 Cron Job）
- [ ] LLM 优化分析 & Prompt 草稿生成
- [ ] MQTT 通知：`agent/{tenantId}/{agentId}/optimization/ready`
- [ ] 前端优化审核页面（Diff 对比 + 采纳/拒绝流程）
- [ ] Prompt 版本管理（历史记录 + 一键回滚）

---

## 9. 开放问题

| # | 问题 | 优先级 | 决策 |
|---|------|--------|------|
| Q1 | 服务端 Agent Runner 用 Next.js 后台任务（BullMQ）还是独立微服务？ | 高 | ✅ **纯 MQTT 事件驱动**，服务端常驻订阅进程，无需 BullMQ 或独立微服务 |
| Q2 | 多租户的 Orchestrator 是共享进程池还是独立进程？ | 高 | ✅ **共享同一 MQTT 连接进程**，按 Topic 中的 `{tenantId}` 区分租户，不同 Agent 通过订阅各自 Topic 隔离 |
| Q3 | 人机协同超时后 `auto_approve` 的安全风险如何管控？ | 中 | ✅ **去掉 auto_approve**，超时统一视为任务失败，由真人手动重试 |
| Q4 | 真人绑定是否支持「备用人员」（primary + fallback user）？ | 中 | ✅ **不需要**，Admin 可代理处理任意请求 |
| Q5 | 子 Agent 失败后，父 Agent 是否自动重新分派给另一个子 Agent？ | 高 | ✅ **不自动重派**，通过 MQTT `task/failed` 通知真人决策 |
| Q6 | Agent 的 System Prompt 是否需要版本管理（变更历史）？ | 低 | ⏳ 待定 |

---

## 附录 A：MQTT Topic 完整参考

```
# Agent 任务调度
agent/{tenantId}/{agentId}/task/assign          # 下发子任务
agent/{tenantId}/{agentId}/task/result          # 子任务结果上报
agent/{tenantId}/{agentId}/task/cancel          # 取消任务
agent/{tenantId}/{agentId}/task/failed          # 执行失败通知（→ 真人决策）

# Agent 状态
agent/{tenantId}/{agentId}/status               # 心跳/状态上报
agent/{tenantId}/{agentId}/log                  # 执行日志流（监控用）

# 人机协同
agent/{tenantId}/{agentId}/human/request        # Agent 请求真人确认
agent/{tenantId}/{agentId}/human/response       # 真人响应

# 自我优化
agent/{tenantId}/{agentId}/optimization/ready   # 优化建议已生成，通知审核

# 指挥链入口
agent/{tenantId}/orchestrator/command           # 向顶级 Orchestrator 下发指令
agent/{tenantId}/{userId}/notify                # 向特定真人推送通知

# 广播
agent/{tenantId}/broadcast/notify               # 全租户广播（紧急停止等）

# 原有（保持不变）
client/{clientId}/status                        # Client 心跳
client/{clientId}/command                       # 向 Client 下发命令
```

---

## 附录 B：人机协同消息体示例

**Agent → 服务端（`human/request` payload）**

```json
{
  "msgId": "01959a1f-xxxx",
  "type": "human.request",
  "tenantId": "tenant-uuid",
  "agentId": "agent-uuid",
  "sessionId": "session-uuid",
  "taskId": "task-uuid",
  "ts": 1740960000000,
  "payload": {
    "question": "检测到目标账号已被风控锁定，是否尝试通过手机验证码解锁？",
    "context": {
      "step": "登录目标平台",
      "attempts": 2,
      "error": "账号风控拦截"
    },
    "options": [
      { "label": "是，继续解锁", "value": "approve" },
      { "label": "否，跳过此账号", "value": "reject" }
    ],
    "expiresAt": "2026-03-03T14:30:00+08:00"
  }
}
```

**真人 → 服务端（`human/response` payload）**

```json
{
  "msgId": "01959a2f-xxxx",
  "type": "human.response",
  "tenantId": "tenant-uuid",
  "agentId": "agent-uuid",
  "sessionId": "session-uuid",
  "taskId": "task-uuid",
  "ts": 1740960300000,
  "payload": {
    "requestId": "human-request-uuid",
    "decision": "approve",
    "data": {}
  }
}
```
