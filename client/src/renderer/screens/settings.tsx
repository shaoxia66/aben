import { useEffect, useState } from 'react'

const { App } = window

export function SettingsScreen() {
    const [apiKey, setApiKey] = useState('')
    const [saved, setSaved] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        App.getApiKey().then(key => {
            setApiKey(key ?? '')
            setLoading(false)
        })
    }, [])

    const handleSave = async () => {
        if (!apiKey.trim()) return
        await App.saveApiKey(apiKey.trim())
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
    }

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') App.closeSettings()
            if (e.key === 'Enter') void handleSave()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [apiKey])

    return (
        <main className="h-screen w-screen bg-transparent p-4 flex items-center justify-center font-sans select-text">
            <div
                className="w-full h-full rounded-[14px] bg-[#1c1c1e]/90 border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-2xl flex flex-col overflow-hidden text-white/90"
                style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
            >
                {/* 顶部拖拽条 + 关闭按钮 */}
                <div className="h-9 flex items-center justify-end px-3 shrink-0">
                    <button
                        className="w-6 h-6 flex items-center justify-center rounded-full bg-white/5 hover:bg-red-500/80 text-white/40 hover:text-white transition-all duration-150 focus:outline-none"
                        onClick={() => App.closeSettings()}
                        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                        title="关闭"
                        type="button"
                    >
                        <svg fill="none" height="10" viewBox="0 0 10 10" width="10">
                            <path d="M1.5 1.5 8.5 8.5M8.5 1.5 1.5 8.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
                        </svg>
                    </button>
                </div>

                {/* 内容区 */}
                <div
                    className="flex-1 px-8 pb-7 flex flex-col justify-center gap-6"
                    style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                >
                    {/* 输入框 */}
                    <div className="space-y-2">
                        <label className="block text-xs font-medium text-white/60 ml-0.5" htmlFor="api-key-input">
                            密钥
                        </label>
                        <input
                            autoComplete="off"
                            autoFocus
                            className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2.5 text-sm font-mono text-white/90 placeholder:text-white/25 focus:outline-none focus:ring-[2px] focus:ring-blue-500/40 focus:border-blue-500/60 transition-all disabled:opacity-40"
                            disabled={loading}
                            id="api-key-input"
                            onChange={e => setApiKey(e.target.value)}
                            placeholder={loading ? '加载中...' : '请从管理端获取密钥并粘贴至此'}
                            spellCheck={false}
                            type="password"
                            value={apiKey}
                        />
                    </div>

                    {/* 按钮 */}
                    <div className="flex justify-end gap-3">
                        <button
                            className="px-4 py-1.5 rounded-md text-sm font-medium text-white/60 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                            onClick={() => App.closeSettings()}
                            type="button"
                        >
                            取消
                        </button>
                        <button
                            className={`px-4 py-1.5 rounded-md text-sm font-medium border transition-colors shadow-sm min-w-[64px] ${saved
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500/50'
                                } disabled:opacity-50`}
                            disabled={loading || !apiKey.trim()}
                            onClick={handleSave}
                            type="button"
                        >
                            {saved ? '已保存 ✓' : '确认'}
                        </button>
                    </div>
                </div>
            </div>
        </main>
    )
}
