/**
 * Up to two initials from a display name.
 *
 * Works for Arabic as well as Latin names because it only ever takes the first
 * code point of a whitespace-separated part. Lives outside `Avatar.tsx` so that
 * file exports a component and nothing else (react-refresh), and so hooks that
 * need initials without rendering an avatar can share one implementation.
 */
export const initialsOf = (name: string): string => {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  return parts
    .slice(0, 2)
    .map((part) => [...part][0])
    .join('')
    .toLocaleUpperCase();
};
