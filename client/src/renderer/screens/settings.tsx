import { useEffect, useState } from 'react'

const { App } = window

type Mode = 'view' | 'edit'

// 隐藏密钥：保留前4位 + *** + 后4位
function maskKey(key: string): string {
    if (key.length <= 12) return '●'.repeat(key.length)
    return `${key.slice(0, 6)}${'●'.repeat(8)}${key.slice(-4)}`
}

export function SettingsScreen() {
    const [storedKey, setStoredKey] = useState<string | null>(null) // null = 未加载
    const [mode, setMode] = useState<Mode>('view')
    const [editValue, setEditValue] = useState('')
    const [showPlain, setShowPlain] = useState(false)
    const [saving, setSaving] = useState(false)
    const [saveOk, setSaveOk] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)

    // 初始加载
    useEffect(() => {
        App.getApiKey().then(key => {
            setStoredKey(key ?? '')
        })
    }, [])

    const hasKey = !!storedKey

    // 进入编辑模式
    const startEdit = () => {
        setEditValue(storedKey ?? '')
        setShowPlain(false)
        setSaveOk(false)
        setMode('edit')
    }

    // 保存
    const handleSave = async () => {
        const trimmed = editValue.trim()
        if (!trimmed) return
        setSaving(true)
        await App.saveApiKey(trimmed)
        setStoredKey(trimmed)
        setSaving(false)
        setSaveOk(true)
        setMode('view')
        setTimeout(() => setSaveOk(false), 2000)
    }

    // 删除
    const handleDelete = async () => {
        if (!confirmDelete) {
            setConfirmDelete(true)
            setTimeout(() => setConfirmDelete(false), 3000)
            return
        }
        await App.deleteApiKey()
        setStoredKey('')
        setConfirmDelete(false)
        setMode('view')
    }

    // 取消编辑
    const cancelEdit = () => {
        setMode('view')
        setEditValue('')
        setShowPlain(false)
    }

    // 键盘快捷键
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (mode === 'edit') { cancelEdit(); return }
                App.closeSettings()
            }
            if (e.key === 'Enter' && mode === 'edit') void handleSave()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [mode, editValue])

    if (storedKey === null) {
        // 加载中
        return (
            <main className="h-screen w-screen bg-transparent p-3 flex items-center justify-center">
                <div className="w-full h-full rounded-[14px] bg-[#1c1c1e]/90 border border-white/10 backdrop-blur-2xl flex items-center justify-center">
                    <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
                </div>
            </main>
        )
    }

    return (
        <main className="h-screen w-screen bg-transparent p-3 flex items-center justify-center font-sans antialiased">
            <div
                className="w-full h-full rounded-[14px] bg-[#1c1c1e]/92 border border-white/[0.1] shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-[40px] flex flex-col overflow-hidden text-white/90"
                style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
            >
                {/* 顶部栏 */}
                <div className="h-9 flex items-center justify-between px-3 shrink-0 border-b border-white/[0.04]">
                    <span className="text-xs font-medium text-white/35 tracking-wide pl-1 select-none">密钥管理</span>
                    <button
                        className="w-[22px] h-[22px] flex items-center justify-center rounded-full hover:bg-white/15 text-white/40 hover:text-white transition-all duration-150"
                        onClick={() => App.closeSettings()}
                        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                        type="button"
                    >
                        <svg fill="none" height="10" viewBox="0 0 10 10" width="10">
                            <path d="M1.5 1.5 8.5 8.5M8.5 1.5 1.5 8.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.2" />
                        </svg>
                    </button>
                </div>

                {/* 内容区 */}
                <div
                    className="flex-1 px-6 py-5 flex flex-col gap-5"
                    style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                >
                    {mode === 'view' ? (
                        // ── 查看模式 ──
                        <>
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs text-white/50 font-medium">当前密钥</label>
                                    {hasKey && (
                                        <button
                                            className="text-[11px] text-white/30 hover:text-white/60 transition-colors"
                                            onClick={() => setShowPlain(v => !v)}
                                            type="button"
                                        >
                                            {showPlain ? '隐藏' : '显示'}
                                        </button>
                                    )}
                                </div>

                                {hasKey ? (
                                    <div className="w-full rounded-lg bg-black/35 border border-white/[0.08] px-3 py-2.5 flex items-center justify-between gap-2">
                                        <span className="font-mono text-sm text-white/80 tracking-wider truncate flex-1">
                                            {showPlain ? storedKey : maskKey(storedKey)}
                                        </span>
                                        {/* 复制按钮 */}
                                        <button
                                            className="shrink-0 text-white/30 hover:text-white/70 transition-colors"
                                            onClick={() => { void navigator.clipboard.writeText(storedKey) }}
                                            title="复制"
                                            type="button"
                                        >
                                            <svg fill="none" height="14" viewBox="0 0 24 24" width="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <rect height="13" rx="2" ry="2" width="13" x="9" y="9" />
                                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                            </svg>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="w-full rounded-lg bg-black/20 border border-dashed border-white/10 px-3 py-3 flex items-center gap-2">
                                        <span className="text-sm text-white/25 italic">尚未设置密钥</span>
                                    </div>
                                )}

                                <p className="text-[11px] text-white/25 pl-0.5">
                                    {hasKey ? '密钥已保存至本地，重启后仍有效。' : '请从管理端复制 ck_... 密钥后粘贴。'}
                                </p>
                            </div>

                            {/* 操作按钮区 */}
                            <div className="flex items-center gap-2">
                                <button
                                    className="flex-1 py-2 rounded-lg text-sm font-medium bg-white/[0.06] hover:bg-white/[0.11] border border-white/[0.07] text-white/75 hover:text-white transition-all"
                                    onClick={startEdit}
                                    type="button"
                                >
                                    {hasKey ? '修改' : '+ 设置密钥'}
                                </button>

                                {hasKey && (
                                    <button
                                        className={`py-2 px-4 rounded-lg text-sm font-medium border transition-all ${confirmDelete
                                                ? 'bg-red-500/25 border-red-500/50 text-red-400 hover:bg-red-500/35'
                                                : 'bg-transparent border-white/[0.07] text-white/35 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10'
                                            }`}
                                        onClick={() => void handleDelete()}
                                        type="button"
                                    >
                                        {confirmDelete ? '确认删除' : '删除'}
                                    </button>
                                )}
                            </div>

                            {saveOk && (
                                <div className="flex items-center gap-2 text-emerald-400 text-xs px-0.5">
                                    <svg fill="none" height="13" viewBox="0 0 24 24" width="13" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    已成功保存
                                </div>
                            )}
                        </>
                    ) : (
                        // ── 编辑模式 ──
                        <>
                            <div className="space-y-1.5">
                                <label className="text-xs text-white/50 font-medium block mb-1" htmlFor="key-edit-input">
                                    {hasKey ? '修改密钥' : '输入密钥'}
                                </label>
                                <div className="relative">
                                    <input
                                        autoComplete="off"
                                        autoFocus
                                        className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2.5 pr-10 text-sm font-mono text-white/90 placeholder:text-white/20 focus:outline-none focus:ring-[2px] focus:ring-blue-500/35 focus:border-blue-500/50 transition-all"
                                        id="key-edit-input"
                                        onChange={e => setEditValue(e.target.value)}
                                        placeholder="ck_..."
                                        spellCheck={false}
                                        type={showPlain ? 'text' : 'password'}
                                        value={editValue}
                                    />
                                    <button
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                                        onClick={() => setShowPlain(v => !v)}
                                        tabIndex={-1}
                                        type="button"
                                    >
                                        {showPlain ? (
                                            <svg fill="none" height="15" viewBox="0 0 24 24" width="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                                <line x1="1" x2="23" y1="1" y2="23" />
                                            </svg>
                                        ) : (
                                            <svg fill="none" height="15" viewBox="0 0 24 24" width="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                <circle cx="12" cy="12" r="3" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                                <p className="text-[11px] text-white/25 pl-0.5">Enter 确认，Esc 取消</p>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    className="flex-1 py-2 rounded-lg text-sm font-medium bg-transparent border border-white/[0.07] text-white/45 hover:bg-white/5 hover:text-white/70 transition-all"
                                    onClick={cancelEdit}
                                    type="button"
                                >
                                    取消
                                </button>
                                <button
                                    className="flex-1 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 border border-blue-500/50 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5"
                                    disabled={saving || !editValue.trim()}
                                    onClick={() => void handleSave()}
                                    type="button"
                                >
                                    {saving ? (
                                        <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" d="M4 12a8 8 0 018-8v8H4z" fill="currentColor" />
                                        </svg>
                                    ) : null}
                                    {saving ? '保存中...' : '保存'}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </main>
    )
}
