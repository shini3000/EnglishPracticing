'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { LockSimpleIcon } from '@phosphor-icons/react/dist/ssr';
import { AnimatedTutor } from '@/components/avatar/animated-tutor';
import type { AvatarChoice } from '@/lib/avatar-choice';
import { cn } from '@/lib/shadcn/utils';

/**
 * The pre-call tutor picker: Ahmad, Sara, or your own photo.
 *
 * The two characters are free and switch instantly. The photo option always routes through
 * its dialog (it may need a passcode and an upload), so this component never decides whether
 * the learner is *entitled* to it — it only reports the click. Entitlement lives on the
 * server (/api/avatar), where it can't be edited out of a bundle.
 */

interface AvatarPickerProps {
  choice: AvatarChoice;
  /**
   * URL of the learner's uploaded photo, or null before any upload. Non-null makes the
   * photo tile show the actual photo — the visible proof the upload worked — where the
   * character tiles show their faces.
   */
  photoSrc: string | null;
  onPick: (choice: 'boy' | 'girl') => void;
  onPickPhoto: () => void;
}

interface TileProps {
  label: string;
  sublabel: string;
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function Tile({ label, sublabel, selected, onClick, children }: TileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'flex flex-1 flex-col items-center gap-1.5 rounded-2xl border p-3 transition-all',
        'hover:border-ring/60 focus-visible:ring-ring/50 outline-none focus-visible:ring-2',
        selected ? 'border-primary ring-primary/25 shadow-sm ring-2' : 'border-input'
      )}
    >
      {children}
      <span className="text-foreground text-sm leading-none font-medium">{label}</span>
      <span className="text-muted-foreground text-xs leading-none">{sublabel}</span>
    </button>
  );
}

export function AvatarPicker({ choice, photoSrc, onPick, onPickPhoto }: AvatarPickerProps) {
  const t = useTranslations('ui');

  const [voice, setVoice] = useState('boy');
  useEffect(() => {
    setVoice(localStorage.getItem('photo-voice') === 'girl' ? 'girl' : 'boy');
  }, []);
  return (
    <div className="w-full">
      <p className="text-foreground mb-2 text-sm font-medium">{t('m69a93c20ccce')}</p>
      {choice === 'photo' && (
        <label className="mb-3 block text-sm">
          {t('mf732f5ede2da')}
          <select
            className="bg-background ml-2 rounded border p-2"
            value={voice}
            onChange={(e) => {
              setVoice(e.target.value);
              localStorage.setItem('photo-voice', e.target.value);
            }}
          >
            <option value="boy">{t('m4b4440482b36')}</option>
            <option value="girl">{t('m53b1fb446230')}</option>
          </select>
        </label>
      )}
      <div className="flex w-full gap-2.5">
        <Tile
          label={t('m4b4440482b36')}
          sublabel="Voz de Ahmad"
          selected={choice === 'boy'}
          onClick={() => onPick('boy')}
        >
          <AnimatedTutor character="boy" className="size-14" />
        </Tile>

        <Tile
          label={t('m53b1fb446230')}
          sublabel="Voz de Sara"
          selected={choice === 'girl'}
          onClick={() => onPick('girl')}
        >
          <AnimatedTutor character="girl" className="size-14" />
        </Tile>

        <Tile
          label={t('ma0437fd08bab')}
          sublabel={photoSrc ? 'Lista' : 'Con clave'}
          selected={choice === 'photo'}
          onClick={onPickPhoto}
        >
          {photoSrc ? (
            <Image
              src={photoSrc}
              alt={t('m84f7616b66f9')}
              width={56}
              height={56}
              unoptimized
              className="size-14 rounded-full object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="bg-muted text-muted-foreground flex size-14 items-center justify-center rounded-full"
            >
              <LockSimpleIcon size={22} weight="bold" />
            </span>
          )}
        </Tile>
      </div>
    </div>
  );
}
