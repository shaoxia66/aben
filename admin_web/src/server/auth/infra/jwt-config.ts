import { z } from "zod";

const envSchema = z.object({
  AUTH_JWT_SECRET: z.string().min(32),
  AUTH_GLOBAL_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  AUTH_TENANT_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(60)
});

export type JwtConfig = {
  secret: string;
  globalTokenTtlSeconds: number;
  tenantTokenTtlSeconds: number;
};

export function getJwtConfig(): JwtConfig {
  const cacheKey = Symbol.for("aben.auth.jwtConfig");
  const anyGlobal = globalThis as unknown as Record<string | symbol, unknown>;
  const cached = anyGlobal[cacheKey] as JwtConfig | undefined;
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid auth env: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join(", ")}`
    );
  }

  const jwtConfig: JwtConfig = {
    secret: parsed.data.AUTH_JWT_SECRET,
    globalTokenTtlSeconds: parsed.data.AUTH_GLOBAL_TOKEN_TTL_DAYS * 24 * 60 * 60,
    tenantTokenTtlSeconds: parsed.data.AUTH_TENANT_TOKEN_TTL_MINUTES * 60
  };

  anyGlobal[cacheKey] = jwtConfig;
  return jwtConfig;
}

