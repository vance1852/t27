import React, { useRef, useEffect } from 'react';
import {
  Vehicle,
  ChargingStation,
  SwappingBay,
  BatteryStorage,
  COLORS,
} from '../../types';
import { SIMULATION_CONSTANTS } from '../../simulation/constants';
import { formatTime } from '../../utils/format';

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 480;

interface StationCanvasProps {
  vehicles: Vehicle[];
  chargingStations: ChargingStation[];
  swappingBays: SwappingBay[];
  batteryStorage: BatteryStorage;
  currentTime: number;
  isDerating: boolean;
}

const getVehicleColor = (batteryLevel: number, status: string): string => {
  if (status === 'lost') return COLORS.gray;
  if (batteryLevel > 0.5) return COLORS.success;
  if (batteryLevel >= 0.2) return COLORS.warning;
  return COLORS.danger;
};

const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
};

const drawBackground = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) => {
  ctx.fillStyle = COLORS.darker;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = COLORS.lightGray;
  ctx.lineWidth = 0.5;

  const gridSize = 20;
  for (let x = 0; x <= width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('时间: ' + formatTime(0), 20, 30);
};

const drawEntrance = (ctx: CanvasRenderingContext2D) => {
  const { ENTRANCE_X, ENTRANCE_Y } = SIMULATION_CONSTANTS;

  ctx.fillStyle = COLORS.teal;
  ctx.strokeStyle = COLORS.teal;
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(ENTRANCE_X, ENTRANCE_Y - 30);
  ctx.lineTo(ENTRANCE_X + 20, ENTRANCE_Y);
  ctx.lineTo(ENTRANCE_X, ENTRANCE_Y + 30);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = COLORS.text;
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('进站', ENTRANCE_X, ENTRANCE_Y + 50);
  ctx.textAlign = 'left';
};

const drawExit = (ctx: CanvasRenderingContext2D) => {
  const { EXIT_X, EXIT_Y } = SIMULATION_CONSTANTS;

  ctx.fillStyle = COLORS.secondary;
  ctx.strokeStyle = COLORS.secondary;
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(EXIT_X, EXIT_Y - 30);
  ctx.lineTo(EXIT_X - 20, EXIT_Y);
  ctx.lineTo(EXIT_X, EXIT_Y + 30);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = COLORS.text;
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('出站', EXIT_X, EXIT_Y + 50);
  ctx.textAlign = 'left';
};

const drawQueueArea = (
  ctx: CanvasRenderingContext2D,
  vehicles: Vehicle[]
) => {
  const { QUEUE_START_X, QUEUE_CHARGING_Y, QUEUE_SWAPPING_Y, QUEUE_SPACING } =
    SIMULATION_CONSTANTS;

  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);

  ctx.strokeRect(QUEUE_START_X - 10, QUEUE_CHARGING_Y - 40, 350, 60);
  ctx.strokeRect(QUEUE_START_X - 10, QUEUE_SWAPPING_Y - 40, 350, 60);

  ctx.setLineDash([]);

  ctx.fillStyle = COLORS.textMuted;
  ctx.font = '12px sans-serif';
  ctx.fillText('充电排队区', QUEUE_START_X, QUEUE_CHARGING_Y - 45);
  ctx.fillText('换电排队区', QUEUE_START_X, QUEUE_SWAPPING_Y - 45);

  const chargingQueue = vehicles.filter(
    (v) => v.status === 'queuing' && v.mode === 'charging'
  );
  const swappingQueue = vehicles.filter(
    (v) => v.status === 'queuing' && v.mode === 'swapping'
  );

  ctx.fillStyle = COLORS.info;
  ctx.font = '11px sans-serif';
  ctx.fillText(
    `${chargingQueue.length}辆`,
    QUEUE_START_X + 80,
    QUEUE_CHARGING_Y - 45
  );
  ctx.fillText(
    `${swappingQueue.length}辆`,
    QUEUE_START_X + 80,
    QUEUE_SWAPPING_Y - 45
  );
};

const drawChargingStations = (
  ctx: CanvasRenderingContext2D,
  stations: ChargingStation[],
  vehicles: Vehicle[],
  pulseFactor: number
) => {
  const {
    STATION_WIDTH,
    STATION_HEIGHT,
    CHARGING_STATIONS_START_X,
    CHARGING_STATIONS_Y,
  } = SIMULATION_CONSTANTS;

  const spacing = 80;

  stations.forEach((station, index) => {
    const x = CHARGING_STATIONS_START_X + index * spacing;
    const y = CHARGING_STATIONS_Y;

    if (station.occupied) {
      const glowIntensity = 0.3 + pulseFactor * 0.3;
      ctx.shadowColor = COLORS.info;
      ctx.shadowBlur = 15 + pulseFactor * 10;
      ctx.globalAlpha = 0.5 + glowIntensity;
    }

    ctx.fillStyle = station.occupied ? COLORS.info : COLORS.lightGray;
    ctx.strokeStyle = station.occupied ? COLORS.info : COLORS.border;
    ctx.lineWidth = 2;

    roundRect(ctx, x, y, STATION_WIDTH, STATION_HEIGHT, 8);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`#${station.id}`, x + STATION_WIDTH / 2, y + 20);

    ctx.font = '10px sans-serif';
    ctx.fillStyle = COLORS.textMuted;
    ctx.fillText(
      `${station.currentPower.toFixed(0)}kW`,
      x + STATION_WIDTH / 2,
      y + 38
    );

    const barWidth = STATION_WIDTH - 16;
    const barHeight = 8;
    const barX = x + 8;
    const barY = y + 48;

    ctx.fillStyle = COLORS.dark;
    ctx.fillRect(barX, barY, barWidth, barHeight);

    if (station.occupied) {
      const progress = station.chargeProgress;
      const gradient = ctx.createLinearGradient(barX, barY, barX + barWidth, barY);
      gradient.addColorStop(0, COLORS.info);
      gradient.addColorStop(1, COLORS.teal);
      ctx.fillStyle = gradient;
      ctx.fillRect(barX, barY, barWidth * progress, barHeight);
    }

    ctx.font = '10px sans-serif';
    ctx.fillStyle = station.occupied ? COLORS.success : COLORS.textMuted;
    ctx.fillText(
      station.occupied ? '充电中' : '空闲',
      x + STATION_WIDTH / 2,
      y + 65
    );

    ctx.textAlign = 'left';

    if (station.occupied && station.vehicleId) {
      const vehicle = vehicles.find((v) => v.id === station.vehicleId);
      if (vehicle) {
        drawVehicle(ctx, vehicle, x + 12, y + 75);
      }
    }
  });
};

const drawSwappingBays = (
  ctx: CanvasRenderingContext2D,
  bays: SwappingBay[],
  pulseFactor: number
) => {
  const {
    STATION_WIDTH,
    STATION_HEIGHT,
    SWAPPING_BAYS_START_X,
    SWAPPING_BAYS_Y,
  } = SIMULATION_CONSTANTS;

  const spacing = 80;

  bays.forEach((bay, index) => {
    const x = SWAPPING_BAYS_START_X + index * spacing;
    const y = SWAPPING_BAYS_Y;

    if (bay.occupied) {
      ctx.shadowColor = COLORS.purple;
      ctx.shadowBlur = 15 + pulseFactor * 10;
      ctx.globalAlpha = 0.5 + pulseFactor * 0.3;
    }

    ctx.fillStyle = bay.occupied ? COLORS.purple : COLORS.lightGray;
    ctx.strokeStyle = bay.occupied ? COLORS.purple : COLORS.border;
    ctx.lineWidth = 2;

    roundRect(ctx, x, y, STATION_WIDTH, STATION_HEIGHT, 8);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`换电#${bay.id}`, x + STATION_WIDTH / 2, y + 20);

    ctx.font = '10px sans-serif';
    ctx.fillStyle = COLORS.textMuted;
    ctx.fillText(`${bay.swapDuration}分钟`, x + STATION_WIDTH / 2, y + 38);

    const barWidth = STATION_WIDTH - 16;
    const barHeight = 8;
    const barX = x + 8;
    const barY = y + 48;

    ctx.fillStyle = COLORS.dark;
    ctx.fillRect(barX, barY, barWidth, barHeight);

    if (bay.occupied) {
      const progress = bay.swapProgress;
      const gradient = ctx.createLinearGradient(barX, barY, barX + barWidth, barY);
      gradient.addColorStop(0, COLORS.purple);
      gradient.addColorStop(1, COLORS.info);
      ctx.fillStyle = gradient;
      ctx.fillRect(barX, barY, barWidth * progress, barHeight);
    }

    ctx.font = '10px sans-serif';
    ctx.fillStyle = bay.occupied ? COLORS.success : COLORS.textMuted;
    ctx.fillText(
      bay.occupied ? '换电中' : '空闲',
      x + STATION_WIDTH / 2,
      y + 65
    );

    ctx.textAlign = 'left';
  });
};

const drawBatteryStorage = (
  ctx: CanvasRenderingContext2D,
  storage: BatteryStorage
) => {
  const { BATTERY_STORAGE_X, BATTERY_STORAGE_Y, BATTERY_STORAGE_WIDTH, BATTERY_STORAGE_HEIGHT } =
    SIMULATION_CONSTANTS;

  ctx.fillStyle = COLORS.secondary;
  ctx.strokeStyle = COLORS.secondary;
  ctx.lineWidth = 2;

  roundRect(ctx, BATTERY_STORAGE_X, BATTERY_STORAGE_Y, BATTERY_STORAGE_WIDTH, BATTERY_STORAGE_HEIGHT, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('电池仓', BATTERY_STORAGE_X + BATTERY_STORAGE_WIDTH / 2, BATTERY_STORAGE_Y + 25);
  ctx.textAlign = 'left';

  const stockPercent = storage.batteries.length / storage.totalCapacity;
  const barWidth = BATTERY_STORAGE_WIDTH - 24;
  const barHeight = 16;
  const barX = BATTERY_STORAGE_X + 12;
  const barY = BATTERY_STORAGE_Y + 40;

  ctx.fillStyle = COLORS.dark;
  ctx.fillRect(barX, barY, barWidth, barHeight);

  const stockGradient = ctx.createLinearGradient(barX, barY, barX + barWidth, barY);
  stockGradient.addColorStop(0, COLORS.warning);
  stockGradient.addColorStop(1, COLORS.success);
  ctx.fillStyle = stockGradient;
  ctx.fillRect(barX, barY, barWidth * stockPercent, barHeight);

  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    `${storage.batteries.length}/${storage.totalCapacity}`,
    BATTERY_STORAGE_X + BATTERY_STORAGE_WIDTH / 2,
    barY + 12
  );
  ctx.textAlign = 'left';

  const statsStartY = barY + 35;
  const statSpacing = 28;

  ctx.fillStyle = COLORS.textMuted;
  ctx.font = '11px sans-serif';
  ctx.fillText('满电电池:', BATTERY_STORAGE_X + 15, statsStartY);
  ctx.fillStyle = COLORS.success;
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(`${storage.availableFullCount}块`, BATTERY_STORAGE_X + 85, statsStartY);

  ctx.fillStyle = COLORS.textMuted;
  ctx.font = '11px sans-serif';
  ctx.fillText('充电中:', BATTERY_STORAGE_X + 15, statsStartY + statSpacing);
  ctx.fillStyle = COLORS.info;
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(`${storage.chargingCount}块`, BATTERY_STORAGE_X + 85, statsStartY + statSpacing);

  ctx.fillStyle = COLORS.textMuted;
  ctx.font = '11px sans-serif';
  ctx.fillText('低电量:', BATTERY_STORAGE_X + 15, statsStartY + statSpacing * 2);
  ctx.fillStyle = COLORS.danger;
  ctx.font = 'bold 12px sans-serif';
  const lowCount = storage.batteries.filter((b) => b.soc < 0.2).length;
  ctx.fillText(`${lowCount}块`, BATTERY_STORAGE_X + 85, statsStartY + statSpacing * 2);

  const socBarsStartY = statsStartY + statSpacing * 3 + 10;
  const socBarWidth = 10;
  const socBarMaxHeight = 40;
  const socSpacing = 4;
  const maxBars = Math.min(storage.batteries.length, 12);
  const totalSocWidth = maxBars * (socBarWidth + socSpacing) - socSpacing;
  const socStartX = BATTERY_STORAGE_X + (BATTERY_STORAGE_WIDTH - totalSocWidth) / 2;

  for (let i = 0; i < maxBars; i++) {
    const battery = storage.batteries[i];
    const barHeight = socBarMaxHeight * battery.soc;
    const barX = socStartX + i * (socBarWidth + socSpacing);
    const barY = socBarsStartY + socBarMaxHeight - barHeight;

    let barColor: string = COLORS.danger;
    if (battery.soc > 0.8) barColor = COLORS.success;
    else if (battery.soc > 0.4) barColor = COLORS.warning;

    ctx.fillStyle = barColor;
    ctx.fillRect(barX, barY, socBarWidth, barHeight);

    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, socBarWidth, barHeight);
  }
};

const drawVehicle = (
  ctx: CanvasRenderingContext2D,
  vehicle: Vehicle,
  x?: number,
  y?: number
) => {
  const { VEHICLE_WIDTH, VEHICLE_HEIGHT } = SIMULATION_CONSTANTS;
  const posX = x ?? vehicle.position.x;
  const posY = y ?? vehicle.position.y;

  const isLost = vehicle.status === 'lost';
  const color = getVehicleColor(vehicle.batteryLevel, vehicle.status);

  if (isLost) {
    ctx.globalAlpha = 0.4;
  }

  ctx.fillStyle = color;
  ctx.strokeStyle = COLORS.dark;
  ctx.lineWidth = 1.5;

  roundRect(ctx, posX, posY, VEHICLE_WIDTH, VEHICLE_HEIGHT, 4);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillRect(posX + 2, posY + 2, VEHICLE_WIDTH - 4, 6);

  ctx.fillStyle = COLORS.dark;
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    `${Math.round(vehicle.batteryLevel * 100)}%`,
    posX + VEHICLE_WIDTH / 2,
    posY - 6
  );
  ctx.textAlign = 'left';

  ctx.globalAlpha = 1;
};

const drawVehicles = (ctx: CanvasRenderingContext2D, vehicles: Vehicle[]) => {
  const { QUEUE_START_X, QUEUE_CHARGING_Y, QUEUE_SWAPPING_Y, QUEUE_SPACING, VEHICLE_WIDTH } =
    SIMULATION_CONSTANTS;

  const chargingQueue = vehicles.filter(
    (v) => v.status === 'queuing' && v.mode === 'charging'
  );
  const swappingQueue = vehicles.filter(
    (v) => v.status === 'queuing' && v.mode === 'swapping'
  );

  chargingQueue.forEach((vehicle, index) => {
    const x = QUEUE_START_X + index * QUEUE_SPACING;
    const y = QUEUE_CHARGING_Y - 12;
    drawVehicle(ctx, vehicle, x, y);
  });

  swappingQueue.forEach((vehicle, index) => {
    const x = QUEUE_START_X + index * QUEUE_SPACING;
    const y = QUEUE_SWAPPING_Y - 12;
    drawVehicle(ctx, vehicle, x, y);
  });

  const otherVehicles = vehicles.filter(
    (v) => v.status === 'entering' || v.status === 'leaving' || v.status === 'lost'
  );
  otherVehicles.forEach((vehicle) => {
    drawVehicle(ctx, vehicle);
  });
};

const drawPowerWarning = (
  ctx: CanvasRenderingContext2D,
  isDerating: boolean,
  flashFactor: number
) => {
  if (!isDerating) return;

  const alpha = 0.3 + flashFactor * 0.5;

  ctx.fillStyle = `rgba(231, 76, 60, ${alpha})`;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.fillStyle = COLORS.danger;
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('⚠️ 电力降额中', CANVAS_WIDTH / 2, 60);
  ctx.textAlign = 'left';
};

const drawTimeDisplay = (ctx: CanvasRenderingContext2D, currentTime: number) => {
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`时间: ${formatTime(currentTime)}`, CANVAS_WIDTH - 20, 30);
  ctx.textAlign = 'left';
};

const StationCanvas: React.FC<StationCanvasProps> = ({
  vehicles,
  chargingStations,
  swappingBays,
  batteryStorage,
  currentTime,
  isDerating,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const timeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      timeRef.current += 0.05;
      const pulseFactor = (Math.sin(timeRef.current * 3) + 1) / 2;
      const flashFactor = (Math.sin(timeRef.current * 8) + 1) / 2;

      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      drawBackground(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
      drawTimeDisplay(ctx, currentTime);
      drawEntrance(ctx);
      drawExit(ctx);
      drawQueueArea(ctx, vehicles);
      drawChargingStations(ctx, chargingStations, vehicles, pulseFactor);
      drawSwappingBays(ctx, swappingBays, pulseFactor);
      drawBatteryStorage(ctx, batteryStorage);
      drawVehicles(ctx, vehicles);
      drawPowerWarning(ctx, isDerating, flashFactor);

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [vehicles, chargingStations, swappingBays, batteryStorage, currentTime, isDerating]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-slate-900 rounded-lg overflow-hidden">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="border border-slate-700 rounded-lg"
      />
    </div>
  );
};

export default StationCanvas;
