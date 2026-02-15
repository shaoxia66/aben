import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_COOKIE_GLOBAL_TOKEN, AUTH_COOKIE_TENANT_TOKEN } from "@/shared/auth-cookies";
import { getJwtConfig } from "@/server/auth/infra/jwt-config";
import { verifyJwtHS256 } from "@/server/auth/infra/jwt";
import { getGlobalSessionUserId } from "@/server/auth/infra/redis-sessions";
import { getContainer } from "@/server/container";
import { changePassword, ChangePasswordError } from "@/server/auth/application/commands/change-password";

export const runtime = "nodejs";

const globalClaimsSchema = z.object({
  typ: z.literal("global"),
  sub: z.string().min(1),
  jti: z.string().min(1),
  iat: z.number(),
  exp: z.number()
});

const inputSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8)
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

  if (!globalToken) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Not signed in" } },
      { status: 401 }
    );
  }

  const jwtConfig = getJwtConfig();
  const verified = verifyJwtHS256({ secret: jwtConfig.secret, token: globalToken });
  if (!verified.ok) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Invalid token" } },
      { status: 401 }
    );
  }

  const parsed = globalClaimsSchema.safeParse(verified.payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Invalid token claims" } },
      { status: 401 }
    );
  }

  const allowlistedUserId = await getGlobalSessionUserId(parsed.data.jti);
  if (!allowlistedUserId || allowlistedUserId !== parsed.data.sub) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Session revoked" } },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsedInput = inputSchema.safeParse(body);
  if (!parsedInput.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input" } },
      { status: 400 }
    );
  }

  try {
    const container = getContainer();
    await changePassword(container, {
      userId: parsed.data.sub,
      currentPassword: parsedInput.data.currentPassword,
      newPassword: parsedInput.data.newPassword
    });

    const response = NextResponse.json({ ok: true, signedOut: true });
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
  } catch (err) {
    if (err instanceof ChangePasswordError) {
      const status =
        err.code === "INVALID_CURRENT_PASSWORD" ? 400 : err.code === "USER_DISABLED" ? 403 : 401;
      const message =
        err.code === "INVALID_CURRENT_PASSWORD"
          ? "当前密码不正确"
          : err.code === "USER_DISABLED"
            ? "用户已被禁用"
            : "用户不存在";
      return NextResponse.json({ error: { code: err.code, message } }, { status });
    }

    if (err && typeof err === "object" && "issues" in (err as any)) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid input" } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Internal error" } },
      { status: 500 }
    );
  }
}

