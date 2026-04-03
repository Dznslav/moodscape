export const moodCounterOptions = {
  responsive: true,
  maintainAspectRatio: false,
  circumference: 180,
  rotation: -90,
  cutout: '72%',
  animation: {
    animateRotate: true,
    animateScale: false,
    duration: 1200,
    easing: 'easeOutQuart',
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(10, 14, 39, 0.85)',
      cornerRadius: 10,
      bodyFont: { family: 'Inter', size: 13 },
    },
  },
};

export const buildMoodCounterChartData = (distribution) => {
  const data = distribution.map((item) => item.count);
  const hasData = data.some((value) => value > 0);

  return {
    labels: distribution.map((item) => item.name),
    datasets: [
      {
        data: hasData ? data : [1],
        backgroundColor: hasData
          ? distribution.map((item) => item.color)
          : ['rgba(150,150,150,0.2)'],
        borderWidth: 0,
        spacing: 2,
        borderRadius: 4,
      },
    ],
  };
};

export const createTrendOptions = ({ emojis, formatLabel }) => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(10, 14, 39, 0.85)',
      titleFont: { family: 'Inter', size: 12 },
      bodyFont: { family: 'Inter', size: 13 },
      padding: 10,
      cornerRadius: 10,
      callbacks: {
        label: (context) => formatLabel(Number(context.raw) || 0),
      },
    },
  },
  scales: {
    y: {
      min: 0.5,
      max: 5.5,
      ticks: {
        stepSize: 1,
        callback: (value) => emojis[Number(value) - 1] || '',
        font: { size: 16 },
        color: 'rgba(150,150,150,0.8)',
      },
      grid: {
        color: 'rgba(150,150,150,0.1)',
        drawBorder: false,
      },
      border: { display: false },
    },
    x: {
      ticks: {
        font: { family: 'Inter', size: 11 },
        color: 'rgba(150,150,150,0.7)',
        maxRotation: 0,
      },
      grid: { display: false },
      border: { display: false },
    },
  },
});

export const createNumericTrendOptions = ({
  min,
  max,
  stepSize,
  formatLabel,
  yTickFormatter,
  layoutPadding,
  xMaxTicksLimit,
  yTickFontSize,
  yTickPadding,
}) => ({
  responsive: true,
  maintainAspectRatio: false,
  layout: layoutPadding
    ? {
        padding: layoutPadding,
      }
    : undefined,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(10, 14, 39, 0.85)',
      titleFont: { family: 'Inter', size: 12 },
      bodyFont: { family: 'Inter', size: 13 },
      padding: 10,
      cornerRadius: 10,
      callbacks: {
        label: (context) => formatLabel(Number(context.raw) || 0),
      },
    },
  },
  scales: {
    y: {
      min,
      max,
      ticks: {
        stepSize,
        callback: (value) =>
          typeof yTickFormatter === 'function'
            ? yTickFormatter(Number(value))
            : Number(value),
        font: { family: 'Inter', size: yTickFontSize ?? 11 },
        color: 'rgba(150,150,150,0.8)',
        padding: yTickPadding ?? 6,
      },
      grid: {
        color: 'rgba(150,150,150,0.1)',
        drawBorder: false,
      },
      border: { display: false },
    },
    x: {
      ticks: {
        font: { family: 'Inter', size: 11 },
        color: 'rgba(150,150,150,0.7)',
        maxRotation: 0,
        autoSkip: true,
        maxTicksLimit: xMaxTicksLimit,
      },
      grid: { display: false },
      border: { display: false },
    },
  },
});
