export const formatTime = (hours: number): string => {
  const h = Math.floor(hours) % 24;
  const m = Math.floor((hours % 1) * 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

export const formatTimeDuration = (minutes: number): string => {
  if (minutes < 1) return `${Math.round(minutes * 60)}秒`;
  if (minutes < 60) return `${minutes.toFixed(1)}分钟`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}小时${m}分`;
};

export const formatNumber = (num: number, decimals = 0): string => {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + '万';
  }
  return num.toFixed(decimals);
};

export const formatPercent = (value: number): string => {
  return `${(value * 100).toFixed(1)}%`;
};

export const formatCurrency = (value: number): string => {
  if (value >= 10000) {
    return `¥${(value / 10000).toFixed(1)}万`;
  }
  return `¥${value.toFixed(0)}`;
};

export const formatPower = (kw: number): string => {
  if (kw >= 1000) {
    return `${(kw / 1000).toFixed(1)}MW`;
  }
  return `${kw.toFixed(0)}kW`;
};

export const formatEnergy = (kwh: number): string => {
  if (kwh >= 10000) {
    return `${(kwh / 10000).toFixed(1)}万kWh`;
  }
  if (kwh >= 1000) {
    return `${(kwh / 1000).toFixed(1)}MWh`;
  }
  return `${kwh.toFixed(0)}kWh`;
};
