export type AlarmClock = { key: string; remaining: number; running: boolean; active: boolean };
export type AlarmState = { key: string; armed: boolean; notified: boolean };

/** Only a running positive countdown may expire; snapshots at zero never loop. */
export function timerExpired(state: AlarmState, clock: AlarmClock): boolean {
  if (state.key !== clock.key || !clock.active) {
    Object.assign(state, { key: clock.key, armed: false, notified: false });
  }
  if (!clock.active) return false;
  if (clock.running && clock.remaining > 0) {
    state.armed = true;
    state.notified = false;
  }
  if (clock.remaining > 0 || !state.armed || state.notified) return false;
  state.notified = true;
  return true;
}

/** Two quiet pulses, scheduled once in Web Audio, not a repeating interval. */
export function playTimerAlarm(context: AudioContext): void {
  for (let i = 0; i < 2; i++) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + i * 0.4;
    oscillator.frequency.value = 660;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.08, start + 0.02);
    gain.gain.linearRampToValueAtTime(0, start + 0.17);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(start);
    oscillator.stop(start + 0.18);
  }
}
