import { forwardRef } from 'react';
import { clsx } from 'clsx';
import { TrendingUp, TrendingDown, Minus, LucideIcon } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  change?: number;
  changeLabel?: string;
  sparklineData?: { value: number }[];
  icon?: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
  onClick?: () => void;
}

const MetricCard = forwardRef<HTMLDivElement, MetricCardProps>(
  (
    {
      title,
      value,
      unit,
      change,
      changeLabel = 'vs last period',
      sparklineData,
      icon: Icon,
      trend: forcedTrend,
      className,
      onClick,
    },
    ref
  ) => {
    const calculatedTrend =
      change !== undefined ? (change > 0 ? 'up' : change < 0 ? 'down' : 'neutral') : 'neutral';

    const trend = forcedTrend || calculatedTrend;

    const trendColors = {
      up: {
        bg: 'bg-green-50 dark:bg-green-900/20',
        text: 'text-green-600 dark:text-green-400',
        icon: 'text-green-500 dark:text-green-400',
        sparkline: '#10b981',
      },
      down: {
        bg: 'bg-red-50 dark:bg-red-900/20',
        text: 'text-red-600 dark:text-red-400',
        icon: 'text-red-500 dark:text-red-400',
        sparkline: '#ef4444',
      },
      neutral: {
        bg: 'bg-gray-50 dark:bg-gray-800/50',
        text: 'text-gray-600 dark:text-gray-400',
        icon: 'text-gray-400 dark:text-gray-500',
        sparkline: '#6b7280',
      },
    };

    const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

    const formatChange = (value: number): string => {
      const absValue = Math.abs(value);
      if (absValue >= 1000) {
        return `${value > 0 ? '+' : '-'}${(absValue / 1000).toFixed(1)}k`;
      }
      return `${value > 0 ? '+' : ''}${value.toFixed(1)}`;
    };

    return (
      <div
        ref={ref}
        onClick={onClick}
        className={clsx(
          'relative overflow-hidden',
          'bg-white dark:bg-gray-800',
          'rounded-xl border border-gray-200 dark:border-gray-700',
          'p-6',
          'transition-all duration-200 ease-in-out',
          'hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600',
          onClick && 'cursor-pointer active:scale-[0.98]',
          className
        )}
      >
        {/* Background gradient on hover */}
        <div
          className={clsx(
            'absolute inset-0 opacity-0 transition-opacity duration-300',
            'group-hover:opacity-100',
            trendColors[trend].bg
          )}
        />

        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                {title}
              </p>
            </div>
            {Icon && (
              <div
                className={clsx(
                  'flex-shrink-0 ml-3 p-2 rounded-lg',
                  'bg-gray-50 dark:bg-gray-700/50',
                  trendColors[trend].icon
                )}
              >
                <Icon className="w-5 h-5" />
              </div>
            )}
          </div>

          {/* Value */}
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              {value}
            </span>
            {unit && <span className="text-sm text-gray-500 dark:text-gray-400">{unit}</span>}
          </div>

          {/* Change indicator */}
          {change !== undefined && (
            <div className="flex items-center gap-2">
              <div
                className={clsx(
                  'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                  trendColors[trend].bg,
                  trendColors[trend].text
                )}
              >
                <TrendIcon className="w-3 h-3" />
                <span>{formatChange(change)}%</span>
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500">{changeLabel}</span>
            </div>
          )}

          {/* Sparkline */}
          {sparklineData && sparklineData.length > 0 && (
            <div className="mt-4 h-10">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparklineData}>
                  <YAxis domain={['dataMin', 'dataMax']} hide />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={trendColors[trend].sparkline}
                    strokeWidth={2}
                    dot={false}
                    animationDuration={1000}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    );
  }
);

MetricCard.displayName = 'MetricCard';

export default MetricCard;
