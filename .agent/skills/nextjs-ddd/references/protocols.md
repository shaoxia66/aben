# 协议层设计 (protocols/)

协议层定义接口，实现依赖倒置。使用 TypeScript Interface 或 Type。

## 目录结构

```
src/order/protocols/
├── index.ts
├── order-repository.ts       # 仓储接口
├── order-query-service.ts    # 查询服务接口
└── payment-gateway.ts        # 外部服务接口
```

## 仓储协议

```typescript
// src/order/protocols/order-repository.ts
import { Order } from "../domain/order";

export interface OrderRepository {
  /**
   * 根据 ID 获取订单
   */
  getById(orderId: string): Promise<Order | null>;

  /**
   * 根据用户 ID 获取订单列表
   */
  getByUserId(userId: string): Promise<Order[]>;

  /**
   * 获取用户待支付订单
   */
  getPendingByUser(userId: string): Promise<Order[]>;

  /**
   * 获取包含指定商品的待支付订单
   */
  getPendingByProduct(productId: string): Promise<Order[]>;

  /**
   * 保存订单（新增或更新）
   */
  save(order: Order): Promise<void>;

  /**
   * 删除订单
   */
  delete(order: Order): Promise<void>;

  /**
   * 生成下一个 ID
   */
  nextId(): Promise<string>;
}
```

## 查询服务协议

```typescript
// src/order/protocols/order-query-service.ts
import { OrderDTO, OrderListDTO } from "../application/dtos";

export interface OrderQueryService {
  /**
   * 根据 ID 查询
   */
  getById(orderId: string): Promise<OrderDTO | null>;

  /**
   * 分页查询
   */
  list(params: {
    page?: number;
    pageSize?: number;
    userId?: string;
    status?: string;
  }): Promise<OrderListDTO>;

  /**
   * 统计
   */
  countByStatus(status: string): Promise<number>;

  /**
   * 搜索
   */
  search(keyword: string, limit?: number): Promise<OrderDTO[]>;
}
```

## 外部服务协议

```typescript
// src/order/protocols/payment-gateway.ts

export interface PaymentResult {
  success: boolean;
  transactionId: string;
  message: string;
}

export interface PaymentGateway {
  /**
   * 支付
   */
  charge(params: {
    amount: number;
    currency: string;
    paymentMethod: string;
    orderId: string;
    metadata?: Record<string, any>;
  }): Promise<PaymentResult>;

  /**
   * 退款
   */
  refund(params: {
    transactionId: string;
    amount: number;
    reason?: string;
  }): Promise<PaymentResult>;

  /**
   * 查询交易状态
   */
  getTransaction(transactionId: string): Promise<PaymentResult | null>;
}
```

```typescript
// src/notification/protocols/email-service.ts

export interface EmailService {
  send(params: {
    to: string;
    subject: string;
    body: string;
    html?: string;
    attachments?: Array<{ filename: string; content: Buffer }>;
  }): Promise<boolean>;

  sendTemplate(params: {
    to: string;
    templateId: string;
    variables: Record<string, any>;
  }): Promise<boolean>;
}
```

```typescript
// src/notification/protocols/sms-service.ts

export interface SmsService {
  send(phone: string, message: string): Promise<boolean>;
  
  sendVerificationCode(phone: string, code: string): Promise<boolean>;
}
```

```typescript
// src/user/protocols/password-service.ts

export interface PasswordService {
  hash(password: string): Promise<string>;
  
  verify(plain: string, hashed: string): Promise<boolean>;
}
```

## 仓储 vs 查询服务

| 对比 | Repository | QueryService |
|------|------------|--------------|
| 用途 | 写操作 | 读操作 |
| 返回 | 领域实体 | DTO |
| 关注 | 聚合完整性 | 查询性能 |
| 场景 | 业务逻辑 | 列表/搜索/统计 |

```typescript
// 仓储：返回领域实体，用于业务操作
const order = await orderRepository.getById(orderId);
order.pay(method);
await orderRepository.save(order);

// 查询服务：返回 DTO，用于展示
const orderDTO = await orderQueryService.getById(orderId);
res.json(orderDTO);
```

## 导出

```typescript
// src/order/protocols/index.ts
export * from "./order-repository";
export * from "./order-query-service";
export * from "./payment-gateway";
```
