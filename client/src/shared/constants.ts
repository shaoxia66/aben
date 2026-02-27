export const ENVIRONMENT = {
  IS_DEV: process.env.NODE_ENV === 'development',
}

export const PLATFORM = {
  IS_MAC: process.platform === 'darwin',
  IS_WINDOWS: process.platform === 'win32',
  IS_LINUX: process.platform === 'linux',
}

/** 后端管理端地址，从环境变量 VITE_ADMIN_API_URL 读取 */
export const ADMIN_API_URL: string =
  // biome-ignore lint/suspicious/noExplicitAny: env injection
  (import.meta as any).env?.VITE_ADMIN_API_URL ?? ''
