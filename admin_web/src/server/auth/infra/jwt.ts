import { createHmac, timingSafeEqual } from "node:crypto";

function base64UrlEncode(input: string | Buffer) {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecodeToBuffer(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, "base64");
}

export type JwtHeader = {
  alg: "HS256";
  typ: "JWT";
};

export type JwtStandardClaims = {
  sub: string;
  jti: string;
  iat: number;
  exp: number;
};

export type GlobalTokenClaims = JwtStandardClaims & {
  typ: "global";
};

export type TenantTokenClaims = JwtStandardClaims & {
  typ: "tenant";
  tid: string;
};

export function signJwtHS256(params: { secret: string; payload: Record<string, unknown> }) {
  const header: JwtHeader = { alg: "HS256", typ: "JWT" };
  const headerPart = base64UrlEncode(JSON.stringify(header));
  const payloadPart = base64UrlEncode(JSON.stringify(params.payload));
  const signingInput = `${headerPart}.${payloadPart}`;
  const sig = createHmac("sha256", params.secret).update(signingInput).digest();
  const signaturePart = base64UrlEncode(sig);
  return `${signingInput}.${signaturePart}`;
}

export function verifyJwtHS256(params: { secret: string; token: string }) {
  const parts = params.token.split(".");
  if (parts.length !== 3) return { ok: false as const, reason: "format" as const };

  const [headerPart, payloadPart, signaturePart] = parts;
  if (!headerPart || !payloadPart || !signaturePart) return { ok: false as const, reason: "format" as const };

  let header: unknown;
  let payload: unknown;
  try {
    header = JSON.parse(base64UrlDecodeToBuffer(headerPart).toString("utf8"));
    payload = JSON.parse(base64UrlDecodeToBuffer(payloadPart).toString("utf8"));
  } catch {
    return { ok: false as const, reason: "json" as const };
  }

  const h = header as Partial<JwtHeader>;
  if (h.alg !== "HS256" || h.typ !== "JWT") return { ok: false as const, reason: "header" as const };

  const signingInput = `${headerPart}.${payloadPart}`;
  const expectedSig = createHmac("sha256", params.secret).update(signingInput).digest();
  const actualSig = base64UrlDecodeToBuffer(signaturePart);

  if (actualSig.length !== expectedSig.length) return { ok: false as const, reason: "signature" as const };
  if (!timingSafeEqual(actualSig, expectedSig)) return { ok: false as const, reason: "signature" as const };

  return { ok: true as const, payload };
}

