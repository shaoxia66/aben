import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { Container } from "@/server/container";
import type { PgClient } from "@/server/clients/infra/pg-clients";
import { rotateClientAuthKey } from "@/server/clients/infra/pg-clients";
import { withTransaction } from "@/server/shared/db/pg";

export class RotateClientKeyError extends Error {
  code: "NOT_FOUND" | "CLIENT_KEY_IN_USE";

  constructor(code: RotateClientKeyError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "RotateClientKeyError";
  }
}

const inputSchema = z.object({}).strict();

function looksLikeUniqueViolation(err: unknown) {
  if (!err || typeof err !== "object") return false;
  const anyErr = err as { code?: unknown };
  return anyErr.code === "23505";
}

function generateAuthKey() {
  const desiredLength = 128;
  const ts = Date.now().toString(36).padStart(10, "0");
  const head = `ck1_${ts}_`;
  const remaining = desiredLength - head.length;
  const random = randomBytes(Math.ceil((remaining * 3) / 4) + 4).toString("base64url");
  return head + random.slice(0, remaining);
}

export async function rotateClientKey(
  container: Container,
  params: { tenantId: string; userId: string; clientId: string; input: unknown }
): Promise<PgClient> {
  inputSchema.parse(params.input);

  for (let attempt = 0; attempt < 5; attempt++) {
    const authKey = generateAuthKey();
    try {
      const updated = await withTransaction(async (client) => {
        return await rotateClientAuthKey(client, {
          tenantId: params.tenantId,
          clientId: params.clientId,
          authKey,
          updatedBy: params.userId
        });
      });

      if (!updated) throw new RotateClientKeyError("NOT_FOUND", "客户端不存在");

      await container.eventBus.publish({
        type: "clients.client.key_rotated",
        occurredAtMs: Date.now(),
        payload: { tenantId: params.tenantId, clientId: updated.id }
      });

      return updated;
    } catch (err) {
      if (!looksLikeUniqueViolation(err)) throw err;
      if (attempt === 4) throw new RotateClientKeyError("CLIENT_KEY_IN_USE", "客户端 key 生成失败，请重试");
    }
  }

  throw new RotateClientKeyError("CLIENT_KEY_IN_USE", "客户端 key 生成失败，请重试");
}
