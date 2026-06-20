import { useSimulation } from './hooks/useSimulation';
import { useConfigStore } from './store/useConfigStore';
import ControlPanel from './components/ControlPanel';
import StationCanvas from './components/StationCanvas';
import MetricsPanel from './components/MetricsPanel';
import TrendCharts from './components/TrendCharts';
import ExpansionPanel from './components/ExpansionPanel';
import { COLORS } from './types';
import { Zap, Activity } from 'lucide-react';

function App() {
  const {
    isRunning,
    currentTime,
    vehicles,
    chargingStations,
    swappingBays,
    batteryStorage,
    metrics,
    isDerating,
  } = useSimulation();

  const { config } = useConfigStore();

  return (
    <div
      className="h-screen w-screen flex flex-col overflow-hidden"
      style={{ backgroundColor: COLORS.darker }}
    >
      <header
        className="flex items-center justify-between px-6 py-3 border-b"
        style={{
          backgroundColor: COLORS.dark,
          borderColor: COLORS.border,
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${COLORS.secondary}, ${COLORS.warning})`,
            }}
          >
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1
              className="text-xl font-bold"
              style={{ color: COLORS.text }}
            >
              新能源物流车充换电站仿真决策系统
            </h1>
            <p
              className="text-xs"
              style={{ color: COLORS.textMuted }}
            >
              充电/换电模式对比 · 电力容量约束 · 扩容决策分析
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Activity
              className={`w-4 h-4 ${isRunning ? 'animate-pulse' : ''}`}
              style={{ color: isRunning ? COLORS.success : COLORS.gray }}
            />
            <span
              className="text-sm font-mono"
              style={{ color: COLORS.text }}
            >
              {isRunning ? '运行中' : '已暂停'}
            </span>
          </div>
          {isDerating && (
            <div
              className="px-3 py-1 rounded-full text-xs font-medium animate-pulse"
              style={{
                backgroundColor: `${COLORS.danger}20`,
                color: COLORS.danger,
                border: `1px solid ${COLORS.danger}`,
              }}
            >
              ⚠ 电力降额中
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <ControlPanel />

        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex overflow-hidden">
            <div
              className="flex-1 p-4 overflow-auto flex items-center justify-center"
              style={{ backgroundColor: COLORS.darker }}
            >
              <StationCanvas
                vehicles={vehicles}
                chargingStations={chargingStations}
                swappingBays={swappingBays}
                batteryStorage={batteryStorage}
                currentTime={currentTime}
                isDerating={isDerating}
              />
            </div>

            <div
              className="w-80 flex flex-col border-l overflow-hidden"
              style={{
                borderColor: COLORS.border,
                backgroundColor: COLORS.dark,
              }}
            >
              <MetricsPanel
                metrics={metrics}
                isDerating={isDerating}
              />
              <div
                className="flex-1 overflow-auto border-t"
                style={{ borderColor: COLORS.border }}
              >
                <TrendCharts
                  queueHistory={metrics.queueHistory}
                  powerHistory={metrics.powerHistory}
                  utilizationHistory={metrics.utilizationHistory}
                  totalGridCapacity={config.totalGridCapacity}
                />
              </div>
            </div>
          </div>

          <div
            className="h-72 border-t overflow-hidden"
            style={{
              borderColor: COLORS.border,
              backgroundColor: COLORS.dark,
            }}
          >
            <ExpansionPanel />
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
