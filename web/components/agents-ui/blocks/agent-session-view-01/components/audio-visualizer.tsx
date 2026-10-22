'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { type MotionProps, motion } from 'motion/react';
import { useVoiceAssistant } from '@livekit/components-react';
import { AgentAudioVisualizerBar } from '@/components/agents-ui/agent-audio-visualizer-bar';
import { cn } from '@/lib/shadcn/utils';

function VisualizerLoading() {
  return (
    <div
      role="status"
      className="text-muted-foreground flex size-[300px] items-center justify-center text-sm"
    >
      Cargando visualización de audio…
    </div>
  );
}
const MotionAgentAudioVisualizerAura = dynamic(
  () =>
    import('@/components/agents-ui/agent-audio-visualizer-aura').then((module) =>
      motion.create(module.AgentAudioVisualizerAura)
    ),
  { loading: VisualizerLoading }
);
const MotionAgentAudioVisualizerBar = motion.create(AgentAudioVisualizerBar);
const MotionAgentAudioVisualizerGrid = dynamic(
  () =>
    import('@/components/agents-ui/agent-audio-visualizer-grid').then((module) =>
      motion.create(module.AgentAudioVisualizerGrid)
    ),
  { loading: VisualizerLoading }
);
const MotionAgentAudioVisualizerRadial = dynamic(
  () =>
    import('@/components/agents-ui/agent-audio-visualizer-radial').then((module) =>
      motion.create(module.AgentAudioVisualizerRadial)
    ),
  { loading: VisualizerLoading }
);
const MotionAgentAudioVisualizerWave = dynamic(
  () =>
    import('@/components/agents-ui/agent-audio-visualizer-wave').then((module) =>
      motion.create(module.AgentAudioVisualizerWave)
    ),
  { loading: VisualizerLoading }
);

interface AudioVisualizerProps extends MotionProps {
  isChatOpen: boolean;
  audioVisualizerType?: 'bar' | 'wave' | 'grid' | 'radial' | 'aura';
  audioVisualizerColor?: `#${string}`;
  audioVisualizerColorShift?: number;
  audioVisualizerWaveLineWidth?: number;
  audioVisualizerGridRowCount?: number;
  audioVisualizerGridColumnCount?: number;
  audioVisualizerRadialBarCount?: number;
  audioVisualizerRadialRadius?: number;
  audioVisualizerBarCount?: number;
  className?: string;
}

export function AudioVisualizer({
  audioVisualizerType = 'bar',
  audioVisualizerColor,
  audioVisualizerColorShift = 0.3,
  audioVisualizerBarCount = 5,
  audioVisualizerRadialRadius = 100,
  audioVisualizerRadialBarCount = 25,
  audioVisualizerGridRowCount = 15,
  audioVisualizerGridColumnCount = 15,
  audioVisualizerWaveLineWidth = 3,
  isChatOpen,
  className,
  ...props
}: AudioVisualizerProps) {
  const { state, audioTrack } = useVoiceAssistant();

  switch (audioVisualizerType) {
    case 'aura': {
      return (
        <MotionAgentAudioVisualizerAura
          state={state}
          audioTrack={audioTrack}
          color={audioVisualizerColor}
          colorShift={audioVisualizerColorShift}
          className={cn('size-[300px] md:size-[450px]', className)}
          {...props}
        />
      );
    }
    case 'wave': {
      return (
        <motion.div className={className} {...props}>
          <MotionAgentAudioVisualizerWave
            state={state}
            audioTrack={audioTrack}
            color={audioVisualizerColor}
            colorShift={audioVisualizerColorShift}
            lineWidth={isChatOpen ? audioVisualizerWaveLineWidth * 2 : audioVisualizerWaveLineWidth}
            className="size-[300px] md:size-[450px]"
          />
        </motion.div>
      );
    }
    case 'grid': {
      const totalCount = audioVisualizerGridRowCount * audioVisualizerGridColumnCount;

      let size: 'icon' | 'sm' | 'md' | 'lg' | 'xl' = 'sm';
      if (totalCount < 100) {
        size = 'xl';
      } else if (totalCount < 200) {
        size = 'lg';
      } else if (totalCount < 300) {
        size = 'md';
      }

      return (
        <MotionAgentAudioVisualizerGrid
          size={size}
          state={state}
          color={audioVisualizerColor}
          audioTrack={audioTrack}
          rowCount={audioVisualizerGridRowCount}
          columnCount={audioVisualizerGridColumnCount}
          radius={Math.round(
            Math.min(audioVisualizerGridRowCount, audioVisualizerGridColumnCount) / 4
          )}
          className={cn('size-[350px] gap-0 p-8 *:place-self-center md:size-[450px]', className)}
          {...props}
        />
      );
    }
    case 'radial': {
      return (
        <motion.div className={className} {...props}>
          <MotionAgentAudioVisualizerRadial
            size="xl"
            state={state}
            color={audioVisualizerColor}
            audioTrack={audioTrack}
            radius={audioVisualizerRadialRadius}
            barCount={audioVisualizerRadialBarCount}
            className="size-[450px]"
          />
        </motion.div>
      );
    }
    default: {
      let size: 'icon' | 'sm' | 'md' | 'lg' | 'xl' = 'icon';
      let sizedClassName = cn('size-[300px] md:size-[450px]', className);

      if (audioVisualizerBarCount <= 5) {
        size = 'xl';
        sizedClassName = cn('size-[450px] *:min-h-[64px] *:w-[64px] gap-4', className);
      } else if (audioVisualizerBarCount <= 10) {
        size = 'lg';
        sizedClassName = cn('size-[450px]', className);
      } else if (audioVisualizerBarCount <= 15) {
        size = 'md';
        sizedClassName = cn('size-[350px] md:size-[450px]', className);
      } else if (audioVisualizerBarCount <= 30) {
        size = 'sm';
        sizedClassName = cn('size-[300px] md:size-[450px]', className);
      }

      return (
        <MotionAgentAudioVisualizerBar
          size={size}
          state={state}
          color={audioVisualizerColor}
          audioTrack={audioTrack}
          barCount={audioVisualizerBarCount}
          className={sizedClassName}
          {...props}
        >
          <span className="min-h-2.5 w-2.5 rounded-full bg-current/10 transition-colors duration-250 ease-linear data-[lk-highlighted=true]:bg-current" />
        </MotionAgentAudioVisualizerBar>
      );
    }
  }
}
