import type { Container } from "@/server/container";
import { withTransaction } from "@/server/shared/db/pg";
import { deleteLlmProviderConfigById } from "@/server/llm-config/infra/pg-llm-provider-configs";

export class DeleteLlmProviderConfigError extends Error {
  code: "NOT_FOUND";

  constructor(code: DeleteLlmProviderConfigError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "DeleteLlmProviderConfigError";
  }
}

export async function deleteLlmProviderConfig(
  container: Container,
  params: { tenantId: string; userId: string; configId: string }
) {
  const deleted = await withTransaction(async (client) => {
    return await deleteLlmProviderConfigById(client, {
      tenantId: params.tenantId,
      configId: params.configId
    });
  });

  if (!deleted) {
    throw new DeleteLlmProviderConfigError("NOT_FOUND", "配置不存在或已被删除");
  }

  await container.eventBus.publish({
    type: "llm.provider_config.deleted",
    occurredAtMs: Date.now(),
    payload: {
      tenantId: params.tenantId,
      userId: params.userId,
      configId: deleted.id,
      provider: deleted.provider,
      wasDefault: deleted.isDefault
    }
  });

  return deleted;
}

