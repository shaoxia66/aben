import { z } from "zod";
import type { Container } from "@/server/container";
import { withTransaction } from "@/server/shared/db/pg";
import { findUserAuthById, hashPassword, updateUserPasswordHash, verifyPassword } from "@/server/auth/infra/pg-auth";
import { revokeAllGlobalSessionsForUser } from "@/server/auth/infra/redis-sessions";

export class ChangePasswordError extends Error {
  code: "INVALID_CURRENT_PASSWORD" | "USER_DISABLED" | "USER_NOT_FOUND";

  constructor(code: ChangePasswordError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "ChangePasswordError";
  }
}

const inputSchema = z.object({
  userId: z.string().min(1),
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8)
});

export async function changePassword(container: Container, input: unknown) {
  const parsed = inputSchema.parse(input);

  await withTransaction(async (client) => {
    const user = await findUserAuthById(client, parsed.userId);
    if (!user) throw new ChangePasswordError("USER_NOT_FOUND", "User not found");
    if (user.isDisabled) throw new ChangePasswordError("USER_DISABLED", "User is disabled");

    const ok = verifyPassword(parsed.currentPassword, user.passwordHash);
    if (!ok) throw new ChangePasswordError("INVALID_CURRENT_PASSWORD", "Invalid current password");

    const nextHash = hashPassword(parsed.newPassword);
    await updateUserPasswordHash(client, { userId: user.id, passwordHash: nextHash });
  });

  await revokeAllGlobalSessionsForUser(parsed.userId);

  await container.eventBus.publish({
    type: "auth.user.password_changed",
    occurredAtMs: Date.now(),
    payload: {
      userId: parsed.userId
    }
  });

  return { ok: true };
}

