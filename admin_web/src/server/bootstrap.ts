import type { Container } from "@/server/container";
import { subscribeAuthDomain } from "@/server/auth/application/subscriptions";
import { startMqttServerWorker } from "@/server/mqtt-worker";

export function ensureBootstrapped(container: Container) {
  const flag = Symbol.for("aben.bootstrapped");
  const anyGlobal = globalThis as unknown as Record<string | symbol, unknown>;

  if (anyGlobal[flag] === true) return;

  subscribeAuthDomain(container);

  // 启动后台 MQTT 监听器 (监听心跳更新 DB)
  startMqttServerWorker();

  anyGlobal[flag] = true;
}
