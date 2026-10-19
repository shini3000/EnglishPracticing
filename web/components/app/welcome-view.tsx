'use client';

import Link from 'next/link';
import { ArrowLeftIcon, MicrophoneIcon } from '@phosphor-icons/react/dist/ssr';
import { AvatarPicker } from '@/components/avatar/avatar-picker';
import { Button } from '@/components/ui/button';
import { type AvatarChoice, tutorNameFor } from '@/lib/avatar-choice';
import { NATIVE_LANGUAGES, type NativeLanguage, type PracticeMode } from '@/lib/practice-options';

/**
 * The pre-call screen: the last thing a learner sees before the microphone opens.
 *
 * This used to carry the passcode form, and starting a call meant unlocking, creating a
 * profile and connecting in the right order from here. All of that now happens at /login,
 * before this page is even reachable — so the screen is back to doing the one job the moment
 * actually calls for: telling them what is about to happen, letting them pick who they'll be
 * talking to, and letting them press the button when they're ready.
 */

interface WelcomeViewProps {
  nativeLanguage: NativeLanguage;
  practiceMode: PracticeMode;
  onNativeLanguage: (value: NativeLanguage) => void;
  onPracticeMode: (value: PracticeMode) => void;
  startButtonText: string;
  learnerName: string | null;
  avatarChoice: AvatarChoice;
  photoSrc: string | null;
  onPickAvatar: (choice: 'boy' | 'girl') => void;
  onPickPhotoAvatar: () => void;
  onStartCall: () => void;
}

export const WelcomeView = ({
  startButtonText,
  learnerName,
  avatarChoice,
  photoSrc,
  onPickAvatar,
  onPickPhotoAvatar,
  onStartCall,
  nativeLanguage,
  practiceMode,
  onNativeLanguage,
  onPracticeMode,
  ref,
}: React.ComponentProps<'div'> & WelcomeViewProps) => {
  const tutorName = tutorNameFor(avatarChoice);

  return (
    <div ref={ref}>
      <section className="mx-auto flex max-w-md flex-col items-center px-6 text-center">
        <h1 className="text-foreground mt-2 text-2xl font-semibold tracking-tight">
          {learnerName ? `Ready when you are, ${learnerName}` : 'Ready when you are'}
        </h1>

        <p className="text-muted-foreground mt-3 text-sm leading-6 text-pretty">
          {capitalize(tutorName)} guiará tu práctica de inglés, explicará las correcciones en tu
          idioma nativo y te pedirá que vuelvas a usar lo aprendido.
        </p>

        <div className="mt-4 grid w-full gap-3 text-left">
          <label className="text-sm">
            Idioma nativo para explicaciones
            <select
              value={nativeLanguage}
              onChange={(e) => onNativeLanguage(e.target.value as NativeLanguage)}
              className="bg-background mt-1 w-full rounded-md border p-2"
            >
              {Object.entries(NATIVE_LANGUAGES).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <p className="text-muted-foreground text-xs">Idioma de aprendizaje: inglés.</p>
          <label className="text-sm">
            Tipo de sesión
            <select
              value={practiceMode}
              onChange={(e) => onPracticeMode(e.target.value as PracticeMode)}
              className="bg-background mt-1 w-full rounded-md border p-2"
            >
              <option value="daily">Práctica tipo A · 145 min · práctica integral</option>
              <option value="diagnostic">Diagnóstico inicial · 30–40 min</option>
              <option value="fluency">Práctica tipo B · 55 min · fluidez y resistencia</option>
            </select>
          </label>
          <p className="text-muted-foreground text-xs">
            {practiceMode === 'daily'
              ? 'Tipo A: conversación, gramática aplicada, escucha, shadowing, vocabulario y transferencia.'
              : practiceMode === 'fluency'
                ? 'Tipo B: cambios de tiempo verbal, monólogo, escucha y réplica, rondas 4–3–2 y microauditoría.'
                : 'Diagnóstico: evaluación inicial para identificar tu nivel aproximado y prioridades.'}
          </p>
          {practiceMode === 'fluency' && (
            <Link className="rounded border p-3 text-sm underline" href="/drill">
              Bloque 1 · Gimnasia temporal sin llamada — empezar aquí
            </Link>
          )}
          <p className="text-muted-foreground text-xs">
            Puedes pausar o terminar antes. Las actividades pendientes se conservan como pendientes.
          </p>
        </div>

        <div className="mt-6 w-full text-left">
          <AvatarPicker
            choice={avatarChoice}
            photoSrc={photoSrc}
            onPick={onPickAvatar}
            onPickPhoto={onPickPhotoAvatar}
          />
        </div>

        <Button
          size="lg"
          onClick={onStartCall}
          className="mt-6 w-full max-w-xs gap-2 rounded-full font-medium"
        >
          <MicrophoneIcon size={17} weight="bold" />
          {startButtonText}
        </Button>

        <p className="text-muted-foreground mt-4 text-xs leading-5">
          Your browser will ask to use your microphone. Choose &ldquo;Allow&rdquo; so{' '}
          {tutorName === 'your tutor' ? 'your tutor' : tutorName} can hear you.
        </p>

        <Link
          href="/home"
          className="text-muted-foreground hover:text-foreground mt-6 flex items-center gap-1.5 text-sm transition-colors"
        >
          <ArrowLeftIcon size={14} weight="bold" />
          Back to home
        </Link>
      </section>

      <div className="fixed bottom-5 left-0 flex w-full items-center justify-center">
        <p className="text-muted-foreground max-w-prose px-6 text-center text-xs leading-5">
          Works best with headphones, in a quiet room.
        </p>
      </div>
    </div>
  );
};

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
