# 全局依赖容器 (container.ts)

全局容器统一管理所有领域的依赖注入，放在 `src/container.ts`。

## 核心原则

| 原则 | 说明 |
|------|------|
| 显式依赖 | EventBus 通过构造函数注入 |
| 单例管理 | 容器管理单例生命周期 |
| 可测试 | 测试时可替换 EventBus |

## 完整实现

```typescript
// src/container.ts
import { prisma } from "@/shared/database";
import { EventBus, getEventBus } from "@/shared/event-bus";
import { bootstrap } from "@/config/bootstrap";

// Order 领域
import { PrismaOrderRepository } from "@/order/infra/prisma-order-repository";
import { PrismaOrderQueryService } from "@/order/infra/prisma-order-query-service";
import { CreateOrderHandler } from "@/order/application/commands/create-order";
import { PayOrderHandler } from "@/order/application/commands/pay-order";
import { CancelOrderHandler } from "@/order/application/commands/cancel-order";
import { GetOrderHandler } from "@/order/application/queries/get-order";
import { ListOrdersHandler } from "@/order/application/queries/list-orders";
import { OrderEventHandlers } from "@/order/application/event-handlers";

// User 领域
import { PrismaUserRepository } from "@/user/infra/prisma-user-repository";
import { UserEventHandlers } from "@/user/application/event-handlers";

// Product 领域
import { PrismaInventoryRepository } from "@/product/infra/prisma-inventory-repository";
import { InventoryEventHandlers } from "@/product/application/event-handlers";

// Notification 领域
import { NotificationEventHandlers } from "@/notification/application/event-handlers";

// ==================== 容器类 ====================

export class AppContainer {
  private _eventBus: EventBus;
  
  // 仓储
  private _orderRepo: PrismaOrderRepository;
  private _userRepo: PrismaUserRepository;
  private _inventoryRepo: PrismaInventoryRepository;

  // 查询服务
  private _orderQuery: PrismaOrderQueryService;

  constructor(eventBus?: EventBus) {
    // EventBus：默认使用单例，测试时可替换
    this._eventBus = eventBus ?? getEventBus();
    
    // 仓储（注入 EventBus）
    this._orderRepo = new PrismaOrderRepository(prisma, this._eventBus);
    this._userRepo = new PrismaUserRepository(prisma);
    this._inventoryRepo = new PrismaInventoryRepository(prisma);

    // 查询服务
    this._orderQuery = new PrismaOrderQueryService(prisma);
  }

  // ===== EventBus =====

  get eventBus(): EventBus {
    return this._eventBus;
  }

  // ===== Order 领域 =====

  get createOrderHandler(): CreateOrderHandler {
    return new CreateOrderHandler(this._orderRepo, this._eventBus);
  }

  get payOrderHandler(): PayOrderHandler {
    return new PayOrderHandler(this._orderRepo, this._eventBus);
  }

  get cancelOrderHandler(): CancelOrderHandler {
    return new CancelOrderHandler(this._orderRepo, this._eventBus);
  }

  get getOrderHandler(): GetOrderHandler {
    return new GetOrderHandler(this._orderQuery);
  }

  get listOrdersHandler(): ListOrdersHandler {
    return new ListOrdersHandler(this._orderQuery);
  }

  get orderEventHandlers(): OrderEventHandlers {
    return new OrderEventHandlers(this._orderRepo);
  }

  // ===== User 领域 =====

  get userEventHandlers(): UserEventHandlers {
    return new UserEventHandlers(this._userRepo);
  }

  // ===== Product 领域 =====

  get inventoryEventHandlers(): InventoryEventHandlers {
    return new InventoryEventHandlers(this._inventoryRepo);
  }

  // ===== Notification 领域 =====

  get notificationEventHandlers(): NotificationEventHandlers {
    return new NotificationEventHandlers();
  }
}

// ==================== 单例（Next.js 热更新安全） ====================

const globalForContainer = globalThis as unknown as {
  container: AppContainer | undefined;
  containerInitialized: boolean | undefined;
};

export function getContainer(eventBus?: EventBus): AppContainer {
  // 测试时传入自定义 EventBus，跳过单例
  if (eventBus) {
    const container = new AppContainer(eventBus);
    bootstrap(container);
    return container;
  }

  // 生产/开发环境使用单例
  if (!globalForContainer.container) {
    globalForContainer.container = new AppContainer();
  }

  // 确保订阅只注册一次
  if (!globalForContainer.containerInitialized) {
    bootstrap(globalForContainer.container);
    globalForContainer.containerInitialized = true;
  }

  return globalForContainer.container;
}

/**
 * 创建独立容器（测试用）
 */
export function createContainer(eventBus?: EventBus): AppContainer {
  return new AppContainer(eventBus);
}
```

## 启动引导

事件订阅由各领域自己管理，启动时统一调用。详见 [subscriptions.md](subscriptions.md)。

```typescript
// src/config/bootstrap.ts
import type { AppContainer } from "@/container";
import { registerOrderSubscriptions } from "@/order/application/subscriptions";
import { registerInventorySubscriptions } from "@/inventory/application/subscriptions";
import { registerUserSubscriptions } from "@/user/application/subscriptions";
import { registerNotificationSubscriptions } from "@/notification/application/subscriptions";

export function bootstrap(container: AppContainer): void {
  const eventBus = container.eventBus;

  registerOrderSubscriptions(eventBus, container.orderEventHandlers);
  registerInventorySubscriptions(eventBus, container.inventoryEventHandlers);
  registerUserSubscriptions(eventBus, container.userEventHandlers);
  registerNotificationSubscriptions(eventBus, container.notificationEventHandlers);

  console.log("[Bootstrap] 所有领域订阅完成");
}
```

## 处理器中使用 EventBus

```typescript
// src/order/application/commands/pay-order.ts
import { EventBus } from "@/shared/event-bus";
import { OrderRepository } from "@/order/protocols/order-repository";

export class PayOrderHandler {
  constructor(
    private orderRepo: OrderRepository,
    private eventBus: EventBus  // 显式注入
  ) {}

  async handle(command: PayOrderCommand): Promise<OrderDTO> {
    const order = await this.orderRepo.getById(command.orderId);
    if (!order) throw new OrderNotFoundError(command.orderId);

    order.pay(command.paymentMethod);
    await this.orderRepo.save(order);

    // 发布事件
    await this.eventBus.publishAll(order.collectEvents());

    return toDTO(order);
  }
}
```

## 测试时替换 EventBus

```typescript
// tests/order/pay-order.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createContainer } from "@/container";
import { createEventBus, EventBus } from "@/shared/event-bus";
import { OrderPaidEvent } from "@/order/domain/events";

describe("PayOrderHandler", () => {
  let eventBus: EventBus;
  let container: ReturnType<typeof createContainer>;

  beforeEach(() => {
    // 每个测试用独立的 EventBus
    eventBus = createEventBus();
    container = createContainer(eventBus);
  });

  it("should publish OrderPaidEvent", async () => {
    // Arrange
    const events: OrderPaidEvent[] = [];
    eventBus.subscribe(OrderPaidEvent, async (e) => {
      events.push(e);
    });

    // Act
    await container.payOrderHandler.handle({
      orderId: "order-123",
      paymentMethod: "alipay"
    });

    // Assert
    expect(events).toHaveLength(1);
    expect(events[0].orderId).toBe("order-123");
  });
});
```

```typescript
// tests/order/pay-order-mock.test.ts
import { describe, it, expect, vi } from "vitest";
import { PayOrderHandler } from "@/order/application/commands/pay-order";
import { EventBus } from "@/shared/event-bus";

describe("PayOrderHandler with mock", () => {
  it("should call eventBus.publishAll", async () => {
    // Mock EventBus
    const mockEventBus: EventBus = {
      subscribe: vi.fn(),
      publish: vi.fn(),
      publishAll: vi.fn(),
      clear: vi.fn()
    } as any;

    const mockRepo = {
      getById: vi.fn().mockResolvedValue(mockOrder),
      save: vi.fn()
    };

    const handler = new PayOrderHandler(mockRepo, mockEventBus);

    // Act
    await handler.handle({ orderId: "123", paymentMethod: "alipay" });

    // Assert
    expect(mockEventBus.publishAll).toHaveBeenCalledTimes(1);
  });
});
```

## API Route 使用（不变）

```typescript
// app/api/orders/[id]/pay/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getContainer } from "@/container";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const container = getContainer();  // 使用单例
  const body = await request.json();

  const result = await container.payOrderHandler.handle({
    orderId: params.id,
    paymentMethod: body.paymentMethod
  });

  return NextResponse.json(result);
}
```

## 依赖关系图

```
AppContainer
├── EventBus (可替换)
├── OrderRepository
│   └── EventBus (注入，用于发布)
├── Handlers
│   ├── OrderRepository (注入)
│   └── EventBus (注入)
└── EventHandlers
```

## 与 FastAPI 版本对比

| 方面 | FastAPI | Next.js |
|------|---------|---------|
| 单例保证 | 模块级单例 | globalThis 单例 |
| 热更新 | 需重启 | 自动保持实例 |
| 容器创建 | `create_container(session, event_bus)` | `getContainer(eventBus?)` |
| 测试替换 | 构造函数注入 | 构造函数注入 |
