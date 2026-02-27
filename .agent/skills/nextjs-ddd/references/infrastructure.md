# 基础设施层设计 (shared/ + infra/)

Next.js 推荐使用 Prisma 作为 ORM。

## 共享基础设施 (shared/)

```
src/shared/
├── event-bus.ts          # 事件总线（见 event-bus.md）
├── database.ts           # Prisma 客户端
└── types.ts              # 公共类型
```

注意：全局依赖容器放在 `src/container.ts`，见 [container.md](container.md)。

### Prisma 客户端（单例）

```typescript
// src/shared/database.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" 
      ? ["query", "info", "warn", "error"] 
      : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```


## Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Order {
  id            String      @id @default(uuid())
  userId        String      @map("user_id")
  status        String      @default("pending")
  totalAmount   Decimal     @map("total_amount") @db.Decimal(10, 2)
  paymentMethod String?     @map("payment_method")
  createdAt     DateTime    @default(now()) @map("created_at")
  paidAt        DateTime?   @map("paid_at")
  updatedAt     DateTime    @updatedAt @map("updated_at")
  
  items         OrderItem[]
  user          User        @relation(fields: [userId], references: [id])

  @@map("orders")
}

model OrderItem {
  id          String  @id @default(uuid())
  orderId     String  @map("order_id")
  productId   String  @map("product_id")
  productName String  @map("product_name")
  quantity    Int
  price       Decimal @db.Decimal(10, 2)
  
  order       Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@map("order_items")
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String
  status    String   @default("active")
  points    Int      @default(0)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  orders    Order[]

  @@map("users")
}
```

---

## 领域基础设施 (infra/)

```
src/order/infra/
├── index.ts
├── order-mapper.ts              # 对象映射
├── prisma-order-repository.ts   # 仓储实现
└── prisma-order-query-service.ts # 查询服务实现
```

### 对象映射

```typescript
// src/order/infra/order-mapper.ts
import { Order as PrismaOrder, OrderItem as PrismaOrderItem } from "@prisma/client";
import { Order } from "../domain/order";
import { OrderItem } from "../domain/order-item";
import { Money, OrderStatus } from "../domain/value-objects";

type PrismaOrderWithItems = PrismaOrder & { items: PrismaOrderItem[] };

export class OrderMapper {
  static toDomain(prismaOrder: PrismaOrderWithItems): Order {
    const items = prismaOrder.items.map(
      item => new OrderItem(
        item.productId,
        item.productName,
        item.quantity,
        new Money(Number(item.price))
      )
    );

    return new Order(
      prismaOrder.id,
      prismaOrder.userId,
      items,
      prismaOrder.status as OrderStatus,
      prismaOrder.createdAt
    );
  }
}
```

### 仓储实现

```typescript
// src/order/infra/prisma-order-repository.ts
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { Order } from "../domain/order";
import { OrderRepository } from "../protocols/order-repository";
import { OrderMapper } from "./order-mapper";

export class PrismaOrderRepository implements OrderRepository {
  constructor(private prisma: PrismaClient) {}

  async getById(orderId: string): Promise<Order | null> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true }
    });
    return order ? OrderMapper.toDomain(order) : null;
  }

  async getByUserId(userId: string): Promise<Order[]> {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      include: { items: true },
      orderBy: { createdAt: "desc" }
    });
    return orders.map(OrderMapper.toDomain);
  }

  async getPendingByUser(userId: string): Promise<Order[]> {
    const orders = await this.prisma.order.findMany({
      where: { userId, status: "pending" },
      include: { items: true }
    });
    return orders.map(OrderMapper.toDomain);
  }

  async getPendingByProduct(productId: string): Promise<Order[]> {
    const orders = await this.prisma.order.findMany({
      where: {
        status: "pending",
        items: { some: { productId } }
      },
      include: { items: true }
    });
    return orders.map(OrderMapper.toDomain);
  }

  async save(order: Order): Promise<void> {
    await this.prisma.order.upsert({
      where: { id: order.id },
      create: {
        id: order.id,
        userId: order.userId,
        status: order.status,
        totalAmount: order.totalAmount.value,
        createdAt: order.createdAt,
        items: {
          create: order.items.map(item => ({
            id: randomUUID(),
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            price: item.price.value
          }))
        }
      },
      update: {
        status: order.status,
        totalAmount: order.totalAmount.value
      }
    });
  }

  async delete(order: Order): Promise<void> {
    await this.prisma.order.delete({
      where: { id: order.id }
    });
  }

  async nextId(): Promise<string> {
    return randomUUID();
  }
}
```

### 查询服务实现

```typescript
// src/order/infra/prisma-order-query-service.ts
import { PrismaClient } from "@prisma/client";
import { OrderQueryService } from "../protocols/order-query-service";
import { OrderDTO, OrderListDTO } from "../application/dtos";

export class PrismaOrderQueryService implements OrderQueryService {
  constructor(private prisma: PrismaClient) {}

  async getById(orderId: string): Promise<OrderDTO | null> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true }
    });
    return order ? this.toDTO(order) : null;
  }

  async list(params: {
    page?: number;
    pageSize?: number;
    userId?: string;
    status?: string;
  }): Promise<OrderListDTO> {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where = {
      ...(params.userId && { userId: params.userId }),
      ...(params.status && { status: params.status })
    };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize
      }),
      this.prisma.order.count({ where })
    ]);

    return {
      items: orders.map(this.toDTO),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  async countByStatus(status: string): Promise<number> {
    return this.prisma.order.count({ where: { status } });
  }

  async search(keyword: string, limit = 10): Promise<OrderDTO[]> {
    const orders = await this.prisma.order.findMany({
      where: {
        OR: [
          { id: { contains: keyword } },
          { userId: { contains: keyword } }
        ]
      },
      include: { items: true },
      take: limit
    });
    return orders.map(this.toDTO);
  }

  private toDTO(order: any): OrderDTO {
    return {
      id: order.id,
      userId: order.userId,
      items: order.items.map((item: any) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        price: Number(item.price),
        subtotal: Number(item.price) * item.quantity
      })),
      status: order.status,
      totalAmount: Number(order.totalAmount),
      createdAt: order.createdAt,
      paidAt: order.paidAt
    };
  }
}
```
