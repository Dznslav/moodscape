export const activityCatalog = [
  { id: 'work', daylioAliases: ['job', 'office', 'business'] },
  { id: 'study', daylioAliases: ['school', 'class', 'college', 'university', 'homework'] },
  { id: 'sport', daylioAliases: ['exercise', 'workout', 'fitness'] },
  { id: 'gym', daylioAliases: ['strength training', 'lifting', 'weights'] },
  { id: 'run', daylioAliases: ['running', 'jog', 'jogging'] },
  { id: 'bike', daylioAliases: ['biking', 'cycling', 'cycle'] },
  { id: 'yoga', daylioAliases: ['stretching', 'pilates'] },
  { id: 'walk', daylioAliases: ['walking', 'hike', 'hiking'] },
  { id: 'nature', daylioAliases: ['park', 'outdoors', 'outdoor'] },
  { id: 'travel', daylioAliases: ['trip', 'vacation', 'holiday', 'flight'] },
  { id: 'beach', daylioAliases: ['sea', 'swimming', 'pool'] },
  { id: 'friends', daylioAliases: ['friend', 'hangout', 'socializing'] },
  { id: 'family', daylioAliases: ['parents', 'kids', 'children'] },
  { id: 'date', daylioAliases: ['romance', 'romantic'] },
  { id: 'party', daylioAliases: ['celebration', 'club'] },
  { id: 'cafe', daylioAliases: ['coffee', 'coffee shop'] },
  { id: 'restaurant', daylioAliases: ['dinner', 'lunch', 'brunch', 'eat out'] },
  { id: 'cooking', daylioAliases: ['cook', 'baking'] },
  { id: 'shopping', daylioAliases: ['mall', 'buying'] },
  { id: 'cleaning', daylioAliases: ['tidying', 'laundry'] },
  { id: 'chores', daylioAliases: ['housework'] },
  { id: 'commute', daylioAliases: ['commuting', 'drive', 'driving', 'bus', 'train'] },
  { id: 'relax', daylioAliases: ['rest', 'relaxing', 'lazy day'] },
  { id: 'meditation', daylioAliases: ['mindfulness', 'breathing'] },
  { id: 'selfcare', daylioAliases: ['self care', 'spa', 'skincare', 'bath'] },
  { id: 'therapy', daylioAliases: ['counseling', 'counselling'] },
  { id: 'health', daylioAliases: ['doctor', 'medicine', 'appointment'] },
  { id: 'journaling', daylioAliases: ['journal', 'diary', 'writing'] },
  { id: 'reading', daylioAliases: ['book', 'books'] },
  { id: 'music', daylioAliases: ['concert', 'singing', 'instrument'] },
  { id: 'movie', daylioAliases: ['cinema', 'series', 'tv', 'netflix'] },
  { id: 'gaming', daylioAliases: ['game', 'video games'] },
  { id: 'creative', daylioAliases: ['craft', 'crafting', 'diy', 'sewing'] },
  { id: 'art', daylioAliases: ['drawing', 'painting', 'design'] },
  { id: 'photography', daylioAliases: ['photos', 'camera'] },
  { id: 'coding', daylioAliases: ['programming', 'development'] },
  { id: 'pet', daylioAliases: ['pets', 'dog', 'cat'] },
  { id: 'gardening', daylioAliases: ['garden', 'plants'] },
  { id: 'volunteering', daylioAliases: ['volunteer', 'charity'] },
];

const IGNORED_ACTIVITY_TOKENS = new Set(['news update']);

export const normalizeActivityToken = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

export const isActivityIgnored = (value) =>
  IGNORED_ACTIVITY_TOKENS.has(normalizeActivityToken(value));

const activityAliasMap = new Map(
  activityCatalog.flatMap(({ id, daylioAliases = [] }) =>
    [id, ...daylioAliases]
      .map((alias) => [normalizeActivityToken(alias), id])
      .filter(([alias]) => alias && !IGNORED_ACTIVITY_TOKENS.has(alias))
  )
);

export const resolveActivityId = (value) => {
  const normalized = normalizeActivityToken(value);
  if (!normalized || IGNORED_ACTIVITY_TOKENS.has(normalized)) return null;
  return normalized ? activityAliasMap.get(normalized) ?? null : null;
};

export const getActivityGroupKey = (value) => {
  if (isActivityIgnored(value)) return null;
  const canonicalId = resolveActivityId(value);
  if (canonicalId) return canonicalId;
  return normalizeActivityToken(value) || null;
};

export const getActivityLabelKey = (value) => {
  const canonicalId = resolveActivityId(value);
  return canonicalId ? `tags.${canonicalId}` : null;
};

export const getActivityDisplayLabel = (value, translate) => {
  if (isActivityIgnored(value)) return '';

  const key = getActivityLabelKey(value);
  if (key) return translate(key);

  const rawValue = String(value ?? '').trim();
  return rawValue || '—';
};

export const isActivitySelected = (selectedActivities, activityId) =>
  selectedActivities.some((activity) => resolveActivityId(activity) === activityId);

export const toggleActivitySelection = (selectedActivities, activityId) => {
  if (isActivitySelected(selectedActivities, activityId)) {
    return selectedActivities.filter((activity) => resolveActivityId(activity) !== activityId);
  }

  return [...selectedActivities, activityId];
};

export const prepareActivitiesForSave = (selectedActivities) => {
  const prepared = [];
  const seen = new Set();

  for (const activity of selectedActivities) {
    const rawValue = String(activity ?? '').trim();
    if (!rawValue) continue;
    if (isActivityIgnored(rawValue)) continue;

    const canonicalId = resolveActivityId(rawValue);
    const value = canonicalId || rawValue;
    const dedupeKey = canonicalId || normalizeActivityToken(rawValue) || rawValue;

    if (seen.has(dedupeKey)) continue;

    seen.add(dedupeKey);
    prepared.push(value);
  }

  return prepared;
};
