'use client';

import { useEffect, useRef, useState } from 'react';
import { type RemoteParticipant, Room, RoomEvent } from 'livekit-client';

type Snapshot = {
  captureId: string;
  text: string;
  finished: boolean;
  overflow: boolean;
  error: boolean;
};

export function useDrillCall(capture: 'time-shifting' | 'agility' = 'time-shifting') {
  const room = useRef<Room | null>(null);
  const captureId = useRef('');
  const connecting = useRef(false);
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
    if (!participant)
      throw new Error(
        'El agente todavía no está listo. Comprueba que el servidor Python esté ejecutándose.'
      );
    return participant;
  }
  function accept(snapshot: Snapshot) {
    if (snapshot.captureId !== captureId.current) return;
    setText(snapshot.text);
    fatal.current = snapshot.overflow || snapshot.error;
    if (snapshot.overflow)
      setError(
        'La respuesta supera el límite. Conserva el texto y repite el paso con una respuesta más corta.'
      );
    else if (snapshot.error)
      setError(
        'Falló la transcripción. No se revisará una respuesta posiblemente incompleta; repite el paso.'
      );
  }
  async function control(action: 'start' | 'status' | 'finish'): Promise<Snapshot> {
    const instance = room.current;
    if (!instance) throw new Error('Conecta la llamada para transcribir.');
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
    if (connecting.current || room.current) return;
    connecting.current = true;
    setPending(true);
    setError('');
    const instance = new Room();
    room.current = instance;
    instance.on(RoomEvent.Disconnected, () => {
      setConnected(false);
      setReady(false);
      setCapturing(false);
      if (room.current === instance) {
        setError(
          'La llamada se desconectó. El texto recibido permanece en pantalla; no se completará este paso automáticamente.'
        );
        room.current = null;
      }
    });
    try {
      const response = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practiceMode: 'fluency',
          nativeLanguage: language,
          capture,
          ...(agentName ? { room_config: { agents: [{ agent_name: agentName }] } } : {}),
        }),
      });
      if (!response.ok)
        throw new Error(
          'No se pudo abrir la llamada. Comprueba la sesión y la configuración de LiveKit.'
        );
      const details = await response.json();
      if (room.current !== instance) return;
      await instance.connect(details.serverUrl, details.participantToken);
      if (room.current !== instance) {
        await instance.disconnect();
        return;
      }
      setConnected(true);
    } catch (e) {
      room.current = null;
      await instance.disconnect();
      setError(e instanceof Error ? e.message : 'No se pudo conectar la llamada.');
    } finally {
      setPending(false);
      connecting.current = false;
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
        if (!stopped && snapshot.error)
          setError('El servicio de transcripción falló. Termina la captura y repite el paso.');
      } catch (e) {
        if (!stopped) {
          setReady(false);
          if (!capturing && Date.now() - waitingSince > 30_000)
            setError(
              'No se ha conectado el agente de transcripción. Reinicia el servidor Python y vuelve a conectar la llamada.'
            );
          if (capturing)
            setError(e instanceof Error ? e.message : 'Se perdió la conexión con el agente.');
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
      const instance = room.current;
      room.current = null;
      void instance?.disconnect();
    },
    []
  );

  async function begin() {
    setPending(true);
    setError('');
    try {
      captureId.current = crypto.randomUUID();
      fatal.current = false;
      await control('start');
      await room.current!.localParticipant.setMicrophoneEnabled(true);
      setCapturing(true);
    } catch (e) {
      // A denied microphone must not leave a server capture active.
      await room.current?.localParticipant.setMicrophoneEnabled(false).catch(() => {});
      await control('finish').catch(() => {});
      setError(e instanceof Error ? e.message : 'No se pudo abrir el micrófono.');
      throw e;
    } finally {
      setPending(false);
    }
  }
  async function finish() {
    setPending(true);
    try {
      await room.current?.localParticipant.setMicrophoneEnabled(false);
      const result = await control('finish');
      setCapturing(false);
      if (fatal.current)
        throw new Error('La transcripción está incompleta. Repite la captura antes de revisar.');
      if (!result.finished || !result.text.trim())
        throw new Error(
          'No se recibió voz transcrita. Repite la captura y comprueba el micrófono.'
        );
      return result.text;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'No se pudo cerrar la transcripción. Inténtalo de nuevo.'
      );
      throw e;
    } finally {
      setPending(false);
    }
  }
  async function disconnect() {
    const instance = room.current;
    room.current = null;
    await instance?.disconnect();
    setConnected(false);
    setReady(false);
    setCapturing(false);
  }
  return { connected, ready, capturing, pending, text, error, connect, begin, finish, disconnect };
}
