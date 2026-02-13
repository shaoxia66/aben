# 应用层设计 (application/)

应用层编排领域对象，实现用例。与 Express 版本基本相同。

## 目录结构

```
src/order/application/
├── index.ts
├── dtos.ts                    # 数据传输对象
├── commands/
│   ├── create-order.ts
│   └── pay-order.ts
├── queries/
│   ├── get-order.ts
│   └── list-orders.ts
├── event-handlers.ts          # 事件处理器
└── subscriptions.ts           # 事件订阅（领域自治）
```

注意：
- 依赖容器统一放在 `src/container.ts`，见 [container.md](container.md)
- 事件订阅由各领域自己管理，见 [subscriptions.md](subscriptions.md)

## DTO

```typescript
// src/order/application/dtos.ts

export interface OrderItemDTO {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface OrderDTO {
  id: string;
  userId: string;
  items: OrderItemDTO[];
  status: string;
  totalAmount: number;
  createdAt: Date;
  paidAt?: Date;
}

export interface OrderListDTO {
  items: OrderDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function toOrderDTO(order: Order): OrderDTO {
  return {
    id: order.id,
    userId: order.userId,
    items: order.items.map(item => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      price: item.price.value,
      subtotal: item.subtotal.value
    })),
    status: order.status,
    totalAmount: order.totalAmount.value,
    createdAt: order.createdAt
  };
}
```

## 命令 + 处理器

```typescript
// src/order/application/commands/create-order.ts
import { eventBus } from "@/shared/event-bus";
import { Order } from "../../domain/order";
import { OrderItem } from "../../domain/order-item";
import { Money } from "../../domain/value-objects";
import { OrderRepository } from "../../protocols/order-repository";
import { OrderDTO, toOrderDTO } from "../dtos";

export interface CreateOrderCommand {
  userId: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    price: number;
  }>;
}

export class CreateOrderHandler {
  constructor(private orderRepository: OrderRepository) {}

  async handle(command: CreateOrderCommand): Promise<OrderDTO> {
    const items = command.items.map(
      item => new OrderItem(
        item.productId,
        item.productName,
        item.quantity,
        new Money(item.price)
      )
    );

    const orderId = await this.orderRepository.nextId();
    const order = Order.create(orderId, command.userId, items);

    await this.orderRepository.save(order);
    await eventBus.publishAll(order.collectEvents());

    return toOrderDTO(order);
  }
}
```

```typescript
// src/order/application/commands/pay-order.ts
import { eventBus } from "@/shared/event-bus";
import { OrderRepository } from "../../protocols/order-repository";
import { OrderNotFoundError } from "../../domain/exceptions";
import { OrderDTO, toOrderDTO } from "../dtos";

export interface PayOrderCommand {
  orderId: string;
  paymentMethod: string;
}

export class PayOrderHandler {
  constructor(private orderRepository: OrderRepository) {}

  async handle(command: PayOrderCommand): Promise<OrderDTO> {
    const order = await this.orderRepository.getById(command.orderId);
    if (!order) {
      throw new OrderNotFoundError(command.orderId);
    }

    order.pay(command.paymentMethod);
    await this.orderRepository.save(order);
    await eventBus.publishAll(order.collectEvents());

    return toOrderDTO(order);
  }
}
```

## 查询处理器

```typescript
// src/order/application/queries/get-order.ts
import { OrderQueryService } from "../../protocols/order-query-service";
import { OrderDTO } from "../dtos";
import { OrderNotFoundError } from "../../domain/exceptions";

export interface GetOrderQuery {
  orderId: string;
}

export class GetOrderHandler {
  constructor(private queryService: OrderQueryService) {}

  async handle(query: GetOrderQuery): Promise<OrderDTO> {
    const order = await this.queryService.getById(query.orderId);
    if (!order) {
      throw new OrderNotFoundError(query.orderId);
    }
    return order;
  }
}
```

## 事件处理器

```typescript
// src/order/application/event-handlers.ts
import { UserBannedEvent } from "@/user/domain/events";
import { ProductRemovedEvent } from "@/product/domain/events";
import { OrderRepository } from "../protocols/order-repository";

export class OrderEventHandlers {
  constructor(private orderRepository: OrderRepository) {}

  async onUserBanned(event: UserBannedEvent): Promise<void> {
    const orders = await this.orderRepository.getPendingByUser(event.userId);
    for (const order of orders) {
      order.cancel("用户已被封禁");
      await this.orderRepository.save(order);
    }
  }

  async onProductRemoved(event: ProductRemovedEvent): Promise<void> {
    const orders = await this.orderRepository.getPendingByProduct(event.productId);
    for (const order of orders) {
      order.cancel(`商品 ${event.productId} 已下架`);
      await this.orderRepository.save(order);
    }
  }
}
```

