import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_COOKIE_GLOBAL_TOKEN, AUTH_COOKIE_TENANT_TOKEN } from "@/shared/auth-cookies";
import { getJwtConfig } from "@/server/auth/infra/jwt-config";
import { verifyJwtHS256 } from "@/server/auth/infra/jwt";
import { revokeGlobalSession, revokeTenantSession } from "@/server/auth/infra/redis-sessions";

export const runtime = "nodejs";

const globalClaimsSchema = z.object({
  typ: z.literal("global"),
  jti: z.string().min(1)
});

const tenantClaimsSchema = z.object({
  typ: z.literal("tenant"),
  jti: z.string().min(1)
});

function readCookie(cookieHeader: string, name: string) {
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export async function POST(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const globalToken = readCookie(cookieHeader, AUTH_COOKIE_GLOBAL_TOKEN);
  const tenantToken = readCookie(cookieHeader, AUTH_COOKIE_TENANT_TOKEN);

  const jwtConfig = getJwtConfig();

  if (globalToken) {
    const verified = verifyJwtHS256({ secret: jwtConfig.secret, token: globalToken });
    if (verified.ok) {
      const parsed = globalClaimsSchema.safeParse(verified.payload);
      if (parsed.success) {
        await revokeGlobalSession(parsed.data.jti);
      }
    }
  }

  if (tenantToken) {
    const verified = verifyJwtHS256({ secret: jwtConfig.secret, token: tenantToken });
    if (verified.ok) {
      const parsed = tenantClaimsSchema.safeParse(verified.payload);
      if (parsed.success) {
        await revokeTenantSession(parsed.data.jti);
      }
    }
  }

  const response = NextResponse.json({ ok: true });
  const isProd = process.env.NODE_ENV === "production";
  const expires = new Date(0);

  response.cookies.set(AUTH_COOKIE_GLOBAL_TOKEN, "", {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    expires
  });
  response.cookies.set(AUTH_COOKIE_TENANT_TOKEN, "", {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    expires
  });

  return response;
}

