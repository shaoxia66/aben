import type { Container } from "@/server/container";
import { withTransaction } from "@/server/shared/db/pg";
import { listAgentTasksByTenantId } from "@/server/agent-tasks/infra/pg-agent-tasks";

export async function listAgentTasks(
  container: Container,
  params: {
    tenantId: string;
    sessionId?: string;
    lifecycle?: "open" | "blocked" | "canceled" | "closed";
    status?: "pending" | "running" | "succeeded" | "failed";
    limit: number;
  }
) {
  return await withTransaction(async (client) => {
    return await listAgentTasksByTenantId(client, {
      tenantId: params.tenantId,
      sessionId: params.sessionId,
      lifecycle: params.lifecycle,
      status: params.status,
      limit: params.limit
    });
  });
}
