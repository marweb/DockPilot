import { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import {
  Image,
  Network,
  Database,
  Wrench,
  Play,
  Square,
  RotateCcw,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Info,
  ChevronDown,
  Filter,
  Clock,
} from 'lucide-react';
import Button from '../common/Button';

type ActivityType =
  | 'container_start'
  | 'container_stop'
  | 'container_restart'
  | 'container_delete'
  | 'image_pull'
  | 'image_delete'
  | 'volume_create'
  | 'volume_delete'
  | 'network_create'
  | 'network_delete'
  | 'build_start'
  | 'build_success'
  | 'build_fail'
  | 'system_warning'
  | 'system_info';

interface Activity {
  id: string;
  type: ActivityType;
  message: string;
  details?: string;
  timestamp: number;
  user?: string;
  target?: string;
}

interface ActivityFeedProps {
  activities?: Activity[];
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onFilterChange?: (filter: ActivityType | null) => void;
  className?: string;
}

const defaultActivities: Activity[] = [
  {
    id: '1',
    type: 'container_start',
    message: 'Container started',
    details: 'nginx:latest started successfully',
    timestamp: Date.now() - 60000,
    user: 'admin',
    target: 'web-server-01',
  },
  {
    id: '2',
    type: 'image_pull',
    message: 'Image pulled',
    details: 'Successfully pulled node:18-alpine',
    timestamp: Date.now() - 300000,
    user: 'admin',
    target: 'node:18-alpine',
  },
  {
    id: '3',
    type: 'build_success',
    message: 'Build completed',
    details: 'Build #1234 completed in 2m 34s',
    timestamp: Date.now() - 600000,
    user: 'jenkins',
    target: 'myapp:latest',
  },
  {
    id: '4',
    type: 'container_stop',
    message: 'Container stopped',
    details: 'Container db-postgres stopped gracefully',
    timestamp: Date.now() - 900000,
    user: 'admin',
    target: 'db-postgres',
  },
  {
    id: '5',
    type: 'system_warning',
    message: 'Low disk space',
    details: 'Docker volume disk usage is above 85%',
    timestamp: Date.now() - 1800000,
    target: 'system',
  },
  {
    id: '6',
    type: 'volume_create',
    message: 'Volume created',
    details: 'Volume myapp_data created',
    timestamp: Date.now() - 3600000,
    user: 'admin',
    target: 'myapp_data',
  },
  {
    id: '7',
    type: 'network_create',
    message: 'Network created',
    details: 'Bridge network myapp_network created',
    timestamp: Date.now() - 7200000,
    user: 'admin',
    target: 'myapp_network',
  },
  {
    id: '8',
    type: 'container_restart',
    message: 'Container restarted',
    details: 'Container redis-cache restarted',
    timestamp: Date.now() - 10800000,
    user: 'system',
    target: 'redis-cache',
  },
];

const activityConfig: Record<
  ActivityType,
  {
    icon: React.ElementType;
    color: string;
    bgColor: string;
    label: string;
  }
> = {
  container_start: {
    icon: Play,
    color: 'text-green-500',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    label: 'Container Start',
  },
  container_stop: {
    icon: Square,
    color: 'text-red-500',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    label: 'Container Stop',
  },
  container_restart: {
    icon: RotateCcw,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    label: 'Container Restart',
  },
  container_delete: {
    icon: Trash2,
    color: 'text-red-500',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    label: 'Container Delete',
  },
  image_pull: {
    icon: Image,
    color: 'text-purple-500',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    label: 'Image Pull',
  },
  image_delete: {
    icon: Trash2,
    color: 'text-red-500',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    label: 'Image Delete',
  },
  volume_create: {
    icon: Database,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    label: 'Volume Create',
  },
  volume_delete: {
    icon: Trash2,
    color: 'text-red-500',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    label: 'Volume Delete',
  },
  network_create: {
    icon: Network,
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
    label: 'Network Create',
  },
  network_delete: {
    icon: Trash2,
    color: 'text-red-500',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    label: 'Network Delete',
  },
  build_start: {
    icon: Wrench,
    color: 'text-orange-500',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    label: 'Build Start',
  },
  build_success: {
    icon: CheckCircle2,
    color: 'text-green-500',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    label: 'Build Success',
  },
  build_fail: {
    icon: AlertCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    label: 'Build Fail',
  },
  system_warning: {
    icon: AlertCircle,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    label: 'Warning',
  },
  system_info: {
    icon: Info,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    label: 'Info',
  },
};

const groupActivitiesByDate = (activities: Activity[]) => {
  const groups: { [key: string]: Activity[] } = {};

  activities.forEach((activity) => {
    const date = new Date(activity.timestamp);
    let key: string;

    if (isToday(date)) {
      key = 'Today';
    } else if (isYesterday(date)) {
      key = 'Yesterday';
    } else {
      key = format(date, 'MMMM d, yyyy');
    }

    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(activity);
  });

  return groups;
};

const ActivityFeed: React.FC<ActivityFeedProps> = ({
  activities = defaultActivities,
  isLoading = false,
  hasMore = false,
  onLoadMore,
  onFilterChange,
  className,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<ActivityType | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const filteredActivities = useMemo(() => {
    if (!selectedFilter) return activities;
    return activities.filter((a) => a.type === selectedFilter);
  }, [activities, selectedFilter]);

  const groupedActivities = useMemo(
    () => groupActivitiesByDate(filteredActivities),
    [filteredActivities]
  );

  const handleFilterChange = (filter: ActivityType | null) => {
    setSelectedFilter(filter);
    onFilterChange?.(filter);
    setShowFilters(false);
  };

  const toggleExpanded = (id: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const formatTimestamp = (timestamp: number): string => {
    return formatDistanceToNow(timestamp, { addSuffix: true });
  };

  return (
    <div
      className={clsx(
        'bg-white dark:bg-gray-800',
        'rounded-xl border border-gray-200 dark:border-gray-700',
        'overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Activity Feed</h3>
          <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-xs text-gray-600 dark:text-gray-400">
            {filteredActivities.length}
          </span>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={clsx(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              showFilters || selectedFilter
                ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            )}
          >
            <Filter className="w-4 h-4" />
            Filter
            {selectedFilter && <span className="w-2 h-2 rounded-full bg-primary-500"></span>}
          </button>

          {/* Filter Dropdown */}
          {showFilters && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20">
              <div className="p-2">
                <button
                  onClick={() => handleFilterChange(null)}
                  className={clsx(
                    'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                    selectedFilter === null
                      ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  )}
                >
                  All Activities
                </button>

                <div className="my-2 border-t border-gray-200 dark:border-gray-700" />

                {Object.entries(activityConfig).map(([type, config]) => (
                  <button
                    key={type}
                    onClick={() => handleFilterChange(type as ActivityType)}
                    className={clsx(
                      'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                      selectedFilter === type
                        ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    )}
                  >
                    <div className={clsx('p-1 rounded', config.bgColor)}>
                      <config.icon className={clsx('w-3 h-3', config.color)} />
                    </div>
                    {config.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Activity List */}
      <div className="max-h-96 overflow-y-auto">
        {Object.entries(groupedActivities).map(([date, items]) => (
          <div key={date}>
            <div className="sticky top-0 bg-gray-50 dark:bg-gray-700/50 px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 border-y border-gray-200 dark:border-gray-700">
              {date}
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {items.map((activity) => {
                const config = activityConfig[activity.type];
                const Icon = config.icon;
                const isExpanded = expandedItems.has(activity.id);

                return (
                  <div
                    key={activity.id}
                    className={clsx(
                      'p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors',
                      isExpanded && 'bg-gray-50 dark:bg-gray-700/30'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={clsx(
                          'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
                          config.bgColor
                        )}
                      >
                        <Icon className={clsx('w-5 h-5', config.color)} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {activity.message}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                              {activity.details}
                            </p>
                          </div>
                          <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                            {formatTimestamp(activity.timestamp)}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 mt-2">
                          {activity.user && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              by <span className="font-medium">{activity.user}</span>
                            </span>
                          )}
                          {activity.target && (
                            <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-400 font-mono">
                              {activity.target}
                            </span>
                          )}
                        </div>

                        {/* Expanded details could go here */}
                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                              <p>
                                <span className="font-medium">Type: </span>
                                {config.label}
                              </p>
                              <p>
                                <span className="font-medium">Timestamp: </span>
                                {format(activity.timestamp, 'PPpp')}
                              </p>
                              <p>
                                <span className="font-medium">ID: </span>
                                {activity.id}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => toggleExpanded(activity.id)}
                        className={clsx(
                          'flex-shrink-0 p-1 rounded transition-transform',
                          isExpanded && 'rotate-180',
                          'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                        )}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {filteredActivities.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Info className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No activities found</p>
            {selectedFilter && (
              <button
                onClick={() => handleFilterChange(null)}
                className="mt-2 text-sm text-primary-500 hover:text-primary-600"
              >
                Clear filter
              </button>
            )}
          </div>
        )}
      </div>

      {/* Load More */}
      {hasMore && onLoadMore && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="secondary" fullWidth onClick={onLoadMore} loading={isLoading}>
            Load More
          </Button>
        </div>
      )}
    </div>
  );
};

export default ActivityFeed;
