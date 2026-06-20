export const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

export const lerp = (a: number, b: number, t: number): number => {
  return a + (b - a) * t;
};

export const distance = (x1: number, y1: number, x2: number, y2: number): number => {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
};

export const normalize = (value: number, min: number, max: number): number => {
  if (max === min) return 0;
  return (value - min) / (max - min);
};

export const randomRange = (min: number, max: number): number => {
  return Math.random() * (max - min) + min;
};

export const randomInt = (min: number, max: number): number => {
  return Math.floor(randomRange(min, max + 1));
};

export const poissonInterval = (lambda: number): number => {
  return -Math.log(1 - Math.random()) / lambda;
};

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 11);
};

export const movingAverage = (values: number[], window: number): number => {
  if (values.length === 0) return 0;
  const recent = values.slice(-window);
  return recent.reduce((a, b) => a + b, 0) / recent.length;
};

export const exponentialSmooth = (current: number, previous: number, alpha = 0.3): number => {
  return alpha * current + (1 - alpha) * previous;
};
