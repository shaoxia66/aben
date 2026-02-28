import { withTransaction } from "@/server/shared/db/pg";
import { listClientsByTenantId } from "@/server/clients/infra/pg-clients";
import { getEmqxOnlineClients } from "@/server/shared/infra/emqx-api";

export async function listClients(params: { tenantId: string }) {
  const [dbClients, onlineClientIds] = await Promise.all([
    withTransaction(async (client) => {
      return await listClientsByTenantId(client, params.tenantId);
    }),
    getEmqxOnlineClients(),
  ]);

  const onlineSet = new Set(onlineClientIds);

  return dbClients.map((client) => {
    const isOnline = onlineSet.has(client.code) || onlineSet.has(client.id);
    return {
      ...client,
      runStatus: isOnline ? "running" : "offline",
    };
  });
}

