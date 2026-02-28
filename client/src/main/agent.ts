/**
 * agent.ts - Deep Agent 核心
 *
 * 使用 LangChain deepagents + DeepSeek（通过 OpenAI 兼容接口）
 * 支持 streaming，通过 IPC 实时推送 token 给聊天窗口
 */
import { app, ipcMain, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import { ChatOpenAI } from '@langchain/openai'
import { createDeepAgent, LocalShellBackend } from 'deepagents'
import { initMcpTools } from './tools/mcp'

// ── 读取本地密钥 ──────────────────────────────────────────────────
function readLocalAuthKey(): string {
    try {
        const file = join(app.getPath('userData'), 'aben-key.json')
        if (!existsSync(file)) return ''
        const data = JSON.parse(readFileSync(file, 'utf-8'))
        return typeof data.key === 'string' ? data.key : ''
    } catch {
        return ''
    }
}

// ── LLM 配置缓存 ──────────────────────────────────────────────────
type LlmConfig = {
    provider: string
    modelName: string | null
    baseUrl: string | null
    apiKey: string | null
    isDefault: boolean
}

type AgentIdentity = {
    clientName: string
    clientType: string
    clientDescription: string | null
    tenantName: string
}

// ── 发送请求拉取后台 llm-config.json ──────────────────────────────
let cachedLlmConfig: LlmConfig | null = null
let cachedIdentity: AgentIdentity | null = null
let cachedMcpConfigs: Record<string, any> | null = null

async function fetchLlmConfig(): Promise<{ llm: LlmConfig; identity: AgentIdentity; mcps: Record<string, any> } | null> {
    // 优先返回内存缓存
    if (cachedLlmConfig && cachedIdentity && cachedMcpConfigs) {
        return { llm: cachedLlmConfig, identity: cachedIdentity, mcps: cachedMcpConfigs }
    }

    const authKey = readLocalAuthKey()
    const adminUrl = 'http://localhost:3000'

    if (!authKey || !adminUrl) return null

    try {
        const { net } = await import('electron')
        const res = await net.fetch(`${adminUrl}/api/client-auth/llm-config`, {
            headers: { Authorization: `Bearer ${authKey}` },
        })
        if (!res.ok) return null

        const json = await res.json() as {
            defaultConfig?: LlmConfig
            client?: { clientName?: string; clientType?: string; clientDescription?: string | null }
            tenant?: { name?: string }
            mcps?: { mcpKey: string; config: Record<string, unknown> }[]
        }

        if (json.defaultConfig) {
            cachedLlmConfig = json.defaultConfig as LlmConfig
            cachedIdentity = {
                clientName: json.client?.clientName ?? '',
                clientType: json.client?.clientType ?? '',
                clientDescription: json.client?.clientDescription ?? null,
                tenantName: json.tenant?.name ?? '',
            }

            const mcpsRecord: Record<string, any> = {}
            if (Array.isArray(json.mcps)) {
                json.mcps.forEach(mcp => {
                    mcpsRecord[mcp.mcpKey] = mcp.config
                })
            }
            cachedMcpConfigs = mcpsRecord
        }

        return cachedLlmConfig && cachedIdentity && cachedMcpConfigs
            ? { llm: cachedLlmConfig, identity: cachedIdentity, mcps: cachedMcpConfigs }
            : null
    } catch (err) {
        console.error('[Agent] 获取 LLM 配置失败:', err)
        return null
    }
}

/** 清空缓存（密钥更新时调用） */
export function clearAgentLlmCache() {
    cachedLlmConfig = null
    cachedIdentity = null
    cachedMcpConfigs = null
}

// ── 缓存 agent 实例与 LLM 配置 ──────────────────────────────────────
type DeepAgent = ReturnType<typeof createDeepAgent>
let agentInstance: DeepAgent | null = null

export async function getOrCreateAgent(): Promise<{ agent: NonNullable<typeof agentInstance> } | { error: string }> {
    // 复用之前的 Agent 实例，避免重复创建（包含重复加载 backend 导致多次依赖下载问题）
    if (agentInstance) return { agent: agentInstance }

    const result = await fetchLlmConfig()
    if (!result) {
        return { error: '未获取到 LLM 配置，请在设置中填写有效的客户端密钥' }
    }
    const { llm: llmConfig, identity, mcps } = result
    if (!llmConfig.apiKey) {
        return {
            error: 'LLM 配置中缺少 API Key'
        }
    }

    // DeepSeek 兼容 OpenAI 接口
    const llm = new ChatOpenAI({
        model: llmConfig.modelName ?? 'deepseek-chat',
        apiKey: llmConfig.apiKey,
        configuration: {
            baseURL: llmConfig.baseUrl ?? 'https://api.deepseek.com/v1',
        },
        temperature: 0.7,
        streaming: true,
    })

    // 用 clientName / tenantName / description 构建个性化 system prompt
    const agentName = identity.clientName || 'Aben'
    const tenantLabel = identity.tenantName ? `（来自 ${identity.tenantName}）` : ''
    const typeStr = identity.clientType ? `，设备类型：${identity.clientType}` : ''
    const descriptionLine = identity.clientDescription
        ? `\n\n关于你自己：${identity.clientDescription}`
        : ''

    const systemPrompt = `你是 ${agentName}${tenantLabel}，一个运行在用户桌面的智能助手。${descriptionLine}`

    // LocalShellBackend：完整本地 Shell 权限
    // - rootDir 作为 shell 命令的默认工作目录（用户主目录）
    // - virtualMode: false → 不限制路径，可访问系统任意位置
    // - inheritEnv: true → 继承 PATH、HOME 等系统环境变量
    const homeDir = app.getPath('home')
    const backend = new LocalShellBackend({
        rootDir: homeDir,
        virtualMode: false,
        inheritEnv: true,
    })

    const tools = await initMcpTools(mcps)

    agentInstance = createDeepAgent({
        model: llm,
        systemPrompt,
        backend,
        tools
    })

    console.log(`[Agent] 初始化完成 | 名称: ${agentName} | 租户: ${identity.tenantName} | provider: ${llmConfig.provider} | model: ${llmConfig.modelName} | backend: LocalShellBackend(${homeDir})`)
    return { agent: agentInstance }
}

// ── 独立执行 Agent 逻辑 (供 IPC 和 MQTT 调用) ───────────────────────────────────
export async function runDeepAgent(
    message: string,
    callbacks?: {
        onChunk?: (chunk: string) => void
        onDone?: () => void
        onError?: (err: string) => void
        onToolStart?: (name: string, input: unknown) => void
        onToolEnd?: (name: string, output: unknown) => void
    }
) {
    const result = await getOrCreateAgent()
    if ('error' in result) {
        callbacks?.onError?.(result.error)
        return
    }

    const agent = result.agent

    try {
        console.log('[Agent] 收到指令:', message.slice(0, 60))

        // @ts-ignore - Bypass deepagents strict tuple type checking 
        const eventStream = agent!.streamEvents(
            { messages: [{ role: 'user', content: message }] } as any,
            { version: 'v2' }
        )

        for await (const event of eventStream) {
            // LLM token 流
            if (
                event.event === 'on_chat_model_stream' &&
                event.data?.chunk?.content
            ) {
                const content = event.data.chunk.content
                if (typeof content === 'string' && content) {
                    callbacks?.onChunk?.(content)
                } else if (Array.isArray(content)) {
                    for (const part of content) {
                        if (part?.type === 'text' && part.text) {
                            callbacks?.onChunk?.(part.text)
                        }
                    }
                }
            }

            // 工具开始调用
            if (event.event === 'on_tool_start') {
                const toolName = event.name ?? 'unknown'
                const input = event.data?.input ?? {}
                console.log(`[Agent] 工具调用: ${toolName}`, JSON.stringify(input).slice(0, 120))
                callbacks?.onToolStart?.(toolName, input)
            }

            // 工具执行完毕
            if (event.event === 'on_tool_end') {
                const toolName = event.name ?? 'unknown'
                const output = event.data?.output ?? ''
                console.log(`[Agent] 工具完成: ${toolName}`)
                callbacks?.onToolEnd?.(toolName, output)
            }
        }

        callbacks?.onDone?.()
    } catch (err) {
        console.error('[Agent] 运行出错:', err)
        callbacks?.onError?.(err instanceof Error ? err.message : String(err))
    }
}

// ── IPC: chat:send（streaming） ───────────────────────────────────
export function registerAgentIpc() {
    ipcMain.removeHandler('agent:send')
    ipcMain.handle('agent:send', async (event, payload: { message: string; threadId?: string }) => {
        const { message } = payload

        // 找到发送过来的 chat 窗口
        const senderWebContents = event.sender
        const chatWin = BrowserWindow.fromWebContents(senderWebContents)

        const sendChunk = (chunk: string) => {
            if (chatWin && !chatWin.isDestroyed()) {
                chatWin.webContents.send('agent:chunk', chunk)
            }
        }
        const sendDone = () => {
            if (chatWin && !chatWin.isDestroyed()) {
                chatWin.webContents.send('agent:done')
            }
        }
        const sendError = (err: string) => {
            if (chatWin && !chatWin.isDestroyed()) {
                chatWin.webContents.send('agent:error', err)
            }
        }
        const sendToolStart = (name: string, input: unknown) => {
            if (chatWin && !chatWin.isDestroyed()) {
                chatWin.webContents.send('agent:tool_start', { name, input })
            }
        }
        const sendToolEnd = (name: string, output: unknown) => {
            if (chatWin && !chatWin.isDestroyed()) {
                chatWin.webContents.send('agent:tool_end', { name, output })
            }
        }

        await runDeepAgent(message, {
            onChunk: sendChunk,
            onDone: sendDone,
            onError: sendError,
            onToolStart: sendToolStart,
            onToolEnd: sendToolEnd
        })
    })
}
