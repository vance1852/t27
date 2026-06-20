import { create } from 'zustand';
import { SimulationState, SimulationConfig } from '../types';
import { SimulationEngine } from '../simulation/SimulationEngine';

interface SimulationStore {
  engine: SimulationEngine;
  state: SimulationState;
  isExpansionRunning: boolean;
  setEngine: (config: SimulationConfig) => void;
  setState: (state: Partial<SimulationState>) => void;
  toggleRunning: () => void;
  setSpeed: (speed: number) => void;
  reset: () => void;
  step: (deltaMs: number) => void;
  setExpansionRunning: (running: boolean) => void;
}

const initialEngine = new SimulationEngine();

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  engine: initialEngine,
  state: initialEngine.createInitialState(),
  isExpansionRunning: false,
  
  setEngine: (config) => {
    const newEngine = new SimulationEngine(config);
    set({
      engine: newEngine,
      state: newEngine.createInitialState(),
    });
  },
  
  setState: (updates) => set((state) => ({
    state: { ...state.state, ...updates },
  })),
  
  toggleRunning: () => set((state) => ({
    state: { ...state.state, isRunning: !state.state.isRunning },
  })),
  
  setSpeed: (speed) => set((state) => ({
    state: { ...state.state, speed },
  })),
  
  reset: () => {
    const { engine } = get();
    engine.reset();
    set({ state: engine.createInitialState() });
  },
  
  step: (deltaMs) => {
    const { engine, state } = get();
    if (!state.isRunning) return;
    
    const newState = engine.step(state, deltaMs);
    set({ state: newState });
  },
  
  setExpansionRunning: (running) => set({ isExpansionRunning: running }),
}));
