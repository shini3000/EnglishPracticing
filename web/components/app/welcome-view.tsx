'use client';

import Link from 'next/link';
import { ArrowLeftIcon, MicrophoneIcon } from '@phosphor-icons/react/dist/ssr';
import { AvatarPicker } from '@/components/avatar/avatar-picker';
import { FluencyBlocks } from '@/components/practice/fluency-blocks';
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
  startStep: number;
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
  startStep,
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
    <div ref={ref} className="call-preparation">
      <Link href="/home" className="study-text-link inline-flex items-center gap-2 text-sm">
        <ArrowLeftIcon size={16} />
        Volver a las prácticas
      </Link>
      <section className="call-preparation-grid">
        <div>
          <h1 className="study-title">
            {learnerName ? `A tu ritmo, ${learnerName}.` : 'Prepara tu práctica.'}
          </h1>

          <p className="text-muted-foreground mt-5 leading-7 text-pretty">
            Practicarás inglés con {capitalize(tutorName)}. Las correcciones gramaticales aparecerán
            por escrito, con explicaciones en tu idioma nativo.
          </p>
          <div className="learning-note mt-8 border-t">
            <h2 className="font-semibold">Antes de abrir el micrófono</h2>
            <p className="text-muted-foreground mt-3 text-sm leading-6">
              Elige un lugar tranquilo y, si puedes, usa auriculares. La llamada solo comenzará al
              pulsar «{startButtonText}».
            </p>
            <p className="text-muted-foreground mt-3 text-sm leading-6">
              Puedes hacer pausas y terminar antes. Las actividades pendientes se conservan como
              pendientes.
            </p>
          </div>
        </div>
        <div className="preparation-form">
          <h2 className="mb-5 text-xl font-semibold">Configura tu sesión</h2>
          <div className="grid w-full gap-4 text-left">
            <label className="text-sm">
              Idioma nativo para explicaciones
              <select
                value={nativeLanguage}
                onChange={(e) => onNativeLanguage(e.target.value as NativeLanguage)}
                className="study-field"
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
                className="study-field"
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
              <FluencyBlocks
                current={
                  startStep >= 15
                    ? 4
                    : startStep >= 9
                      ? 3
                      : startStep >= 5
                        ? 2
                        : startStep >= 4
                          ? 1
                          : 0
                }
              />
            )}
          </div>

          <div className="mt-6 w-full text-left">
            <p className="text-muted-foreground mb-4 text-sm">
              Habla en inglés por el micrófono. Si necesitas preguntar algo en otro idioma,
              escríbelo en el chat de la llamada.
            </p>
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
            className="mt-6 w-full gap-2 rounded-xl font-medium"
          >
            <MicrophoneIcon size={17} weight="bold" />
            {startButtonText}
          </Button>

          <p className="text-muted-foreground mt-4 text-xs leading-5">
            Tu navegador pedirá permiso para usar el micrófono. Elige «Permitir» para que el tutor
            pueda escucharte.
          </p>
        </div>
      </section>
    </div>
  );
};

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
