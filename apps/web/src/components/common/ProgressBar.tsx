import { forwardRef, useMemo } from 'react';
import { clsx } from 'clsx';

interface ProgressBarProps {
  /**
   * Type of progress bar
   * @default 'linear'
   */
  variant?: 'linear' | 'circular';
  /**
   * Current progress value (0-100)
   * @default 0
   */
  value?: number;
  /**
   * Size of the progress bar
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /**
   * Color variant
   * @default 'primary'
   */
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  /**
   * Whether the progress is indeterminate
   * @default false
   */
  indeterminate?: boolean;
  /**
   * Label to display
   */
  label?: string;
  /**
   * Whether to show percentage
   * @default false
   */
  showPercentage?: boolean;
  /**
   * Custom className
   */
  className?: string;
  /**
   * Thickness of the progress bar (for linear) or stroke width (for circular)
   * @default variant === 'linear' ? 8 : 4
   */
  thickness?: number;
}

const colorVariants = {
  primary: {
    bg: 'bg-primary-500',
    text: 'text-primary-600 dark:text-primary-400',
    stroke: '#3b82f6',
    track: 'bg-primary-100 dark:bg-primary-900/30',
  },
  success: {
    bg: 'bg-green-500',
    text: 'text-green-600 dark:text-green-400',
    stroke: '#10b981',
    track: 'bg-green-100 dark:bg-green-900/30',
  },
  warning: {
    bg: 'bg-yellow-500',
    text: 'text-yellow-600 dark:text-yellow-400',
    stroke: '#f59e0b',
    track: 'bg-yellow-100 dark:bg-yellow-900/30',
  },
  danger: {
    bg: 'bg-red-500',
    text: 'text-red-600 dark:text-red-400',
    stroke: '#ef4444',
    track: 'bg-red-100 dark:bg-red-900/30',
  },
  info: {
    bg: 'bg-cyan-500',
    text: 'text-cyan-600 dark:text-cyan-400',
    stroke: '#06b6d4',
    track: 'bg-cyan-100 dark:bg-cyan-900/30',
  },
  neutral: {
    bg: 'bg-gray-500',
    text: 'text-gray-600 dark:text-gray-400',
    stroke: '#6b7280',
    track: 'bg-gray-200 dark:bg-gray-700',
  },
};

const sizes = {
  sm: { height: 4, circular: 32, fontSize: 'text-xs' },
  md: { height: 8, circular: 48, fontSize: 'text-sm' },
  lg: { height: 12, circular: 64, fontSize: 'text-base' },
  xl: { height: 16, circular: 96, fontSize: 'text-lg' },
};

const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(
  (
    {
      variant = 'linear',
      value = 0,
      size = 'md',
      color = 'primary',
      indeterminate = false,
      label,
      showPercentage = false,
      className,
      thickness,
    },
    ref
  ) => {
    const normalizedValue = Math.min(100, Math.max(0, value));
    const colors = colorVariants[color];
    const sizeConfig = sizes[size];

    // Calculate color based on percentage for auto variant
    const calculatedColor = useMemo(() => {
      if (color !== 'primary') return colors;
      if (normalizedValue < 30) return colorVariants.danger;
      if (normalizedValue < 70) return colorVariants.warning;
      return colorVariants.success;
    }, [color, normalizedValue, colors]);

    const renderLinear = () => {
      const barThickness = thickness || sizeConfig.height;

      return (
        <div ref={ref} className={clsx('w-full', className)}>
          {/* Label row */}
          {(label || showPercentage) && (
            <div className="flex items-center justify-between mb-1.5">
              {label && (
                <span
                  className={clsx(
                    'font-medium text-gray-700 dark:text-gray-300',
                    sizeConfig.fontSize
                  )}
                >
                  {label}
                </span>
              )}
              {showPercentage && !indeterminate && (
                <span className={clsx('font-semibold', calculatedColor.text, sizeConfig.fontSize)}>
                  {Math.round(normalizedValue)}%
                </span>
              )}
            </div>
          )}

          {/* Progress track */}
          <div
            className={clsx('w-full rounded-full overflow-hidden', colors.track)}
            style={{ height: barThickness }}
          >
            <div
              className={clsx(
                'h-full rounded-full transition-all duration-500 ease-out',
                calculatedColor.bg,
                indeterminate && 'animate-indeterminate'
              )}
              style={{
                width: indeterminate ? '50%' : `${normalizedValue}%`,
                animation: indeterminate ? 'indeterminate 1.5s ease-in-out infinite' : undefined,
              }}
            />
          </div>

          <style>{`
            @keyframes indeterminate {
              0% {
                transform: translateX(-100%);
              }
              50% {
                transform: translateX(0%);
              }
              100% {
                transform: translateX(200%);
              }
            }
          `}</style>
        </div>
      );
    };

    const renderCircular = () => {
      const diameter = sizeConfig.circular;
      const strokeWidth = thickness || Math.max(2, diameter / 12);
      const radius = (diameter - strokeWidth) / 2;
      const circumference = 2 * Math.PI * radius;
      const strokeDashoffset = indeterminate
        ? circumference * 0.75
        : circumference - (normalizedValue / 100) * circumference;

      return (
        <div
          ref={ref}
          className={clsx('relative inline-flex items-center justify-center', className)}
          style={{ width: diameter, height: diameter }}
        >
          <svg className="transform -rotate-90" width={diameter} height={diameter}>
            {/* Track circle */}
            <circle
              cx={diameter / 2}
              cy={diameter / 2}
              r={radius}
              fill="none"
              stroke={
                colors.track.replace('bg-', '').replace('dark:', '') === 'bg-primary-100'
                  ? '#dbeafe'
                  : '#e5e7eb'
              }
              strokeWidth={strokeWidth}
              className={colors.track}
            />

            {/* Progress circle */}
            <circle
              cx={diameter / 2}
              cy={diameter / 2}
              r={radius}
              fill="none"
              stroke={calculatedColor.stroke}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className={clsx(
                'transition-all duration-500 ease-out',
                indeterminate && 'animate-spin'
              )}
              style={{
                transformOrigin: 'center',
                animation: indeterminate ? 'spin 1s linear infinite' : undefined,
              }}
            />
          </svg>

          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {showPercentage && !indeterminate ? (
              <span className={clsx('font-bold', calculatedColor.text, sizeConfig.fontSize)}>
                {Math.round(normalizedValue)}%
              </span>
            ) : label ? (
              <span
                className={clsx(
                  'font-medium text-gray-700 dark:text-gray-300 text-center px-1',
                  size === 'sm' ? 'text-[10px]' : 'text-xs'
                )}
              >
                {label}
              </span>
            ) : null}
          </div>
        </div>
      );
    };

    return variant === 'linear' ? renderLinear() : renderCircular();
  }
);

ProgressBar.displayName = 'ProgressBar';

export default ProgressBar;
