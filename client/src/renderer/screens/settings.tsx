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

    // 处理回车保存与 Esc 关闭
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                App.closeSettings()
                return
            }
            if (e.key === 'Enter') {
                void handleSave()
                return
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [apiKey]) // 依赖 apiKey 以便拿到最新值

    return (
        // 外层 h-screen w-screen，加一点 padding 以容纳外围阴影；设为透明背景
        <main className="h-screen w-screen bg-transparent p-4 flex items-center justify-center font-sans select-text">
            {/* 主卡片：macOS 风格。带拖拽支持，大圆角，精细阴影与半透明毛玻璃 */}
            <div
                className="w-full h-full rounded-[14px] bg-[#1c1c1e]/90 border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-2xl flex flex-col overflow-hidden text-white/90"
                style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
            >
                {/* 顶部标题栏区 (不仅用于显示，主要充当拖拉把手) */}
                <div className="h-10 flex items-center justify-center relative shrink-0">
                    <span className="text-xs font-semibold text-white/40 tracking-wider">
                        API SETTINGS
                    </span>
                </div>

                {/* 内容区 */}
                <div
                    className="flex-1 px-8 pt-2 pb-6 flex flex-col justify-between"
                    style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                >
                    <div>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-white/5 border border-white/5 shadow-inner shrink-0 text-2xl">
                                🔑
                            </div>
                            <div>
                                <h1 className="text-xl font-medium tracking-tight text-white/95">配置密钥</h1>
                                <p className="text-xs text-white/45 mt-1 leading-relaxed">
                                    此 Key 仅保存在本地设备，确保数据安全。<br />
                                    可从选定的 AI 服务平台获取。
                                </p>
                            </div>
                        </div>

                        {/* 表单区域 */}
                        <div className="space-y-2 mt-4 select-text">
                            <label
                                className="block text-xs font-medium text-white/70 ml-1"
                                htmlFor="api-key-input"
                            >
                                API Key
                            </label>
                            <div className="relative group">
                                <input
                                    autoComplete="off"
                                    className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2.5 text-sm font-mono text-white/90 placeholder:text-white/20 focus:outline-none focus:ring-[3px] focus:ring-blue-500/40 focus:border-blue-500/60 transition-all disabled:opacity-40"
                                    disabled={loading}
                                    id="api-key-input"
                                    onChange={e => setApiKey(e.target.value)}
                                    placeholder={loading ? '加载中...' : 'sk-...'}
                                    spellCheck={false}
                                    type="password"
                                    value={apiKey}
                                />
                            </div>
                        </div>
                    </div>

                    {/* 底部按钮 */}
                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            className="px-4 py-1.5 rounded-md text-sm font-medium text-white/70 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                            onClick={() => App.closeSettings()}
                            type="button"
                        >
                            取消
                        </button>
                        <button
                            className={`px-4 py-1.5 rounded-md text-sm font-medium border transition-colors shadow-sm ${saved
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500/50'
                                } disabled:opacity-50 min-w-[64px]`}
                            disabled={loading || !apiKey.trim()}
                            onClick={handleSave}
                            type="button"
                        >
                            {saved ? '已保存' : '完成'}
                        </button>
                    </div>
                </div>
            </div>
        </main>
    )
}
