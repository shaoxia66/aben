import type { Container } from "@/server/container";
import { withTransaction } from "@/server/shared/db/pg";
import { listAgentMessagesBySessionId } from "@/server/agent-sessions/infra/pg-agent-sessions";

export async function listAgentMessages(
  container: Container,
  params: { tenantId: string; sessionId: string; limit: number }
) {
  return await withTransaction(async (client) => {
    return await listAgentMessagesBySessionId(client, params);
  });
}

