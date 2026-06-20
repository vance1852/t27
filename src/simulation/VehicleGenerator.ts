import type { Vehicle, SimulationConfig, Point } from '../types';
import { generateId, randomRange, poissonInterval } from '../utils/math';
import { getArrivalRateMultiplier, SIMULATION_CONSTANTS } from './constants';

export class VehicleGenerator {
  private config: SimulationConfig;
  private nextArrivalTime: number;
  private vehicleCount: number;

  constructor(config: SimulationConfig) {
    this.config = config;
    this.nextArrivalTime = 0;
    this.vehicleCount = 0;
  }

  update(currentTime: number): Vehicle[] {
    const newVehicles: Vehicle[] = [];
    const currentHour = currentTime % 24;
    const multiplier = getArrivalRateMultiplier(
      currentHour,
      this.config.morningPeakStart,
      this.config.morningPeakEnd,
      this.config.eveningPeakStart,
      this.config.eveningPeakEnd,
      this.config.peakMultiplier
    );
    const arrivalRate = (this.config.arrivalIntensity * multiplier) / 60;

    while (currentTime >= this.nextArrivalTime) {
      const vehicle = this.createVehicle(this.nextArrivalTime);
      newVehicles.push(vehicle);
      this.nextArrivalTime += poissonInterval(arrivalRate);
    }

    return newVehicles;
  }

  private createVehicle(arrivalTime: number): Vehicle {
    const batteryLevel = randomRange(this.config.minBatteryLevel, this.config.maxBatteryLevel);
    const batteryCapacity = randomRange(
      this.config.averageBatteryCapacity * 0.8,
      this.config.averageBatteryCapacity * 1.2
    );
    const maxWaitTime = randomRange(
      this.config.averageMaxWaitTime * 0.7,
      this.config.averageMaxWaitTime * 1.3
    );
    const position: Point = {
      x: SIMULATION_CONSTANTS.ENTRANCE_X,
      y: SIMULATION_CONSTANTS.ENTRANCE_Y,
    };

    this.vehicleCount++;

    return {
      id: generateId(),
      arrivalTime,
      batteryLevel,
      batteryCapacity,
      maxWaitTime,
      mode: 'undecided',
      status: 'entering',
      assignedStationId: null,
      assignedBayId: null,
      chargeStartTime: null,
      swapStartTime: null,
      targetSoC: this.config.targetSoC,
      position,
      targetPosition: { ...position },
      queueStartTime: null,
      actualWaitTime: null,
      energyCharged: 0,
    };
  }
}
