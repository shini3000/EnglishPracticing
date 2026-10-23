'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { XIcon } from '@phosphor-icons/react/dist/ssr';
import { prepareAvatarPhoto } from '@/components/avatar/photo-utils';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';

/**
 * The personalized-avatar dialog: passcode in, photo up, avatar on.
 *
 * The avatar passcode is typed here and sent with the upload, but it is never *checked*
 * here — /api/avatar does that, server-side, on every write. This dialog holding the
 * passcode in component state for the duration of the form is fine; baking the expected
 * value into the bundle would not be.
 *
 * A learner with a photo already on file can start using it with one click and no passcode:
 * the passcode gates *adding* a photo (the action that arms the metered bitHuman avatar),
 * not re-using one that was already admitted through that gate.
 */

interface PersonalAvatarDialogProps {
  open: boolean;
  /** URL of the already-uploaded photo, or null before any upload. */
  photoSrc: string | null;
  onClose: () => void;
  /** The photo is on the server; the caller flips the pre-call choice to 'photo'. */
  onReady: (uploadedNew: boolean) => void;
}

export function PersonalAvatarDialog({
  open,
  photoSrc,
  onClose,
  onReady,
}: PersonalAvatarDialogProps) {
  const t = useTranslations('ui');

  const hasPhoto = photoSrc !== null;
  const [passcode, setPasscode] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Each opening starts fresh — a stale error or a previous photo preview would be confusing
  // ten minutes later.
  useEffect(() => {
    if (open) {
      setPasscode('');
      setPhotoDataUrl(null);
      setError(null);
      setShowUploadForm(!hasPhoto);
    }
  }, [open, hasPhoto]);

  if (!open) {
    return null;
  }

  const handleFile = async (file: File | undefined) => {
    setError(null);
    if (!file) return;
    try {
      setPhotoDataUrl(await prepareAvatarPhoto(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('me9fe8433758b'));
    }
  };

  const canSubmit = passcode.trim().length > 0 && photoDataUrl !== null && !isSubmitting;

  const handleUpload = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode, image: photoDataUrl }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? t('m4def98c89240'));
        return;
      }

      onReady(true);
    } catch {
      setError(t('m143a7593dd9a'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('m1e4a32ebac4b')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-background w-full max-w-sm rounded-2xl border p-5 text-left shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-foreground text-lg font-semibold">{t('m1e4a32ebac4b')}</h2>
            <p className="text-muted-foreground mt-1 text-xs leading-5">{t('m7d194fbcda3a')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('m7d9eb7acb13e')}
            className="text-muted-foreground hover:text-foreground -m-1 p-1 transition-colors"
          >
            <XIcon size={18} weight="bold" />
          </button>
        </div>

        {hasPhoto && !showUploadForm ? (
          <div className="flex flex-col gap-2.5">
            {photoSrc && (
              <div className="flex items-center gap-3">
                <Image
                  src={photoSrc}
                  alt={t('m24e99333c5bf')}
                  width={56}
                  height={56}
                  unoptimized
                  className="size-14 rounded-full object-cover"
                />
                <p className="text-muted-foreground text-sm">{t('md5d34b2be859')}</p>
              </div>
            )}
            <Button size="lg" className="w-full rounded-lg" onClick={() => onReady(false)}>
              {t('m0527b609e339')}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full rounded-lg"
              onClick={() => setShowUploadForm(true)}
            >
              {t('maed63d829d95')}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            <div>
              <p className="text-foreground mb-1.5 text-sm font-medium">{t('md84eebada93e')}</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="border-input hover:border-ring/60 flex w-full items-center gap-3 rounded-lg border border-dashed p-3 transition-colors"
              >
                {photoDataUrl ? (
                  <Image
                    src={photoDataUrl}
                    alt={t('mbc37e53aa883')}
                    width={56}
                    height={56}
                    unoptimized
                    className="size-14 rounded-full object-cover"
                  />
                ) : (
                  <span className="bg-muted size-14 shrink-0 rounded-full" aria-hidden />
                )}
                <span className="text-muted-foreground text-sm">
                  {photoDataUrl ? t('m8bc0425b6f95') : t('mdecf13fd391b')}
                </span>
              </button>
              <p className="text-muted-foreground mt-1.5 text-xs leading-5">{t('m21de3e737284')}</p>
            </div>

            <TextField
              label={t('m3698d0bed2f8')}
              type="password"
              value={passcode}
              onChange={(e) => {
                setPasscode(e.target.value);
                setError(null);
              }}
              placeholder="••••••••"
              autoComplete="off"
              className="font-mono tracking-widest"
              hint={t('m43c26d563937')}
            />

            <p
              role="status"
              aria-live="polite"
              className="text-destructive min-h-5 text-sm leading-5 [&:empty]:min-h-0"
            >
              {error}
            </p>

            <Button
              size="lg"
              disabled={!canSubmit}
              onClick={handleUpload}
              className="w-full rounded-lg"
            >
              {isSubmitting ? t('m23e39291d613') : t('m918c7962439d')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
