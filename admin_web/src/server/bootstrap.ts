import type { Container } from "@/server/container";
import { subscribeAuthDomain } from "@/server/auth/application/subscriptions";

export function ensureBootstrapped(container: Container) {
  const flag = Symbol.for("aben.bootstrapped");
  const anyGlobal = globalThis as unknown as Record<string | symbol, unknown>;

  if (anyGlobal[flag] === true) return;

  subscribeAuthDomain(container);

  anyGlobal[flag] = true;
}
