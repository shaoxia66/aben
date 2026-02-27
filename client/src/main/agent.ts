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

// ── 读取本地密钥 ──────────────────────────────────────────────────
function readLocalAuthKey(): string {
    try {
        const file = join(app.getPath('userData'), 'aben-key.json')
        if (!existsSync(file)) return ''
        const data = JSON.parse(readFileSync(file, 'utf-8')) as { key?: string }
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

let cachedLlmConfig: LlmConfig | null = null
let cachedIdentity: AgentIdentity | null = null

async function fetchLlmConfig(): Promise<{ llm: LlmConfig; identity: AgentIdentity } | null> {
    if (cachedLlmConfig && cachedIdentity) return { llm: cachedLlmConfig, identity: cachedIdentity }

    const authKey = readLocalAuthKey()
    const adminUrl = process.env.VITE_ADMIN_API_URL ?? ''

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
        }
        if (json.defaultConfig) {
            cachedLlmConfig = json.defaultConfig
            cachedIdentity = {
                clientName: json.client?.clientName ?? '',
                clientType: json.client?.clientType ?? '',
                clientDescription: json.client?.clientDescription ?? null,
                tenantName: json.tenant?.name ?? '',
            }
        }
        return cachedLlmConfig && cachedIdentity
            ? { llm: cachedLlmConfig, identity: cachedIdentity }
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
}

// ── 创建 Agent（懒初始化） ─────────────────────────────────────────
type DeepAgent = ReturnType<typeof createDeepAgent>
let agentInstance: DeepAgent | null = null

async function getOrCreateAgent(): Promise<{ agent: DeepAgent; error?: never } | { agent?: never; error: string }> {
    if (agentInstance) return { agent: agentInstance }

    const result = await fetchLlmConfig()
    if (!result) {
        return { error: '未获取到 LLM 配置，请在设置中填写有效的客户端密钥' }
    }
    const { llm: llmConfig, identity } = result
    if (!llmConfig.apiKey) {
        return { error: 'LLM 配置中缺少 API Key' }
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
    const clientTypeLabel = identity.clientType ? `，设备类型：${identity.clientType}` : ''
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

    agentInstance = createDeepAgent({
        model: llm,
        systemPrompt,
        backend,
    })

    console.log(`[Agent] 初始化完成 | 名称: ${agentName} | 租户: ${identity.tenantName} | provider: ${llmConfig.provider} | model: ${llmConfig.modelName} | backend: LocalShellBackend(${homeDir})`)
    return { agent: agentInstance }
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

        const result = await getOrCreateAgent()
        if ('error' in result && result.error) {
            sendError(result.error)
            return
        }

        const { agent } = result

        try {
            console.log('[Agent] 收到消息:', message.slice(0, 60))

            // 使用 streamEvents 精准捕获 LLM token
            const eventStream = agent!.streamEvents(
                { messages: [{ role: 'user', content: message }] },
                { version: 'v2' }
            )

            for await (const event of eventStream) {
                if (
                    event.event === 'on_chat_model_stream' &&
                    event.data?.chunk?.content
                ) {
                    const content = event.data.chunk.content
                    if (typeof content === 'string' && content) {
                        sendChunk(content)
                    } else if (Array.isArray(content)) {
                        // Anthropic 格式：[{ type: 'text', text: '...' }]
                        for (const part of content) {
                            if (part?.type === 'text' && part.text) {
                                sendChunk(part.text)
                            }
                        }
                    }
                }
            }

            sendDone()
        } catch (err) {
            console.error('[Agent] 运行出错:', err)
            sendError(err instanceof Error ? err.message : String(err))
        }
    })
}
