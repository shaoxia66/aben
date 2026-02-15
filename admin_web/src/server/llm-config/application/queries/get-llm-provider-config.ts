import { withTransaction } from "@/server/shared/db/pg";
import {
  findDefaultLlmProviderConfigByTenantId,
  findLlmProviderConfigByTenantIdAndProvider
} from "@/server/llm-config/infra/pg-llm-provider-configs";

export async function getLlmProviderConfig(params: { tenantId: string; provider: string }) {
  return await withTransaction(async (client) => {
    return await findLlmProviderConfigByTenantIdAndProvider(client, params);
  });
}

export async function getTenantDefaultLlmProviderConfig(params: { tenantId: string }) {
  return await withTransaction(async (client) => {
    return await findDefaultLlmProviderConfigByTenantId(client, params);
  });
}
