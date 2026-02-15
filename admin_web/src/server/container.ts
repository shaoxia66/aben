import { eventBus } from "@/server/shared/event-bus";
import type { InMemoryEventBus } from "@/server/shared/event-bus";
import { ensureBootstrapped } from "@/server/bootstrap";

export type Container = {
  eventBus: InMemoryEventBus;
};

const container: Container = {
  eventBus
};

export function getContainer() {
  ensureBootstrapped(container);
  return container;
}

