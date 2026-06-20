import type {
  Vehicle,
  ChargingStation,
  SwappingBay,
  BatteryStorage,
  SimulationConfig,
  Point,
} from '../types';
import { SIMULATION_CONSTANTS } from './constants';

export class StrategyEngine {
  private config: SimulationConfig;

  constructor(config: SimulationConfig) {
    this.config = config;
  }

  selectVehicleMode(vehicle: Vehicle, batteryStorage: BatteryStorage): 'charging' | 'swapping' {
    const hasFullBattery = batteryStorage.availableFullCount > 0;
    const isLowBattery = vehicle.batteryLevel < 0.2;

    if (hasFullBattery && isLowBattery) {
      return Math.random() < 0.9 ? 'swapping' : 'charging';
    }

    if (hasFullBattery) {
      return Math.random() < 0.7 ? 'swapping' : 'charging';
    }

    return Math.random() < 0.5 ? 'charging' : 'swapping';
  }

  selectChargingStation(
    vehicle: Vehicle,
    stations: ChargingStation[],
    vehicles: Vehicle[]
  ): number | null {
    const idleStations = stations.filter((s) => !s.occupied);
    if (idleStations.length > 0) {
      return idleStations[0].id;
    }

    let minWaitTime = Infinity;
    let selectedStationId: number | null = null;

    for (const station of stations) {
      const currentVehicle = vehicles.find((v) => v.id === station.vehicleId);
      let remainingChargeTime = 0;

      if (currentVehicle && currentVehicle.chargeStartTime !== null) {
        const energyNeeded =
          currentVehicle.batteryCapacity * (currentVehicle.targetSoC - currentVehicle.batteryLevel);
        const chargeRate = station.currentPower;
        remainingChargeTime = energyNeeded / chargeRate;
      }

      const queueVehicles = vehicles.filter(
        (v) => v.assignedStationId === station.id && v.status === 'queuing'
      );
      const estimatedQueueTime = queueVehicles.length * 10;

      const totalWaitTime = remainingChargeTime + estimatedQueueTime;

      if (totalWaitTime < minWaitTime) {
        minWaitTime = totalWaitTime;
        selectedStationId = station.id;
      }
    }

    return selectedStationId;
  }

  selectSwappingBay(
    vehicle: Vehicle,
    bays: SwappingBay[],
    batteryStorage: BatteryStorage
  ): number | null {
    if (batteryStorage.availableFullCount === 0) {
      return null;
    }

    const idleBays = bays.filter((b) => !b.occupied);
    if (idleBays.length > 0) {
      return idleBays[0].id;
    }

    let minWaitTime = Infinity;
    let selectedBayId: number | null = null;

    for (const bay of bays) {
      const remainingSwapTime = bay.swapDuration * (1 - bay.swapProgress);

      if (remainingSwapTime < minWaitTime) {
        minWaitTime = remainingSwapTime;
        selectedBayId = bay.id;
      }
    }

    return selectedBayId;
  }

  getQueuePosition(mode: 'charging' | 'swapping', queueIndex: number): Point {
    const { QUEUE_START_X, QUEUE_SPACING, QUEUE_CHARGING_Y, QUEUE_SWAPPING_Y } = SIMULATION_CONSTANTS;

    return {
      x: QUEUE_START_X + queueIndex * QUEUE_SPACING,
      y: mode === 'charging' ? QUEUE_CHARGING_Y : QUEUE_SWAPPING_Y,
    };
  }
}
