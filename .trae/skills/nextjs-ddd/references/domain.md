# 领域层设计 (domain/)

领域层是 DDD 核心，包含纯业务逻辑，不依赖任何框架。

## 目录结构

```
src/order/domain/
├── index.ts
├── order.ts              # 聚合根
├── order-item.ts         # 实体
├── value-objects.ts      # 值对象
├── events.ts             # 领域事件
└── exceptions.ts         # 领域异常
```

## 聚合根

```typescript
// src/order/domain/order.ts
import { DomainEvent } from "../../shared/event-bus";
import { OrderCreatedEvent, OrderPaidEvent, OrderCancelledEvent } from "./events";
import { OrderItem } from "./order-item";
import { OrderStatus, Money } from "./value-objects";
import { OrderCannotBePaidError, OrderCannotBeCancelledError } from "./exceptions";

export class Order {
  private _events: DomainEvent[] = [];
  private _status: OrderStatus;
  private _paidAt?: Date;

  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly items: OrderItem[],
    status: OrderStatus = OrderStatus.PENDING,
    public readonly createdAt: Date = new Date()
  ) {
    this._status = status;
  }

  // ===== 工厂方法 =====
  static create(id: string, userId: string, items: OrderItem[]): Order {
    const order = new Order(id, userId, items);

    order._events.push(new OrderCreatedEvent(
      order.id,
      order.userId,
      order.items.map(i => i.toPlain()),
      order.totalAmount.value
    ));

    return order;
  }

  // ===== 查询方法 =====
  get status(): OrderStatus {
    return this._status;
  }

  get totalAmount(): Money {
    const total = this.items.reduce(
      (sum, item) => sum + item.subtotal.value,
      0
    );
    return new Money(total);
  }

  get isPending(): boolean {
    return this._status === OrderStatus.PENDING;
  }

  get isPaid(): boolean {
    return this._status === OrderStatus.PAID;
  }

  // ===== 业务行为 =====
  pay(paymentMethod: string): void {
    if (!this.isPending) {
      throw new OrderCannotBePaidError(
        `订单状态为 ${this._status}，无法支付`
      );
    }

    this._status = OrderStatus.PAID;
    this._paidAt = new Date();

    this._events.push(new OrderPaidEvent(
      this.id,
      this.userId,
      this.items.map(i => i.toPlain()),
      this.totalAmount.value,
      paymentMethod
    ));
  }

  cancel(reason: string): void {
    if (this._status === OrderStatus.CANCELLED) {
      throw new OrderCannotBeCancelledError("订单已取消");
    }

    if (this._status === OrderStatus.COMPLETED) {
      throw new OrderCannotBeCancelledError("已完成订单无法取消");
    }

    this._status = OrderStatus.CANCELLED;

    this._events.push(new OrderCancelledEvent(
      this.id,
      this.userId,
      this.items.map(i => i.toPlain()),
      reason
    ));
  }

  complete(): void {
    if (!this.isPaid) {
      throw new Error("未支付订单无法完成");
    }
    this._status = OrderStatus.COMPLETED;
  }

  // ===== 事件收集 =====
  collectEvents(): readonly DomainEvent[] {
    const events = Object.freeze([...this._events]);
    this._events = [];
    return events;  // 只读，防止外部修改
  }
}
```

## 实体

```typescript
// src/order/domain/order-item.ts
import { Money } from "./value-objects";

export class OrderItem {
  constructor(
    public readonly productId: string,
    public readonly productName: string,
    public readonly quantity: number,
    public readonly price: Money
  ) {
    if (quantity <= 0) {
      throw new Error("数量必须大于0");
    }
  }

  get subtotal(): Money {
    return new Money(this.price.value * this.quantity);
  }

  toPlain(): PlainOrderItem {
    return {
      productId: this.productId,
      productName: this.productName,
      quantity: this.quantity,
      price: this.price.value
    };
  }
}

export interface PlainOrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}
```

## 值对象

```typescript
// src/order/domain/value-objects.ts

// 订单状态
export enum OrderStatus {
  PENDING = "pending",
  PAID = "paid",
  CANCELLED = "cancelled",
  COMPLETED = "completed"
}

// 金额（不可变）
export class Money {
  constructor(public readonly value: number) {
    if (value < 0) {
      throw new Error("金额不能为负");
    }
  }

  add(other: Money): Money {
    return new Money(this.value + other.value);
  }

  subtract(other: Money): Money {
    return new Money(this.value - other.value);
  }

  multiply(factor: number): Money {
    return new Money(this.value * factor);
  }

  equals(other: Money): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value.toFixed(2);
  }
}

// 邮箱
export class Email {
  constructor(public readonly value: string) {
    if (!this.isValid(value)) {
      throw new Error(`无效邮箱: ${value}`);
    }
  }

  private isValid(email: string): boolean {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return pattern.test(email);
  }

  get domain(): string {
    return this.value.split("@")[1];
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }
}
```

## 领域事件

```typescript
// src/order/domain/events.ts
import { randomUUID } from "crypto";
import { BaseDomainEvent } from "../../shared/event-bus";
import { PlainOrderItem } from "./order-item";

export class OrderCreatedEvent extends BaseDomainEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly items: PlainOrderItem[],
    public readonly totalAmount: number
  ) {
    super();
  }
}

export class OrderPaidEvent extends BaseDomainEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly items: PlainOrderItem[],
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
    public readonly items: PlainOrderItem[],
    public readonly reason: string
  ) {
    super();
  }
}
```

## 领域异常

```typescript
// src/order/domain/exceptions.ts

export class OrderDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderDomainError";
  }
}

export class OrderNotFoundError extends OrderDomainError {
  constructor(orderId: string) {
    super(`订单不存在: ${orderId}`);
    this.name = "OrderNotFoundError";
  }
}

export class OrderCannotBePaidError extends OrderDomainError {
  constructor(message: string) {
    super(message);
    this.name = "OrderCannotBePaidError";
  }
}

export class OrderCannotBeCancelledError extends OrderDomainError {
  constructor(message: string) {
    super(message);
    this.name = "OrderCannotBeCancelledError";
  }
}
```

## 设计原则

1. **聚合根**：外部只能通过聚合根访问内部实体
2. **值对象**：不可变，通过值判断相等性
3. **领域事件**：在业务行为中产生，记录"发生了什么"
4. **无框架依赖**：domain 层不导入 Express、TypeORM 等
