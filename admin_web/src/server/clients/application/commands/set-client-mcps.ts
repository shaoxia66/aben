import { z } from "zod";
import type { Container } from "@/server/container";
import { withTransaction } from "@/server/shared/db/pg";
import {
    setClientMcpsForClient,
    setClientMcpEnabled,
    type PgClientMcp
} from "@/server/clients/infra/pg-client-mcps";

const setMcpsSchema = z.object({
    mcpKeys: z.array(z.string().min(1).max(100)).max(200)
});

const setMcpEnabledSchema = z.object({
    isEnabled: z.boolean()
});

export async function setClientMcps(
    container: Container,
    params: { tenantId: string; userId: string; clientId: string; input: unknown }
): Promise<PgClientMcp[]> {
    const parsed = setMcpsSchema.parse(params.input);
    const distinctMcpKeys = Array.from(new Set(parsed.mcpKeys));

    const rows = await withTransaction(async (client) => {
        return await setClientMcpsForClient(client, {
            tenantId: params.tenantId,
            clientId: params.clientId,
            mcpKeys: distinctMcpKeys
        });
    });

    await container.eventBus.publish({
        type: "clients.client.mcps.set",
        occurredAtMs: Date.now(),
        payload: {
            tenantId: params.tenantId,
            clientId: params.clientId,
            mcpKeys: distinctMcpKeys
        }
    });

    return rows;
}

export async function setClientMcpEnabledCommand(
    container: Container,
    params: { tenantId: string; userId: string; clientId: string; mcpKey: string; input: unknown }
): Promise<PgClientMcp> {
    const parsed = setMcpEnabledSchema.parse(params.input);

    const row = await withTransaction(async (client) => {
        return await setClientMcpEnabled(client, {
            tenantId: params.tenantId,
            clientId: params.clientId,
            mcpKey: params.mcpKey,
            isEnabled: parsed.isEnabled
        });
    });

    await container.eventBus.publish({
        type: "clients.client.mcp.enabled_changed",
        occurredAtMs: Date.now(),
        payload: {
            tenantId: params.tenantId,
            clientId: params.clientId,
            mcpKey: params.mcpKey,
            isEnabled: row.isEnabled
        }
    });

    return row;
}
