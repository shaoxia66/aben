import { withTransaction } from "@/server/shared/db/pg";
import { findClientByAuthKey, touchClientAuthKeyLastUsedAt } from "@/server/clients/infra/pg-clients";

export type ClientAuthContext = {
    clientId: string;
    tenantId: string;
    clientType: string;
    code: string;
    clientName: string;
    clientDescription: string | null;
    status: "enabled" | "disabled" | "archived";
};

export type ClientAuthFailure = {
    status: number;
    code: "UNAUTHENTICATED" | "FORBIDDEN";
    message: string;
};

/**
 * 通过 Authorization: Bearer <auth_key> 认证客户端。
 * 成功后异步更新 auth_key_last_used_at（不阻塞响应）。
 */
export async function requireClientAuth(
    request: Request
): Promise<{ ok: true; context: ClientAuthContext } | { ok: false; error: ClientAuthFailure }> {
    const authHeader = request.headers.get("authorization") ?? "";
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match || !match[1]) {
        return {
            ok: false,
            error: { status: 401, code: "UNAUTHENTICATED", message: "Missing or invalid Authorization header" }
        };
    }

    const authKey = match[1].trim();
    if (!authKey) {
        return {
            ok: false,
            error: { status: 401, code: "UNAUTHENTICATED", message: "Empty auth key" }
        };
    }

    const found = await withTransaction(async (client) => {
        return await findClientByAuthKey(client, authKey);
    });

    if (!found) {
        return {
            ok: false,
            error: { status: 401, code: "UNAUTHENTICATED", message: "Invalid auth key" }
        };
    }

    if (found.status !== "enabled") {
        return {
            ok: false,
            error: { status: 403, code: "FORBIDDEN", message: "Client is disabled or archived" }
        };
    }

    // 异步更新最近使用时间，不阻塞主响应
    void withTransaction(async (client) => {
        await touchClientAuthKeyLastUsedAt(client, found.id);
    }).catch(() => {/* 忽略更新失败，不影响主流程 */ });

    return {
        ok: true,
        context: {
            clientId: found.id,
            tenantId: found.tenantId,
            clientType: found.clientType,
            code: found.code,
            clientName: found.name,
            clientDescription: found.description,
            status: found.status
        }
    };
}
