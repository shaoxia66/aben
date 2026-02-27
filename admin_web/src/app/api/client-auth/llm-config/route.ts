import { NextResponse } from "next/server";
import { requireClientAuth } from "@/server/auth/infra/require-client-auth";
import { withTransaction } from "@/server/shared/db/pg";
import { listLlmProviderConfigsByTenantId } from "@/server/llm-config/infra/pg-llm-provider-configs";

export const runtime = "nodejs";

/** 查询租户名 */
async function fetchTenantName(tenantId: string): Promise<string> {
    try {
        const result = await withTransaction(async (client) => {
            return client.query<{ name: string }>(
                "SELECT name FROM tenants WHERE id = $1 LIMIT 1",
                [tenantId]
            );
        });
        return result.rows[0]?.name ?? "";
    } catch {
        return "";
    }
}

/**
 * GET /api/client-auth/llm-config
 *
 * 客户端专用接口：通过 auth_key（即管理端页面中 ck_... 密钥）认证，
 * 返回当前租户所有已启用的 LLM 配置（含明文 api_key、base_url、model_name），
 * 以及 client 名称和租户名称（用于拼接 system prompt）。
 *
 * Authorization: Bearer <auth_key>
 */
export async function GET(request: Request) {
    // 1. 客户端密钥认证
    const auth = await requireClientAuth(request);
    if (!auth.ok) {
        return NextResponse.json(
            { error: { code: auth.error.code, message: auth.error.message } },
            { status: auth.error.status }
        );
    }

    const { tenantId, clientId, clientName, clientDescription, clientType, code } = auth.context;

    // 2. 并行查：LLM 配置 + 租户名
    const [configs, tenantName] = await Promise.all([
        withTransaction(async (client) => listLlmProviderConfigsByTenantId(client, tenantId)),
        fetchTenantName(tenantId),
    ]);

    const enabled = configs.filter((c) => c.status === "enabled");

    if (enabled.length === 0) {
        return NextResponse.json(
            { error: { code: "NO_LLM_CONFIG", message: "当前租户暂无可用的 LLM 配置" } },
            { status: 404 }
        );
    }

    // 3. 排序（default 优先）
    const sorted = [...enabled].sort((a, b) => {
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        return a.provider.localeCompare(b.provider);
    });

    const result = sorted.map((c) => ({
        id: c.id,
        provider: c.provider,
        modelName: c.modelName,
        baseUrl: c.baseUrl,
        apiKey: c.apiKey,
        apiKeyLast4: c.apiKeyLast4,
        isDefault: c.isDefault,
    }));

    return NextResponse.json({
        client: {
            id: clientId,
            code,
            clientType,
            clientName,
            clientDescription: clientDescription ?? null,
        },
        tenant: {
            id: tenantId,
            name: tenantName,     // ← 租户名称
        },
        configs: result,
        defaultConfig: result.find((c) => c.isDefault) ?? result[0] ?? null,
    });
}
