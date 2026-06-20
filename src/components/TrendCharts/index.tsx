import React, { useEffect, useRef, useMemo } from 'react';
import { TimeSeriesData, COLORS } from '../../types';
import { SIMULATION_CONSTANTS } from '../../simulation/constants';

interface TrendChartsProps {
  queueHistory: TimeSeriesData[];
  powerHistory: TimeSeriesData[];
  utilizationHistory: TimeSeriesData[];
  totalGridCapacity: number;
}

interface ChartConfig {
  title: string;
  yMin: number;
  yMax: number;
  lineColor: string;
  unit: string;
  warningLine?: { value: number; color: string; dashed?: boolean };
}

const CHART_HEIGHT = 120;
const CHART_GAP = 16;
const PADDING_LEFT = 50;
const PADDING_RIGHT = 60;
const PADDING_TOP = 24;
const PADDING_BOTTOM = 24;
const MAX_DISPLAY_POINTS = SIMULATION_CONSTANTS.MAX_HISTORY_POINTS;

const catmullRomToBezier = (p0: { x: number; y: number }, p1: { x: number; y: number }, p2: { x: number; y: number }, p3: { x: number; y: number }) => {
  const cp1x = p1.x + (p2.x - p0.x) / 6;
  const cp1y = p1.y + (p2.y - p0.y) / 6;
  const cp2x = p2.x - (p3.x - p1.x) / 6;
  const cp2y = p2.y - (p3.y - p1.y) / 6;
  return { cp1x, cp1y, cp2x, cp2y };
};

const getSmoothPath = (points: { x: number; y: number }[]) => {
  if (points.length < 2) return '';
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const { cp1x, cp1y, cp2x, cp2y } = catmullRomToBezier(p0, p1, p2, p3);
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  return path;
};

const TrendCharts: React.FC<TrendChartsProps> = ({
  queueHistory,
  powerHistory,
  utilizationHistory,
  totalGridCapacity,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const displayDataRef = useRef<{
    queue: TimeSeriesData[];
    power: TimeSeriesData[];
    utilization: TimeSeriesData[];
  }>({ queue: [], power: [], utilization: [] });

  const chartConfigs: ChartConfig[] = useMemo(() => [
    {
      title: '实时队列长度',
      yMin: 0,
      yMax: 30,
      lineColor: '#3498db',
      unit: '辆',
    },
    {
      title: '总功率 (kW)',
      yMin: 0,
      yMax: totalGridCapacity,
      lineColor: '#ff6b35',
      unit: 'kW',
      warningLine: { value: totalGridCapacity, color: '#e74c3c', dashed: true },
    },
    {
      title: '配电利用率',
      yMin: 0,
      yMax: 100,
      lineColor: '#2ecc71',
      unit: '%',
      warningLine: { value: 80, color: '#f39c12', dashed: false },
    },
  ], [totalGridCapacity]);

  const getDisplayData = (history: TimeSeriesData[], targetLength: number): TimeSeriesData[] => {
    if (history.length === 0) {
      const now = Date.now();
      return Array(targetLength).fill(null).map((_, i) => ({
        time: now - (targetLength - 1 - i) * 1000,
        value: 0,
      }));
    }

    if (history.length >= targetLength) {
      return history.slice(-targetLength);
    }

    const padding: TimeSeriesData[] = [];
    const firstTime = history[0].time;
    const interval = history.length > 1 ? (history[history.length - 1].time - firstTime) / (history.length - 1) : 1000;

    for (let i = 0; i < targetLength - history.length; i++) {
      padding.push({
        time: firstTime - (targetLength - history.length - i) * interval,
        value: 0,
      });
    }

    return [...padding, ...history];
  };

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const interpolateData = (target: TimeSeriesData[], current: TimeSeriesData[], t: number): TimeSeriesData[] => {
    if (current.length === 0) return target;
    return target.map((point, i) => ({
      time: point.time,
      value: lerp(current[i]?.value || 0, point.value, t),
    }));
  };

  const drawChart = (
    ctx: CanvasRenderingContext2D,
    data: TimeSeriesData[],
    config: ChartConfig,
    chartY: number,
    chartWidth: number
  ) => {
    const chartInnerWidth = chartWidth - PADDING_LEFT - PADDING_RIGHT;
    const chartInnerHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
    const drawAreaX = PADDING_LEFT;
    const drawAreaY = chartY + PADDING_TOP;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
    ctx.fillRect(drawAreaX - 8, chartY, chartInnerWidth + 16, CHART_HEIGHT);

    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(drawAreaX, drawAreaY, chartInnerWidth, chartInnerHeight);

    ctx.strokeStyle = 'rgba(55, 65, 81, 0.5)';
    ctx.lineWidth = 0.5;
    const gridLineCount = 4;
    for (let i = 0; i <= gridLineCount; i++) {
      const y = drawAreaY + (chartInnerHeight / gridLineCount) * i;
      ctx.beginPath();
      ctx.moveTo(drawAreaX, y);
      ctx.lineTo(drawAreaX + chartInnerWidth, y);
      ctx.stroke();

      const value = config.yMax - ((config.yMax - config.yMin) / gridLineCount) * i;
      ctx.fillStyle = COLORS.textMuted;
      ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(value.toFixed(0), drawAreaX - 6, y + 3);
    }

    if (config.warningLine) {
      const warningY = drawAreaY + chartInnerHeight -
        ((config.warningLine.value - config.yMin) / (config.yMax - config.yMin)) * chartInnerHeight;

      if (warningY >= drawAreaY && warningY <= drawAreaY + chartInnerHeight) {
        ctx.strokeStyle = config.warningLine.color;
        ctx.lineWidth = 1.5;

        if (config.warningLine.dashed) {
          ctx.setLineDash([5, 4]);
        } else {
          ctx.setLineDash([]);
        }

        ctx.beginPath();
        ctx.moveTo(drawAreaX, warningY);
        ctx.lineTo(drawAreaX + chartInnerWidth, warningY);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    const displayData = data.slice(-MAX_DISPLAY_POINTS);
    const points: { x: number; y: number }[] = displayData.map((d, i) => {
      const x = drawAreaX + (i / (MAX_DISPLAY_POINTS - 1)) * chartInnerWidth;
      const y = drawAreaY + chartInnerHeight -
        Math.max(0, Math.min(1, (d.value - config.yMin) / (config.yMax - config.yMin))) * chartInnerHeight;
      return { x, y };
    });

    if (points.length >= 2) {
      const gradient = ctx.createLinearGradient(0, drawAreaY, 0, drawAreaY + chartInnerHeight);
      const baseColor = config.lineColor;
      gradient.addColorStop(0, baseColor + '60');
      gradient.addColorStop(0.5, baseColor + '20');
      gradient.addColorStop(1, baseColor + '05');

      const smoothPath = getSmoothPath(points);
      const path2D = new Path2D(smoothPath);

      ctx.save();
      ctx.beginPath();
      path2D && ctx.stroke(path2D);
      ctx.lineTo(points[points.length - 1].x, drawAreaY + chartInnerHeight);
      ctx.lineTo(points[0].x, drawAreaY + chartInnerHeight);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.restore();

      ctx.beginPath();
      const strokePath = new Path2D(smoothPath);
      ctx.strokeStyle = baseColor;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke(strokePath);
    }

    const recentPoints = points.slice(-10);
    recentPoints.forEach((p, i) => {
      const alpha = 0.3 + (i / recentPoints.length) * 0.7;
      const radius = 2 + (i / recentPoints.length) * 2;

      ctx.beginPath();
      ctx.arc(p.x, p.y, radius + 2, 0, Math.PI * 2);
      ctx.fillStyle = config.lineColor + Math.floor(alpha * 40).toString(16).padStart(2, '0');
      ctx.fill();

      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = config.lineColor;
      ctx.fill();
    });

    ctx.fillStyle = COLORS.text;
    ctx.font = '600 12px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(config.title, drawAreaX - 8, chartY + 16);

    const latestValue = displayData[displayData.length - 1]?.value || 0;
    ctx.fillStyle = config.lineColor;
    ctx.font = 'bold 14px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${latestValue.toFixed(1)} ${config.unit}`, drawAreaX + chartInnerWidth + 8, chartY + 16);

    if (displayData.length > 0) {
      const startTime = displayData[0].time;
      const endTime = displayData[displayData.length - 1].time;
      const duration = (endTime - startTime) / 1000;

      ctx.fillStyle = COLORS.textMuted;
      ctx.font = '9px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`-${duration.toFixed(0)}s`, drawAreaX, drawAreaY + chartInnerHeight + 14);

      ctx.textAlign = 'right';
      ctx.fillText('现在', drawAreaX + chartInnerWidth, drawAreaY + chartInnerHeight + 14);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let startTime = 0;
    const animationDuration = 300;
    let previousQueue = [...displayDataRef.current.queue];
    let previousPower = [...displayDataRef.current.power];
    let previousUtilization = [...displayDataRef.current.utilization];

    displayDataRef.current = {
      queue: getDisplayData(queueHistory, MAX_DISPLAY_POINTS),
      power: getDisplayData(powerHistory, MAX_DISPLAY_POINTS),
      utilization: getDisplayData(utilizationHistory, MAX_DISPLAY_POINTS),
    };

    startTime = performance.now();

    const animate = (timestamp: number) => {
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / animationDuration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const chartWidth = rect.width;
      const totalHeight = CHART_HEIGHT * 3 + CHART_GAP * 2;

      canvas.width = chartWidth * dpr;
      canvas.height = totalHeight * dpr;
      canvas.style.height = `${totalHeight}px`;

      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, chartWidth, totalHeight);

      const interpolatedQueue = interpolateData(displayDataRef.current.queue, previousQueue, easeProgress);
      const interpolatedPower = interpolateData(displayDataRef.current.power, previousPower, easeProgress);
      const interpolatedUtilization = interpolateData(displayDataRef.current.utilization, previousUtilization, easeProgress);

      drawChart(ctx, interpolatedQueue, chartConfigs[0], 0, chartWidth);
      drawChart(ctx, interpolatedPower, chartConfigs[1], CHART_HEIGHT + CHART_GAP, chartWidth);
      drawChart(ctx, interpolatedUtilization, chartConfigs[2], (CHART_HEIGHT + CHART_GAP) * 2, chartWidth);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        previousQueue = [...displayDataRef.current.queue];
        previousPower = [...displayDataRef.current.power];
        previousUtilization = [...displayDataRef.current.utilization];
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [queueHistory, powerHistory, utilizationHistory, chartConfigs]);

  return (
    <div className="w-full">
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ height: `${CHART_HEIGHT * 3 + CHART_GAP * 2}px` }}
      />
    </div>
  );
};

export default TrendCharts;
