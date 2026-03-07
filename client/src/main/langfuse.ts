/**
 * langfuse.ts — Langfuse 可观测性集成
 *
 * 通过 @langfuse/langchain 的 CallbackHandler 自动追踪：
 *  - 每次 LLM 调用的 prompt / completion / token 用量
 *  - 工具调用（名称、入参、出参）
 *  - 完整的 agent 执行链路
 *
 * ⚠️  重要：Electron 主进程使用 externalizeDepsPlugin，
 *    @langfuse/langchain 是外部模块，运行时读真实 process.env。
 *    Vite define 只替换我们自己打包的代码里的 process.env.*，
 *    所以这里必须显式将 baked-in 值重新赋给真实 process.env，
 *    才能让外部库读到正确的配置。
 */

import { CallbackHandler } from '@langfuse/langchain'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { LangfuseSpanProcessor } from '@langfuse/otel'

    // ── 在模块加载时立即将环境变量写入真实 process.env ─────────────────
    // Vite define 会将这里的 process.env.LANGFUSE_* 替换为字面量字符串，
    // 然后我们再把它们赋值给真实的 process.env 供外部库读取。
    ; (function ensureLangfuseEnv() {
        const secretKey = process.env.LANGFUSE_SECRET_KEY
        const publicKey = process.env.LANGFUSE_PUBLIC_KEY
        const baseUrl = process.env.LANGFUSE_BASE_URL

        if (secretKey) process.env.LANGFUSE_SECRET_KEY = secretKey
        if (publicKey) process.env.LANGFUSE_PUBLIC_KEY = publicKey
        if (baseUrl) process.env.LANGFUSE_BASE_URL = baseUrl
    })()

/** 判断 Langfuse 是否已配置 */
function isLangfuseConfigured(): boolean {
    return !!(process.env.LANGFUSE_SECRET_KEY && process.env.LANGFUSE_PUBLIC_KEY)
}

// ── OpenTelemetry (Langfuse v4 依赖) 全局单例初始化 ───────────────
let otelSdk: NodeSDK | null = null

export function initLangfuseTelemetry() {
    if (!isLangfuseConfigured() || otelSdk) return

    otelSdk = new NodeSDK({
        // 显式传递空的 instrumentations，同时在处理器上进一步过滤
        instrumentations: [],
        spanProcessors: [
            new LangfuseSpanProcessor({
                shouldExportSpan: ({ otelSpan }) => {
                    return ['langfuse-sdk', 'ai'].includes(otelSpan.instrumentationScope.name)
                }
            })
        ],
    })

    try {
        otelSdk.start()
        console.log('[Langfuse OTEL] OpenTelemetry 追踪器已启动')
    } catch (err) {
        console.error('[Langfuse OTEL] OpenTelemetry 启动失败:', err)
    }
}

/**
 * 为每次对话创建一个 CallbackHandler 实例。
 *
 * 每次用户发送消息时调用，让 Langfuse 能按 sessionId 聚合同一会话的多次追踪。
 *
 * @param sessionId  会话 ID（在 Langfuse 中归组同一会话的调用链路）
 * @param userId     用户标识（可选）
 * @param agentName  agent 名称（作为 tag 标注）
 * @param tenantName 租户名称（作为 tag 标注）
 */
export function createLangfuseHandler(options: {
    sessionId?: string
    userId?: string
    agentName?: string
    tenantName?: string
}): CallbackHandler | null {
    if (!isLangfuseConfigured()) {
        return null
    }

    const tags = ['aben-client', 'deepagent']
    if (options.agentName) tags.push(`agent:${options.agentName}`)
    if (options.tenantName) tags.push(`tenant:${options.tenantName}`)

    try {
        const handler = new CallbackHandler({
            sessionId: options.sessionId,
            userId: options.userId,
            tags,
        })
        return handler
    } catch (err) {
        console.error('[Langfuse] 创建 handler 失败:', err)
        return null
    }
}

/** 打印 Langfuse 配置状态（启动时调用一次即可） */
export function logLangfuseStatus(): void {
    if (isLangfuseConfigured()) {
        const baseUrl = process.env.LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com'
        console.log(`[Langfuse] ✅ 已启用 → ${baseUrl}`)
        console.log(`[Langfuse] Public Key: ${(process.env.LANGFUSE_PUBLIC_KEY ?? '').slice(0, 20)}...`)

        // 启动 OpenTelemetry SDK
        initLangfuseTelemetry()
    } else {
        console.log('[Langfuse] ⏭️ 未配置 LANGFUSE_SECRET_KEY / LANGFUSE_PUBLIC_KEY，跳过可观测性集成')
    }
}
