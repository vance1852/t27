import {
  Vehicle, ChargingStation, SwappingBay, BatteryStorage, Battery,
  SimulationConfig, SimulationState, Metrics, BatteryStatus,
  DEFAULT_CONFIG
} from '../types';
import { VehicleGenerator } from './VehicleGenerator';
import { PowerDistributor } from './PowerDistributor';
import { StrategyEngine } from './StrategyEngine';
import { generateId, clamp, distance, lerp } from '../utils/math';
import {
  SIMULATION_CONSTANTS, getCurrentElectricityPrice, getChargePowerFactor
} from './constants';

const {
  STEP_DURATION,
  MAX_HISTORY_POINTS,
  CHARGING_STATIONS_START_X,
  CHARGING_STATIONS_Y,
  SWAPPING_BAYS_START_X,
  SWAPPING_BAYS_Y,
  BATTERY_STORAGE_X,
  STATION_WIDTH,
  VEHICLE_MOVE_SPEED,
  EXIT_X,
  EXIT_Y,
} = SIMULATION_CONSTANTS;

export class SimulationEngine {
  private config: SimulationConfig;
  private vehicleGenerator: VehicleGenerator;
  private powerDistributor: PowerDistributor;
  private strategyEngine: StrategyEngine;
  private lastHistorySample: number = 0;
  private waitTimes: number[] = [];

  constructor(config: SimulationConfig = DEFAULT_CONFIG) {
    this.config = config;
    this.vehicleGenerator = new VehicleGenerator(config);
    this.powerDistributor = new PowerDistributor(config);
    this.strategyEngine = new StrategyEngine(config);
  }

  public updateConfig(config: Partial<SimulationConfig>): void {
    this.config = { ...this.config, ...config };
    this.vehicleGenerator = new VehicleGenerator(this.config);
    this.powerDistributor = new PowerDistributor(this.config);
    this.strategyEngine = new StrategyEngine(this.config);
  }

  public getConfig(): SimulationConfig {
    return { ...this.config };
  }

  public createInitialState(): SimulationState {
    const startTime = 6;
    const chargingStations = this.createChargingStations();
    const swappingBays = this.createSwappingBays();
    const batteryStorage = this.createBatteryStorage();

    return {
      isRunning: false,
      speed: 5,
      currentTime: startTime,
      startTime,
      vehicles: [],
      chargingStations,
      swappingBays,
      batteryStorage,
      metrics: this.createInitialMetrics(),
      isDerating: false,
      lastUpdateTime: 0,
    };
  }

  private createInitialMetrics(): Metrics {
    return {
      avgWaitTime: 0,
      maxQueueLength: 0,
      currentQueueLength: 0,
      chargingQueueLength: 0,
      swappingQueueLength: 0,
      throughput: 0,
      churnRate: 0,
      totalVehicles: 0,
      lostVehicles: 0,
      servedVehicles: 0,
      electricityCost: 0,
      powerUtilization: 0,
      totalPowerDemand: 0,
      totalPowerAllocated: 0,
      deratedTime: 0,
      batteryLowStockTime: 0,
      queueHistory: [],
      powerHistory: [],
      utilizationHistory: [],
      chargingUtilization: 0,
      swappingUtilization: 0,
    };
  }

  private createChargingStations(): ChargingStation[] {
    const stations: ChargingStation[] = [];
    const count = this.config.chargingStationCount;
    const perRow = Math.ceil(count / 2);

    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      stations.push({
        id: i,
        occupied: false,
        power: this.config.chargerPower,
        currentPower: 0,
        vehicleId: null,
        chargeProgress: 0,
        position: {
          x: CHARGING_STATIONS_START_X + col * (STATION_WIDTH + 15),
          y: CHARGING_STATIONS_Y + row * 85,
        },
      });
    }
    return stations;
  }

  private createSwappingBays(): SwappingBay[] {
    const bays: SwappingBay[] = [];
    for (let i = 0; i < this.config.swappingBayCount; i++) {
      bays.push({
        id: i,
        occupied: false,
        swapDuration: this.config.swapDuration,
        vehicleId: null,
        swapProgress: 0,
        position: {
          x: SWAPPING_BAYS_START_X + i * (STATION_WIDTH + 20),
          y: SWAPPING_BAYS_Y,
        },
      });
    }
    return bays;
  }

  private createBatteryStorage(): BatteryStorage {
    const batteries: Battery[] = [];
    for (let i = 0; i < this.config.batteryStorageCapacity; i++) {
      const isFull = i < this.config.initialFullBatteries;
      batteries.push({
        id: generateId(),
        soc: isFull ? 1.0 : 0.1,
        status: isFull ? 'full' : 'empty',
        chargeRate: 1.0,
        currentChargePower: 0,
      });
    }

    return {
      totalCapacity: this.config.batteryStorageCapacity,
      batteries,
      chargingCount: 0,
      availableFullCount: this.config.initialFullBatteries,
      lowStockThreshold: 5,
      position: {
        x: BATTERY_STORAGE_X,
        y: SIMULATION_CONSTANTS.BATTERY_STORAGE_Y,
      },
    };
  }

  public step(state: SimulationState, deltaRealMs: number): SimulationState {
    if (!state.isRunning) return state;

    const deltaSimMinutes = state.speed * (deltaRealMs / 1000) * 60;
    const steps = Math.max(1, Math.floor(deltaSimMinutes / STEP_DURATION));
    const stepDelta = deltaSimMinutes / steps;

    let newState = { ...state };

    for (let i = 0; i < steps; i++) {
      newState = this.singleStep(newState, stepDelta);
    }

    return newState;
  }

  private singleStep(state: SimulationState, deltaMinutes: number): SimulationState {
    const newTime = state.currentTime + deltaMinutes / 60;
    const currentHour = newTime % 24;

    let vehicles = state.vehicles.map(v => ({ ...v }));
    let chargingStations = state.chargingStations.map(s => ({ ...s }));
    let swappingBays = state.swappingBays.map(b => ({ ...b }));
    let batteryStorage = {
      ...state.batteryStorage,
      batteries: state.batteryStorage.batteries.map(b => ({ ...b }))
    };
    const metrics = { ...state.metrics };

    const newVehicles = this.vehicleGenerator.update(newTime);
    vehicles.push(...newVehicles);
    metrics.totalVehicles += newVehicles.length;

    vehicles = this.processEnteringVehicles(vehicles, batteryStorage, chargingStations, swappingBays);
    vehicles = this.processQueuingVehicles(vehicles, newTime, metrics);

    const activeResult = this.processActiveVehicles(
      vehicles, chargingStations, swappingBays, batteryStorage, newTime, deltaMinutes, metrics);
    vehicles = activeResult.vehicles;
    chargingStations = activeResult.chargingStations;
    swappingBays = activeResult.swappingBays;
    batteryStorage = activeResult.batteryStorage;

    batteryStorage = this.updateBatteryCharging(batteryStorage, deltaMinutes);

    const powerResult = this.powerDistributor.distributePower(
      chargingStations, batteryStorage, vehicles);

    const derating = powerResult.isDerating;

    const energyConsumed = powerResult.totalAllocated * (deltaMinutes / 60);
    const electricityPrice = getCurrentElectricityPrice(currentHour, this.config.electricityPrices);
    metrics.electricityCost += energyConsumed * electricityPrice;

    if (derating) {
      metrics.deratedTime += deltaMinutes;
    }

    if (batteryStorage.availableFullCount < batteryStorage.lowStockThreshold) {
      metrics.batteryLowStockTime += deltaMinutes;
    }

    const updatedMetrics = this.updateMetrics(metrics, vehicles, chargingStations, swappingBays, batteryStorage, powerResult, newTime);

    vehicles = this.updateVehiclePositions(vehicles, deltaMinutes);

    vehicles = vehicles.filter(v => v.status !== 'leaving' ||
      distance(v.position.x, v.position.y, EXIT_X, EXIT_Y) > 10);

    return {
      ...state,
      currentTime: newTime,
      vehicles,
      chargingStations,
      swappingBays,
      batteryStorage,
      metrics: updatedMetrics,
      isDerating: derating,
      lastUpdateTime: Date.now(),
    };
  }

  private processEnteringVehicles(
    vehicles: Vehicle[],
    batteryStorage: BatteryStorage,
    chargingStations: ChargingStation[],
    swappingBays: SwappingBay[]
  ): Vehicle[] {
    return vehicles.map(vehicle => {
      if (vehicle.status !== 'entering') return vehicle;

      const mode = this.strategyEngine.selectVehicleMode(vehicle, batteryStorage);
      const newVehicle = { ...vehicle, mode };

      if (mode === 'charging') {
        const stationId = this.strategyEngine.selectChargingStation(newVehicle, chargingStations, vehicles);
        if (stationId !== null) {
          return {
            ...newVehicle,
            status: 'charging',
            assignedStationId: stationId,
            chargeStartTime: null,
            targetPosition: { ...chargingStations[stationId].position },
          };
        }
      } else if (mode === 'swapping') {
        const bayId = this.strategyEngine.selectSwappingBay(newVehicle, swappingBays, batteryStorage);
        if (bayId !== null && batteryStorage.availableFullCount > 0) {
          return {
            ...newVehicle,
            status: 'swapping',
            assignedBayId: bayId,
            swapStartTime: null,
            targetPosition: { ...swappingBays[bayId].position },
          };
        }
      }

      const queueIndex = vehicles.filter(v =>
        v.status === 'queuing' && v.mode === mode).length;
      const queuePos = this.strategyEngine.getQueuePosition(mode, queueIndex);

      return {
        ...newVehicle,
        status: 'queuing',
        queueStartTime: vehicle.arrivalTime,
        targetPosition: queuePos,
      };
    });
  }

  private processQueuingVehicles(
    vehicles: Vehicle[],
    currentTime: number,
    metrics: Metrics
  ): Vehicle[] {
    return vehicles.map(vehicle => {
      if (vehicle.status !== 'queuing') return vehicle;

      const waitTime = currentTime - (vehicle.queueStartTime || vehicle.arrivalTime);
      if (waitTime > vehicle.maxWaitTime) {
        metrics.lostVehicles++;
        return {
          ...vehicle,
          status: 'lost',
          actualWaitTime: waitTime,
          targetPosition: { x: EXIT_X, y: EXIT_Y - 50 },
        };
      }

      return vehicle;
    });
  }

  private processActiveVehicles(
    vehicles: Vehicle[],
    chargingStations: ChargingStation[],
    swappingBays: SwappingBay[],
    batteryStorage: BatteryStorage,
    currentTime: number,
    deltaMinutes: number,
    metrics: Metrics
  ): {
    vehicles: Vehicle[];
    chargingStations: ChargingStation[];
    swappingBays: SwappingBay[];
    batteryStorage: BatteryStorage;
  } {
    const newVehicles = [...vehicles];
    const newStations = [...chargingStations];
    const newBays = [...swappingBays];
    let newBatteryStorage = {
      ...batteryStorage,
      batteries: [...batteryStorage.batteries]
    };

    for (let i = 0; i < newVehicles.length; i++) {
      const vehicle = newVehicles[i];

      if (vehicle.status === 'charging' && vehicle.assignedStationId !== null) {
        const station = newStations[vehicle.assignedStationId];
        const distToStation = distance(
          vehicle.position.x, vehicle.position.y,
          station.position.x, station.position.y
        );

        if (distToStation < 5 && vehicle.chargeStartTime === null) {
          newVehicles[i] = { ...vehicle, chargeStartTime: currentTime };
          newStations[vehicle.assignedStationId] = { ...station, occupied: true, vehicleId: vehicle.id };
          continue;
        }

        if (vehicle.chargeStartTime !== null) {
          const powerFactor = getChargePowerFactor(vehicle.batteryLevel);
          const actualPower = station.power * powerFactor;
          const energyAdded = actualPower * (deltaMinutes / 60);
          const newSoc = clamp(vehicle.batteryLevel + energyAdded / vehicle.batteryCapacity, 0, 1);

          const progress = clamp(
            (newSoc - vehicle.arrivalTime > 0.1 ?
              (newSoc - 0.1) / (vehicle.targetSoC - 0.1) : 0), 0, 1);

          newVehicles[i] = {
            ...vehicle,
            batteryLevel: newSoc,
            energyCharged: vehicle.energyCharged + energyAdded,
          };

          newStations[vehicle.assignedStationId] = {
            ...station,
            currentPower: actualPower,
            chargeProgress: progress,
          };

          if (newSoc >= vehicle.targetSoC) {
            const waitTime = currentTime - (vehicle.queueStartTime || vehicle.arrivalTime);
            this.waitTimes.push(waitTime);
            metrics.servedVehicles++;

            newVehicles[i] = {
              ...newVehicles[i],
              status: 'leaving',
              actualWaitTime: waitTime,
              targetPosition: { x: EXIT_X, y: EXIT_Y },
              assignedStationId: null,
            };
            newStations[station.id] = {
              ...newStations[station.id],
              occupied: false,
              vehicleId: null,
              currentPower: 0,
              chargeProgress: 0,
            };
          }
        }
      }

      if (vehicle.status === 'swapping' && vehicle.assignedBayId !== null) {
        const bay = newBays[vehicle.assignedBayId];
        const distToBay = distance(
          vehicle.position.x, vehicle.position.y,
          bay.position.x, bay.position.y
        );

        if (distToBay < 5 && vehicle.swapStartTime === null && newBatteryStorage.availableFullCount > 0) {
          newVehicles[i] = { ...vehicle, swapStartTime: currentTime };
          newBays[vehicle.assignedBayId] = { ...bay, occupied: true, vehicleId: vehicle.id };

          const fullBatteryIndex = newBatteryStorage.batteries.findIndex(b => b.status === 'full');
          if (fullBatteryIndex !== -1) {
            const oldSoc = vehicle.batteryLevel;
            newVehicles[i].batteryLevel = 1.0;
            newBatteryStorage.batteries[fullBatteryIndex] = {
              ...newBatteryStorage.batteries[fullBatteryIndex],
              soc: oldSoc,
              status: oldSoc >= 0.8 ? 'full' : 'charging',
            };
            newBatteryStorage.availableFullCount--;

            const emptyBattery: Battery = {
              id: generateId(),
              soc: oldSoc,
              status: oldSoc < 0.2 ? 'empty' : 'charging',
              chargeRate: 1.0,
              currentChargePower: 0,
            };
            const emptySlot = newBatteryStorage.batteries.findIndex(b => b.status === 'empty');
            if (emptySlot !== -1) {
              newBatteryStorage.batteries[emptySlot] = emptyBattery;
            } else {
              newBatteryStorage.batteries.push(emptyBattery);
              newBatteryStorage.totalCapacity++;
            }
          }
          continue;
        }

        if (vehicle.swapStartTime !== null) {
          const elapsed = currentTime - vehicle.swapStartTime;
          const progress = clamp(elapsed / bay.swapDuration, 0, 1);
          newBays[vehicle.assignedBayId] = { ...bay, swapProgress: progress };

          if (progress >= 1) {
            const waitTime = currentTime - (vehicle.queueStartTime || vehicle.arrivalTime);
            this.waitTimes.push(waitTime);
            metrics.servedVehicles++;

            newVehicles[i] = {
              ...newVehicles[i],
              status: 'leaving',
              actualWaitTime: waitTime,
              targetPosition: { x: EXIT_X, y: EXIT_Y },
              assignedBayId: null,
            };
            newBays[bay.id] = {
              ...newBays[bay.id],
              occupied: false,
              vehicleId: null,
              swapProgress: 0,
            };
          }
        }
      }
    }

    return {
      vehicles: newVehicles,
      chargingStations: newStations,
      swappingBays: newBays,
      batteryStorage: newBatteryStorage,
    };
  }

  private updateBatteryCharging(
    batteryStorage: BatteryStorage,
    deltaMinutes: number
  ): BatteryStorage {
    const newBatteries = batteryStorage.batteries.map(b => {
      if (b.status !== 'charging') return { ...b };

      const powerFactor = getChargePowerFactor(b.soc);
      const chargePower = this.config.batteryChargerPower * powerFactor;
      const energyAdded = chargePower * b.chargeRate * (deltaMinutes / 60);
      const newSoc = clamp(b.soc + energyAdded / 80, 0, 1);

      const newStatus = (newSoc >= 1.0 ? 'full' : 'charging') as BatteryStatus;

      return {
        ...b,
        soc: newSoc,
        status: newStatus,
        currentChargePower: newStatus === 'charging' ? chargePower : 0,
      };
    });

    const chargingCount = newBatteries.filter(b => b.status === 'charging').length;
    const availableFullCount = newBatteries.filter(b => b.status === 'full').length;

    const emptyBatteries = newBatteries.filter(b => b.status === 'empty');
    const maxChargingSlots = 10;
    const availableSlots = Math.max(0, maxChargingSlots - chargingCount);

    for (let i = 0; i < Math.min(emptyBatteries.length, availableSlots); i++) {
      const idx = newBatteries.findIndex(b => b.id === emptyBatteries[i].id);
      if (idx !== -1) {
        newBatteries[idx] = { ...newBatteries[idx], status: 'charging' };
      }
    }

    return {
      ...batteryStorage,
      batteries: newBatteries,
      chargingCount: newBatteries.filter(b => b.status === 'charging').length,
      availableFullCount: newBatteries.filter(b => b.status === 'full').length,
    };
  }

  private updateMetrics(
    metrics: Metrics,
    vehicles: Vehicle[],
    chargingStations: ChargingStation[],
    swappingBays: SwappingBay[],
    batteryStorage: BatteryStorage,
    powerResult: { totalDemand: number; totalAllocated: number },
    currentTime: number
  ): Metrics {
    const queuingVehicles = vehicles.filter(v => v.status === 'queuing');
    const chargingQueue = queuingVehicles.filter(v => v.mode === 'charging').length;
    const swappingQueue = queuingVehicles.filter(v => v.mode === 'swapping').length;
    const currentQueueLength = queuingVehicles.length;

    const newMetrics = { ...metrics };

    newMetrics.currentQueueLength = currentQueueLength;
    newMetrics.chargingQueueLength = chargingQueue;
    newMetrics.swappingQueueLength = swappingQueue;
    newMetrics.maxQueueLength = Math.max(metrics.maxQueueLength, currentQueueLength);

    const elapsedHours = currentTime - 6;
    newMetrics.throughput = elapsedHours > 0 ? metrics.servedVehicles / elapsedHours : 0;
    newMetrics.churnRate = metrics.totalVehicles > 0 ? metrics.lostVehicles / metrics.totalVehicles : 0;

    if (this.waitTimes.length > 0) {
      newMetrics.avgWaitTime = this.waitTimes.reduce((a, b) => a + b, 0) / this.waitTimes.length;
    }

    const occupiedStations = chargingStations.filter(s => s.occupied).length;
    newMetrics.chargingUtilization = chargingStations.length > 0 ? occupiedStations / chargingStations.length : 0;

    const occupiedBays = swappingBays.filter(b => b.occupied).length;
    newMetrics.swappingUtilization = swappingBays.length > 0 ? occupiedBays / swappingBays.length : 0;

    newMetrics.totalPowerDemand = powerResult.totalDemand;
    newMetrics.totalPowerAllocated = powerResult.totalAllocated;
    newMetrics.powerUtilization = this.config.totalGridCapacity > 0 ?
      powerResult.totalAllocated / this.config.totalGridCapacity : 0;

    if (currentTime - this.lastHistorySample >= SIMULATION_CONSTANTS.HISTORY_SAMPLE_INTERVAL / 60) {
      this.lastHistorySample = currentTime;

      const addHistory = (history: { time: number; value: number }[], value: number) => {
        const newHistory = [...history, { time: currentTime, value }];
        return newHistory.slice(-MAX_HISTORY_POINTS);
      };

      newMetrics.queueHistory = addHistory(metrics.queueHistory, currentQueueLength);
      newMetrics.powerHistory = addHistory(metrics.powerHistory, powerResult.totalAllocated);
      newMetrics.utilizationHistory = addHistory(metrics.utilizationHistory, newMetrics.powerUtilization);
    }

    return newMetrics;
  }

  private updateVehiclePositions(vehicles: Vehicle[], deltaMinutes: number): Vehicle[] {
    const moveDistance = VEHICLE_MOVE_SPEED * (deltaMinutes / 60);

    return vehicles.map(vehicle => {
      const dx = vehicle.targetPosition.x - vehicle.position.x;
      const dy = vehicle.targetPosition.y - vehicle.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 1) return vehicle;

      const t = Math.min(1, moveDistance / dist);
      return {
        ...vehicle,
        position: {
          x: lerp(vehicle.position.x, vehicle.targetPosition.x, t),
          y: lerp(vehicle.position.y, vehicle.targetPosition.y, t),
        },
      };
    });
  }

  public reset(): void {
    this.waitTimes = [];
    this.lastHistorySample = 0;
    this.vehicleGenerator = new VehicleGenerator(this.config);
  }

  public runBatchSimulation(configOverrides: Partial<SimulationConfig>, durationHours: number = 24): Metrics {
    const originalConfig = this.getConfig();
    this.updateConfig({ ...originalConfig, ...configOverrides });
    this.reset();

    let state = this.createInitialState();
    state.isRunning = true;
    state.speed = 100;

    const endTime = state.currentTime + durationHours;
    const stepMs = 100;

    while (state.currentTime < endTime) {
      state = this.step(state, stepMs);
    }

    this.updateConfig(originalConfig);
    this.reset();

    return state.metrics;
  }
}
