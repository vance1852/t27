import { Metrics } from '../../types';
import {
  Clock,
  Users,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Zap,
  Battery,
  Activity,
  TrendingDown,
  Minus,
} from 'lucide-react';
import {
  formatTimeDuration,
  formatPercent,
  formatCurrency,
  formatNumber,
  formatPower,
} from '../../utils/format';
import { cn } from '@/lib/utils';

interface MetricsPanelProps {
  metrics: Metrics;
  isDerating: boolean;
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  colorClass?: string;
  pulseBorder?: boolean;
  previousValue?: number;
  currentValue?: number;
}

function MetricCard({
  icon,
  label,
  value,
  subValue,
  colorClass = 'text-white',
  pulseBorder = false,
  previousValue,
  currentValue,
}: MetricCardProps) {
  const getTrendIcon = () => {
    if (previousValue === undefined || currentValue === undefined) return null;
    const diff = currentValue - previousValue;
    if (Math.abs(diff) < 0.001) return <Minus className="h-3 w-3 text-gray-400" />;
    if (diff > 0) return <TrendingUp className="h-3 w-3 text-red-400" />;
    return <TrendingDown className="h-3 w-3 text-green-400" />;
  };

  return (
    <div
      className={cn(
        'group flex items-center gap-4 rounded-xl border border-gray-700 bg-gray-800/50 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-gray-600 hover:bg-gray-800/80 hover:shadow-lg',
        pulseBorder && 'animate-pulse border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]'
      )}
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-700/50 text-gray-400 group-hover:bg-gray-700">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">{label}</span>
          {getTrendIcon()}
        </div>
        <div className={cn('font-mono text-2xl font-bold tracking-tight', colorClass)}>
          {value}
        </div>
        {subValue && <div className="text-xs text-gray-500">{subValue}</div>}
      </div>
    </div>
  );
}

export default function MetricsPanel({ metrics, isDerating }: MetricsPanelProps) {
  const {
    avgWaitTime,
    maxQueueLength,
    throughput,
    churnRate,
    electricityCost,
    powerUtilization,
    batteryLowStockTime,
    chargingUtilization,
    swappingUtilization,
  } = metrics;

  const getWaitTimeColor = () => {
    if (avgWaitTime > 10) return 'text-red-400';
    if (avgWaitTime > 5) return 'text-orange-400';
    return 'text-green-400';
  };

  const getQueueLengthColor = () => {
    if (maxQueueLength > 15) return 'text-red-400';
    if (maxQueueLength > 8) return 'text-orange-400';
    return 'text-white';
  };

  const getChurnRateColor = () => {
    if (churnRate > 0.05) return 'text-red-400';
    if (churnRate > 0.02) return 'text-orange-400';
    return 'text-white';
  };

  const getBatteryLowStockColor = () => {
    if (batteryLowStockTime > 60) return 'text-red-400';
    return 'text-white';
  };

  const getPreviousValue = (history: { value: number }[] | undefined) => {
    if (!history || history.length < 2) return undefined;
    return history[history.length - 2]?.value;
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <MetricCard
        icon={<Clock className="h-6 w-6" />}
        label="平均排队时长"
        value={formatTimeDuration(avgWaitTime)}
        colorClass={getWaitTimeColor()}
        currentValue={avgWaitTime}
        previousValue={getPreviousValue(metrics.queueHistory)}
      />

      <MetricCard
        icon={<Users className="h-6 w-6" />}
        label="最大队长"
        value={formatNumber(maxQueueLength)}
        colorClass={getQueueLengthColor()}
        currentValue={maxQueueLength}
        previousValue={getPreviousValue(metrics.queueHistory)}
      />

      <MetricCard
        icon={<TrendingUp className="h-6 w-6" />}
        label="吞吐量"
        value={`${throughput.toFixed(1)} 辆/小时`}
        currentValue={throughput}
        previousValue={getPreviousValue(metrics.utilizationHistory)}
      />

      <MetricCard
        icon={<AlertTriangle className="h-6 w-6" />}
        label="客户流失率"
        value={formatPercent(churnRate)}
        colorClass={getChurnRateColor()}
        currentValue={churnRate}
      />

      <MetricCard
        icon={<DollarSign className="h-6 w-6" />}
        label="电费成本"
        value={formatCurrency(electricityCost)}
        currentValue={electricityCost}
      />

      <MetricCard
        icon={<Zap className="h-6 w-6" />}
        label="配电利用率"
        value={formatPercent(powerUtilization)}
        pulseBorder={isDerating}
        currentValue={powerUtilization}
        previousValue={getPreviousValue(metrics.powerHistory)}
      />

      <MetricCard
        icon={<Battery className="h-6 w-6" />}
        label="电池仓告急"
        value={`${formatTimeDuration(batteryLowStockTime)} / 天`}
        colorClass={getBatteryLowStockColor()}
        currentValue={batteryLowStockTime}
      />

      <MetricCard
        icon={<Activity className="h-6 w-6" />}
        label="设施利用率"
        value={`${formatPercent(chargingUtilization + swappingUtilization)}`}
        subValue={`充电 ${formatPercent(chargingUtilization)} · 换电 ${formatPercent(swappingUtilization)}`}
        currentValue={chargingUtilization + swappingUtilization}
        previousValue={getPreviousValue(metrics.utilizationHistory)}
      />
    </div>
  );
}
