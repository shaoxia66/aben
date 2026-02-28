import { useEffect, useRef, useState } from 'react'

const { App } = window

// ── 消息类型定义 ──────────────────────────────────────────────────
type TextMessage = {
    id: number
    type: 'text'
    role: 'user' | 'assistant'
    content: string
    ts: number
}

type ToolStepMessage = {
    id: number
    type: 'tool'
    toolName: string
    input: unknown
    output: unknown | null   // null = 还在执行中
    ts: number
}

type ChatMessage = TextMessage | ToolStepMessage

let _id = 0
const uid = () => ++_id

// ── 工具名称映射（友好展示） ───────────────────────────────────────
const TOOL_LABELS: Record<string, string> = {
    execute: '执行命令',
    write_file: '写入文件',
    read_file: '读取文件',
    edit_file: '编辑文件',
    ls: '列出目录',
    glob: '搜索文件',
    grep: '搜索内容',
    grep_raw: '搜索内容',
    rm: '删除文件',
    mv: '移动文件',
    cp: '复制文件',
    mkdir: '创建目录',
    write_todos: '规划任务',
    task: '子任务委派',
}

function toolLabel(name: string) {
    return TOOL_LABELS[name] ?? name
}

// 从 input 里提取一行摘要
function toolSummary(name: string, input: unknown): string {
    if (!input || typeof input !== 'object') return ''
    const i = input as Record<string, unknown>
    if (name === 'execute') return String(i.command ?? i.cmd ?? '').slice(0, 80)
    if (name === 'write_file' || name === 'read_file' || name === 'edit_file') return String(i.path ?? i.file_path ?? '').slice(0, 80)
    if (name === 'ls') return String(i.path ?? i.directory ?? '').slice(0, 80)
    if (name === 'grep' || name === 'grep_raw') return String(i.pattern ?? i.query ?? '').slice(0, 80)
    if (name === 'glob') return String(i.pattern ?? '').slice(0, 80)
    if (name === 'write_todos') return '...'
    // 通用：取第一个字段
    const first = Object.values(i)[0]
    return String(first ?? '').slice(0, 80)
}

// ── 子组件：工具步骤卡片 ──────────────────────────────────────────
function ToolStepCard({ msg }: { msg: ToolStepMessage }) {
    const [expanded, setExpanded] = useState(false)
    const running = msg.output === null
    const label = toolLabel(msg.toolName)
    const summary = toolSummary(msg.toolName, msg.input)
    let outputStr = ''
    if (msg.output != null) {
        if (typeof msg.output === 'string') {
            outputStr = msg.output
        } else if (Array.isArray(msg.output)) {
            // 如果返回的是行数组等格式，直接换行拼接
            outputStr = msg.output.map(item => typeof item === 'object' ? JSON.stringify(item) : String(item)).join('\n')
        } else {
            // 尝试提取核心执行结果，避免直接展示深层结构的 JSON（过滤掉状态码等无关信息）
            const obj = msg.output as Record<string, unknown>
            if (typeof obj.content === 'string') {
                outputStr = obj.content
            } else if (typeof obj.output === 'string') {
                outputStr = obj.output
            } else if (typeof obj.stdout === 'string' || typeof obj.stderr === 'string') {
                outputStr = [obj.stdout, obj.stderr].filter(Boolean).join('\n')
            } else {
                // 回退：移除一些不需要的长字段或无用字段后再展示
                const cleanObj = { ...obj }
                delete cleanObj.exitCode
                if (Object.keys(cleanObj).length === 1 && typeof Object.values(cleanObj)[0] === 'string') {
                    outputStr = Object.values(cleanObj)[0] as string
                } else {
                    outputStr = JSON.stringify(cleanObj, null, 2)
                }
            }
        }
    }
    return (
        <div className="flex items-start gap-2 py-0.5">
            {/* 左侧连接线 + 图标 */}
            <div className="flex flex-col items-center shrink-0 self-stretch ml-1">
                <div className={`w-[6px] h-[6px] rounded-full mt-[7px] shrink-0 ${running ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
            </div>

            <button
                className="flex-1 text-left min-w-0"
                onClick={() => !running && setExpanded(v => !v)}
                type="button"
            >
                <div className="flex items-center gap-2">
                    {/* 工具名 */}
                    <span className={`text-[11px] font-medium font-mono px-1.5 py-0.5 rounded ${running
                        ? 'bg-amber-500/10 text-amber-400/90 border border-amber-500/20'
                        : 'bg-white/[0.04] text-white/40 border border-white/[0.06]'}`}>
                        {label}
                    </span>
                    {/* 摘要 */}
                    {summary && (
                        <span className="text-[11px] text-white/30 truncate font-mono">
                            {summary}
                        </span>
                    )}
                    {running && (
                        <svg className="animate-spin w-3 h-3 text-amber-400/60 shrink-0" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-30" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-80" d="M4 12a8 8 0 018-8v8H4z" fill="currentColor" />
                        </svg>
                    )}
                    {!running && (
                        <svg
                            className={`w-3 h-3 text-white/20 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
                        >
                            <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    )}
                </div>

                {/* 展开的输出内容 */}
                {expanded && !running && outputStr && (
                    <div className="mt-1.5 rounded-md bg-black/25 border border-white/[0.05] px-3 py-2 font-mono text-[11px] text-white/50 whitespace-pre-wrap break-all leading-relaxed max-h-40 overflow-y-auto">
                        {outputStr.slice(0, 2000)}
                        {outputStr.length > 2000 && <span className="text-white/25">…（截断）</span>}
                    </div>
                )}
            </button>
        </div>
    )
}

// ── 子组件：助手图标 ──────────────────────────────────────────────
function AssistantIcon() {
    return (
        <div className="w-7 h-7 rounded-full bg-white/[0.03] border border-white/[0.08] flex items-center justify-center shrink-0 shadow-sm">
            <svg className="text-white/70" fill="none" height="13" stroke="currentColor"
                strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="13">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
            </svg>
        </div>
    )
}

// ── 主界面 ────────────────────────────────────────────────────────
export function ChatScreen() {
    const [messages, setMessages] = useState<ChatMessage[]>([
        { id: uid(), type: 'text', role: 'assistant', content: '你好，有什么我可以帮你的吗？', ts: Date.now() },
    ])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const bottomRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    useEffect(() => {
        inputRef.current?.focus()
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') App.closeChat()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    const handleSend = async () => {
        const text = input.trim()
        if (!text || loading) return

        setInput('')
        if (inputRef.current) inputRef.current.style.height = 'auto'

        const userMsg: TextMessage = { id: uid(), type: 'text', role: 'user', content: text, ts: Date.now() }

        // currentAssistantId = -1 表示暂无接收气泡，chunk 来了再懒创建
        let currentAssistantId = -1

        setMessages(prev => [...prev, userMsg])
        setLoading(true)

        // 工具步骤追踪
        const toolCounters: Record<string, number> = {}
        const toolStepIds: Map<string, number> = new Map()

        // ── chunk：追加到当前 assistant 气泡，若无则懒创建 ──
        const offChunk = App.onAgentChunk((chunk: string) => {
            if (currentAssistantId === -1) {
                // 懒创建：有 token 来了才建气泡
                const newId = uid()
                currentAssistantId = newId
                const newMsg: TextMessage = { id: newId, type: 'text', role: 'assistant', content: chunk, ts: Date.now() }
                setMessages(prev => [...prev, newMsg])
            } else {
                setMessages(prev => prev.map(m =>
                    m.id === currentAssistantId && m.type === 'text'
                        ? { ...m, content: m.content + chunk }
                        : m
                ))
            }
        })

        // ── tool_start：冻结当前气泡，插入工具卡片 ──
        const offToolStart = App.onAgentToolStart(({ name, input: toolInput }) => {
            toolCounters[name] = (toolCounters[name] ?? 0) + 1
            const key = `${name}#${toolCounters[name]}`
            const stepId = uid()
            toolStepIds.set(key, stepId)

            const step: ToolStepMessage = {
                id: stepId,
                type: 'tool',
                toolName: name,
                input: toolInput,
                output: null,
                ts: Date.now(),
            }

            currentAssistantId = -1  // 暂无接收气泡，等 chunk 到来时懒创建
            setMessages(prev => [...prev, step])
        })

        // ── tool_end：更新工具卡为完成，不预插气泡 ──
        const offToolEnd = App.onAgentToolEnd(({ name, output }) => {
            const count = toolCounters[name] ?? 1
            for (let c = count; c >= 1; c--) {
                const key = `${name}#${c}`
                const stepId = toolStepIds.get(key)
                if (stepId !== undefined) {
                    setMessages(prev => prev.map(m =>
                        m.id === stepId && m.type === 'tool'
                            ? { ...m, output }
                            : m
                    ))
                    toolStepIds.delete(key)
                    break
                }
            }
            // 不预插空气泡，等有 chunk 时懒创建
        })

        const offDone = App.onAgentDone(() => {
            offChunk(); offToolStart(); offToolEnd()
            setLoading(false)
        })

        const offError = App.onAgentError((err: string) => {
            offChunk(); offToolStart(); offToolEnd()
            setMessages(prev => {
                // 找最后一条 assistant 文字气泡写错误
                const idx = [...prev].reverse().findIndex(m => m.type === 'text' && m.role === 'assistant')
                if (idx === -1) return [...prev, { id: uid(), type: 'text' as const, role: 'assistant' as const, content: `[错误] ${err}`, ts: Date.now() }]
                const realIdx = prev.length - 1 - idx
                return prev.map((m, i) => i === realIdx && m.type === 'text' ? { ...m, content: `[错误] ${err}` } : m)
            })
            setLoading(false)
        })

        try {
            await App.agentSend(text)
        } catch {
            offChunk(); offToolStart(); offToolEnd(); offDone(); offError()
            setMessages(prev => prev.map(m =>
                m.id === currentAssistantId && m.type === 'text'
                    ? { ...m, content: '[错误] 发送失败，请检查连接' }
                    : m
            ))
            setLoading(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            void handleSend()
        }
    }

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value)
        e.target.style.height = 'auto'
        e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
    }

    return (
        <main className="h-screen w-screen bg-transparent flex items-stretch justify-stretch font-sans antialiased text-white/90">
            <div
                className="w-full h-full rounded-[14px] bg-[#1c1c1e]/85 backdrop-blur-[40px] border border-white/[0.12] shadow-[0_20px_60px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden"
                style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
            >
                {/* 标题栏 */}
                <div className="h-10 flex items-center justify-between px-3 shrink-0 border-b border-white/[0.04]">
                    <span className="text-[13px] font-medium text-white/40 tracking-wide select-none pl-2">Aben</span>
                    <button
                        className="w-[22px] h-[22px] flex items-center justify-center rounded-full bg-white/5 hover:bg-white/20 text-white/50 hover:text-white transition-all duration-200"
                        onClick={() => App.closeChat()}
                        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                        type="button"
                    >
                        <svg fill="none" height="10" viewBox="0 0 10 10" width="10">
                            <path d="M1.5 1.5 8.5 8.5M8.5 1.5 1.5 8.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.2" />
                        </svg>
                    </button>
                </div>

                {/* 消息列表 */}
                <div
                    className="flex-1 overflow-y-auto px-4 py-5 space-y-4"
                    style={{ WebkitAppRegion: 'no-drag', scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
                >
                    {messages.map((msg, i) => {
                        // 工具调用步骤
                        if (msg.type === 'tool') {
                            return (
                                <div key={msg.id} className="pl-2">
                                    <ToolStepCard msg={msg} />
                                </div>
                            )
                        }

                        // 普通文字消息
                        const isUser = msg.role === 'user'
                        const prevMsg = i > 0 ? messages[i - 1] : null
                        const prevIsUserOrTool = prevMsg ? (prevMsg.type === 'tool' || (prevMsg.type === 'text' && prevMsg.role === 'user')) : false
                        const showIcon = !isUser && (i === 0 || prevIsUserOrTool)

                        return (
                            <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                                <div className={`flex gap-3 max-w-[87%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                                    {!isUser && (
                                        <div className="w-7 shrink-0 pt-0.5">
                                            {showIcon && <AssistantIcon />}
                                        </div>
                                    )}
                                    <div className={`px-3.5 py-2.5 text-[14px] leading-[1.65] whitespace-pre-wrap break-words ${isUser
                                        ? 'bg-[#0A84FF] text-white rounded-2xl rounded-tr-sm shadow-sm'
                                        : msg.content
                                            ? 'bg-white/[0.06] text-white/90 rounded-2xl rounded-tl-[4px] border border-white/[0.04]'
                                            : 'bg-white/[0.06] text-white/90 rounded-2xl rounded-tl-[4px] border border-white/[0.04] min-w-[48px]'
                                        }`}>
                                        {msg.content || (
                                            // 空内容时显示光标等待
                                            <span className="inline-block w-[2px] h-[14px] bg-white/50 animate-pulse rounded" />
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}

                    {/* 全局 loading 指示（只在无任何 assistant 消息时展示） */}
                    {loading && messages.filter(m => m.type === 'text' && m.role === 'assistant').length === 0 && (
                        <div className="flex items-start gap-3">
                            <div className="w-7 shrink-0 pt-0.5"><AssistantIcon /></div>
                            <div className="bg-white/[0.06] border border-white/[0.04] rounded-2xl rounded-tl-[4px] px-4 py-3 flex items-center gap-1.5 h-[42px]">
                                <span className="w-[5px] h-[5px] rounded-full bg-white/40 animate-pulse" />
                                <span className="w-[5px] h-[5px] rounded-full bg-white/40 animate-pulse delay-150" />
                                <span className="w-[5px] h-[5px] rounded-full bg-white/40 animate-pulse delay-300" />
                            </div>
                        </div>
                    )}

                    <div ref={bottomRef} className="h-1" />
                </div>

                {/* 输入区 */}
                <div
                    className="shrink-0 p-4 border-t border-white/[0.04] bg-white/[0.02]"
                    style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                >
                    <div className="relative flex items-end w-full rounded-[14px] bg-black/30 border border-white/[0.08] focus-within:border-white/20 focus-within:bg-black/40 transition-all shadow-inner">
                        <textarea
                            ref={inputRef}
                            className="flex-1 w-full bg-transparent text-[14px] text-white/90 placeholder:text-white/30 resize-none py-3 pl-4 pr-12 focus:outline-none leading-relaxed"
                            disabled={loading}
                            onChange={handleInput}
                            onKeyDown={handleKeyDown}
                            placeholder="描述你需要执行的任务..."
                            rows={1}
                            style={{ minHeight: '44px' }}
                            value={input}
                        />
                        <div className="absolute right-2 bottom-[6px]">
                            <button
                                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 ${input.trim() && !loading
                                    ? 'bg-white/10 hover:bg-white/20 text-white'
                                    : 'bg-transparent text-white/20 cursor-not-allowed'
                                    }`}
                                disabled={loading || !input.trim()}
                                onClick={() => void handleSend()}
                                type="button"
                            >
                                <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round"
                                    strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="16">
                                    <line x1="12" x2="12" y1="19" y2="5" />
                                    <polyline points="5 12 12 5 19 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div className="flex justify-between items-center mt-2 px-1">
                        <span className="text-[11px] text-white/25 truncate">通过语言直接控制桌面智能体</span>
                        <span className="text-[10px] text-white/20 font-mono tracking-tighter shrink-0">v0.1.0</span>
                    </div>
                </div>
            </div>
        </main>
    )
}
