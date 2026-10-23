'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { type RemoteParticipant, Room, RoomEvent } from 'livekit-client';

type Snapshot = {
  captureId: string;
  text: string;
  finished: boolean;
  overflow: boolean;
  error: boolean;
};

export function useDrillCall(capture: 'time-shifting' | 'agility' = 'time-shifting') {
  const t = useTranslations('ui');

  const room = useRef<Room | null>(null);
  const captureId = useRef('');
  const connecting = useRef(false);
  const starting = useRef(false);
  const startId = useRef(0);
  const connectionAbort = useRef<AbortController | null>(null);
  const cancelWait = useRef<(() => void) | null>(null);
  const [connected, setConnected] = useState(false);
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [pending, setPending] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const fatal = useRef(false);

  function agent(): RemoteParticipant {
    const participant = [...(room.current?.remoteParticipants.values() ?? [])].find(
      (p) => p.isAgent && p.attributes.drill_ready === 'true'
    );
    if (!participant) throw new Error(t('mb3dbe42796b8'));
    return participant;
  }
  function accept(snapshot: Snapshot) {
    if (snapshot.captureId !== captureId.current) return;
    setText(snapshot.text);
    fatal.current = snapshot.overflow || snapshot.error;
    if (snapshot.overflow) setError(t('ma02939400705'));
    else if (snapshot.error) setError(t('m601b0729c933'));
  }
  async function control(action: 'start' | 'status' | 'finish'): Promise<Snapshot> {
    const instance = room.current;
    if (!instance) throw new Error(t('m3891f7f5b36a'));
    const snapshot = JSON.parse(
      await instance.localParticipant.performRpc({
        destinationIdentity: agent().identity,
        method: 'drill.control',
        payload: JSON.stringify({ action, captureId: captureId.current }),
        responseTimeout: action === 'finish' ? 20_000 : 5000,
      })
    ) as Snapshot;
    accept(snapshot);
    return snapshot;
  }
  async function connect(language: string, agentName?: string) {
    if (connecting.current || room.current) return null;
    connecting.current = true;
    setPending(true);
    setError('');
    const instance = new Room();
    const abort = new AbortController();
    connectionAbort.current = abort;
    room.current = instance;
    instance.on(RoomEvent.Disconnected, () => {
      if (room.current !== instance) return;
      setConnected(false);
      setReady(false);
      setCapturing(false);
      if (room.current === instance) {
        setError(t('mef3e2889ead8'));
        room.current = null;
      }
    });
    try {
      const response = await fetch('/api/token', {
        method: 'POST',
        signal: abort.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practiceMode: 'fluency',
          nativeLanguage: language,
          capture,
          ...(agentName ? { room_config: { agents: [{ agent_name: agentName }] } } : {}),
        }),
      });
      if (!response.ok) throw new Error(t('mb44b37d8577a'));
      const details = await response.json();
      if (room.current !== instance) return null;
      await instance.connect(details.serverUrl, details.participantToken);
      if (room.current !== instance) {
        await instance.disconnect();
        return null;
      }
      setConnected(true);
      return instance;
    } catch (e) {
      const active = room.current === instance;
      if (active) room.current = null;
      await instance.disconnect();
      if (active) setError(e instanceof Error ? e.message : t('mb33ab6f1428c'));
      return null;
    } finally {
      if (connectionAbort.current === abort) {
        connectionAbort.current = null;
        setPending(false);
        connecting.current = false;
      }
    }
  }

  function waitForAgent(instance: Room) {
    return new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timeout);
        instance.off(RoomEvent.ParticipantConnected, check);
        instance.off(RoomEvent.ParticipantAttributesChanged, check);
        instance.off(RoomEvent.Disconnected, cancelled);
        if (cancelWait.current === cancelled) cancelWait.current = null;
      };
      const cancelled = () => {
        cleanup();
        reject(new Error(t('mbe29969acc27')));
      };
      const check = () => {
        if (room.current !== instance) return cancelled();
        if (
          [...instance.remoteParticipants.values()].some(
            (participant) => participant.isAgent && participant.attributes.drill_ready === 'true'
          )
        ) {
          cleanup();
          setReady(true);
          resolve();
        }
      };
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(t('md17f30b5dc5c')));
      }, 30_000);
      cancelWait.current = cancelled;
      instance.on(RoomEvent.ParticipantConnected, check);
      instance.on(RoomEvent.ParticipantAttributesChanged, check);
      instance.on(RoomEvent.Disconnected, cancelled);
      check();
    });
  }

  // One explicit click connects, waits for the listener and opens the microphone.
  // No microphone or timer starts just by visiting the exercise.
  async function start(language: string, agentName?: string) {
    if (starting.current) return false;
    const id = ++startId.current;
    starting.current = true;
    setPending(true);
    setError('');
    try {
      const instance = room.current ?? (await connect(language, agentName));
      if (!instance) throw new Error(t('m5765b059c984'));
      setPending(true);
      await waitForAgent(instance);
      await begin();
      return true;
    } catch (e) {
      if (id === startId.current) setError(e instanceof Error ? e.message : t('m926a7d492154'));
      throw e;
    } finally {
      if (id === startId.current) {
        starting.current = false;
        setPending(false);
      }
    }
  }
  useEffect(() => {
    if (!connected) return;
    let stopped = false;
    let polling = false;
    const waitingSince = Date.now();
    const tick = async () => {
      if (polling) return;
      try {
        agent();
        setReady(true);
        if (!capturing || !captureId.current) return;
        polling = true;
        const snapshot = await control('status');
        if (!stopped && snapshot.error) setError(t('ma2322275827a'));
      } catch (e) {
        if (!stopped) {
          setReady(false);
          if (!capturing && Date.now() - waitingSince > 30_000) setError(t('mad801b915857'));
          if (capturing) setError(e instanceof Error ? e.message : t('mca8bc5f6fc41'));
        }
      } finally {
        polling = false;
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 1000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
    // RPC snapshots are authoritative; one id per capture, never append polling duplicates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, capturing]);
  useEffect(
    () => () => {
      ++startId.current;
      connectionAbort.current?.abort();
      cancelWait.current?.();
      const instance = room.current;
      room.current = null;
      void instance?.disconnect();
    },
    []
  );

  async function begin() {
    const id = startId.current;
    setPending(true);
    setError('');
    const instance = room.current;
    try {
      if (!instance) throw new Error(t('m6ce71bc12ba0'));
      captureId.current = crypto.randomUUID();
      fatal.current = false;
      await control('start');
      if (room.current !== instance) throw new Error(t('mc1f6b1b79f3b'));
      await instance.localParticipant.setMicrophoneEnabled(true);
      if (room.current !== instance) {
        await instance.localParticipant.setMicrophoneEnabled(false);
        throw new Error(t('mc1f6b1b79f3b'));
      }
      setCapturing(true);
    } catch (e) {
      // A denied microphone must not leave a server capture active.
      await instance?.localParticipant.setMicrophoneEnabled(false).catch(() => {});
      if (room.current === instance) {
        await control('finish').catch(() => {});
        setError(e instanceof Error ? e.message : t('maa13daaf75d7'));
      }
      throw e;
    } finally {
      if (id === startId.current) setPending(false);
    }
  }
  async function finish() {
    setPending(true);
    try {
      await room.current?.localParticipant.setMicrophoneEnabled(false);
      const result = await control('finish');
      setCapturing(false);
      if (fatal.current) throw new Error(t('m64f9fd1a9052'));
      if (!result.finished || !result.text.trim()) throw new Error(t('mf1b248ab625c'));
      return result.text;
    } catch (e) {
      setError(e instanceof Error ? e.message : t('mae389129bdc9'));
      throw e;
    } finally {
      setPending(false);
    }
  }
  async function disconnect() {
    ++startId.current;
    starting.current = false;
    connectionAbort.current?.abort();
    connectionAbort.current = null;
    connecting.current = false;
    cancelWait.current?.();
    const instance = room.current;
    room.current = null;
    setConnected(false);
    setReady(false);
    setCapturing(false);
    setPending(false);
    await instance?.disconnect();
  }
  return {
    connected,
    ready,
    capturing,
    pending,
    text,
    error,
    connect,
    start,
    begin,
    finish,
    disconnect,
  };
}
