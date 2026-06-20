export const SIMULATION_CONSTANTS = {
  STEP_DURATION: 0.1,
  HISTORY_SAMPLE_INTERVAL: 5,
  MAX_HISTORY_POINTS: 200,
  VEHICLE_MOVE_SPEED: 120,
  QUEUE_SPACING: 45,
  STATION_WIDTH: 60,
  STATION_HEIGHT: 70,
  VEHICLE_WIDTH: 36,
  VEHICLE_HEIGHT: 24,
  CANVAS_PADDING: 40,
  ENTRANCE_X: 60,
  ENTRANCE_Y: 100,
  QUEUE_START_X: 140,
  QUEUE_CHARGING_Y: 180,
  QUEUE_SWAPPING_Y: 340,
  CHARGING_STATIONS_START_X: 260,
  CHARGING_STATIONS_Y: 150,
  SWAPPING_BAYS_START_X: 260,
  SWAPPING_BAYS_Y: 310,
  BATTERY_STORAGE_X: 680,
  BATTERY_STORAGE_Y: 180,
  BATTERY_STORAGE_WIDTH: 160,
  BATTERY_STORAGE_HEIGHT: 180,
  EXIT_X: 860,
  EXIT_Y: 280,
} as const;

export const COSTS = {
  CHARGING_STATION: 80000,
  SWAPPING_BAY: 350000,
  BATTERY: 15000,
  GRID_UPGRADE_PER_KW: 800,
  REVENUE_PER_SERVED_VEHICLE: 80,
} as const;

export const getChargePowerFactor = (soc: number): number => {
  if (soc < 0.75) return 1.0;
  if (soc < 0.95) return 1.0 - ((soc - 0.75) / 0.2) * 0.7;
  return 0.1;
};

export const getArrivalRateMultiplier = (
  hour: number,
  morningStart: number,
  morningEnd: number,
  eveningStart: number,
  eveningEnd: number,
  peakMultiplier: number
): number => {
  if (hour >= morningStart && hour < morningEnd) {
    const t = (hour - morningStart) / (morningEnd - morningStart);
    return 1 + (peakMultiplier - 1) * Math.sin(t * Math.PI);
  }
  if (hour >= eveningStart && hour < eveningEnd) {
    const t = (hour - eveningStart) / (eveningEnd - eveningStart);
    return 1 + (peakMultiplier - 1) * Math.sin(t * Math.PI);
  }
  const offPeak = 0.5 + 0.3 * Math.sin((hour / 24) * Math.PI * 2);
  return Math.max(0.3, offPeak);
};

export const getCurrentElectricityPrice = (
  hour: number,
  prices: { startHour: number; endHour: number; price: number }[]
): number => {
  for (const p of prices) {
    if (hour >= p.startHour && hour < p.endHour) {
      return p.price;
    }
  }
  return prices[prices.length - 1]?.price || 0.5;
};
