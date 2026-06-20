export type Point = {
  x: number;
  y: number;
};

export type VehicleStatus = 'queuing' | 'charging' | 'swapping' | 'leaving' | 'lost' | 'entering';
export type VehicleMode = 'charging' | 'swapping' | 'undecided';
export type BatteryStatus = 'full' | 'charging' | 'empty';

export interface Vehicle {
  id: string;
  arrivalTime: number;
  batteryLevel: number;
  batteryCapacity: number;
  maxWaitTime: number;
  mode: VehicleMode;
  status: VehicleStatus;
  assignedStationId: number | null;
  assignedBayId: number | null;
  chargeStartTime: number | null;
  swapStartTime: number | null;
  targetSoC: number;
  position: Point;
  targetPosition: Point;
  queueStartTime: number | null;
  actualWaitTime: number | null;
  energyCharged: number;
}

export interface ChargingStation {
  id: number;
  occupied: boolean;
  power: number;
  currentPower: number;
  vehicleId: string | null;
  chargeProgress: number;
  position: Point;
}

export interface SwappingBay {
  id: number;
  occupied: boolean;
  swapDuration: number;
  vehicleId: string | null;
  swapProgress: number;
  position: Point;
}

export interface Battery {
  id: string;
  soc: number;
  status: BatteryStatus;
  chargeRate: number;
  currentChargePower: number;
}

export interface BatteryStorage {
  totalCapacity: number;
  batteries: Battery[];
  chargingCount: number;
  availableFullCount: number;
  lowStockThreshold: number;
  position: Point;
}

export interface TimeSeriesData {
  time: number;
  value: number;
}

export interface Metrics {
  avgWaitTime: number;
  maxQueueLength: number;
  currentQueueLength: number;
  chargingQueueLength: number;
  swappingQueueLength: number;
  throughput: number;
  churnRate: number;
  totalVehicles: number;
  lostVehicles: number;
  servedVehicles: number;
  electricityCost: number;
  powerUtilization: number;
  totalPowerDemand: number;
  totalPowerAllocated: number;
  deratedTime: number;
  batteryLowStockTime: number;
  queueHistory: TimeSeriesData[];
  powerHistory: TimeSeriesData[];
  utilizationHistory: TimeSeriesData[];
  chargingUtilization: number;
  swappingUtilization: number;
}

export interface ElectricityPrice {
  startHour: number;
  endHour: number;
  price: number;
}

export interface SimulationConfig {
  arrivalIntensity: number;
  morningPeakStart: number;
  morningPeakEnd: number;
  eveningPeakStart: number;
  eveningPeakEnd: number;
  peakMultiplier: number;
  
  chargingStationCount: number;
  swappingBayCount: number;
  batteryStorageCapacity: number;
  initialFullBatteries: number;
  
  chargerPower: number;
  batteryChargerPower: number;
  swapDuration: number;
  totalGridCapacity: number;
  
  targetSoC: number;
  averageBatteryCapacity: number;
  averageMaxWaitTime: number;
  minBatteryLevel: number;
  maxBatteryLevel: number;
  
  electricityPrices: ElectricityPrice[];
  
  vehiclePriorityWeight: number;
  batteryPriorityWeight: number;
}

export interface SimulationState {
  isRunning: boolean;
  speed: number;
  currentTime: number;
  startTime: number;
  
  vehicles: Vehicle[];
  chargingStations: ChargingStation[];
  swappingBays: SwappingBay[];
  batteryStorage: BatteryStorage;
  metrics: Metrics;
  
  isDerating: boolean;
  lastUpdateTime: number;
}

export interface ExpansionScenario {
  id: string;
  name: string;
  chargingStationsAdded: number;
  swappingBaysAdded: number;
  batteryCapacityAdded: number;
  gridCapacityAdded: number;
  cost: number;
  avgWaitTime: number;
  churnRate: number;
  throughput: number;
  improvementScore: number;
  costBenefitRatio: number;
  paybackPeriod: number;
}

export const DEFAULT_CONFIG: SimulationConfig = {
  arrivalIntensity: 8,
  morningPeakStart: 8,
  morningPeakEnd: 10,
  eveningPeakStart: 17,
  eveningPeakEnd: 19,
  peakMultiplier: 2.5,
  
  chargingStationCount: 6,
  swappingBayCount: 2,
  batteryStorageCapacity: 30,
  initialFullBatteries: 15,
  
  chargerPower: 180,
  batteryChargerPower: 40,
  swapDuration: 4,
  totalGridCapacity: 1500,
  
  targetSoC: 0.85,
  averageBatteryCapacity: 200,
  averageMaxWaitTime: 20,
  minBatteryLevel: 0.1,
  maxBatteryLevel: 0.5,
  
  electricityPrices: [
    { startHour: 0, endHour: 6, price: 0.35 },
    { startHour: 6, endHour: 10, price: 0.85 },
    { startHour: 10, endHour: 14, price: 0.65 },
    { startHour: 14, endHour: 18, price: 0.85 },
    { startHour: 18, endHour: 22, price: 0.75 },
    { startHour: 22, endHour: 24, price: 0.45 },
  ],
  
  vehiclePriorityWeight: 1.0,
  batteryPriorityWeight: 0.5,
};

export const COLORS = {
  primary: '#1e3a5f',
  secondary: '#ff6b35',
  success: '#2ecc71',
  warning: '#f39c12',
  danger: '#e74c3c',
  info: '#3498db',
  purple: '#9b59b6',
  teal: '#1abc9c',
  dark: '#0f172a',
  darker: '#0a0f1a',
  gray: '#7f8c8d',
  lightGray: '#2d3748',
  border: '#374151',
  text: '#f1f5f9',
  textMuted: '#94a3b8',
} as const;
