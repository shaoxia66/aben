import { app } from 'electron'
import { join } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import mqtt, { MqttClient } from 'mqtt'
import { runDeepAgent } from './agent'

let mqttClient: MqttClient | null = null
let currentClientId: string | null = null

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

async function fetchMqttConfig() {
    const authKey = readLocalAuthKey()
    const adminUrl = 'http://localhost:3000'

    if (!authKey || !adminUrl) return null

    try {
        const { net } = await import('electron')
        const res = await net.fetch(`${adminUrl}/api/client-auth/mqtt-config`, {
            headers: { Authorization: `Bearer ${authKey}` },
        })

        if (!res.ok) {
            console.error('[MQTT] 获取配置失败, HTTP status:', res.status)
            return null
        }

        const json = await res.json() as {
            host: string
            port: number
            protocol: string
            password: string
        }

        return json
    } catch (err) {
        console.error('[MQTT] fetchMqttConfig 请求出错:', err)
        return null
    }
}

export async function initMqtt() {
    if (mqttClient) return mqttClient

    const config = await fetchMqttConfig()
    if (!config) {
        console.warn('[MQTT] 未能获取 MQTT 配置，跳过连接')
        return null
    }

    const { host, port, protocol, password } = config

    // Connect config
    // 获取 client id
    // 从 JWT 中解析出服务端签发的真实 clientid (对应为 code)
    let userClientId = 'client_' + Math.random().toString(16).substring(2, 8)
    try {
        const payloadStr = Buffer.from(password.split('.')[1], 'base64').toString('utf-8')
        const payload = JSON.parse(payloadStr)
        if (payload.clientid) {
            userClientId = payload.clientid
        }
    } catch { }

    currentClientId = userClientId

    const brokerUrl = `${protocol}://${host}:${port}`
    console.log(`[MQTT] 正在连接: ${brokerUrl}, 客户端ID: ${currentClientId}`)

    // 遗嘱消息 (LWT - Last Will and Testament)
    // 当由于网络原因或奔溃导致连接意外断开时，MQTT 服务器自动代发此消息给该主题
    const lwtTopic = `client/${currentClientId}/status`
    const lwtMessage = JSON.stringify({
        status: 'offline',
        timestamp: Date.now(),
        version: app.getVersion()
    })

    mqttClient = mqtt.connect(brokerUrl, {
        username: 'aben_client',
        password,
        clientId: currentClientId,
        rejectUnauthorized: false,
        will: {
            topic: lwtTopic,
            payload: Buffer.from(lwtMessage),
            qos: 1,
            retain: true
        }
    })

    mqttClient.on('connect', () => {
        console.log('[MQTT] 成功连接到服务器')

        // 成功连上后主动发送上线状态
        const onlinePayload = JSON.stringify({
            status: 'online',
            timestamp: Date.now(),
            version: app.getVersion()
        })
        mqttClient?.publish(`client/${currentClientId}/status`, onlinePayload, { qos: 1, retain: true })

        // 订阅后续的指令和聊天 Topic
        mqttClient?.subscribe(`client/${currentClientId}/command`, { qos: 1 })
        mqttClient?.subscribe(`client/${currentClientId}/chat/inbox`, { qos: 1 })
    })

    mqttClient.on('message', async (topic, message) => {
        try {
            const payload = JSON.parse(message.toString())

            if (topic.endsWith('/command')) {
                console.log('[MQTT] 收到远程指令:', payload)
                if (payload.action === 'START_TASK' && payload.payload?.task) {
                    const taskId = payload.commandId || `cmd_${Date.now()}`

                    // 广播事件：任务开始
                    const startEvent = JSON.stringify({ eventId: taskId, type: 'AGENT_START', data: { task: payload.payload.task } })
                    mqttClient?.publish(`client/${currentClientId}/event`, startEvent, { qos: 1 })

                    await runDeepAgent(payload.payload.task, {
                        onChunk: (chunk) => {
                            // 可选：将 chunk 进度发回 event/chat
                        },
                        onToolStart: (name, input) => {
                            const evt = JSON.stringify({ eventId: taskId, type: 'TOOL_START', data: { name, input } })
                            mqttClient?.publish(`client/${currentClientId}/event`, evt, { qos: 1 })
                        },
                        onToolEnd: (name, output) => {
                            const evt = JSON.stringify({ eventId: taskId, type: 'TOOL_END', data: { name, output } })
                            mqttClient?.publish(`client/${currentClientId}/event`, evt, { qos: 1 })
                        },
                        onError: (err) => {
                            const evt = JSON.stringify({ eventId: taskId, type: 'AGENT_ERROR', data: { error: err } })
                            mqttClient?.publish(`client/${currentClientId}/event`, evt, { qos: 1 })
                        },
                        onDone: () => {
                            const evt = JSON.stringify({ eventId: taskId, type: 'AGENT_DONE', data: {} })
                            mqttClient?.publish(`client/${currentClientId}/event`, evt, { qos: 1 })
                        }
                    })
                }
            } else if (topic.endsWith('/chat/inbox')) {
                console.log('[MQTT] 收到云端消息:', payload)
                // 收到消息直接让 Agent 执行，并且边流式输出边向 outbox 广播
                const msgId = payload.messageId || `msg_${Date.now()}`
                const content = payload.message

                await runDeepAgent(content, {
                    onChunk: (chunk) => {
                        const outboxEvt = JSON.stringify({ messageId: msgId, type: 'chunk', content: chunk })
                        mqttClient?.publish(`client/${currentClientId}/chat/outbox`, outboxEvt, { qos: 1 })
                    },
                    onDone: () => {
                        const outboxEvt = JSON.stringify({ messageId: msgId, type: 'done' })
                        mqttClient?.publish(`client/${currentClientId}/chat/outbox`, outboxEvt, { qos: 1 })
                    },
                    onError: (err) => {
                        const outboxEvt = JSON.stringify({ messageId: msgId, type: 'error', content: err })
                        mqttClient?.publish(`client/${currentClientId}/chat/outbox`, outboxEvt, { qos: 1 })
                    }
                })
            }
        } catch (e) {
            console.error('[MQTT] 解析 Message 失败:', e)
        }
    })

    mqttClient.on('error', (err) => {
        console.error('[MQTT] 连接错误:', err.message)
    })

    mqttClient.on('close', () => {
        console.log('[MQTT] 连接断开')
    })

    mqttClient.on('reconnect', () => {
        console.log('[MQTT] 正在重新连接...')
    })

    return mqttClient
}

export function getMqttClient(): MqttClient | null {
    return mqttClient
}

export function closeMqtt() {
    if (mqttClient) {
        mqttClient.end()
        mqttClient = null
    }
}
