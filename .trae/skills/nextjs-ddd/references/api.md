# API 层设计 (app/)

Next.js App Router 使用文件系统路由，API 层包括 API Routes 和 Server Actions。

## 目录结构

```
src/app/
├── api/                       # API Routes
│   ├── orders/
│   │   ├── route.ts           # GET, POST /api/orders
│   │   └── [id]/
│   │       ├── route.ts       # GET, PUT, DELETE /api/orders/:id
│   │       └── pay/
│   │           └── route.ts   # POST /api/orders/:id/pay
│   └── users/
│       ├── route.ts
│       └── [id]/
│           └── route.ts
├── actions/                   # Server Actions
│   ├── order-actions.ts
│   └── user-actions.ts
├── middleware.ts              # 全局中间件
└── error.tsx                  # 错误边界
```

## API Routes

### 订单列表 + 创建

```typescript
// src/app/api/orders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getContainer } from "@/container";
import { createOrderSchema } from "@/lib/validations/order";
import { handleApiError } from "@/lib/api-utils";

// GET /api/orders
export async function GET(request: NextRequest) {
  try {
    const container = getContainer();
    const { searchParams } = new URL(request.url);

    const result = await container.listOrdersHandler.handle({
      page: Number(searchParams.get("page")) || 1,
      pageSize: Number(searchParams.get("pageSize")) || 20,
      userId: searchParams.get("userId") || undefined,
      status: searchParams.get("status") || undefined
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/orders
export async function POST(request: NextRequest) {
  try {
    const container = getContainer();
    const body = await request.json();

    // 验证
    const validated = createOrderSchema.parse(body);

    const result = await container.createOrderHandler.handle(validated);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
```

### 订单详情

```typescript
// src/app/api/orders/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getContainer } from "@/container";
import { handleApiError } from "@/lib/api-utils";

interface Params {
  params: { id: string };
}

// GET /api/orders/:id
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const container = getContainer();

    const result = await container.getOrderHandler.handle({
      orderId: params.id
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/orders/:id
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const container = getContainer();

    await container.cancelOrderHandler.handle({
      orderId: params.id,
      reason: "用户取消"
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
```

### 订单支付

```typescript
// src/app/api/orders/[id]/pay/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getContainer } from "@/container";
import { payOrderSchema } from "@/lib/validations/order";
import { handleApiError } from "@/lib/api-utils";

interface Params {
  params: { id: string };
}

// POST /api/orders/:id/pay
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const container = getContainer();
    const body = await request.json();

    const validated = payOrderSchema.parse(body);

    const result = await container.payOrderHandler.handle({
      orderId: params.id,
      paymentMethod: validated.paymentMethod
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
```

---

## Server Actions

```typescript
// src/app/actions/order-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { getContainer } from "@/container";
import { createOrderSchema, payOrderSchema } from "@/lib/validations/order";

export async function createOrder(formData: FormData) {
  const container = getContainer();

  const data = {
    userId: formData.get("userId") as string,
    items: JSON.parse(formData.get("items") as string)
  };

  const validated = createOrderSchema.parse(data);
  const result = await container.createOrderHandler.handle(validated);

  revalidatePath("/orders");
  return result;
}

export async function payOrder(orderId: string, paymentMethod: string) {
  const container = getContainer();

  const validated = payOrderSchema.parse({ paymentMethod });
  const result = await container.payOrderHandler.handle({
    orderId,
    paymentMethod: validated.paymentMethod
  });

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  return result;
}

export async function cancelOrder(orderId: string, reason: string) {
  const container = getContainer();

  await container.cancelOrderHandler.handle({ orderId, reason });

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  return { success: true };
}

export async function getOrders(params: {
  page?: number;
  pageSize?: number;
  status?: string;
}) {
  const container = getContainer();
  return container.listOrdersHandler.handle(params);
}
```

---

## 请求验证 (Zod)

```typescript
// src/lib/validations/order.ts
import { z } from "zod";

export const createOrderSchema = z.object({
  userId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    productName: z.string().min(1),
    quantity: z.number().int().positive(),
    price: z.number().positive()
  })).min(1)
});

export const payOrderSchema = z.object({
  paymentMethod: z.enum(["alipay", "wechat", "card"])
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type PayOrderInput = z.infer<typeof payOrderSchema>;
```

---

## 错误处理

```typescript
// src/lib/api-utils.ts
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { OrderDomainError, OrderNotFoundError } from "@/order/domain/exceptions";
import { UserDomainError, UserNotFoundError } from "@/user/domain/exceptions";

export function handleApiError(error: unknown): NextResponse {
  console.error("[API Error]", error);

  // Zod 验证错误
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "validation_error",
        message: "请求参数验证失败",
        details: error.errors
      },
      { status: 400 }
    );
  }

  // 未找到错误
  if (error instanceof OrderNotFoundError || error instanceof UserNotFoundError) {
    return NextResponse.json(
      { error: error.name, message: error.message },
      { status: 404 }
    );
  }

  // 领域错误
  if (error instanceof OrderDomainError || error instanceof UserDomainError) {
    return NextResponse.json(
      { error: error.name, message: error.message },
      { status: 400 }
    );
  }

  // 未知错误
  return NextResponse.json(
    {
      error: "internal_error",
      message: process.env.NODE_ENV === "production"
        ? "服务器内部错误"
        : (error as Error).message
    },
    { status: 500 }
  );
}
```

---

## 中间件

```typescript
// src/middleware.ts
import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const start = Date.now();

  // 日志
  const response = NextResponse.next();
  
  console.log(
    `${request.method} ${request.nextUrl.pathname} ${Date.now() - start}ms`
  );

  return response;
}

export const config = {
  matcher: "/api/:path*"
};
```

---

## 认证中间件

```typescript
// src/middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  // 跳过公开路由
  if (
    request.nextUrl.pathname.startsWith("/api/auth") ||
    request.nextUrl.pathname === "/api/health"
  ) {
    return NextResponse.next();
  }

  // 验证 token
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "unauthorized", message: "缺少认证令牌" },
      { status: 401 }
    );
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token);

  if (!payload) {
    return NextResponse.json(
      { error: "unauthorized", message: "无效的认证令牌" },
      { status: 401 }
    );
  }

  // 将用户信息添加到 header
  const response = NextResponse.next();
  response.headers.set("x-user-id", payload.userId);
  return response;
}

export const config = {
  matcher: "/api/:path*"
};
```

---

## 前端调用示例

### 使用 API Routes

```typescript
// 客户端组件
"use client";

async function handlePayOrder(orderId: string) {
  const res = await fetch(`/api/orders/${orderId}/pay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paymentMethod: "alipay" })
  });
  
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message);
  }
  
  return res.json();
}
```

### 使用 Server Actions

```typescript
// 客户端组件
"use client";

import { payOrder } from "@/app/actions/order-actions";

function PayButton({ orderId }: { orderId: string }) {
  const handleClick = async () => {
    const result = await payOrder(orderId, "alipay");
    console.log(result);
  };

  return <button onClick={handleClick}>支付</button>;
}
```

```typescript
// 表单提交
"use client";

import { createOrder } from "@/app/actions/order-actions";

function OrderForm() {
  return (
    <form action={createOrder}>
      <input name="userId" type="hidden" value="user-id" />
      <input name="items" type="hidden" value={JSON.stringify(items)} />
      <button type="submit">创建订单</button>
    </form>
  );
}
```
