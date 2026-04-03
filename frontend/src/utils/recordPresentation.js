export const moodEmojis = ['\u{1F614}', '\u{1F615}', '\u{1F610}', '\u{1F642}', '\u{1F60A}'];
export const energyEmojis = ['\u{1FAAB}', '\u{1F634}', '\u{1F611}', '\u26A1', '\u{1F525}'];

export const moodColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981'];
export const energyColors = ['#94a3b8', '#7dd3fc', '#38bdf8', '#0ea5e9', '#2563eb'];

const moodBackgrounds = {
  default: [
    'rgba(239,68,68,0.18)',
    'rgba(249,115,22,0.18)',
    'rgba(234,179,8,0.18)',
    'rgba(34,197,94,0.18)',
    'rgba(16,185,129,0.18)',
  ],
  selected: [
    'rgba(239,68,68,0.30)',
    'rgba(249,115,22,0.30)',
    'rgba(234,179,8,0.30)',
    'rgba(34,197,94,0.30)',
    'rgba(16,185,129,0.30)',
  ],
};

const clampScoreIndex = (value) => Math.max(0, Math.min(4, Number(value) - 1));

export const getMoodEmoji = (value) => moodEmojis[clampScoreIndex(value)] ?? moodEmojis[2];

export const getEnergyEmoji = (value) => energyEmojis[clampScoreIndex(value)] ?? energyEmojis[2];

export const getMoodColor = (value) => moodColors[clampScoreIndex(value)] ?? '#6b7280';

export const getMoodBackground = (value, { selected = false } = {}) => {
  const palette = selected ? moodBackgrounds.selected : moodBackgrounds.default;
  return palette[clampScoreIndex(value)] ?? 'transparent';
};

export const buildMoodDistribution = (records, moodNames) => {
  const counts = [0, 0, 0, 0, 0];

  for (const record of records) {
    if (record?.mood >= 1 && record.mood <= 5) {
      counts[record.mood - 1] += 1;
    }
  }

  return [
    { emoji: moodEmojis[4], name: moodNames[4], count: counts[4], color: moodColors[4] },
    { emoji: moodEmojis[3], name: moodNames[3], count: counts[3], color: moodColors[3] },
    { emoji: moodEmojis[2], name: moodNames[2], count: counts[2], color: moodColors[2] },
    { emoji: moodEmojis[1], name: moodNames[1], count: counts[1], color: moodColors[1] },
    { emoji: moodEmojis[0], name: moodNames[0], count: counts[0], color: moodColors[0] },
  ];
};

export const getMoodImpactColor = (value) => {
  if (value >= 4.5) return moodColors[4];
  if (value >= 3.5) return moodColors[3];
  if (value >= 2.5) return moodColors[2];
  if (value >= 1.5) return moodColors[1];
  return moodColors[0];
};

export const getMoodImpactEmoji = (value) => getMoodEmoji(Math.round(value));

export const getMoodSummaryEmoji = (value) =>
  Number.isFinite(Number(value)) ? getMoodEmoji(Math.round(Number(value))) : moodEmojis[2];

export const getEnergySummaryEmoji = (value) =>
  Number.isFinite(Number(value)) ? getEnergyEmoji(Math.round(Number(value))) : energyEmojis[2];
