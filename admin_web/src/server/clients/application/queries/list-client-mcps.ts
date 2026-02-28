import { withTransaction } from "@/server/shared/db/pg";
import {
    listClientMcpsByTenantId,
    type PgClientMcpWithName
} from "@/server/clients/infra/pg-client-mcps";

export type ClientMcpBinding = PgClientMcpWithName;

export async function listClientMcps(params: {
    tenantId: string;
}): Promise<ClientMcpBinding[]> {
    return await withTransaction(async (client) => {
        return await listClientMcpsByTenantId(client, params.tenantId);
    });
}
