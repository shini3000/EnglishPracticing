'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { ArrowLeftIcon, MicrophoneIcon } from '@phosphor-icons/react/dist/ssr';
import { AvatarPicker } from '@/components/avatar/avatar-picker';
import { FluencyBlocks } from '@/components/practice/fluency-blocks';
import { Button } from '@/components/ui/button';
import { translateStatic } from '@/i18n/static-text';
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
  onPracticeMode,
  ref,
}: React.ComponentProps<'div'> & WelcomeViewProps) => {
  const t = useTranslations('ui');

  const tutorName = tutorNameFor(avatarChoice);

  return (
    <div ref={ref} className="call-preparation">
      <Link href="/home" className="study-text-link inline-flex items-center gap-2 text-sm">
        <ArrowLeftIcon size={16} />
        {t('m23e939f389fb')}
      </Link>
      <section className="call-preparation-grid">
        <div>
          <h1 className="study-title">
            {learnerName ? t('m74bfca76a7ed', { v0: learnerName }) : t('m8c19d33e95f4')}
          </h1>

          <p className="text-muted-foreground mt-5 leading-7 text-pretty">
            {t('m461d7ebb40e2')} {capitalize(tutorName)} {t('mcc277488410d')}
          </p>
          <div className="learning-note mt-8 border-t">
            <h2 className="font-semibold">{t('me8d67fde2492')}</h2>
            <p className="text-muted-foreground mt-3 text-sm leading-6">
              {t('mf532349ac3bf')} {translateStatic(t, startButtonText)}».
            </p>
            <p className="text-muted-foreground mt-3 text-sm leading-6">{t('mcd5bdc88f472')}</p>
          </div>
        </div>
        <div className="preparation-form">
          <h2 className="mb-5 text-xl font-semibold">{t('m6503a20f6865')}</h2>
          <div className="grid w-full gap-4 text-left">
            <p className="text-sm">
              {t('medca6f0ab6be')} {translateStatic(t, NATIVE_LANGUAGES[nativeLanguage])}.{' '}
              <Link href="/profile" className="study-text-link">
                {t('m1096db3ab260')}
              </Link>
            </p>
            <p className="text-muted-foreground text-xs">{t('m3486390d66a1')}</p>
            <label className="text-sm">
              {t('m8e2ff3119cc8')}
              <select
                value={practiceMode}
                onChange={(e) => onPracticeMode(e.target.value as PracticeMode)}
                className="study-field"
              >
                <option value="daily">{t('m6f00f74be8a8')}</option>
                <option value="diagnostic">{t('mba5897446d51')}</option>
                <option value="fluency">{t('m90471cb77372')}</option>
              </select>
            </label>
            <p className="text-muted-foreground text-xs">
              {practiceMode === 'daily'
                ? t('m1d51c8f00cab')
                : practiceMode === 'fluency'
                  ? t('ma09c558ddd02')
                  : t('m1d8ccfca8304')}
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
            <p className="text-muted-foreground mb-4 text-sm">{t('m3db74c6117c1')}</p>
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
            {translateStatic(t, startButtonText)}
          </Button>

          <p className="text-muted-foreground mt-4 text-xs leading-5">{t('mbb3c98d48783')}</p>
        </div>
      </section>
    </div>
  );
};

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
