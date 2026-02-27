# 事件驱动编排

事件驱动用于解耦跨领域协作。一个领域发布事件，其他领域订阅并响应。

## 核心概念

| 概念 | 说明 |
|------|------|
| 领域事件 | 记录"发生了什么"，如 OrderPaidEvent |
| 事件发布 | 聚合根在业务行为中产生事件 |
| 事件订阅 | 其他领域注册处理器监听事件 |
| 事件总线 | 负责分发事件到所有订阅者 |

## 完整示例

### 1. 定义事件

```typescript
// src/order/domain/events.ts
import { BaseDomainEvent } from "../../shared/event-bus";

export class OrderPaidEvent extends BaseDomainEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly items: Array<{ productId: string; quantity: number }>,
    public readonly amount: number,
    public readonly paymentMethod: string
  ) {
    super();
  }
}

export class OrderCancelledEvent extends BaseDomainEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly items: Array<{ productId: string; quantity: number }>,
    public readonly reason: string
  ) {
    super();
  }
}
```

### 2. 聚合根发布事件

```typescript
// src/order/domain/order.ts
class Order {
  private _events: DomainEvent[] = [];

  pay(paymentMethod: string): void {
    this._status = OrderStatus.PAID;
    
    // 产生事件（暂存）
    this._events.push(new OrderPaidEvent(
      this.id,
      this.userId,
      this.items.map(i => ({ productId: i.productId, quantity: i.quantity })),
      this.totalAmount.value,
      paymentMethod
    ));
  }

  collectEvents(): readonly DomainEvent[] {
    const events = Object.freeze([...this._events]);
    this._events = [];
    return events;
  }
}
```

### 3. 应用层发布事件

```typescript
// src/order/application/commands/pay-order.ts
class PayOrderHandler {
  async handle(command: PayOrderCommand): Promise<OrderDTO> {
    const order = await this.orderRepository.getById(command.orderId);
    
    order.pay(command.paymentMethod);
    
    await this.orderRepository.save(order);
    
    // 发布事件（触发所有订阅者）
    await eventBus.publishAll(order.collectEvents());
    
    return toOrderDTO(order);
  }
}
```

### 4. 各领域事件处理器

```typescript
// src/product/application/event-handlers.ts
import { OrderPaidEvent, OrderCancelledEvent } from "../../order/domain/events";

export class InventoryEventHandlers {
  constructor(private inventoryRepository: any) {}

  async onOrderPaid(event: OrderPaidEvent): Promise<void> {
    console.log(`[库存] 处理订单支付: ${event.orderId}`);
    
    for (const item of event.items) {
      await this.inventoryRepository.deduct(item.productId, item.quantity);
      console.log(`[库存] 商品 ${item.productId} 扣减 ${item.quantity}`);
    }
  }

  async onOrderCancelled(event: OrderCancelledEvent): Promise<void> {
    console.log(`[库存] 处理订单取消: ${event.orderId}`);
    
    for (const item of event.items) {
      await this.inventoryRepository.restore(item.productId, item.quantity);
    }
  }
}
```

```typescript
// src/user/application/event-handlers.ts
import { OrderPaidEvent } from "../../order/domain/events";

export class UserEventHandlers {
  constructor(private userRepository: any) {}

  async onOrderPaid(event: OrderPaidEvent): Promise<void> {
    console.log(`[用户] 处理订单支付: ${event.orderId}`);
    
    const points = Math.floor(event.amount * 0.1);
    await this.userRepository.addPoints(event.userId, points);
    
    console.log(`[用户] 用户 ${event.userId} 增加 ${points} 积分`);
  }
}
```

```typescript
// src/notification/application/event-handlers.ts
import { OrderCreatedEvent, OrderPaidEvent } from "../../order/domain/events";
import { UserCreatedEvent } from "../../user/domain/events";

export class NotificationEventHandlers {
  constructor(
    private emailService: any,
    private smsService: any
  ) {}

  async onOrderCreated(event: OrderCreatedEvent): Promise<void> {
    await this.emailService.send({
      to: event.userId,
      subject: "订单确认",
      body: `订单 ${event.orderId} 已创建，金额 ${event.totalAmount}`
    });
  }

  async onOrderPaid(event: OrderPaidEvent): Promise<void> {
    await this.smsService.send(
      event.userId,
      `订单 ${event.orderId} 支付成功`
    );
  }

  async onUserCreated(event: UserCreatedEvent): Promise<void> {
    await this.emailService.send({
      to: event.email,
      subject: "欢迎注册",
      body: `你好 ${event.name}，欢迎加入！`
    });
  }
}
```

```typescript
// src/audit/application/event-handlers.ts
import { DomainEvent } from "../../shared/event-bus";

export class AuditEventHandlers {
  constructor(private auditRepository: any) {}

  async onOrderCreated(event: any): Promise<void> {
    await this.log("ORDER_CREATED", event);
  }

  async onOrderPaid(event: any): Promise<void> {
    await this.log("ORDER_PAID", event);
  }

  async onOrderCancelled(event: any): Promise<void> {
    await this.log("ORDER_CANCELLED", event);
  }

  private async log(action: string, event: DomainEvent): Promise<void> {
    await this.auditRepository.save({
      action,
      eventId: event.eventId,
      data: event,
      occurredAt: event.occurredAt,
      loggedAt: new Date()
    });
    console.log(`[审计] ${action}: ${event.eventId}`);
  }
}
```

### 5. 注册事件

```typescript
// src/config/events.ts
import { eventBus } from "../shared/event-bus";
import {
  OrderCreatedEvent,
  OrderPaidEvent,
  OrderCancelledEvent
} from "../order/domain/events";
import { UserCreatedEvent } from "../user/domain/events";

import { InventoryEventHandlers } from "../product/application/event-handlers";
import { UserEventHandlers } from "../user/application/event-handlers";
import { NotificationEventHandlers } from "../notification/application/event-handlers";
import { AuditEventHandlers } from "../audit/application/event-handlers";

export function registerEventHandlers(
  inventoryHandlers: InventoryEventHandlers,
  userHandlers: UserEventHandlers,
  notificationHandlers: NotificationEventHandlers,
  auditHandlers: AuditEventHandlers
): void {
  // 订单创建
  eventBus.subscribe(OrderCreatedEvent, e => notificationHandlers.onOrderCreated(e));
  eventBus.subscribe(OrderCreatedEvent, e => auditHandlers.onOrderCreated(e));

  // 订单支付（4 个领域响应）
  eventBus.subscribe(OrderPaidEvent, e => inventoryHandlers.onOrderPaid(e));
  eventBus.subscribe(OrderPaidEvent, e => userHandlers.onOrderPaid(e));
  eventBus.subscribe(OrderPaidEvent, e => notificationHandlers.onOrderPaid(e));
  eventBus.subscribe(OrderPaidEvent, e => auditHandlers.onOrderPaid(e));

  // 订单取消
  eventBus.subscribe(OrderCancelledEvent, e => inventoryHandlers.onOrderCancelled(e));
  eventBus.subscribe(OrderCancelledEvent, e => auditHandlers.onOrderCancelled(e));

  // 用户创建
  eventBus.subscribe(UserCreatedEvent, e => notificationHandlers.onUserCreated(e));

  console.log("[事件注册] 完成");
}
```

### 6. 启动时注册

```typescript
// src/api/app.ts
import express from "express";
import { registerEventHandlers } from "../config/events";
import { connectDatabase } from "../shared/database";

const app = express();

async function bootstrap() {
  // 连接数据库
  await connectDatabase();

  // 初始化处理器
  const inventoryHandlers = new InventoryEventHandlers(inventoryRepo);
  const userHandlers = new UserEventHandlers(userRepo);
  const notificationHandlers = new NotificationEventHandlers(emailService, smsService);
  const auditHandlers = new AuditEventHandlers(auditRepo);

  // 注册事件
  registerEventHandlers(
    inventoryHandlers,
    userHandlers,
    notificationHandlers,
    auditHandlers
  );

  // 启动服务
  app.listen(3000, () => {
    console.log("Server running on port 3000");
  });
}

bootstrap();
```

## 事件流转图

```
OrderPaidEvent 发布
        │
        ▼
   ┌─────────┐
   │ EventBus │
   └─────────┘
        │
    ┌───┼───┬───────┬───────┐
    ▼   ▼   ▼       ▼       ▼
  库存 用户 通知    审计
  扣减 积分 短信    日志
```

## 关系总结

| 关系 | 支持 | 示例 |
|------|------|------|
| 一事件 → 一领域 | ✅ | `UserCreatedEvent → notification` |
| 一事件 → 多领域 | ✅ | `OrderPaidEvent → product, user, notification, audit` |
| 多事件 → 一领域 | ✅ | `OrderCreated, OrderPaid → notification` |

## 扩展新需求

```typescript
// 新增：订单支付后同步到搜索引擎
// 只需加一行，不改原有代码
eventBus.subscribe(OrderPaidEvent, e => searchHandlers.onOrderPaid(e));
```
