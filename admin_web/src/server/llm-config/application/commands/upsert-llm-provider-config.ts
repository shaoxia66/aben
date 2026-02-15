import { z } from "zod";
import type { Container } from "@/server/container";
import { withTransaction } from "@/server/shared/db/pg";
import type { PgLlmProviderConfig } from "@/server/llm-config/infra/pg-llm-provider-configs";
import {
  clearDefaultLlmProviderConfigs,
  saveLlmProviderConfig as saveRow,
  setDefaultLlmProviderConfigById
} from "@/server/llm-config/infra/pg-llm-provider-configs";

export class UpsertLlmProviderConfigError extends Error {
  code: "VALIDATION_ERROR";

  constructor(code: UpsertLlmProviderConfigError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "UpsertLlmProviderConfigError";
  }
}

const providerSchema = z.enum(["openai", "anthropic", "deepseek", "qwen", "azure_openai", "custom"]);

const inputSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  provider: providerSchema,
  name: z.string().trim().max(255).optional().nullable(),
  baseUrl: z.string().trim().max(2000).optional().nullable(),
  defaultModel: z.string().trim().max(100).optional().nullable(),
  isDefault: z.boolean().optional(),
  status: z.enum(["enabled", "disabled"]).optional(),
  apiKey: z.string().optional().nullable()
});

function normalizeOptionalText(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed ? trimmed : null;
}

function normalizeBaseUrl(v: unknown): string | null {
  const t = normalizeOptionalText(v);
  if (!t) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function last4(apiKey: string | null) {
  if (!apiKey) return null;
  const t = apiKey.trim();
  if (t.length < 4) return null;
  return t.slice(-4);
}

export async function upsertLlmProviderConfig(
  container: Container,
  params: { tenantId: string; userId: string; input: unknown }
): Promise<PgLlmProviderConfig> {
  const raw = params.input && typeof params.input === "object" ? (params.input as Record<string, unknown>) : null;

  const parsed = inputSchema.safeParse(params.input);
  if (!parsed.success) {
    throw new UpsertLlmProviderConfigError("VALIDATION_ERROR", "Invalid input");
  }

  const provider = parsed.data.provider.trim();
  const id = typeof parsed.data.id === "string" && parsed.data.id.trim() ? parsed.data.id.trim() : null;
  const name = normalizeOptionalText(parsed.data.name);
  const baseUrlInput = normalizeOptionalText(parsed.data.baseUrl);
  const baseUrl = normalizeBaseUrl(baseUrlInput);
  if (baseUrlInput && !baseUrl) {
    throw new UpsertLlmProviderConfigError("VALIDATION_ERROR", "Base URL 无效");
  }
  const defaultModel = normalizeOptionalText(parsed.data.defaultModel);
  const status: PgLlmProviderConfig["status"] = parsed.data.status ?? "enabled";

  const shouldUpdateApiKey = !!raw && Object.prototype.hasOwnProperty.call(raw, "apiKey");
  const apiKeyNormalized = shouldUpdateApiKey ? normalizeOptionalText(parsed.data.apiKey) : null;
  const apiKeyLast4 = shouldUpdateApiKey ? last4(apiKeyNormalized) : null;

  const shouldUpdateIsDefault = !!raw && Object.prototype.hasOwnProperty.call(raw, "isDefault");
  const isDefault = parsed.data.isDefault === true;

  const saved = await withTransaction(async (client) => {
    const applyInlineIsDefault = shouldUpdateIsDefault && !isDefault;

    const row = await saveRow(client, {
      id,
      tenantId: params.tenantId,
      provider,
      name,
      baseUrl,
      defaultModel,
      shouldUpdateIsDefault: applyInlineIsDefault,
      isDefault: false,
      status,
      shouldUpdateApiKey,
      apiKey: apiKeyNormalized,
      apiKeyLast4,
      userId: params.userId
    });

    if (shouldUpdateIsDefault && isDefault) {
      await clearDefaultLlmProviderConfigs(client, { tenantId: params.tenantId });
      const updated = await setDefaultLlmProviderConfigById(client, { tenantId: params.tenantId, configId: row.id });
      return updated ?? row;
    }

    return row;
  });

  await container.eventBus.publish({
    type: "llm.provider_config.upserted",
    occurredAtMs: Date.now(),
    payload: { tenantId: params.tenantId, provider: saved.provider, status: saved.status }
  });

  return saved;
}
