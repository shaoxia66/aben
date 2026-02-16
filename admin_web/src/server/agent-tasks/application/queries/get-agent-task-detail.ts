import type { Container } from "@/server/container";
import { withTransaction } from "@/server/shared/db/pg";
import { findAgentTaskById, listAgentTaskEventsByTaskId, listAgentTaskRunsByTaskId } from "@/server/agent-tasks/infra/pg-agent-tasks";

export async function getAgentTaskDetail(
  container: Container,
  params: { tenantId: string; taskId: string }
) {
  return await withTransaction(async (client) => {
    const task = await findAgentTaskById(client, {
      tenantId: params.tenantId,
      taskId: params.taskId
    });
    if (!task) return null;

    const [runs, events] = await Promise.all([
      listAgentTaskRunsByTaskId(client, { tenantId: params.tenantId, taskId: params.taskId, limit: 50 }),
      listAgentTaskEventsByTaskId(client, { tenantId: params.tenantId, taskId: params.taskId, limit: 200 })
    ]);

    return { task, runs, events };
  });
}
