import { z } from "zod";
import type { Container } from "@/server/container";
import type { PgClient } from "@/server/clients/infra/pg-clients";
import { updateClientRowPatch } from "@/server/clients/infra/pg-clients";
import { withTransaction } from "@/server/shared/db/pg";

export class UpdateClientError extends Error {
  code: "NOT_FOUND";

  constructor(code: UpdateClientError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "UpdateClientError";
  }
}

const inputSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).nullable().optional(),
  status: z.enum(["enabled", "disabled", "archived"]).optional(),
  version: z.string().max(50).nullable().optional(),
  platform: z.string().max(50).nullable().optional(),
  config: z.unknown().optional(),
  capabilities: z.unknown().optional()
}).refine(
  (v) => {
    return (
      "name" in v ||
      "description" in v ||
      "status" in v ||
      "version" in v ||
      "platform" in v ||
      "config" in v ||
      "capabilities" in v
    );
  },
  { message: "No fields to update" }
);

export async function updateClient(
  container: Container,
  params: { tenantId: string; userId: string; clientId: string; input: unknown }
): Promise<PgClient> {
  const parsed = inputSchema.parse(params.input);
  const patch: Record<string, unknown> = {};
  if ("name" in parsed) patch.name = parsed.name;
  if ("description" in parsed) patch.description = parsed.description ?? null;
  if ("status" in parsed) patch.status = parsed.status;
  if ("version" in parsed) patch.version = parsed.version ?? null;
  if ("platform" in parsed) patch.platform = parsed.platform ?? null;
  if ("config" in parsed) patch.config = parsed.config ?? {};
  if ("capabilities" in parsed) patch.capabilities = parsed.capabilities ?? {};

  const updated = await withTransaction(async (client) => {
    return await updateClientRowPatch(client, {
      tenantId: params.tenantId,
      clientId: params.clientId,
      patch: patch as any,
      updatedBy: params.userId
    });
  });

  if (!updated) throw new UpdateClientError("NOT_FOUND", "客户端不存在");

  await container.eventBus.publish({
    type: "clients.client.updated",
    occurredAtMs: Date.now(),
    payload: { tenantId: params.tenantId, clientId: updated.id, status: updated.status }
  });

  return updated;
}
