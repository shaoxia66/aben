import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_GLOBAL_TOKEN } from '@/shared/auth-cookies';

function base64UrlToUint8Array(input: string) {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
  const normalized = base64 + pad;
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeJsonPart(part: string) {
  const bytes = base64UrlToUint8Array(part);
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text) as unknown;
}

async function verifyHs256Jwt(token: string, secret: string) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerPart, payloadPart, signaturePart] = parts;
  if (!headerPart || !payloadPart || !signaturePart) return null;

  const header = decodeJsonPart(headerPart) as any;
  if (!header || header.alg !== 'HS256' || header.typ !== 'JWT') return null;

  const payload = decodeJsonPart(payloadPart) as any;
  if (!payload || payload.typ !== 'global') return null;
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) return null;
  if (typeof payload.exp !== 'number') return null;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (payload.exp <= nowSeconds) return null;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signature = base64UrlToUint8Array(signaturePart);
  const data = new TextEncoder().encode(`${headerPart}.${payloadPart}`);
  const ok = await crypto.subtle.verify('HMAC', key, signature, data);
  if (!ok) return null;

  return payload as { sub: string; exp: number; typ: 'global' };
}

export default async function middleware(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE_GLOBAL_TOKEN)?.value;
  const secret = process.env.AUTH_JWT_SECRET;

  if (!token || !secret) {
    const url = req.nextUrl.clone();
    url.pathname = '/auth/sign-in';
    url.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  try {
    const payload = await verifyHs256Jwt(token, secret);
    if (!payload) {
      const url = req.nextUrl.clone();
      url.pathname = '/auth/sign-in';
      url.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search);
      return NextResponse.redirect(url);
    }
  } catch {
    const url = req.nextUrl.clone();
    url.pathname = '/auth/sign-in';
    url.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
}
export const config = {
  matcher: ['/dashboard/:path*']
};
