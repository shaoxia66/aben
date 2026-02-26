'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { IconSparkles, IconX } from '@tabler/icons-react';

function pickMessage(messages: string[], index: number) {
  if (messages.length === 0) return '你好，我是智能助手。';
  return messages[index % messages.length] ?? messages[0]!;
}

export default function DesktopAssistant() {
  const messages = useMemo(
    () => [
      '你好，我是智能助手。点击我可以打开气泡。',
      '需要我帮你找入口、定位功能，或者解释页面吗？',
      '想和智能体对话的话，可以去「会话」里开始。'
    ],
    []
  );

  const [open, setOpen] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);
  const [text, setText] = useState(() => pickMessage(messages, 0));
  const messageIndexRef = useRef(0);
  const autoTimerRef = useRef<number | null>(null);
  const autoIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    const show = () => {
      setText(pickMessage(messages, messageIndexRef.current));
      setOpen(true);
      if (autoTimerRef.current) window.clearTimeout(autoTimerRef.current);
      autoTimerRef.current = window.setTimeout(() => setOpen(false), 6000);
    };

    const initial = window.setTimeout(show, 1200);
    autoIntervalRef.current = window.setInterval(() => {
      setMessageIndex((i) => {
        const next = i + 1;
        messageIndexRef.current = next;
        return next;
      });
      show();
    }, 45000);

    return () => {
      window.clearTimeout(initial);
      if (autoTimerRef.current) window.clearTimeout(autoTimerRef.current);
      if (autoIntervalRef.current) window.clearInterval(autoIntervalRef.current);
    };
  }, [messages]);

  useEffect(() => {
    messageIndexRef.current = messageIndex;
    setText(pickMessage(messages, messageIndex));
  }, [messages, messageIndex]);

  return (
    <div className='fixed right-6 bottom-6 z-50 select-none'>
      <div className='relative flex flex-col items-end gap-2'>
        {open ? (
          <div className="relative max-w-[260px] rounded-2xl bg-popover px-3 py-2 text-sm leading-relaxed shadow-lg after:absolute after:right-5 after:-bottom-2 after:h-0 after:w-0 after:border-x-[10px] after:border-x-transparent after:border-t-[12px] after:border-t-popover">
            <div className='flex items-start gap-2'>
              <div className='min-w-0 flex-1 whitespace-pre-wrap'>{text}</div>
              <button
                type='button'
                aria-label='关闭气泡'
                className='text-muted-foreground hover:text-foreground -mr-0.5 -mt-0.5 inline-flex size-6 items-center justify-center rounded-md outline-none'
                onClick={() => setOpen(false)}
              >
                <IconX className='size-4' />
              </button>
            </div>
            <div className='text-muted-foreground mt-2 flex items-center justify-end gap-3 text-xs'>
              <Link href='/dashboard/workspaces/sessions' className='hover:text-foreground underline underline-offset-2'>
                打开会话
              </Link>
              <button
                type='button'
                className='hover:text-foreground underline underline-offset-2'
                onClick={() => {
                  setMessageIndex((i) => {
                    const next = i + 1;
                    messageIndexRef.current = next;
                    return next;
                  });
                }}
              >
                换一句
              </button>
            </div>
          </div>
        ) : null}

        <button
          type='button'
          aria-label='桌面智能助手'
          className='group relative inline-flex size-14 items-center justify-center bg-transparent p-0 outline-none focus-visible:outline-none focus-visible:ring-0'
          onClick={() => {
            setMessageIndex((i) => {
              const next = i + 1;
              messageIndexRef.current = next;
              return next;
            });
            setOpen((v) => {
              const next = !v;
              if (next) {
                if (autoTimerRef.current) window.clearTimeout(autoTimerRef.current);
                autoTimerRef.current = window.setTimeout(() => setOpen(false), 8000);
              }
              return next;
            });
          }}
        >
          <IconSparkles className='text-primary size-11 drop-shadow-sm transition-transform group-active:scale-[0.98]' />
        </button>
      </div>
    </div>
  );
}
