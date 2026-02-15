import type { Container } from "@/server/container";
import { withTransaction } from "@/server/shared/db/pg";
import { listAgentSessionsByTenantId } from "@/server/agent-sessions/infra/pg-agent-sessions";

export async function listAgentSessions(container: Container, params: { tenantId: string }) {
  return await withTransaction(async (client) => {
    return await listAgentSessionsByTenantId(client, params.tenantId);
  });
}

