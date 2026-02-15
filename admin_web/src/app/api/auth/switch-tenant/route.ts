import { NextResponse } from "next/server";
import { z } from "zod";
import { getContainer } from "@/server/container";
import { AUTH_COOKIE_GLOBAL_TOKEN, AUTH_COOKIE_TENANT_TOKEN } from "@/shared/auth-cookies";
import { getJwtConfig } from "@/server/auth/infra/jwt-config";
import { signJwtHS256, verifyJwtHS256 } from "@/server/auth/infra/jwt";
import { createTenantSession, getGlobalSessionUserId, revokeTenantSession } from "@/server/auth/infra/redis-sessions";
import { withTransaction } from "@/server/shared/db/pg";
import { findActiveMembershipForUserInTenant } from "@/server/auth/infra/pg-auth";

export const runtime = "nodejs";

const inputSchema = z.object({
  tenantId: z.string().min(1)
});

const globalClaimsSchema = z.object({
  typ: z.literal("global"),
  sub: z.string().min(1),
  jti: z.string().min(1),
  iat: z.number(),
  exp: z.number()
});

const tenantClaimsSchema = z.object({
  typ: z.literal("tenant"),
  sub: z.string().min(1),
  tid: z.string().min(1),
  jti: z.string().min(1),
  iat: z.number(),
  exp: z.number()
});

function readCookie(cookieHeader: string, name: string) {
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export async function POST(request: Request) {
  const container = getContainer();

  let body: unknown;
  try {
    const text = await request.text();
    if (!text) {
      return NextResponse.json({ error: { code: "BAD_JSON", message: "Empty request body" } }, { status: 400 });
    }
    const normalized = text.replace(/^\uFEFF/, "");
    body = JSON.parse(normalized);
  } catch (err) {
    const details = process.env.NODE_ENV !== "production" && err instanceof Error ? err.message : undefined;
    return NextResponse.json({ error: { code: "BAD_JSON", message: "Invalid JSON body", details } }, { status: 400 });
  }

  const parsedInput = inputSchema.safeParse(body);
  if (!parsedInput.success) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input" } }, { status: 400 });
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  const globalToken = readCookie(cookieHeader, AUTH_COOKIE_GLOBAL_TOKEN);
  const existingTenantToken = readCookie(cookieHeader, AUTH_COOKIE_TENANT_TOKEN);
  if (!globalToken) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Not signed in" } }, { status: 401 });
  }

  const jwtConfig = getJwtConfig();

  const globalVerified = verifyJwtHS256({ secret: jwtConfig.secret, token: globalToken });
  if (!globalVerified.ok) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Invalid token" } }, { status: 401 });
  }
  const globalParsed = globalClaimsSchema.safeParse(globalVerified.payload);
  if (!globalParsed.success) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Invalid token claims" } }, { status: 401 });
  }

  const allowlistedUserId = await getGlobalSessionUserId(globalParsed.data.jti);
  if (!allowlistedUserId || allowlistedUserId !== globalParsed.data.sub) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Session revoked" } }, { status: 401 });
  }

  let fromTenantId: string | null = null;
  if (existingTenantToken) {
    const verified = verifyJwtHS256({ secret: jwtConfig.secret, token: existingTenantToken });
    if (verified.ok) {
      const parsed = tenantClaimsSchema.safeParse(verified.payload);
      if (parsed.success) {
        fromTenantId = parsed.data.tid;
        await revokeTenantSession(parsed.data.jti);
      }
    }
  }

  const membership = await withTransaction(async (client) => {
    return await findActiveMembershipForUserInTenant(client, {
      userId: globalParsed.data.sub,
      tenantId: parsedInput.data.tenantId
    });
  });

  if (!membership) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "No access to tenant" } }, { status: 403 });
  }

  const tenantSession = await createTenantSession({
    userId: globalParsed.data.sub,
    tenantId: membership.tenantId,
    role: membership.role,
    status: membership.status
  });

  const nowSeconds = Math.floor(Date.now() / 1000);
  const tenantExpSeconds = Math.floor(tenantSession.expiresAtMs / 1000);
  const tenantToken = signJwtHS256({
    secret: jwtConfig.secret,
    payload: {
      typ: "tenant",
      sub: globalParsed.data.sub,
      tid: membership.tenantId,
      jti: tenantSession.jti,
      iat: nowSeconds,
      exp: tenantExpSeconds
    }
  });

  await container.eventBus.publish({
    type: "auth.user.tenant_switched",
    occurredAtMs: Date.now(),
    payload: {
      userId: globalParsed.data.sub,
      fromTenantId,
      toTenantId: membership.tenantId
    }
  });

  const response = NextResponse.json({
    tenant: {
      id: membership.tenantId,
      slug: membership.tenantSlug,
      name: membership.tenantName,
      role: membership.role,
      status: membership.status
    }
  });

  const isProd = process.env.NODE_ENV === "production";
  response.cookies.set(AUTH_COOKIE_TENANT_TOKEN, tenantToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    expires: new Date(tenantSession.expiresAtMs)
  });

  return response;
}

