export const getEnergyLabelKey = (value) => {
  const normalizedValue = Math.max(1, Math.min(5, Number(value) || 3));
  return `dashboard.energyLevel${normalizedValue}`;
};
