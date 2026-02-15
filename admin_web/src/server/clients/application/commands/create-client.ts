import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { Container } from "@/server/container";
import { withTransaction } from "@/server/shared/db/pg";
import type { PgClient } from "@/server/clients/infra/pg-clients";
import { createClientRow } from "@/server/clients/infra/pg-clients";

export class CreateClientError extends Error {
  code: "CLIENT_CODE_IN_USE" | "CLIENT_KEY_IN_USE";

  constructor(code: CreateClientError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "CreateClientError";
  }
}

const inputSchema = z.object({
  clientType: z.string().min(1).max(50),
  code: z.string().min(1).max(64).optional(),
  name: z.string().min(1).max(255),
  description: z.string().max(5000).nullable().optional(),
  status: z.enum(["enabled", "disabled", "archived"]).optional(),
  version: z.string().max(50).nullable().optional(),
  platform: z.string().max(50).nullable().optional(),
  config: z.unknown().optional(),
  capabilities: z.unknown().optional()
});

function looksLikeUniqueViolation(err: unknown) {
  if (!err || typeof err !== "object") return false;
  const anyErr = err as { code?: unknown };
  return anyErr.code === "23505";
}

function getUniqueConstraintName(err: unknown) {
  if (!err || typeof err !== "object") return null;
  const anyErr = err as { constraint?: unknown; message?: unknown };
  if (typeof anyErr.constraint === "string" && anyErr.constraint) return anyErr.constraint;
  if (typeof anyErr.message === "string") {
    if (anyErr.message.includes("idx_clients_tenant_code")) return "idx_clients_tenant_code";
    if (anyErr.message.includes("idx_clients_tenant_auth_key")) return "idx_clients_tenant_auth_key";
  }
  return null;
}

function generateAuthKey() {
  const desiredLength = 128;
  const ts = Date.now().toString(36).padStart(10, "0");
  const head = `ck1_${ts}_`;
  const remaining = desiredLength - head.length;
  const random = randomBytes(Math.ceil((remaining * 3) / 4) + 4).toString("base64url");
  return head + random.slice(0, remaining);
}

function generateClientCode(clientType: string) {
  const suffix = randomBytes(4).toString("hex");
  const code = `${clientType}-${suffix}`;
  return code.length > 64 ? code.slice(0, 64) : code;
}

export async function createClient(
  container: Container,
  params: { tenantId: string; userId: string; input: unknown }
): Promise<PgClient> {
  const parsed = inputSchema.parse(params.input);
  const status = parsed.status ?? "enabled";
  const description = typeof parsed.description === "string" ? parsed.description : null;
  const version = typeof parsed.version === "string" ? parsed.version : null;
  const platform = typeof parsed.platform === "string" ? parsed.platform : null;
  const providedCode = typeof parsed.code === "string" ? parsed.code : null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const authKey = generateAuthKey();
    const code = providedCode ?? generateClientCode(parsed.clientType);
    try {
      const created = await withTransaction(async (client) => {
        return await createClientRow(client, {
          tenantId: params.tenantId,
          clientType: parsed.clientType,
          code,
          name: parsed.name,
          description,
          authKey,
          status,
          version,
          platform,
          config: parsed.config ?? {},
          capabilities: parsed.capabilities ?? {},
          createdBy: params.userId
        });
      });

      await container.eventBus.publish({
        type: "clients.client.created",
        occurredAtMs: Date.now(),
        payload: { tenantId: params.tenantId, clientId: created.id, clientType: created.clientType }
      });

      return created;
    } catch (err) {
      if (!looksLikeUniqueViolation(err)) throw err;
      const constraint = getUniqueConstraintName(err);
      if (constraint === "idx_clients_tenant_code") {
        if (providedCode) throw new CreateClientError("CLIENT_CODE_IN_USE", "客户端 code 已存在");
        continue;
      }
      if (constraint === "idx_clients_tenant_auth_key") {
        if (attempt === 4) throw new CreateClientError("CLIENT_KEY_IN_USE", "客户端 key 生成失败，请重试");
        continue;
      }
      throw new CreateClientError("CLIENT_CODE_IN_USE", "客户端创建失败（唯一约束冲突）");
    }
  }

  throw new CreateClientError("CLIENT_KEY_IN_USE", "客户端 key 生成失败，请重试");
}
