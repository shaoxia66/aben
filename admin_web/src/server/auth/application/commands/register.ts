import { z } from "zod";
import type { Container } from "@/server/container";
import { withTransaction } from "@/server/shared/db/pg";
import { createGlobalSession, createTenantSession } from "@/server/auth/infra/redis-sessions";
import { createTenant, createTenantUser, createUser, findUserByEmail, hashPassword } from "@/server/auth/infra/pg-auth";

export class RegisterError extends Error {
  code: "EMAIL_IN_USE" | "TENANT_SLUG_IN_USE";

  constructor(code: RegisterError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "RegisterError";
  }
}

const inputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(255).optional(),
  tenantName: z.string().min(1).max(255)
});

function slugify(value: string) {
  const base = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (base.length >= 3) return base.slice(0, 64);
  return `t-${Math.random().toString(36).slice(2, 10)}`.slice(0, 64);
}

function looksLikeUniqueViolation(err: unknown) {
  if (!err || typeof err !== "object") return false;
  const anyErr = err as { code?: unknown };
  return anyErr.code === "23505";
}

export async function register(container: Container, input: unknown) {
  const parsed = inputSchema.parse(input);

  const created = await withTransaction(async (client) => {
    const existing = await findUserByEmail(client, parsed.email);
    if (existing) throw new RegisterError("EMAIL_IN_USE", "Email already in use");

    const user = await createUser(client, {
      email: parsed.email,
      passwordHash: hashPassword(parsed.password),
      displayName: parsed.displayName ?? null
    });

    const baseSlug = slugify(parsed.tenantName);
    let tenant: { id: string; slug: string };
    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`.slice(0, 64);
      try {
        const createdTenant = await createTenant(client, { slug, name: parsed.tenantName });
        tenant = { id: createdTenant.id, slug: createdTenant.slug };
        break;
      } catch (err) {
        if (!looksLikeUniqueViolation(err)) throw err;
        if (attempt === 4) throw new RegisterError("TENANT_SLUG_IN_USE", "Tenant slug already in use");
      }
    }

    const membership = await createTenantUser(client, {
      tenantId: tenant!.id,
      userId: user.id,
      role: "owner",
      status: "active"
    });

    return {
      userId: user.id,
      tenantId: tenant!.id,
      tenantSlug: tenant!.slug,
      role: membership.role,
      status: membership.status
    };
  });

  const globalSession = await createGlobalSession(created.userId);
  const tenantSession = await createTenantSession({
    userId: created.userId,
    tenantId: created.tenantId,
    role: created.role,
    status: created.status
  });

  await container.eventBus.publish({
    type: "auth.user.registered",
    occurredAtMs: Date.now(),
    payload: {
      userId: created.userId,
      tenantId: created.tenantId
    }
  });

  return {
    userId: created.userId,
    tenantId: created.tenantId,
    tenantSlug: created.tenantSlug,
    globalSession,
    tenantSession
  };
}

