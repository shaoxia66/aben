import { withTransaction } from "@/server/shared/db/pg";
import { listClientsByTenantId } from "@/server/clients/infra/pg-clients";

export async function listClients(params: { tenantId: string }) {
  return await withTransaction(async (client) => {
    return await listClientsByTenantId(client, params.tenantId);
  });
}

