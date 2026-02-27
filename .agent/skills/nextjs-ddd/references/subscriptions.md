# 事件订阅 (subscriptions.ts)

每个领域自己管理事件订阅，实现领域自治。

## 核心原则

| 原则 | 说明 |
|------|------|
| 领域自治 | 每个领域管理自己关心的事件 |
| 单一职责 | subscriptions.ts 只负责注册订阅 |
| 依赖清晰 | 谁订阅谁一目了然 |

## 目录结构

```
src/
├── config/
│   └── bootstrap.ts               # 启动引导
│
├── order/application/
│   ├── event-handlers.ts          # 处理器实现
│   └── subscriptions.ts           # 订单领域订阅
│
├── inventory/application/
│   ├── event-handlers.ts
│   └── subscriptions.ts           # 库存领域订阅
│
├── user/application/
│   ├── event-handlers.ts
│   └── subscriptions.ts           # 用户领域订阅
│
└── notification/application/
    ├── event-handlers.ts
    └── subscriptions.ts           # 通知领域订阅
```

## 各领域订阅

### 订单领域

```typescript
// src/order/application/subscriptions.ts
import { EventBus } from "@/shared/event-bus";
import { UserBannedEvent } from "@/user/domain/events";
import { OrderEventHandlers } from "./event-handlers";

export function registerOrderSubscriptions(
  eventBus: EventBus,
  handlers: OrderEventHandlers
): void {
  /**
   * 订单领域关心的事件
   *
   * 订阅：
   * - UserBannedEvent → 取消该用户待支付订单
   */
  eventBus.subscribe(UserBannedEvent, (e) => handlers.onUserBanned(e));

  console.log("[Order] 事件订阅完成");
}
```

### 库存领域

```typescript
// src/inventory/application/subscriptions.ts
import { EventBus } from "@/shared/event-bus";
import { OrderPaidEvent, OrderCancelledEvent } from "@/order/domain/events";
import { InventoryEventHandlers } from "./event-handlers";

export function registerInventorySubscriptions(
  eventBus: EventBus,
  handlers: InventoryEventHandlers
): void {
  /**
   * 库存领域关心的事件
   *
   * 订阅：
   * - OrderPaidEvent → 扣减库存
   * - OrderCancelledEvent → 恢复库存
   */
  eventBus.subscribe(OrderPaidEvent, (e) => handlers.onOrderPaid(e));
  eventBus.subscribe(OrderCancelledEvent, (e) => handlers.onOrderCancelled(e));

  console.log("[Inventory] 事件订阅完成");
}
```

### 用户领域

```typescript
// src/user/application/subscriptions.ts
import { EventBus } from "@/shared/event-bus";
import { OrderPaidEvent } from "@/order/domain/events";
import { UserEventHandlers } from "./event-handlers";

export function registerUserSubscriptions(
  eventBus: EventBus,
  handlers: UserEventHandlers
): void {
  /**
   * 用户领域关心的事件
   *
   * 订阅：
   * - OrderPaidEvent → 增加积分
   */
  eventBus.subscribe(OrderPaidEvent, (e) => handlers.onOrderPaid(e));

  console.log("[User] 事件订阅完成");
}
```

### 通知领域

```typescript
// src/notification/application/subscriptions.ts
import { EventBus } from "@/shared/event-bus";
import { OrderPaidEvent, OrderCancelledEvent } from "@/order/domain/events";
import { UserCreatedEvent } from "@/user/domain/events";
import { NotificationEventHandlers } from "./event-handlers";

export function registerNotificationSubscriptions(
  eventBus: EventBus,
  handlers: NotificationEventHandlers
): void {
  /**
   * 通知领域关心的事件
   *
   * 订阅：
   * - OrderPaidEvent → 发送支付成功通知
   * - OrderCancelledEvent → 发送取消通知
   * - UserCreatedEvent → 发送欢迎邮件
   */
  eventBus.subscribe(OrderPaidEvent, (e) => handlers.onOrderPaid(e));
  eventBus.subscribe(OrderCancelledEvent, (e) => handlers.onOrderCancelled(e));
  eventBus.subscribe(UserCreatedEvent, (e) => handlers.onUserCreated(e));

  console.log("[Notification] 事件订阅完成");
}
```

## 启动引导

```typescript
// src/config/bootstrap.ts
import type { AppContainer } from "@/container";

import { registerOrderSubscriptions } from "@/order/application/subscriptions";
import { registerInventorySubscriptions } from "@/inventory/application/subscriptions";
import { registerUserSubscriptions } from "@/user/application/subscriptions";
import { registerNotificationSubscriptions } from "@/notification/application/subscriptions";

export function bootstrap(container: AppContainer): void {
  /**
   * 应用启动时初始化所有领域订阅
   *
   * 注意：只导入 subscriptions 模块，不导入具体事件类
   */
  const eventBus = container.eventBus;

  registerOrderSubscriptions(eventBus, container.orderEventHandlers);
  registerInventorySubscriptions(eventBus, container.inventoryEventHandlers);
  registerUserSubscriptions(eventBus, container.userEventHandlers);
  registerNotificationSubscriptions(eventBus, container.notificationEventHandlers);

  console.log("[Bootstrap] 所有领域订阅完成");
}
```

## 容器中调用

```typescript
// src/container.ts（部分）
import { bootstrap } from "@/config/bootstrap";

const globalForContainer = globalThis as unknown as {
  container: AppContainer | undefined;
  containerInitialized: boolean | undefined;
};

export function getContainer(eventBus?: EventBus): AppContainer {
  if (eventBus) {
    const container = new AppContainer(eventBus);
    bootstrap(container);  // 测试时也初始化订阅
    return container;
  }

  if (!globalForContainer.container) {
    globalForContainer.container = new AppContainer();
  }

  // 确保订阅只注册一次
  if (!globalForContainer.containerInitialized) {
    bootstrap(globalForContainer.container);  // 使用 bootstrap
    globalForContainer.containerInitialized = true;
  }

  return globalForContainer.container;
}
```

## 与集中注册对比

| 方面 | 集中注册 (config/events.ts) | 领域自治 (subscriptions.ts) |
|------|----------------------------|----------------------------|
| 事件导入 | container 导入所有事件 | 各领域自己导入 |
| 维护性 | 改一个文件 | 改各自领域文件 |
| 领域独立 | ❌ 耦合 | ✅ 自治 |
| 新增领域 | 改 events.ts | 加 subscriptions.ts |
| 可读性 | 集中查看 | 分散但更清晰 |

## 事件流向图

```
┌─────────────────────────────────────────────────────────────────────┐
│                           事件发布者                                 │
├─────────────────────────────────────────────────────────────────────┤
│  Order 领域                                                         │
│  ├── OrderPaidEvent      → Inventory, User, Notification           │
│  └── OrderCancelledEvent → Inventory, Notification                 │
│                                                                     │
│  User 领域                                                          │
│  ├── UserCreatedEvent    → Notification                            │
│  └── UserBannedEvent     → Order                                   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           事件订阅者                                 │
├─────────────────────────────────────────────────────────────────────┤
│  order/subscriptions.ts                                             │
│  └── UserBannedEvent → onUserBanned (取消待支付订单)                │
│                                                                     │
│  inventory/subscriptions.ts                                         │
│  ├── OrderPaidEvent → onOrderPaid (扣减库存)                        │
│  └── OrderCancelledEvent → onOrderCancelled (恢复库存)              │
│                                                                     │
│  user/subscriptions.ts                                              │
│  └── OrderPaidEvent → onOrderPaid (增加积分)                        │
│                                                                     │
│  notification/subscriptions.ts                                      │
│  ├── OrderPaidEvent → onOrderPaid (支付成功通知)                    │
│  ├── OrderCancelledEvent → onOrderCancelled (取消通知)              │
│  └── UserCreatedEvent → onUserCreated (欢迎邮件)                    │
└─────────────────────────────────────────────────────────────────────┘
```

## 测试

```typescript
// tests/order/subscriptions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createEventBus, EventBus } from "@/shared/event-bus";
import { UserBannedEvent } from "@/user/domain/events";
import { registerOrderSubscriptions } from "@/order/application/subscriptions";

describe("Order Subscriptions", () => {
  let eventBus: EventBus;
  let mockHandlers: any;

  beforeEach(() => {
    eventBus = createEventBus();
    mockHandlers = {
      onUserBanned: vi.fn()
    };
  });

  it("should subscribe to UserBannedEvent", async () => {
    // Arrange
    registerOrderSubscriptions(eventBus, mockHandlers);
    const event = new UserBannedEvent("user-123", "违规");

    // Act
    await eventBus.publish(event);

    // Assert
    expect(mockHandlers.onUserBanned).toHaveBeenCalledWith(event);
  });
});
```
