import { MultiServerMCPClient } from '@langchain/mcp-adapters'
import { join } from 'node:path'
import { app } from 'electron'

let mcpClient: MultiServerMCPClient | null = null

/** 
 * 连接一台或多台基于 MCP (Model Context Protocol) 开发的现成工具服务器
 */
export async function initMcpTools(serverConfigs: Record<string, any> = {}) {
    if (mcpClient) {
        return mcpClient.getTools()
    }

    // 我们在这里通过 MCP 协议动态拉取 server-puppeteer (无头浏览器) 的官方工具
    // 以及如果用户还想接入其他的比如 server-sqlite 等，都可以配在字面量里
    // 另外，我们将服务端下发的 MCP 服务端配置 (serverConfigs) 与本地静态配置做合并
    const configsToLoad = {
        puppeteer: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-puppeteer']
        },
        ...serverConfigs
    }

    mcpClient = new MultiServerMCPClient(configsToLoad)

    // 初始化并连接到所有的 MCP 服务器
    await mcpClient.initializeConnections()

    // 获取挂载在这台 MCP 服务器上注册的所有智能体工具
    const rawTools = await mcpClient.getTools()

    // 增加错误处理包装，防止某一个工具执行崩溃导致整个 Agent 崩溃
    const tools = rawTools.map((originalTool: any) => {
        if (typeof originalTool.invoke === 'function') {
            const originalInvoke = originalTool.invoke.bind(originalTool)
            originalTool.invoke = async (...args: any[]) => {
                try {
                    return await originalInvoke(...args)
                } catch (error: any) {
                    console.error(`[MCP Tool Error] 工具 ${originalTool.name} 执行失败:`, error)
                    return `【工具执行出错】: ${error?.message || String(error)}\n请根据该报错信息调整参数重新调用该工具或执行下一步备选计划。`
                }
            }
        }
        if (typeof originalTool.call === 'function') {
            const originalCall = originalTool.call.bind(originalTool)
            originalTool.call = async (...args: any[]) => {
                try {
                    return await originalCall(...args)
                } catch (error: any) {
                    console.error(`[MCP Tool Error] 工具 ${originalTool.name} 执行失败:`, error)
                    return `【工具执行出错】: ${error?.message || String(error)}\n请根据该报错信息调整参数重新调用该工具或执行下一步备选计划。`
                }
            }
        }
        return originalTool
    })

    console.log(`[MCP] 成功接入 MCP 服务器，获取到了 ${tools.length} 个跨进程工具！`)
    tools.forEach(tool => {
        console.log(`[MCP Tool] 名称: ${tool.name}, 描述: ${tool.description}`)
    })

    return tools
}

export async function closeMcp() {
    if (mcpClient) {
        // 断开 MCP Client（这将会安全停止在后台跑的 subprocess）
        await mcpClient.close()
        mcpClient = null
    }
}

// Just a test

// EOF
