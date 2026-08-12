import React, { useState } from 'react';
import { initialsOf } from '../initials';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  /** Display name — the source of the initials fallback. */
  name: string;
  /** Server-provided photo URL. Null/empty falls straight through to initials. */
  photo?: string | null;
  size?: AvatarSize;
  className?: string;
}

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: 'w-8 h-8 text-[10px]',
  sm: 'w-10 h-10 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-16 h-16 text-lg',
  xl: 'w-full h-full text-3xl',
};

/**
 * Palette-token tints, picked deterministically from the name so the same
 * person always gets the same colour. Raw hex is not allowed by the frontend
 * conventions, so these are all Material tokens from tailwind.config.js.
 */
const TINTS = [
  'bg-primary-fixed text-on-primary-fixed',
  'bg-secondary-fixed text-on-secondary-fixed',
  'bg-tertiary-fixed text-on-tertiary-fixed',
  'bg-surface-container-high text-on-surface-variant',
  'bg-primary-fixed-dim text-on-primary-fixed-variant',
  'bg-secondary-fixed-dim text-on-secondary-fixed-variant',
] as const;

const tintFor = (name: string): string => {
  let hash = 0;
  for (const char of name ?? '') {
    hash = (hash * 31 + char.codePointAt(0)!) % 100000;
  }
  return TINTS[hash % TINTS.length];
};

/**
 * Local initials avatar with an optional real photo.
 *
 * Replaces the `i.pravatar.cc` / Unsplash placeholders that used to sit in the
 * data-mapping layer of six hooks: those were outbound requests to third-party
 * hosts on every product page, leaking user ids in the query string. A photo
 * that fails to load (expired storage URL, offline backend) degrades to the
 * initials rather than a broken-image icon.
 */
const Avatar: React.FC<AvatarProps> = ({ name, photo, size = 'sm', className = '' }) => {
  // The *URL* that failed, not a boolean: a row recycled by React for a
  // different driver then gets a fresh attempt automatically, with no effect
  // needed to reset the flag.
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);

  const base = `${SIZE_CLASSES[size]} rounded-full shrink-0 object-cover ${className}`;

  if (photo && failedPhoto !== photo) {
    return (
      <img
        src={photo}
        alt={name}
        title={name}
        onError={() => setFailedPhoto(photo)}
        className={base}
      />
    );
  }

  return (
    <div
      title={name}
      aria-label={name}
      role="img"
      className={`${base} flex items-center justify-center font-bold ltr:tracking-wide select-none ${tintFor(name)}`}
    >
      {initialsOf(name)}
    </div>
  );
};

export default Avatar;
