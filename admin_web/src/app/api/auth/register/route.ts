import { NextResponse } from "next/server";
import { getContainer } from "@/server/container";
import { register, RegisterError } from "@/server/auth/application/commands/register";
import { getJwtConfig } from "@/server/auth/infra/jwt-config";
import { signJwtHS256 } from "@/server/auth/infra/jwt";
import { AUTH_COOKIE_GLOBAL_TOKEN, AUTH_COOKIE_TENANT_TOKEN } from "@/shared/auth-cookies";

export const runtime = "nodejs";

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

  try {
    const result = await register(container, body);
    const jwtConfig = getJwtConfig();

    const nowSeconds = Math.floor(Date.now() / 1000);
    const globalExpSeconds = Math.floor(result.globalSession.expiresAtMs / 1000);
    const tenantExpSeconds = Math.floor(result.tenantSession.expiresAtMs / 1000);

    const globalToken = signJwtHS256({
      secret: jwtConfig.secret,
      payload: {
        typ: "global",
        sub: result.userId,
        jti: result.globalSession.jti,
        iat: nowSeconds,
        exp: globalExpSeconds
      }
    });

    const tenantToken = signJwtHS256({
      secret: jwtConfig.secret,
      payload: {
        typ: "tenant",
        sub: result.userId,
        tid: result.tenantId,
        jti: result.tenantSession.jti,
        iat: nowSeconds,
        exp: tenantExpSeconds
      }
    });

    const response = NextResponse.json({
      userId: result.userId,
      tenantId: result.tenantId,
      tenantSlug: result.tenantSlug,
      tokens: {
        global: { token: globalToken, expiresAtMs: result.globalSession.expiresAtMs },
        tenant: { token: tenantToken, expiresAtMs: result.tenantSession.expiresAtMs }
      }
    });

    const isProd = process.env.NODE_ENV === "production";
    response.cookies.set(AUTH_COOKIE_GLOBAL_TOKEN, globalToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      expires: new Date(result.globalSession.expiresAtMs)
    });
    response.cookies.set(AUTH_COOKIE_TENANT_TOKEN, tenantToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      expires: new Date(result.tenantSession.expiresAtMs)
    });

    return response;
  } catch (err) {
    if (err instanceof RegisterError) {
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: 409 });
    }

    if (err && typeof err === "object" && "issues" in (err as any)) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input" } }, { status: 400 });
    }

    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Internal error" } }, { status: 500 });
  }
}
