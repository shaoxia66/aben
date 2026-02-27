# 事件总线 (EventBus)

事件总线通过**容器注入**，而非全局单例，便于测试和替换。

## 核心原则

| 原则 | 说明 |
|------|------|
| 显式依赖 | 通过构造函数/容器注入 |
| 可测试 | 测试时可替换为 mock |
| 单例可选 | 生产环境用单例，测试用独立实例 |

## 事件总线实现

```typescript
// src/shared/event-bus.ts
import { EventEmitter } from "events";
import { randomUUID } from "crypto";

// ==================== 类型定义 ====================

export interface DomainEvent {
  readonly eventId: string;
  readonly occurredAt: Date;
}

export abstract class BaseDomainEvent implements DomainEvent {
  readonly eventId: string;
  readonly occurredAt: Date;

  constructor() {
    this.eventId = randomUUID();
    this.occurredAt = new Date();
  }
}

type EventHandler<T extends DomainEvent> = (event: T) => Promise<void>;
type EventClass<T extends DomainEvent> = new (...args: any[]) => T;

interface PublishOptions {
  parallel?: boolean;
  retries?: number;
  timeout?: number;
}

// ==================== 事件总线 ====================

export class EventBus {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  /**
   * 订阅事件
   */
  subscribe<T extends DomainEvent>(
    eventClass: EventClass<T>,
    handler: EventHandler<T>
  ): () => void {
    const eventName = eventClass.name;
    this.emitter.on(eventName, handler);
    console.log(`[EventBus] 订阅: ${eventName}`);

    return () => {
      this.emitter.off(eventName, handler);
    };
  }

  /**
   * 发布事件
   */
  async publish<T extends DomainEvent>(
    event: T,
    options: PublishOptions = {}
  ): Promise<void> {
    const { parallel = false, retries = 1, timeout = 30000 } = options;
    const eventName = event.constructor.name;
    const handlers = this.emitter.listeners(eventName) as EventHandler<T>[];

    console.log(`[EventBus] 发布: ${eventName}, 处理器: ${handlers.length}`);

    if (handlers.length === 0) return;

    const executeHandler = async (handler: EventHandler<T>): Promise<void> => {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          await Promise.race([
            handler(event),
            this.timeoutPromise(timeout)
          ]);
          return;
        } catch (error) {
          console.error(
            `[EventBus] 处理失败 (${attempt}/${retries}): ${eventName}`,
            error
          );
          if (attempt < retries) {
            await this.sleep(1000 * attempt);
          }
        }
      }
    };

    if (parallel) {
      await Promise.allSettled(handlers.map(executeHandler));
    } else {
      for (const handler of handlers) {
        await executeHandler(handler);
      }
    }
  }

  /**
   * 批量发布
   */
  async publishAll(
    events: readonly DomainEvent[],
    options?: PublishOptions
  ): Promise<void> {
    for (const event of events) {
      await this.publish(event, options);
    }
  }

  /**
   * 清空订阅（测试用）
   */
  clear(): void {
    this.emitter.removeAllListeners();
  }

  private timeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`超时 ${ms}ms`)), ms)
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ==================== 工厂函数 ====================

// 单例（内部使用）
let _eventBus: EventBus | undefined;

/**
 * 获取事件总线单例（通过容器注入使用）
 */
export function getEventBus(): EventBus {
  if (!_eventBus) {
    _eventBus = new EventBus();
  }
  return _eventBus;
}

/**
 * 重置事件总线（测试用）
 */
export function resetEventBus(): void {
  if (_eventBus) {
    _eventBus.clear();
  }
  _eventBus = undefined;
}

/**
 * 创建新的事件总线实例（测试用）
 */
export function createEventBus(): EventBus {
  return new EventBus();
}
```

## 与 Express 版本的区别

| 对比 | Express | Next.js |
|------|---------|---------|
| 初始化时机 | app.ts 启动时 | 首次 getContainer() 时 |
| 单例保证 | 模块单例 | globalThis 单例 |
| 热更新 | 需重启 | 自动保持实例 |

事件注册和容器使用见 [container.md](container.md)。
