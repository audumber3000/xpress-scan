// Number/axis formatting helpers shared by the dashboard charts.

// Money/number formatting lives in utils/currency.js so the Payments screen
// can use the same helpers without importing out of the dashboard's folder.
// Re-exported here because the dashboard's charts already import them from
// this module.
export { formatCompactMoney, formatMoney, formatCount } from '../../utils/currency';

// 10000 -> "10k", 10200 -> "10.2k". Axis ticks only — no currency symbol.
export const formatToK = (value) => {
  if (value >= 1000) {
    const kValue = value / 1000;
    return kValue % 1 === 0 ? `${kValue}k` : `${kValue.toFixed(1)}k`;
  }
  return String(value);
};

// Nice step size aiming for ~5 ticks.
const getNiceStep = (min, max) => {
  const range = max - min;
  const roughStep = range / 5;
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const normalizedStep = roughStep / magnitude;

  const niceSteps = [1, 2, 5, 10];
  let bestStep = 1;
  for (const step of niceSteps) {
    if (step >= normalizedStep) {
      bestStep = step;
      break;
    }
  }
  const finalStep = bestStep * magnitude;
  return finalStep < 1 && range > 1 ? 1 : finalStep || 1;
};

// Dynamic Y-axis [min, max] with padding, rounded to nice numbers.
export const calculateYAxisDomain = (data, dataKeys, paddingPercent = 0.15) => {
  if (!data || data.length === 0) return [0, 100];

  const keys = Array.isArray(dataKeys) ? dataKeys : [dataKeys];
  let minValue = Infinity;
  let maxValue = -Infinity;

  data.forEach((item) => {
    keys.forEach((key) => {
      const value = item[key];
      if (value !== null && value !== undefined && !isNaN(value)) {
        minValue = Math.min(minValue, value);
        maxValue = Math.max(maxValue, value);
      }
    });
  });

  if (minValue === Infinity || maxValue === -Infinity) return [0, 100];

  const range = maxValue - minValue;
  const padding = range * paddingPercent;
  const domainMin = Math.max(0, minValue - padding);
  const domainMax = maxValue + padding;

  const step = getNiceStep(domainMin, domainMax);
  const niceMin = Math.floor(domainMin / step) * step;

  // Round up to the next whole step and stop. There used to be a
  // `domainMin + step * 5` floor here meant to guarantee ~5 gridlines, but the
  // step is *already* sized for about five ticks, so the two compounded: a
  // chart topping out at 96 got a domain of [0, 250] and every bar rendered
  // at a third of its proper height. Tick count is recharts' business, not the
  // domain's.
  const niceMax = Math.max(Math.ceil(domainMax / step) * step, niceMin + step);

  return [niceMin, niceMax];
};

// Shared dark tooltip style used across charts.
export const tooltipStyle = {
  borderRadius: 12,
  border: 'none',
  background: '#111',
  color: '#fff',
  fontSize: 12,
  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
};
