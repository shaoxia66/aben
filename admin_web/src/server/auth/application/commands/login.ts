import { z } from "zod";
import type { Container } from "@/server/container";
import { withTransaction } from "@/server/shared/db/pg";
import { createGlobalSession, createTenantSession } from "@/server/auth/infra/redis-sessions";
import { findFirstActiveMembershipForUser, findUserAuthByEmail, verifyPassword } from "@/server/auth/infra/pg-auth";

export class LoginError extends Error {
  code: "INVALID_CREDENTIALS" | "USER_DISABLED" | "NO_TENANT";

  constructor(code: LoginError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "LoginError";
  }
}

const inputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export async function login(container: Container, input: unknown) {
  const parsed = inputSchema.parse(input);

  const found = await withTransaction(async (client) => {
    const user = await findUserAuthByEmail(client, parsed.email);
    if (!user) throw new LoginError("INVALID_CREDENTIALS", "Invalid email or password");
    if (user.isDisabled) throw new LoginError("USER_DISABLED", "User is disabled");
    if (!verifyPassword(parsed.password, user.passwordHash)) {
      throw new LoginError("INVALID_CREDENTIALS", "Invalid email or password");
    }

    const membership = await findFirstActiveMembershipForUser(client, user.id);
    if (!membership) throw new LoginError("NO_TENANT", "No active tenant membership");

    return {
      userId: user.id,
      tenantId: membership.tenantId,
      tenantSlug: membership.tenantSlug,
      role: membership.role,
      status: membership.status
    };
  });

  const globalSession = await createGlobalSession(found.userId);
  const tenantSession = await createTenantSession({
    userId: found.userId,
    tenantId: found.tenantId,
    role: found.role,
    status: found.status
  });

  await container.eventBus.publish({
    type: "auth.user.logged_in",
    occurredAtMs: Date.now(),
    payload: {
      userId: found.userId,
      tenantId: found.tenantId
    }
  });

  return {
    userId: found.userId,
    tenantId: found.tenantId,
    tenantSlug: found.tenantSlug,
    globalSession,
    tenantSession
  };
}

