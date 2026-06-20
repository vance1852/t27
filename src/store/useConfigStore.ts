import { create } from 'zustand';
import { SimulationConfig, DEFAULT_CONFIG, ElectricityPrice } from '../types';

interface ConfigStore {
  config: SimulationConfig;
  setConfig: (updates: Partial<SimulationConfig>) => void;
  setElectricityPrice: (index: number, price: Partial<ElectricityPrice>) => void;
  resetConfig: () => void;
}

export const useConfigStore = create<ConfigStore>((set) => ({
  config: { ...DEFAULT_CONFIG },
  
  setConfig: (updates) => set((state) => ({
    config: { ...state.config, ...updates },
  })),
  
  setElectricityPrice: (index, price) => set((state) => {
    const newPrices = [...state.config.electricityPrices];
    newPrices[index] = { ...newPrices[index], ...price };
    return {
      config: { ...state.config, electricityPrices: newPrices },
    };
  }),
  
  resetConfig: () => set({ config: { ...DEFAULT_CONFIG } }),
}));
