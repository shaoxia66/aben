import * as Sentry from '@sentry/nextjs';
const sentryOptions: Sentry.NodeOptions | Sentry.EdgeOptions = {
  // Sentry DSN
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Enable Spotlight in development
  spotlight: process.env.NODE_ENV === 'development',

  // Adds request headers and IP for users, for more info visit
  sendDefaultPii: true,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false
};

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { ensureLangfuseOtelSdkStarted } = await import(
      '@/server/shared/telemetry/langfuse'
    );
    await ensureLangfuseOtelSdkStarted();

    if (!process.env.NEXT_PUBLIC_SENTRY_DISABLED) {
      Sentry.init(sentryOptions);
    }
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    if (!process.env.NEXT_PUBLIC_SENTRY_DISABLED) {
      Sentry.init(sentryOptions);
    }
  }
}

export const onRequestError = Sentry.captureRequestError;
