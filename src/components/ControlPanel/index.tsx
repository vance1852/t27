import { useState } from 'react';
import { useConfigStore } from '../../store/useConfigStore';
import { useSimulationStore } from '../../store/useSimulationStore';
import { Gauge, Zap, Battery, Clock, Settings, Play, Pause, RotateCcw, FastForward, ChevronDown, ChevronUp } from 'lucide-react';
import { COLORS } from '../../types';
import { cn } from '@/lib/utils';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}

function Slider({ label, value, min, max, step = 1, unit = '', onChange }: SliderProps) {
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-slate-300">{label}</span>
        <span className="text-sm font-medium" style={{ color: COLORS.secondary }}>
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-lg appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${COLORS.secondary} 0%, ${COLORS.secondary} ${((value - min) / (max - min)) * 100}%, ${COLORS.lightGray} ${((value - min) / (max - min)) * 100}%, ${COLORS.lightGray} 100%)`,
        }}
      />
      <div className="flex justify-between text-xs text-slate-500 mt-1">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

interface CollapsibleGroupProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function CollapsibleGroup({ title, icon, children, defaultOpen = true }: CollapsibleGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="mb-2 rounded-lg overflow-hidden transition-all duration-200 hover:bg-slate-800/50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-700/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span style={{ color: COLORS.secondary }}>{icon}</span>
          <span className="font-medium text-slate-100">{title}</span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>
      {isOpen && (
        <div className="px-3 pb-3">
          {children}
        </div>
      )}
    </div>
  );
}

function formatTime(hours: number): string {
  const h = Math.floor(hours) % 24;
  const m = Math.floor((hours % 1) * 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export default function ControlPanel() {
  const { config, setConfig, setElectricityPrice } = useConfigStore();
  const { state, toggleRunning, setSpeed, reset } = useSimulationStore();

  const speedOptions = [1, 5, 10, 30];

  return (
    <div
      className="h-full flex flex-col overflow-y-auto"
      style={{
        width: '280px',
        backgroundColor: COLORS.dark,
        borderRight: `1px solid ${COLORS.border}`,
      }}
    >
      <div className="p-4 border-b" style={{ borderColor: COLORS.border }}>
        <h1 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5" style={{ color: COLORS.secondary }} />
          控制面板
        </h1>

        <div className="flex items-center justify-between mb-4 p-3 rounded-lg" style={{ backgroundColor: COLORS.darker }}>
          <div>
            <div className="text-xs text-slate-500">仿真时间</div>
            <div className="text-lg font-mono font-bold" style={{ color: COLORS.info }}>
              {formatTime(state.currentTime)}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={toggleRunning}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-medium transition-all duration-200',
              state.isRunning
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            )}
          >
            {state.isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {state.isRunning ? '暂停' : '开始'}
          </button>
          <button
            onClick={reset}
            className="flex items-center justify-center p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
            title="重置"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        <div className="mb-4">
          <div className="text-xs text-slate-500 mb-2 flex items-center gap-1">
            <FastForward className="w-3 h-3" />
            仿真速度
          </div>
          <div className="grid grid-cols-4 gap-2">
            {speedOptions.map((speed) => (
              <button
                key={speed}
                onClick={() => setSpeed(speed)}
                className={cn(
                  'py-2 px-1 rounded text-sm font-medium transition-all duration-200',
                  state.speed === speed
                    ? 'text-white'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                )}
                style={
                  state.speed === speed
                    ? { backgroundColor: COLORS.secondary }
                    : undefined
                }
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <CollapsibleGroup title="车流参数" icon={<Gauge className="w-4 h-4" />}>
          <Slider
            label="到达强度"
            value={config.arrivalIntensity}
            min={2}
            max={20}
            unit="辆/小时"
            onChange={(v) => setConfig({ arrivalIntensity: v })}
          />
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <div className="text-xs text-slate-500 mb-1">早高峰开始</div>
              <input
                type="number"
                min={0}
                max={23}
                value={config.morningPeakStart}
                onChange={(e) => setConfig({ morningPeakStart: Number(e.target.value) })}
                className="w-full p-2 rounded bg-slate-800 border border-slate-600 text-slate-100 text-sm focus:outline-none focus:border-orange-500 transition-colors"
              />
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">早高峰结束</div>
              <input
                type="number"
                min={0}
                max={23}
                value={config.morningPeakEnd}
                onChange={(e) => setConfig({ morningPeakEnd: Number(e.target.value) })}
                className="w-full p-2 rounded bg-slate-800 border border-slate-600 text-slate-100 text-sm focus:outline-none focus:border-orange-500 transition-colors"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <div className="text-xs text-slate-500 mb-1">晚高峰开始</div>
              <input
                type="number"
                min={0}
                max={23}
                value={config.eveningPeakStart}
                onChange={(e) => setConfig({ eveningPeakStart: Number(e.target.value) })}
                className="w-full p-2 rounded bg-slate-800 border border-slate-600 text-slate-100 text-sm focus:outline-none focus:border-orange-500 transition-colors"
              />
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">晚高峰结束</div>
              <input
                type="number"
                min={0}
                max={23}
                value={config.eveningPeakEnd}
                onChange={(e) => setConfig({ eveningPeakEnd: Number(e.target.value) })}
                className="w-full p-2 rounded bg-slate-800 border border-slate-600 text-slate-100 text-sm focus:outline-none focus:border-orange-500 transition-colors"
              />
            </div>
          </div>
          <Slider
            label="高峰倍数"
            value={config.peakMultiplier}
            min={1.5}
            max={4}
            step={0.1}
            unit="x"
            onChange={(v) => setConfig({ peakMultiplier: v })}
          />
        </CollapsibleGroup>

        <CollapsibleGroup title="设施配置" icon={<Battery className="w-4 h-4" />}>
          <Slider
            label="充电桩数量"
            value={config.chargingStationCount}
            min={2}
            max={20}
            unit="个"
            onChange={(v) => setConfig({ chargingStationCount: v })}
          />
          <Slider
            label="换电工位数量"
            value={config.swappingBayCount}
            min={1}
            max={8}
            unit="个"
            onChange={(v) => setConfig({ swappingBayCount: v })}
          />
          <Slider
            label="电池仓容量"
            value={config.batteryStorageCapacity}
            min={10}
            max={100}
            unit="块"
            onChange={(v) => setConfig({ batteryStorageCapacity: v })}
          />
          <Slider
            label="初始满电电池数"
            value={config.initialFullBatteries}
            min={1}
            max={config.batteryStorageCapacity}
            unit="块"
            onChange={(v) => setConfig({ initialFullBatteries: v })}
          />
        </CollapsibleGroup>

        <CollapsibleGroup title="电力参数" icon={<Zap className="w-4 h-4" />}>
          <Slider
            label="单桩功率"
            value={config.chargerPower}
            min={60}
            max={360}
            step={10}
            unit="kW"
            onChange={(v) => setConfig({ chargerPower: v })}
          />
          <Slider
            label="电池仓充电功率"
            value={config.batteryChargerPower}
            min={20}
            max={100}
            step={5}
            unit="kW"
            onChange={(v) => setConfig({ batteryChargerPower: v })}
          />
          <Slider
            label="总配电容量"
            value={config.totalGridCapacity}
            min={500}
            max={5000}
            step={100}
            unit="kW"
            onChange={(v) => setConfig({ totalGridCapacity: v })}
          />
          <Slider
            label="换电时长"
            value={config.swapDuration}
            min={2}
            max={10}
            step={0.5}
            unit="分钟"
            onChange={(v) => setConfig({ swapDuration: v })}
          />
        </CollapsibleGroup>

        <CollapsibleGroup title="电价策略" icon={<Clock className="w-4 h-4" />}>
          <div className="space-y-3">
            {config.electricityPrices.map((price, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="text-xs text-slate-400 w-20">
                  {price.startHour.toString().padStart(2, '0')}:00 - {price.endHour.toString().padStart(2, '0')}:00
                </span>
                <div className="flex-1 relative">
                  <input
                    type="number"
                    min={0}
                    max={2}
                    step={0.01}
                    value={price.price}
                    onChange={(e) => setElectricityPrice(index, { price: Number(e.target.value) })}
                    className="w-full p-2 pr-8 rounded bg-slate-800 border border-slate-600 text-slate-100 text-sm focus:outline-none focus:border-orange-500 transition-colors"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                    元
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleGroup>
      </div>

      <style>{`
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: ${COLORS.secondary};
          cursor: pointer;
          border: 2px solid ${COLORS.dark};
          box-shadow: 0 0 0 2px ${COLORS.secondary};
        }
        input[type="range"]::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: ${COLORS.secondary};
          cursor: pointer;
          border: 2px solid ${COLORS.dark};
          box-shadow: 0 0 0 2px ${COLORS.secondary};
        }
      `}</style>
    </div>
  );
}
