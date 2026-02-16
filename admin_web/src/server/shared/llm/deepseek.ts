import { ChatDeepSeek } from "@langchain/deepseek";
import {
  getLlmProviderConfig,
  getTenantDefaultLlmProviderConfig
} from "@/server/llm-config/application/queries/get-llm-provider-config";

export type DeepSeekRuntimeConfig = {
  apiKey: string;
  baseUrl: string | null;
  model: string;
};

export async function getDeepSeekRuntimeConfig(params: { tenantId: string }): Promise<DeepSeekRuntimeConfig | null> {
  const defaultCfg = await getTenantDefaultLlmProviderConfig({ tenantId: params.tenantId });
  if (defaultCfg && defaultCfg.provider === "deepseek" && defaultCfg.status === "enabled" && defaultCfg.apiKey?.trim()) {
    return {
      apiKey: defaultCfg.apiKey,
      baseUrl: defaultCfg.baseUrl?.trim() ? defaultCfg.baseUrl.trim() : null,
      model: defaultCfg.modelName?.trim() ? defaultCfg.modelName.trim() : "deepseek-chat"
    };
  }

  const cfg = await getLlmProviderConfig({ tenantId: params.tenantId, provider: "deepseek" });
  if (cfg && cfg.status === "enabled" && cfg.apiKey?.trim()) {
    return {
      apiKey: cfg.apiKey,
      baseUrl: cfg.baseUrl?.trim() ? cfg.baseUrl.trim() : null,
      model: cfg.modelName?.trim() ? cfg.modelName.trim() : "deepseek-chat"
    };
  }

  const envApiKey = process.env.DEEPSEEK_API_KEY;
  if (envApiKey && envApiKey.trim()) {
    return {
      apiKey: envApiKey,
      baseUrl: null,
      model: process.env.DEEPSEEK_MODEL_NAME ?? "deepseek-chat"
    };
  }

  return null;
}

export async function getTenantDeepSeekChatModel(params: { tenantId: string }) {
  const cfg = await getDeepSeekRuntimeConfig({ tenantId: params.tenantId });
  if (!cfg) {
    throw new Error("未配置 DeepSeek API Key");
  }

  return new ChatDeepSeek({
    apiKey: cfg.apiKey,
    model: cfg.model,
    temperature: 0.5,
    configuration: cfg.baseUrl ? { baseURL: cfg.baseUrl } : undefined
  });
}

export const model = new ChatDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY,
  model: process.env.DEEPSEEK_MODEL_NAME ?? "deepseek-chat",
  temperature: 0.5
});
