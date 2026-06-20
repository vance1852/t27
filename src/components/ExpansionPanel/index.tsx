import { useState, useCallback } from 'react';
import type { ExpansionScenario, SimulationConfig, Metrics } from '../../types';
import { COSTS } from '../../simulation/constants';
import {
  Zap,
  Battery,
  TrendingUp,
  DollarSign,
  Award,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  formatCurrency,
  formatTimeDuration,
  formatPercent,
  formatNumber,
} from '../../utils/format';
import { useSimulationStore } from '../../store/useSimulationStore';
import { useConfigStore } from '../../store/useConfigStore';

interface ScenarioConfig {
  chargingStationsAdded: number;
  swappingBaysAdded: number;
  batteryCapacityAdded: number;
  gridCapacityAdded: number;
}

export default function ExpansionPanel() {
  const [scanning, setScanning] = useState(false);
  const [scenarios, setScenarios] = useState<ExpansionScenario[]>([]);
  const [baselineMetrics, setBaselineMetrics] = useState<Metrics | null>(null);
  const [progress, setProgress] = useState(0);

  const engine = useSimulationStore((state) => state.engine);
  const currentConfig = useConfigStore((state) => state.config);
  const setExpansionRunning = useSimulationStore(
    (state) => state.setExpansionRunning
  );

  const generateScenarioMatrix = (): ScenarioConfig[] => {
    const chargingOptions = [0, 2, 4];
    const swappingOptions = [0, 1];
    const batteryOptions = [0, 10];
    const gridOptions = [0, 200];

    const matrix: ScenarioConfig[] = [];

    for (const stations of chargingOptions) {
      for (const bays of swappingOptions) {
        for (const battery of batteryOptions) {
          for (const grid of gridOptions) {
            if (stations === 0 && bays === 0 && battery === 0 && grid === 0) {
              continue;
            }
            matrix.push({
              chargingStationsAdded: stations,
              swappingBaysAdded: bays,
              batteryCapacityAdded: battery,
              gridCapacityAdded: grid,
            });
          }
        }
      }
    }

    return matrix.slice(0, 12);
  };

  const calculateCost = (config: ScenarioConfig): number => {
    return (
      config.chargingStationsAdded * COSTS.CHARGING_STATION +
      config.swappingBaysAdded * COSTS.SWAPPING_BAY +
      config.batteryCapacityAdded * COSTS.BATTERY +
      config.gridCapacityAdded * COSTS.GRID_UPGRADE_PER_KW
    );
  };

  const generateScenarioName = (config: ScenarioConfig): string => {
    const parts: string[] = [];
    if (config.chargingStationsAdded > 0) {
      parts.push(`+${config.chargingStationsAdded}桩`);
    }
    if (config.swappingBaysAdded > 0) {
      parts.push(`+${config.swappingBaysAdded}工位`);
    }
    if (config.batteryCapacityAdded > 0) {
      parts.push(`+${config.batteryCapacityAdded}电池`);
    }
    if (config.gridCapacityAdded > 0) {
      parts.push(`+${config.gridCapacityAdded}kW配电`);
    }
    return parts.join(' · ');
  };

  const generateConfigDescription = (config: ScenarioConfig): string => {
    const parts: string[] = [];
    if (config.chargingStationsAdded > 0) {
      parts.push(`充电桩 +${config.chargingStationsAdded}`);
    }
    if (config.swappingBaysAdded > 0) {
      parts.push(`换电工位 +${config.swappingBaysAdded}`);
    }
    if (config.batteryCapacityAdded > 0) {
      parts.push(`电池仓 +${config.batteryCapacityAdded}`);
    }
    if (config.gridCapacityAdded > 0) {
      parts.push(`配电 +${config.gridCapacityAdded}kW`);
    }
    return parts.join(', ');
  };

  const calculateImprovement = (
    baseline: number,
    current: number
  ): number => {
    if (baseline === 0) return 0;
    return (baseline - current) / baseline;
  };

  const runScanning = useCallback(async () => {
    setScanning(true);
    setProgress(0);
    setScenarios([]);
    setBaselineMetrics(null);
    setExpansionRunning(true);

    try {
      const baseline = engine.runBatchSimulation({}, 24);
      setBaselineMetrics(baseline);

      const matrix = generateScenarioMatrix();
      const totalScenarios = matrix.length;
      const results: ExpansionScenario[] = [];

      for (let i = 0; i < matrix.length; i++) {
        const config = matrix[i];
        const configOverrides: Partial<SimulationConfig> = {
          chargingStationCount:
            currentConfig.chargingStationCount + config.chargingStationsAdded,
          swappingBayCount:
            currentConfig.swappingBayCount + config.swappingBaysAdded,
          batteryStorageCapacity:
            currentConfig.batteryStorageCapacity + config.batteryCapacityAdded,
          totalGridCapacity:
            currentConfig.totalGridCapacity + config.gridCapacityAdded,
        };

        const metrics = engine.runBatchSimulation(configOverrides, 24);
        const cost = calculateCost(config);

        const waitTimeImprovement = calculateImprovement(
          baseline.avgWaitTime,
          metrics.avgWaitTime
        );
        const churnRateImprovement = calculateImprovement(
          baseline.churnRate,
          metrics.churnRate
        );
        const overallImprovement =
          (waitTimeImprovement + churnRateImprovement) / 2;

        const costBenefitRatio =
          cost > 0 ? (overallImprovement / cost) * 10000 : 0;

        const monthlyLostRevenueBaseline =
          baseline.lostVehicles * COSTS.REVENUE_PER_SERVED_VEHICLE * 30;
        const monthlyLostRevenueScenario =
          metrics.lostVehicles * COSTS.REVENUE_PER_SERVED_VEHICLE * 30;
        const monthlySavings =
          monthlyLostRevenueBaseline - monthlyLostRevenueScenario;

        const paybackPeriod = monthlySavings > 0 ? cost / monthlySavings : 0;

        results.push({
          id: `scenario-${i}`,
          name: generateScenarioName(config),
          chargingStationsAdded: config.chargingStationsAdded,
          swappingBaysAdded: config.swappingBaysAdded,
          batteryCapacityAdded: config.batteryCapacityAdded,
          gridCapacityAdded: config.gridCapacityAdded,
          cost,
          avgWaitTime: metrics.avgWaitTime,
          churnRate: metrics.churnRate,
          throughput: metrics.throughput,
          improvementScore: overallImprovement,
          costBenefitRatio,
          paybackPeriod,
        });

        setProgress(((i + 1) / totalScenarios) * 100);

        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      results.sort((a, b) => b.costBenefitRatio - a.costBenefitRatio);
      setScenarios(results);
    } finally {
      setScanning(false);
      setExpansionRunning(false);
    }
  }, [engine, currentConfig, setExpansionRunning]);

  const getBestScenario = (): ExpansionScenario | null => {
    if (scenarios.length === 0) return null;
    return scenarios.reduce((best, current) =>
      current.costBenefitRatio > best.costBenefitRatio ? current : best
    );
  };

  const getRecommendationReason = (scenario: ExpansionScenario): string => {
    const reasons: string[] = [];
    if (scenario.chargingStationsAdded > 0) {
      reasons.push(`增加${scenario.chargingStationsAdded}个充电桩`);
    }
    if (scenario.swappingBaysAdded > 0) {
      reasons.push(`增加${scenario.swappingBaysAdded}个换电工位`);
    }
    if (scenario.batteryCapacityAdded > 0) {
      reasons.push(`增加${scenario.batteryCapacityAdded}块电池储备`);
    }
    if (scenario.gridCapacityAdded > 0) {
      reasons.push(`扩容${scenario.gridCapacityAdded}kW配电容量`);
    }
    return (
      '该方案通过' +
      reasons.join('、') +
      `，可将等待时间改善${formatPercent(scenario.improvementScore)}，投资回收期约${scenario.paybackPeriod.toFixed(1)}个月，性价比最优。`
    );
  };

  const bestScenario = getBestScenario();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                扩容决策分析
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                智能扫描最优扩容方案
              </p>
            </div>
          </div>
          <button
            onClick={runScanning}
            disabled={scanning}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors duration-200"
          >
            {scanning ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                扫描中...
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5" />
                开始扫描
              </>
            )}
          </button>
        </div>

        {scanning && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-300">
                正在分析扩容方案...
              </span>
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              已完成 {Math.floor((progress / 100) * 12)} / 12 个方案
            </p>
          </div>
        )}
      </div>

      {baselineMetrics && scenarios.length > 0 && (
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-yellow-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  基准等待时间
                </span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {formatTimeDuration(baselineMetrics.avgWaitTime)}
              </p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-red-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  基准流失率
                </span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {formatPercent(baselineMetrics.churnRate)}
              </p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="flex items-center gap-2 mb-2">
                <Battery className="w-4 h-4 text-green-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  基准吞吐量
                </span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {formatNumber(baselineMetrics.throughput, 1)} 辆/小时
              </p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  扫描方案数
                </span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {scenarios.length} 个
              </p>
            </div>
          </div>

          {bestScenario && (
            <div className="mb-6 p-5 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border-2 border-amber-300 dark:border-amber-600 rounded-xl">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-amber-100 dark:bg-amber-800 rounded-full">
                  <Award className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-amber-800 dark:text-amber-400 mb-1">
                    推荐方案：{bestScenario.name}
                  </h3>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                    {getRecommendationReason(bestScenario)}
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <p className="text-xs text-amber-600 dark:text-amber-400/70">
                        投资成本
                      </p>
                      <p className="font-semibold text-amber-800 dark:text-amber-300">
                        {formatCurrency(bestScenario.cost)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-amber-600 dark:text-amber-400/70">
                        改善率
                      </p>
                      <p className="font-semibold text-amber-800 dark:text-amber-300">
                        {formatPercent(bestScenario.improvementScore)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-amber-600 dark:text-amber-400/70">
                        性价比
                      </p>
                      <p className="font-semibold text-amber-800 dark:text-amber-300">
                        {bestScenario.costBenefitRatio.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-amber-600 dark:text-amber-400/70">
                        投资回收期
                      </p>
                      <p className="font-semibold text-amber-800 dark:text-amber-300">
                        {bestScenario.paybackPeriod.toFixed(1)} 个月
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap">
                    方案名称
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap">
                    配置变化
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap">
                    成本
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap">
                    平均等待
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap">
                    流失率
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap">
                    改善率
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap">
                    性价比
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap">
                    回收期
                  </th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((scenario, index) => {
                  const isBest = scenario.id === bestScenario?.id;
                  return (
                    <tr
                      key={scenario.id}
                      className={`
                        border-t border-gray-200 dark:border-gray-700
                        hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors
                        ${isBest ? 'bg-amber-50/50 dark:bg-amber-900/10 border-l-4 border-l-amber-400' : ''}
                      `}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isBest && (
                            <Award className="w-4 h-4 text-amber-500 flex-shrink-0" />
                          )}
                          <span
                            className={`font-medium ${isBest ? 'text-amber-700 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}
                          >
                            方案 {index + 1}：{scenario.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 max-w-xs truncate">
                        {generateConfigDescription({
                          chargingStationsAdded: scenario.chargingStationsAdded,
                          swappingBaysAdded: scenario.swappingBaysAdded,
                          batteryCapacityAdded: scenario.batteryCapacityAdded,
                          gridCapacityAdded: scenario.gridCapacityAdded,
                        })}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 dark:text-white font-medium">
                        {formatCurrency(scenario.cost)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                        {formatTimeDuration(scenario.avgWaitTime)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                        {formatPercent(scenario.churnRate)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`font-medium ${scenario.improvementScore > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                        >
                          {scenario.improvementScore > 0 ? '+' : ''}
                          {formatPercent(scenario.improvementScore)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`font-medium ${isBest ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}
                        >
                          {scenario.costBenefitRatio.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                        {scenario.paybackPeriod > 0
                          ? `${scenario.paybackPeriod.toFixed(1)} 月`
                          : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!scanning && scenarios.length === 0 && (
        <div className="p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
            <TrendingUp className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            尚未进行扩容分析
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
            点击"开始扫描"按钮，系统将自动生成12种扩容方案并运行仿真对比，为您推荐性价比最优的扩容策略。
          </p>
          <button
            onClick={runScanning}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200"
          >
            <Zap className="w-5 h-5" />
            开始智能扫描
          </button>
        </div>
      )}
    </div>
  );
}
