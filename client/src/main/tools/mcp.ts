import { MultiServerMCPClient } from '@langchain/mcp-adapters'
import { join } from 'node:path'
import { app } from 'electron'

let mcpClient: MultiServerMCPClient | null = null

/** 
 * 连接一台或多台基于 MCP (Model Context Protocol) 开发的现成工具服务器
 */
export async function initMcpTools() {
    if (mcpClient) {
        return mcpClient.getTools()
    }

    // 我们在这里通过 MCP 协议动态拉取 server-puppeteer (无头浏览器) 的官方工具
    // 以及如果用户还想接入其他的比如 server-sqlite 等，都可以配在字面量里
    mcpClient = new MultiServerMCPClient({
        puppeteer: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-puppeteer']
        },
        // 'claude-computer-use': {
        //     command: 'npx',
        //     args: ['-y', 'claude-computer-use-mcp'],
        //     env: {
        //         ...process.env,
        //         // claude-computer-use-mcp 启动强制需要的安全变量
        //         COOKIE_ENCRYPTION_KEY: 'aben-desktop-encryption-key-which-is-long-enough'
        //     }
        // }
    })

    // 初始化并连接到所有的 MCP 服务器
    await mcpClient.initializeConnections()

    // 获取挂载在这台 MCP 服务器上注册的所有智能体工具
    const tools = await mcpClient.getTools()
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
