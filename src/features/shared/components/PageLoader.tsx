import React from 'react';
import Lottie from 'lottie-react';
import { useTranslation } from 'react-i18next';
import loadingComet from '../../../assets/lottie/loading_comet.json';

interface PageLoaderProps {
  /** sm = inline widget loaders, md = section/card loaders, lg = full route/page loaders. */
  size?: 'sm' | 'md' | 'lg';
  /** Pass null to render the animation without a text label. */
  label?: string | null;
  fullScreen?: boolean;
  className?: string;
  /** Override when the loader sits on a dark/colored background. */
  labelClassName?: string;
}

const SIZE_PX: Record<NonNullable<PageLoaderProps['size']>, number> = {
  sm: 40,
  md: 72,
  lg: 112,
};

/**
 * The one loading indicator for the whole dashboard — every full-page,
 * route-transition, and section-level loading state renders this instead of
 * a plain spinner or "جاري التحميل..." text.
 */
const PageLoader: React.FC<PageLoaderProps> = ({
  size = 'md',
  label,
  fullScreen = false,
  className = '',
  labelClassName = 'text-on-surface-variant',
}) => {
  const { t } = useTranslation();
  const resolvedLabel = label === null ? null : label ?? t('common.loading');
  const px = SIZE_PX[size];

  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 ${fullScreen ? 'min-h-screen' : ''} ${className}`.trim()}
      role="status"
      aria-label={resolvedLabel ?? t('common.loading')}
    >
      <Lottie animationData={loadingComet} loop style={{ width: px, height: px }} />
      {resolvedLabel && (
        <p className={`text-sm font-medium ${labelClassName}`}>{resolvedLabel}</p>
      )}
    </div>
  );
};

export default PageLoader;
