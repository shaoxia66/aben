import { useEffect, useRef, useState } from 'react'

const { App } = window

interface Message {
    id: number
    role: 'user' | 'assistant'
    content: string
    ts: number
}
let _id = 0
const uid = () => ++_id

// AI 助手的极简图标
function AssistantIcon() {
    return (
        <div className="w-7 h-7 rounded-full bg-white/[0.03] border border-white/[0.08] flex items-center justify-center shrink-0 shadow-sm">
            <svg
                className="text-white/70"
                fill="none"
                height="13"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                viewBox="0 0 24 24"
                width="13"
            >
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
            </svg>
        </div>
    )
}

export function ChatScreen() {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: uid(),
            role: 'assistant',
            content: '你好，有什么我可以帮你的吗？',
            ts: Date.now(),
        },
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
        const userMsg: Message = { id: uid(), role: 'user', content: text, ts: Date.now() }
        setMessages(prev => [...prev, userMsg])
        setLoading(true)

        // 模拟请求
        await new Promise(r => setTimeout(r, 800))
        const replyMsg: Message = {
            id: uid(),
            role: 'assistant',
            content: `收到你的指令：\n\n${text}\n\n当前尚未连接真实接口。你可以继续说明任务需求。`,
            ts: Date.now(),
        }
        setMessages(prev => [...prev, replyMsg])
        setLoading(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            void handleSend()
        }
    }

    // 自动变高输入框
    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value)
        e.target.style.height = 'auto'
        e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
    }

    return (
        // 去掉 padding，让卡片直接占满窗口区域并处理圆角，窗口设置为 transparent 所以会透出壁纸
        <main className="h-screen w-screen bg-transparent flex items-stretch justify-stretch font-sans antialiased text-white/90">
            <div
                className="w-full h-full rounded-[14px] bg-[#1c1c1e]/85 backdrop-blur-[40px] border border-white/[0.12] shadow-[0_20px_60px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden"
                style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
            >
                {/* 极简标题栏 */}
                <div className="h-10 flex items-center justify-between px-3 shrink-0 border-b border-white/[0.04]">
                    <div className="flex items-center gap-2 pl-2">
                        <span className="text-[13px] font-medium text-white/40 tracking-wide select-none">
                            Aben
                        </span>
                    </div>
                    {/* macOS 风格关闭按钮，或者极简按钮 */}
                    <button
                        className="w-[22px] h-[22px] flex items-center justify-center rounded-full bg-white/5 hover:bg-white/20 text-white/50 hover:text-white transition-all duration-200"
                        onClick={() => App.closeChat()}
                        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                        title="关闭对话"
                        type="button"
                    >
                        <svg fill="none" height="10" viewBox="0 0 10 10" width="10">
                            <path d="M1.5 1.5 8.5 8.5M8.5 1.5 1.5 8.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.2" />
                        </svg>
                    </button>
                </div>

                {/* 对话列表区 */}
                <div
                    className="flex-1 overflow-y-auto px-5 py-6 space-y-6 scrollbar-hide"
                    // Tailwind 配置如没有 scrollbar-hide，可以用普通样式隐藏滚动条
                    style={{ WebkitAppRegion: 'no-drag', scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
                >
                    {messages.map((msg, i) => {
                        const isUser = msg.role === 'user'
                        const isPrevUser = i > 0 && messages[i - 1].role === 'user'
                        const showAssistantIcon = !isUser && (i === 0 || messages[i - 1].role === 'user')

                        return (
                            <div
                                key={msg.id}
                                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} ${isUser && isPrevUser ? '-mt-4' : ''}`}
                            >
                                <div className={`flex gap-3 max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                                    {/* 头像占位区域，保持对齐 */}
                                    {!isUser && (
                                        <div className="w-7 shrink-0 pt-0.5">
                                            {showAssistantIcon && <AssistantIcon />}
                                        </div>
                                    )}

                                    {/* 消息气泡 */}
                                    <div
                                        className={`px-3.5 py-2.5 text-[14px] leading-[1.6] whitespace-pre-wrap break-words ${isUser
                                            ? 'bg-[#0A84FF] text-white rounded-2xl rounded-tr-sm shadow-sm'
                                            : 'bg-white/[0.06] text-white/90 rounded-2xl rounded-tl-[4px] border border-white/[0.04]'
                                            }`}
                                    >
                                        {msg.content}
                                    </div>
                                </div>
                            </div>
                        )
                    })}

                    {/* 加载状态 */}
                    {loading && (
                        <div className="flex flex-col items-start">
                            <div className="flex gap-3 max-w-[85%] flex-row">
                                <div className="w-7 shrink-0 pt-0.5">
                                    <AssistantIcon />
                                </div>
                                <div className="bg-white/[0.06] border border-white/[0.04] rounded-2xl rounded-tl-[4px] px-4 py-3.5 flex items-center gap-1.5 h-[42px]">
                                    <span className="w-[5px] h-[5px] rounded-full bg-white/40 animate-pulse" />
                                    <span className="w-[5px] h-[5px] rounded-full bg-white/40 animate-pulse delay-150" />
                                    <span className="w-[5px] h-[5px] rounded-full bg-white/40 animate-pulse delay-300" />
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={bottomRef} className="h-2" />
                </div>

                {/* 底部输入框区域 */}
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
                        {/* 发送按钮，悬浮在 textarea 右下角 */}
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
                                <svg
                                    fill="none"
                                    height="16"
                                    stroke="currentColor"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    viewBox="0 0 24 24"
                                    width="16"
                                >
                                    <line x1="12" x2="12" y1="19" y2="5" />
                                    <polyline points="5 12 12 5 19 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                    {/* 小字提示 */}
                    <div className="flex justify-between items-center mt-2.5 px-1">
                        <span className="text-[11px] text-white/30 truncate">
                            通过语言直接控制桌面智能体
                        </span>
                        <span className="text-[10px] text-white/20 font-mono tracking-tighter shrink-0">
                            v0.1.0
                        </span>
                    </div>
                </div>
            </div>
        </main>
    )
}
