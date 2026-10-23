'use client';

import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { MonitorIcon, MoonIcon, SunIcon } from '@phosphor-icons/react';
import { cn } from '@/lib/shadcn/utils';

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const t = useTranslations('ui');

  const { theme, setTheme } = useTheme();

  return (
    <div
      className={cn(
        'text-foreground bg-background flex w-full flex-row justify-end divide-x overflow-hidden rounded-full border',
        className
      )}
    >
      <span className="sr-only">{t('m43393125b9b6')}</span>
      <button
        type="button"
        onClick={() => setTheme('dark')}
        className="flex size-10 cursor-pointer items-center justify-center"
      >
        <span className="sr-only">{t('m880d418b13a6')}</span>
        <MoonIcon
          suppressHydrationWarning
          size={16}
          weight="bold"
          className={cn(theme !== 'dark' && 'opacity-25')}
        />
      </button>
      <button
        type="button"
        onClick={() => setTheme('light')}
        className="flex size-10 cursor-pointer items-center justify-center"
      >
        <span className="sr-only">{t('m7e62a332c5f1')}</span>
        <SunIcon
          suppressHydrationWarning
          size={16}
          weight="bold"
          className={cn(theme !== 'light' && 'opacity-25')}
        />
      </button>
      <button
        type="button"
        onClick={() => setTheme('system')}
        className="flex size-10 cursor-pointer items-center justify-center"
      >
        <span className="sr-only">{t('mcb7960100e28')}</span>
        <MonitorIcon
          suppressHydrationWarning
          size={16}
          weight="bold"
          className={cn(theme !== 'system' && 'opacity-25')}
        />
      </button>
    </div>
  );
}
