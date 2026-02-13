---
name: nextjs-ddd
description: Next.js App Router 项目的领域驱动设计（DDD）+ 事件驱动开发规范。当需要创建 Next.js 后端 API、设计 DDD 架构、实现领域模型、编写仓储模式、使用事件驱动编排跨领域业务时使用此技能。适用于：(1) Next.js App Router API 开发 (2) 设计领域模型和聚合根 (3) 实现仓储和协议层 (4) 事件驱动跨领域编排 (5) Server Actions 集成
---

# Next.js DDD 事件驱动开发规范

## 项目结构

```
src/
├── container.ts               # 全局依赖容器（统一管理所有领域）
│
│── bootstrap.ts           # 启动引导（调用各领域订阅）
│
├── shared/                    # 共享基础设施（纯技术，无业务）
│   ├── event-bus.ts           # 事件总线
│   ├── database.ts            # 数据库连接（Prisma）
│   └── types.ts               # 公共类型
│
├── {domain}/                  # 领域模块（如 user/order/product）
│   ├── domain/                # 领域层：实体、值对象、事件、异常
│   ├── protocols/             # 协议层：仓储、服务接口
│   ├── application/           # 应用层
│   │   ├── commands/          # 命令处理器
│   │   ├── queries/           # 查询处理器
│   │   ├── event-handlers.ts  # 事件处理器
│   │   └── subscriptions.ts   # 事件订阅（领域自治）
│   └── infra/                 # 基础设施层：Prisma 仓储实现
│
└── app/                       # Next.js App Router
    ├── api/                   # API Routes
    ├── actions/               # Server Actions
    └── middleware.ts          # 中间件
```

## 各层职责

| 层 | 职责 | 依赖方向 |
|---|------|----------|
| domain/ | 纯业务逻辑，无外部依赖 | 不依赖任何层 |
| protocols/ | 接口定义（Interface） | 依赖 domain |
| application/ | 用例编排，DTO 转换 | 依赖 domain + protocols |
| infra/ | 技术实现（Prisma） | 实现 protocols |
| app/api/ | API Routes | 调用 application |
| app/actions/ | Server Actions | 调用 application |

## 实现指南

详细实现参考：
- **全局容器**: 见 [references/container.md](references/container.md)
- **事件总线**: 见 [references/event-bus.md](references/event-bus.md)
- **领域层设计**: 见 [references/domain.md](references/domain.md)
- **协议层设计**: 见 [references/protocols.md](references/protocols.md)
- **应用层设计**: 见 [references/application.md](references/application.md)
- **事件订阅**: 见 [references/subscriptions.md](references/subscriptions.md)
- **基础设施层**: 见 [references/infrastructure.md](references/infrastructure.md)
- **事件驱动编排**: 见 [references/event-driven.md](references/event-driven.md)
- **API 层设计**: 见 [references/api.md](references/api.md)

## 快速示例

### API Route

```typescript
// app/api/orders/[id]/pay/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getContainer } from "@/container";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const container = getContainer();
  const body = await request.json();
  
  const result = await container.payOrderHandler.handle({
    orderId: params.id,
    paymentMethod: body.paymentMethod
  });
  
  return NextResponse.json(result);
}
```

### Server Action

```typescript
// app/actions/order-actions.ts
"use server";
import { getContainer } from "@/container";

export async function payOrder(orderId: string, paymentMethod: string) {
  const container = getContainer();
  return container.payOrderHandler.handle({ orderId, paymentMethod });
}
```