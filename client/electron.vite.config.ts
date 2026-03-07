import { defineConfig, externalizeDepsPlugin, loadEnv } from 'electron-vite'
import { codeInspectorPlugin } from 'code-inspector-plugin'
import { resolve, normalize, dirname } from 'node:path'
import tailwindcss from '@tailwindcss/vite'

import injectProcessEnvPlugin from 'rollup-plugin-inject-process-env'
import tsconfigPathsPlugin from 'vite-tsconfig-paths'
import reactPlugin from '@vitejs/plugin-react'

import { settings } from './src/lib/electron-router-dom'
import { main, resources } from './package.json'

const [nodeModules, devFolder] = normalize(dirname(main)).split(/\/|\\/g)
const devPath = [nodeModules, devFolder].join('/')

const tsconfigPaths = tsconfigPathsPlugin({
  projects: [resolve('tsconfig.json')],
})

export default defineConfig(({ mode }) => {
  // 使用第三个参数 '' 能够加载 .env 中的所有变量（不限于 VITE_ 开头）
  const env = loadEnv(mode, process.cwd(), '')
  const adminApiUrl = env.VITE_ADMIN_API_URL ?? ''

  // Langfuse 变量（无 VITE_ 前缀，通过 define 注入主进程）
  const langfuseSecretKey = env.LANGFUSE_SECRET_KEY ?? process.env.LANGFUSE_SECRET_KEY ?? ''
  const langfusePublicKey = env.LANGFUSE_PUBLIC_KEY ?? process.env.LANGFUSE_PUBLIC_KEY ?? ''
  const langfuseBaseUrl = env.LANGFUSE_BASE_URL ?? process.env.LANGFUSE_BASE_URL ?? ''

  console.log('[DEBUG-VITE-CONFIG] SecKey:', !!langfuseSecretKey, 'PubKey:', !!langfusePublicKey)

  // 把关键环境变量写回 process.env，这样 Electron 子进程可以直接继承读到
  if (adminApiUrl) {
    process.env.VITE_ADMIN_API_URL = adminApiUrl
  }

  return {
    main: {
      mode: 'es2022',
      plugins: [tsconfigPaths, externalizeDepsPlugin()],

      define: {
        'import.meta.env.VITE_ADMIN_API_URL': JSON.stringify(adminApiUrl),
        'process.env.VITE_ADMIN_API_URL': JSON.stringify(adminApiUrl),
        // Langfuse 追踪配置（注入主进程 process.env）
        'process.env.LANGFUSE_SECRET_KEY': JSON.stringify(langfuseSecretKey),
        'process.env.LANGFUSE_PUBLIC_KEY': JSON.stringify(langfusePublicKey),
        'process.env.LANGFUSE_BASE_URL': JSON.stringify(langfuseBaseUrl),
      },

      build: {
        rollupOptions: {
          input: {
            index: resolve('src/main/index.ts'),
          },

          output: {
            dir: resolve(devPath, 'main'),
            format: 'es',
          },
        },
      },
    },

    preload: {
      mode: 'es2022',
      plugins: [tsconfigPaths, externalizeDepsPlugin()],

      build: {
        rollupOptions: {
          output: {
            dir: resolve(devPath, 'preload'),
          },
        },
      },
    },

    renderer: {
      define: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
        'process.platform': JSON.stringify(process.platform),
        'import.meta.env.VITE_ADMIN_API_URL': JSON.stringify(adminApiUrl),
      },

      server: {
        port: settings.port,
      },

      plugins: [
        tsconfigPaths,
        tailwindcss(),
        codeInspectorPlugin({
          bundler: 'vite',
          hotKeys: ['altKey'],
          hideConsole: true,
        }),
        reactPlugin(),
      ],

      publicDir: resolve(resources, 'public'),

      build: {
        outDir: resolve(devPath, 'renderer'),

        rollupOptions: {
          plugins: [
            injectProcessEnvPlugin({
              NODE_ENV: 'production',
              platform: process.platform,
            }),
          ],

          input: {
            index: resolve('src/renderer/index.html'),
          },

          output: {
            dir: resolve(devPath, 'renderer'),
          },
        },
      },
    },
  }
})
