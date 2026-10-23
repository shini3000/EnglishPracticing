'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { type AlarmClock, playTimerAlarm, timerExpired } from '@/lib/timer-alarm';

export function useTimerAlarm(clock: AlarmClock) {
  const { key, remaining, running, active } = clock;
  const context = useRef<AudioContext | null>(null);
  const state = useRef({ key: '', armed: false, notified: false });
  const mounted = useRef(false);
  const [ready, setReady] = useState(false);
  const enable = useCallback(async () => {
    if (!window.AudioContext) return;
    try {
      context.current ??= new AudioContext();
      await context.current.resume();
      if (mounted.current) setReady(context.current?.state === 'running');
    } catch {
      /* A blocked or unsupported audio device must never stop practice. */
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    const unlock = () => {
      void enable();
    };
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    return () => {
      mounted.current = false;
      window.removeEventListener('pointerdown', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
      const current = context.current;
      context.current = null;
      if (current) void current.close().catch(() => {});
    };
  }, [enable]);
  useEffect(() => {
    if (
      timerExpired(state.current, { key, remaining, running, active }) &&
      context.current?.state === 'running'
    ) {
      try {
        playTimerAlarm(context.current);
      } catch {
        /* Keep the visual cue. */
      }
    }
  }, [key, remaining, running, active]);
  return { ready, enable };
}
