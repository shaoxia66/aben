import { z } from "zod";
import type { Container } from "@/server/container";
import { withTransaction } from "@/server/shared/db/pg";
import { listEnabledClientIdsByTenantId } from "@/server/clients/infra/pg-clients";
import { createAgentSessionRow } from "@/server/agent-sessions/infra/pg-agent-sessions";

const inputSchema = z.object({
  title: z.string().trim().max(255).nullable().optional()
});

export class CreateAgentSessionError extends Error {
  readonly code: "NO_ENABLED_CLIENTS";

  constructor(code: CreateAgentSessionError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

export async function createAgentSession(
  container: Container,
  params: { tenantId: string; input: unknown }
) {
  const parsed = inputSchema.safeParse(params.input);
  if (!parsed.success) {
    throw parsed.error;
  }

  const session = await withTransaction(async (client) => {
    const clientIds = await listEnabledClientIdsByTenantId(client, params.tenantId);
    if (clientIds.length === 0) {
      throw new CreateAgentSessionError("NO_ENABLED_CLIENTS", "当前租户没有启用的客户端");
    }

    return await createAgentSessionRow(client, {
      tenantId: params.tenantId,
      clientIds,
      title: parsed.data.title ?? null
    });
  });

  await container.eventBus.publish({
    type: "agent_sessions.session_created",
    occurredAtMs: Date.now(),
    payload: {
      tenantId: session.tenantId,
      sessionId: session.id,
      clientIds: session.clientIds
    }
  });

  return session;
}

