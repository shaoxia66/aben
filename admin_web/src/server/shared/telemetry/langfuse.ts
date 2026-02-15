

/**
 * Langfuse + OpenTelemetry（LangChain 1.x）集成
 *
 * 环境变量（推荐）：
 * - LANGFUSE_SECRET_KEY
 * - LANGFUSE_PUBLIC_KEY
 * - LANGFUSE_BASE_URL
 *
 * 兼容：
 * - LANGFUSE_HOST（会在启动时自动映射到 LANGFUSE_BASE_URL）
 *
 * Next.js（App Router）建议用法：
 * 1) 在 src/instrumentation.ts 的 register() 中（仅 nodejs runtime）调用：
 *    await ensureLangfuseOtelSdkStarted();
 * 2) 在任何 LangChain 调用处传 callbacks：
 *    await chain.invoke(input, { callbacks: [langfuseHandler] })
 *
 * 脚本/队列任务建议用法：
 * - 任务结束后调用 await shutdownLangfuseOtelSdk()，确保 trace flush 出去
 */

import { CallbackHandler } from "@langfuse/langchain";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

const globalForLangfuse = globalThis as typeof globalThis & {
  __langfuseSdkStarted?: boolean;
  __langfuseSdkInstance?: NodeSDK;
  __langfuseSdkHooksInstalled?: boolean;
  __langfuseSdkStartPromise?: Promise<void>;
};

async function ensureLangfuseOtelSdkStarted() {
  if (!process.env.LANGFUSE_BASE_URL && process.env.LANGFUSE_HOST) {
    process.env.LANGFUSE_BASE_URL = process.env.LANGFUSE_HOST;
  }
  if (!process.env.LANGFUSE_BASEURL && process.env.LANGFUSE_BASE_URL) {
    process.env.LANGFUSE_BASEURL = process.env.LANGFUSE_BASE_URL;
  }

  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const baseUrl = process.env.LANGFUSE_BASE_URL;

  if (globalForLangfuse.__langfuseSdkStartPromise) {
    await globalForLangfuse.__langfuseSdkStartPromise;
    return;
  }

  if (secretKey && publicKey && !globalForLangfuse.__langfuseSdkStarted) {
    const sdk = new NodeSDK({
      spanProcessors: [
        new LangfuseSpanProcessor({
          secretKey,
          publicKey,
          ...(baseUrl ? { baseUrl } : {})
        })
      ]
    });

    globalForLangfuse.__langfuseSdkStarted = true;
    globalForLangfuse.__langfuseSdkInstance = sdk;
    globalForLangfuse.__langfuseSdkStartPromise = Promise.resolve(sdk.start());

    if (!globalForLangfuse.__langfuseSdkHooksInstalled) {
      const shutdown = async () => {
        try {
          await sdk.shutdown();
        } catch {
          return;
        }
      };

      process.once('beforeExit', () => {
        void shutdown();
      });
      process.once('SIGINT', () => {
        void shutdown();
      });
      process.once('SIGTERM', () => {
        void shutdown();
      });

      globalForLangfuse.__langfuseSdkHooksInstalled = true;
    }

    await globalForLangfuse.__langfuseSdkStartPromise;
  }
}

/**
 * 对短进程（脚本/Worker）建议在退出前调用，避免 trace 尚未导出进程就结束。
 */
async function shutdownLangfuseOtelSdk() {
  const sdk = globalForLangfuse.__langfuseSdkInstance;
  if (!sdk) return;
  try {
    await sdk.shutdown();
  } catch {
    return;
  }
}

const langfuseHandler = new CallbackHandler();

export { ensureLangfuseOtelSdkStarted, langfuseHandler, shutdownLangfuseOtelSdk };
