import type {
  Vehicle,
  ChargingStation,
  Battery,
  BatteryStorage,
  SimulationConfig,
} from '../types';
import { getChargePowerFactor } from './constants';

export class PowerDistributor {
  private config: SimulationConfig;

  constructor(config: SimulationConfig) {
    this.config = config;
  }

  distributePower(
    stations: ChargingStation[],
    batteryStorage: BatteryStorage,
    vehicles: Vehicle[]
  ): {
    isDerating: boolean;
    totalDemand: number;
    totalAllocated: number;
  } {
    const stationDemands: Map<number, number> = new Map();
    const batteryDemands: Map<string, number> = new Map();

    for (const station of stations) {
      if (station.occupied && station.vehicleId) {
        const vehicle = vehicles.find((v) => v.id === station.vehicleId);
        if (vehicle) {
          const demand =
            station.power * getChargePowerFactor(vehicle.batteryLevel);
          stationDemands.set(station.id, demand);
        }
      }
    }

    for (const battery of batteryStorage.batteries) {
      if (battery.status === 'charging') {
        const demand =
          this.config.batteryChargerPower * getChargePowerFactor(battery.soc);
        batteryDemands.set(battery.id, demand);
      }
    }

    const totalVehicleDemand = Array.from(stationDemands.values()).reduce(
      (sum, d) => sum + d,
      0
    );
    const totalBatteryDemand = Array.from(batteryDemands.values()).reduce(
      (sum, d) => sum + d,
      0
    );
    const totalDemand = totalVehicleDemand + totalBatteryDemand;

    let isDerating = false;
    let totalAllocated = 0;

    if (totalDemand <= this.config.totalGridCapacity) {
      isDerating = false;

      for (const station of stations) {
        const demand = stationDemands.get(station.id) ?? 0;
        station.currentPower = demand;
        totalAllocated += demand;
      }

      for (const battery of batteryStorage.batteries) {
        const demand = batteryDemands.get(battery.id) ?? 0;
        battery.currentChargePower = demand;
        totalAllocated += demand;
      }
    } else {
      isDerating = true;

      const vehicleWeight = this.config.vehiclePriorityWeight;
      const batteryWeight = this.config.batteryPriorityWeight;

      const weightedTotalDemand =
        totalVehicleDemand * vehicleWeight + totalBatteryDemand * batteryWeight;

      const allocationRatio = this.config.totalGridCapacity / weightedTotalDemand;

      for (const station of stations) {
        const demand = stationDemands.get(station.id) ?? 0;
        const allocated = Math.min(
          demand,
          demand * allocationRatio * vehicleWeight
        );
        station.currentPower = allocated;
        totalAllocated += allocated;
      }

      for (const battery of batteryStorage.batteries) {
        const demand = batteryDemands.get(battery.id) ?? 0;
        const allocated = Math.min(
          demand,
          demand * allocationRatio * batteryWeight
        );
        battery.currentChargePower = allocated;
        totalAllocated += allocated;
      }
    }

    return {
      isDerating,
      totalDemand,
      totalAllocated,
    };
  }
}
