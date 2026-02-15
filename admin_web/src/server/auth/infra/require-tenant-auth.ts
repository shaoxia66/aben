import { z } from "zod";
import { AUTH_COOKIE_GLOBAL_TOKEN, AUTH_COOKIE_TENANT_TOKEN } from "@/shared/auth-cookies";
import { getJwtConfig } from "@/server/auth/infra/jwt-config";
import { verifyJwtHS256 } from "@/server/auth/infra/jwt";
import { getGlobalSessionUserId, getTenantSession } from "@/server/auth/infra/redis-sessions";

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

export type TenantAuthContext = {
  userId: string;
  tenantId: string;
};

export type TenantAuthFailure = {
  status: number;
  code: "UNAUTHENTICATED";
  message: string;
};

export async function requireTenantAuth(
  request: Request
): Promise<{ ok: true; context: TenantAuthContext } | { ok: false; error: TenantAuthFailure }> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const globalToken = readCookie(cookieHeader, AUTH_COOKIE_GLOBAL_TOKEN);
  const tenantToken = readCookie(cookieHeader, AUTH_COOKIE_TENANT_TOKEN);

  if (!globalToken || !tenantToken) {
    return { ok: false, error: { status: 401, code: "UNAUTHENTICATED", message: "Not signed in" } };
  }

  const jwtConfig = getJwtConfig();

  const globalVerified = verifyJwtHS256({ secret: jwtConfig.secret, token: globalToken });
  if (!globalVerified.ok) {
    return { ok: false, error: { status: 401, code: "UNAUTHENTICATED", message: "Invalid token" } };
  }

  const globalParsed = globalClaimsSchema.safeParse(globalVerified.payload);
  if (!globalParsed.success) {
    return { ok: false, error: { status: 401, code: "UNAUTHENTICATED", message: "Invalid token claims" } };
  }

  const allowlistedUserId = await getGlobalSessionUserId(globalParsed.data.jti);
  if (!allowlistedUserId || allowlistedUserId !== globalParsed.data.sub) {
    return { ok: false, error: { status: 401, code: "UNAUTHENTICATED", message: "Session revoked" } };
  }

  const tenantVerified = verifyJwtHS256({ secret: jwtConfig.secret, token: tenantToken });
  if (!tenantVerified.ok) {
    return { ok: false, error: { status: 401, code: "UNAUTHENTICATED", message: "Invalid token" } };
  }

  const tenantParsed = tenantClaimsSchema.safeParse(tenantVerified.payload);
  if (!tenantParsed.success) {
    return { ok: false, error: { status: 401, code: "UNAUTHENTICATED", message: "Invalid token claims" } };
  }

  if (tenantParsed.data.sub !== globalParsed.data.sub) {
    return { ok: false, error: { status: 401, code: "UNAUTHENTICATED", message: "Invalid session" } };
  }

  const tenantSession = await getTenantSession(tenantParsed.data.jti);
  if (
    !tenantSession ||
    tenantSession.userId !== tenantParsed.data.sub ||
    tenantSession.tenantId !== tenantParsed.data.tid
  ) {
    return { ok: false, error: { status: 401, code: "UNAUTHENTICATED", message: "Session revoked" } };
  }

  return {
    ok: true,
    context: { userId: tenantParsed.data.sub, tenantId: tenantParsed.data.tid }
  };
}

