'use client';

import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'motion/react';
import { useSessionContext } from '@livekit/components-react';
import type { AppConfig } from '@/app-config';
import { PracticePanel } from '@/components/app/practice-panel';
import { WelcomeView } from '@/components/app/welcome-view';
import { Skeleton } from '@/components/ui/skeleton';
import type { AvatarChoice } from '@/lib/avatar-choice';
import type { NativeLanguage, PracticeMode } from '@/lib/practice-options';

const MotionWelcomeView = motion.create(WelcomeView);
function SessionLoading() {
  const t = useTranslations('ui');

  const { end } = useSessionContext();
  return (
    <div className="call-session-view bg-background flex flex-col items-center justify-center gap-5 p-6">
      <p role="status" aria-live="polite">
        {t('m5127fc99bf08')}
      </p>
      <Skeleton className="h-48 w-48 rounded-full" />
      <button className="study-button" onClick={() => void end()}>
        {t('m43df91572f34')}
      </button>
    </div>
  );
}

const MotionSessionView = dynamic(
  () => import('@/components/app/motion-session-view').then((module) => module.MotionSessionView),
  { loading: SessionLoading }
);

const VIEW_MOTION_PROPS = {
  variants: {
    visible: {
      opacity: 1,
    },
    hidden: {
      opacity: 0,
    },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
  transition: {
    duration: 0.5,
    ease: 'linear',
  },
};

interface ViewControllerProps {
  startStep: number;
  nativeLanguage: NativeLanguage;
  practiceMode: PracticeMode;
  onPracticeMode: (value: PracticeMode) => void;
  appConfig: AppConfig;
  learnerName: string | null;
  avatarChoice: AvatarChoice;
  photoSrc: string | null;
  onPickAvatar: (choice: 'boy' | 'girl') => void;
  onPickPhotoAvatar: () => void;
}

export function ViewController({
  startStep,
  appConfig,
  learnerName,
  avatarChoice,
  photoSrc,
  onPickAvatar,
  onPickPhotoAvatar,
  nativeLanguage,
  practiceMode,
  onPracticeMode,
}: ViewControllerProps) {
  const { isConnected, start } = useSessionContext();
  const { resolvedTheme } = useTheme();

  return (
    <>
      <AnimatePresence mode="wait">
        {/* Welcome view */}
        {!isConnected && (
          <MotionWelcomeView
            startStep={startStep}
            key="welcome"
            {...VIEW_MOTION_PROPS}
            startButtonText={appConfig.startButtonText}
            learnerName={learnerName}
            avatarChoice={avatarChoice}
            photoSrc={photoSrc}
            onPickAvatar={onPickAvatar}
            onPickPhotoAvatar={onPickPhotoAvatar}
            onStartCall={start}
            nativeLanguage={nativeLanguage}
            practiceMode={practiceMode}
            onPracticeMode={onPracticeMode}
          />
        )}
      </AnimatePresence>
      {/* Session view */}
      <PracticePanel mode={practiceMode}>
        {isConnected && (
          <MotionSessionView
            key="session-view"
            {...VIEW_MOTION_PROPS}
            supportsChatInput={appConfig.supportsChatInput}
            supportsVideoInput={appConfig.supportsVideoInput}
            supportsScreenShare={appConfig.supportsScreenShare}
            isPreConnectBufferEnabled={appConfig.isPreConnectBufferEnabled}
            // The photo avatar arrives as a real video track and takes over the tile on its
            // own; the free characters are rendered locally from this prop. Photo mode passes
            // no character, so a failed bitHuman session falls back to the neutral visualizer
            // rather than to a face whose voice may not match.
            characterAvatar={avatarChoice === 'photo' ? undefined : avatarChoice}
            audioVisualizerType={appConfig.audioVisualizerType}
            audioVisualizerColor={
              resolvedTheme === 'dark'
                ? appConfig.audioVisualizerColorDark
                : appConfig.audioVisualizerColor
            }
            audioVisualizerColorShift={appConfig.audioVisualizerColorShift}
            audioVisualizerBarCount={appConfig.audioVisualizerBarCount}
            audioVisualizerGridRowCount={appConfig.audioVisualizerGridRowCount}
            audioVisualizerGridColumnCount={appConfig.audioVisualizerGridColumnCount}
            audioVisualizerRadialBarCount={appConfig.audioVisualizerRadialBarCount}
            audioVisualizerRadialRadius={appConfig.audioVisualizerRadialRadius}
            audioVisualizerWaveLineWidth={appConfig.audioVisualizerWaveLineWidth}
            className="call-session-view"
          />
        )}
      </PracticePanel>
    </>
  );
}
