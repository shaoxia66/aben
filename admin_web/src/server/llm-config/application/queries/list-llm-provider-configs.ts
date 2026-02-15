import { withTransaction } from "@/server/shared/db/pg";
import { listLlmProviderConfigsByTenantId } from "@/server/llm-config/infra/pg-llm-provider-configs";

export async function listLlmProviderConfigs(params: { tenantId: string }) {
  return await withTransaction(async (client) => {
    return await listLlmProviderConfigsByTenantId(client, params.tenantId);
  });
}

