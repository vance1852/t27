import { useEffect, useRef } from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import { useConfigStore } from '../store/useConfigStore';
import { useAnimationLoop } from './useAnimationLoop';
import { SimulationConfig } from '../types';

export const useSimulation = () => {
  const { state, step, setEngine, engine } = useSimulationStore();
  const { config } = useConfigStore();
  const previousConfigRef = useRef<SimulationConfig | null>(null);

  useEffect(() => {
    setEngine(config);
    previousConfigRef.current = config;
  }, [config.chargingStationCount, config.swappingBayCount, config.batteryStorageCapacity, config.totalGridCapacity]);

  useEffect(() => {
    if (previousConfigRef.current && previousConfigRef.current !== config) {
      const prev = previousConfigRef.current;
      const hasOtherChanges = 
        prev.arrivalIntensity !== config.arrivalIntensity ||
        prev.morningPeakStart !== config.morningPeakStart ||
        prev.morningPeakEnd !== config.morningPeakEnd ||
        prev.eveningPeakStart !== config.eveningPeakStart ||
        prev.eveningPeakEnd !== config.eveningPeakEnd ||
        prev.peakMultiplier !== config.peakMultiplier ||
        prev.chargerPower !== config.chargerPower ||
        prev.batteryChargerPower !== config.batteryChargerPower ||
        prev.swapDuration !== config.swapDuration ||
        prev.electricityPrices !== config.electricityPrices ||
        prev.initialFullBatteries !== config.initialFullBatteries;
      
      if (hasOtherChanges) {
        engine.updateConfig(config);
      }
    }
    previousConfigRef.current = config;
  }, [config]);

  useAnimationLoop((deltaMs) => {
    step(deltaMs);
  }, true);

  return {
    isRunning: state.isRunning,
    currentTime: state.currentTime,
    speed: state.speed,
    vehicles: state.vehicles,
    chargingStations: state.chargingStations,
    swappingBays: state.swappingBays,
    batteryStorage: state.batteryStorage,
    metrics: state.metrics,
    isDerating: state.isDerating,
  };
};
