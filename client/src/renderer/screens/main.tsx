import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const { App } = window

export function MainScreen() {
  // 气泡消息：保留给后续「助手主动通知」使用，暂不通过点击触发
  const [bubbleText, setBubbleText] = useState<string | null>(null)
  const timerRef = useRef<number | null>(null)

  const dragRef = useRef<{
    pointerId: number | null
    startScreenX: number
    startScreenY: number
    moved: boolean
    lastTap: number   // 记录上次抬起时间，用于识别双击
  }>({ pointerId: null, startScreenX: 0, startScreenY: 0, moved: false, lastTap: 0 })

  // 暴露给外部：后续智能体可以通过 IPC 调用来推送气泡通知
  // 例：setBubbleText('任务已完成')
  useEffect(() => {
    App.sayHelloFromBridge()
    void App.setWidgetMode('compact')
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [])

  const showBubble = (text: string) => {
    setBubbleText(text)
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => setBubbleText(null), 6000)
  }
    // 导出供后续使用（暂时挂到 window 方便调试）
    ; (window as unknown as Record<string, unknown>).__showBubble = showBubble

  return (
    <main className="h-screen w-screen bg-transparent">
      <div className="relative flex h-full w-full items-end justify-end p-6">
        <div className="relative flex flex-col items-end gap-2">
          {/* 气泡通知区（仅由助手主动推送，不再由单击触发） */}
          {bubbleText ? (
            <div
              className="relative max-w-[260px] rounded-2xl bg-black/70 px-3 py-2 text-sm leading-relaxed text-white shadow-lg backdrop-blur-md after:absolute after:right-5 after:-bottom-2 after:h-0 after:w-0 after:border-x-[10px] after:border-x-transparent after:border-t-[12px] after:border-t-black/70"
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1 whitespace-pre-wrap">{bubbleText}</div>
                <button
                  aria-label="关闭气泡"
                  className="text-white/70 hover:text-white inline-flex size-6 items-center justify-center rounded-md"
                  onClick={() => setBubbleText(null)}
                  type="button"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
          ) : null}

          {/* 助手图标：单击无响应（拖拽）；双击打开聊天窗口 */}
          <button
            aria-label="桌面智能助手"
            className="bg-transparent p-0 outline-none focus-visible:outline-none"
            onPointerDown={event => {
              dragRef.current.pointerId = event.pointerId
              dragRef.current.startScreenX = event.screenX
              dragRef.current.startScreenY = event.screenY
              dragRef.current.moved = false
              event.currentTarget.setPointerCapture(event.pointerId)
              App.widgetDrag({
                phase: 'start',
                screenX: event.screenX,
                screenY: event.screenY,
                offsetX: event.clientX,
                offsetY: event.clientY,
              })
            }}
            onPointerMove={event => {
              if (dragRef.current.pointerId !== event.pointerId) return
              const dx = Math.abs(event.screenX - dragRef.current.startScreenX)
              const dy = Math.abs(event.screenY - dragRef.current.startScreenY)
              if (dx + dy > 4) dragRef.current.moved = true
              App.widgetDrag({
                phase: 'move',
                screenX: event.screenX,
                screenY: event.screenY,
              })
            }}
            onPointerUp={event => {
              if (dragRef.current.pointerId !== event.pointerId) return
              dragRef.current.pointerId = null
              App.widgetDrag({
                phase: 'end',
                screenX: event.screenX,
                screenY: event.screenY,
              })

              if (!dragRef.current.moved) {
                const now = Date.now()
                const elapsed = now - dragRef.current.lastTap
                if (elapsed < 350) {
                  // 双击：打开聊天窗口
                  void App.openChat()
                  dragRef.current.lastTap = 0
                } else {
                  // 单击：仅记录时间，不做任何事
                  dragRef.current.lastTap = now
                }
              }
            }}
            type="button"
          >
            <RobotIcon className="h-20 w-20 text-teal-300 drop-shadow-sm" />
          </button>
        </div>
      </div>
    </main>
  )
}

function RobotIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M16 35c-4 2-7 6-7 10 0 3 2 5 5 5 3 0 6-2 8-5"
        opacity="0.55"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <g className="assistant-wave">
        <path
          d="M48 35c4 2 7 6 7 10 0 3-2 5-5 5-3 0-6-2-8-5"
          opacity="0.55"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="3"
        />
        <path
          d="M56.5 32.5c1.2-1.2 3.1-1.2 4.3 0"
          opacity="0.45"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2.2"
        />
      </g>
      <path
        d="M32 8c1.1046 0 2 .89543 2 2v6.2c7.9.9 14 7.6 14 15.6v9.8c0 8.8-7.2 16-16 16s-16-7.2-16-16v-9.8c0-8 6.1-14.7 14-15.6V10c0-1.10457.8954-2 2-2Z"
        fill="currentColor"
        opacity="0.92"
      />
      <rect
        fill="black"
        height="18"
        opacity="0.55"
        rx="9"
        width="28"
        x="18"
        y="26"
      />
      <circle className="assistant-eye" cx="27" cy="35" fill="white" r="3.2" />
      <circle className="assistant-eye" cx="37" cy="35" fill="white" r="3.2" />
      <path
        d="M26 46c2.1 2 4.3 3 6 3s3.9-1 6-3"
        stroke="white"
        strokeLinecap="round"
        strokeOpacity="0.9"
        strokeWidth="2.2"
      />
      <path
        d="M22 18.5c2-2.6 5.6-4.5 10-4.5s8 1.9 10 4.5"
        opacity="0.55"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.2"
      />
    </svg>
  )
}

