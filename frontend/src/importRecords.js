import { prepareActivitiesForSave } from './utils/activities.js';

const DAYLIO_REQUIRED_HEADERS = ['full_date', 'time', 'activities', 'mood'];
const MOODSCAPE_TIMESTAMP_HEADERS = ['timestamp', 'created_at', 'date', 'datetime'];
const IGNORED_ACTIVITY_TOKENS = new Set(['news update']);
const DAYLIO_ACTIVITY_ALIASES = new Map(
  Object.entries({
    work: ['job', 'jobs', 'office', 'business', 'email', 'emails'],
    study: ['school', 'class', 'college', 'university', 'homework', 'learning', 'language learning', 'tutorial', 'research', 'new things'],
    walk: ['walking', 'walk', 'hike', 'hiking'],
    travel: ['trip', 'travel', 'vacation', 'holiday', 'flight'],
    relax: ['rest', 'relaxing', 'lazy day', 'power nap', 'reddit'],
    meditation: ['mindfulness', 'meditation', 'breathing', 'prayer', 'quran'],
    selfcare: ['self care', 'spa', 'skincare', 'bath', 'shower', 'shave', 'shaving', 'trimming', 'trim'],
    health: ['doctor', 'medicine', 'appointment', 'fasting'],
    journaling: ['journal', 'diary', 'writing', 'write diary', 'write dairy'],
    reading: ['book', 'books', 'reading', 'audio books', 'audiobooks'],
    music: ['concert', 'singing', 'instrument', 'songs', 'podcast'],
    movie: ['cinema', 'series', 'tv', 'netflix', 'watching series', 'streaming', 'youtube', 'documentary', 'movies'],
    creative: ['craft', 'crafting', 'diy', 'sewing', 'poetry'],
    art: ['drawing', 'painting', 'design', 'designing', 'art'],
    friends: ['friend', 'hangout', 'socializing', 'penpal'],
    cooking: ['cook', 'cooking', 'baking', 'good meal'],
    chores: ['housework', 'repair', 'cleaning'],
    coding: ['programming', 'development', 'coding'],
  }).flatMap(([activityId, aliases]) => aliases.map((alias) => [normalizeLookupToken(alias), activityId]))
);

const createImportError = (code, details = {}) => {
  const error = new Error(code);
  error.code = code;
  Object.assign(error, details);
  return error;
};

const normalizeHeader = (value) => String(value ?? '').trim().toLowerCase();

const normalizeText = (value) => {
  const normalized = String(value ?? '').trim();
  return normalized || null;
};

function normalizeLookupToken(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const isIgnoredActivity = (value) => IGNORED_ACTIVITY_TOKENS.has(normalizeLookupToken(value));

const countUnquotedDelimiters = (line, delimiter) => {
  let count = 0;
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (insideQuotes && line[index + 1] === '"') {
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (!insideQuotes && character === delimiter) {
      count += 1;
    }
  }

  return count;
};

const detectDelimiter = (csvText) => {
  const firstLine = String(csvText ?? '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/u)
    .find((line) => line.trim());

  if (!firstLine) {
    return ',';
  }

  return countUnquotedDelimiters(firstLine, ';') > countUnquotedDelimiters(firstLine, ',') ? ';' : ',';
};

const parseCSV = (csvText) => {
  const normalizedText = String(csvText ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  if (!normalizedText.trim()) {
    throw createImportError('empty_file');
  }

  const delimiter = detectDelimiter(normalizedText);
  const rows = [];
  let row = [];
  let field = '';
  let insideQuotes = false;

  for (let index = 0; index < normalizedText.length; index += 1) {
    const character = normalizedText[index];

    if (insideQuotes) {
      if (character === '"') {
        if (normalizedText[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          insideQuotes = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      insideQuotes = true;
      continue;
    }

    if (character === delimiter) {
      row.push(field);
      field = '';
      continue;
    }

    if (character === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += character;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [headerRow = [], ...dataRows] = rows;
  const headers = headerRow.map(normalizeHeader);

  const mappedRows = dataRows
    .filter((cells) => cells.some((cell) => String(cell ?? '').trim() !== ''))
    .map((cells) =>
      headers.reduce((record, header, columnIndex) => {
        record[header] = cells[columnIndex] ?? '';
        return record;
      }, {})
    );

  return { headers, rows: mappedRows };
};

const parseDaylioDate = (value, rowNumber) => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/u.exec(normalizeText(value) ?? '');
  if (!match) {
    throw createImportError('invalid_row', { row: rowNumber });
  }

  const [, day, month, year] = match;
  return { year, month, day };
};

const parseTimeParts = (value, rowNumber) => {
  const source = normalizeText(value) ?? '12:00 am';
  const match = /^(\d{1,2}):(\d{2})\s*([ap]\.?m\.?)?$/iu.exec(source);
  if (!match) {
    throw createImportError('invalid_row', { row: rowNumber });
  }

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toLowerCase().replace(/\./g, '');

  if (Number.isNaN(hours) || Number.isNaN(minutes) || minutes < 0 || minutes > 59) {
    throw createImportError('invalid_row', { row: rowNumber });
  }

  if (meridiem) {
    if (hours < 1 || hours > 12) {
      throw createImportError('invalid_row', { row: rowNumber });
    }

    if (meridiem === 'pm' && hours !== 12) {
      hours += 12;
    }

    if (meridiem === 'am' && hours === 12) {
      hours = 0;
    }
  } else if (hours > 23) {
    throw createImportError('invalid_row', { row: rowNumber });
  }

  return {
    hours: String(hours).padStart(2, '0'),
    minutes: String(minutes).padStart(2, '0'),
  };
};

const parseMoodValue = (value, rowNumber) => {
  const rawValue = normalizeText(value);
  if (!rawValue) {
    throw createImportError('invalid_row', { row: rowNumber });
  }

  const numericMood = Number(rawValue);
  if (Number.isInteger(numericMood) && numericMood >= 1 && numericMood <= 5) {
    return numericMood;
  }

  const moodMap = {
    awful: 1,
    horrible: 1,
    terrible: 1,
    bad: 2,
    poor: 2,
    meh: 3,
    normal: 3,
    okay: 3,
    ok: 3,
    average: 3,
    good: 4,
    nice: 4,
    great: 5,
    amazing: 5,
    awesome: 5,
    rad: 5,
  };

  const normalizedMood = normalizeLookupToken(rawValue);
  const resolvedMood = moodMap[normalizedMood];

  if (!resolvedMood) {
    throw createImportError('invalid_row', { row: rowNumber });
  }

  return resolvedMood;
};

const parseOptionalScaleValue = (value, rowNumber) => {
  const rawValue = normalizeText(value);
  if (!rawValue) {
    return null;
  }

  const numericValue = Number(rawValue);
  if (Number.isInteger(numericValue) && numericValue >= 1 && numericValue <= 5) {
    return numericValue;
  }

  throw createImportError('invalid_row', { row: rowNumber });
};

const parseOptionalFloat = (value, rowNumber) => {
  const rawValue = normalizeText(value);
  if (!rawValue) {
    return null;
  }

  const numericValue = Number(rawValue.replace(',', '.'));
  if (Number.isFinite(numericValue)) {
    return numericValue;
  }

  throw createImportError('invalid_row', { row: rowNumber });
};

const parseRequiredFloat = (value, rowNumber, { min = -Infinity, max = Infinity } = {}) => {
  const rawValue = normalizeText(value);
  if (!rawValue) {
    throw createImportError('invalid_row', { row: rowNumber });
  }

  const numericValue = Number(rawValue.replace(',', '.'));
  if (Number.isFinite(numericValue) && numericValue >= min && numericValue <= max) {
    return numericValue;
  }

  throw createImportError('invalid_row', { row: rowNumber });
};

const parseTags = (value) => {
  const rawValue = normalizeText(value);
  if (!rawValue) {
    return [];
  }

  if (rawValue.startsWith('[')) {
    try {
      const parsed = JSON.parse(rawValue);
      if (Array.isArray(parsed)) {
        return prepareActivitiesForSave(parsed.filter((activity) => !isIgnoredActivity(activity)));
      }
    } catch {
    }
  }

  const separator = rawValue.includes('|') ? /\|/u : rawValue.includes(';') ? /;/u : /,/u;
  return prepareActivitiesForSave(
    rawValue
      .split(separator)
      .map((part) => normalizeText(part))
      .filter(Boolean)
      .filter((activity) => !isIgnoredActivity(activity))
  );
};

const parseActivityTokens = (value) =>
  prepareActivitiesForSave(
    String(value ?? '')
      .split('|')
      .map((activity) => normalizeText(activity))
      .filter(Boolean)
      .filter((activity) => !isIgnoredActivity(activity))
      .map((activity) => DAYLIO_ACTIVITY_ALIASES.get(normalizeLookupToken(activity)) ?? activity)
  );

const parseFeatures = (row, rowNumber) => {
  const rawFeatures = normalizeText(row.features ?? row.features_json);
  let parsedFeatures = null;

  if (rawFeatures) {
    try {
      const parsed = JSON.parse(rawFeatures);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        parsedFeatures = parsed;
      } else {
        throw new Error('invalid_features');
      }
    } catch {
      throw createImportError('invalid_row', { row: rowNumber });
    }
  }

  const weatherFeatures = {
    temp: parseOptionalFloat(row.weather_temp ?? row.temp, rowNumber),
    humidity: parseOptionalFloat(row.weather_humidity ?? row.humidity, rowNumber),
    rain: parseOptionalFloat(row.weather_rain ?? row.rain, rowNumber),
    clouds: parseOptionalFloat(row.weather_clouds ?? row.clouds, rowNumber),
  };

  const normalizedWeather = Object.fromEntries(
    Object.entries(weatherFeatures).filter(([, value]) => value !== null)
  );

  if (Object.keys(normalizedWeather).length === 0) {
    return parsedFeatures;
  }

  return {
    ...(parsedFeatures || {}),
    ...normalizedWeather,
  };
};

const parseMoodscapeTimestamp = (value, rowNumber) => {
  const rawValue = normalizeText(value);
  if (!rawValue) {
    throw createImportError('invalid_row', { row: rowNumber });
  }

  const localMatch =
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/u.exec(rawValue);

  if (localMatch) {
    const [, year, month, day, hours = '12', minutes = '00', seconds = '00'] = localMatch;
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  }

  const normalizedValue = rawValue.replace(' ', 'T');
  const parsedDate = new Date(normalizedValue);

  if (Number.isNaN(parsedDate.getTime())) {
    throw createImportError('invalid_row', { row: rowNumber });
  }

  return normalizedValue;
};

const parseSleepDate = (value, rowNumber) => {
  const rawValue = normalizeText(value);
  if (!rawValue) {
    throw createImportError('invalid_row', { row: rowNumber });
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(rawValue);
  if (!match) {
    throw createImportError('invalid_row', { row: rowNumber });
  }

  return rawValue;
};

const parseSleepQualityValue = (value, rowNumber) => {
  const rawValue = normalizeText(value);
  if (!rawValue) {
    throw createImportError('invalid_row', { row: rowNumber });
  }

  const numericValue = Number(rawValue);
  if (Number.isInteger(numericValue) && numericValue >= 1 && numericValue <= 3) {
    return numericValue;
  }

  throw createImportError('invalid_row', { row: rowNumber });
};

const resolveMoodscapeEntryType = (row) => {
  const normalizedType = normalizeLookupToken(row.entry_type ?? row.type ?? row.row_type ?? '');

  if (['sleep', 'sleep log', 'sleeplog'].includes(normalizedType)) {
    return 'sleep';
  }

  if (['record', 'entry', 'mood', 'mood entry'].includes(normalizedType)) {
    return 'record';
  }

  return null;
};

const parseDaylioRecord = (row, rowIndex) => {
  const rowNumber = rowIndex + 2;
  const { year, month, day } = parseDaylioDate(row.full_date, rowNumber);
  const { hours, minutes } = parseTimeParts(row.time, rowNumber);

  return {
    timestamp: `${year}-${month}-${day}T${hours}:${minutes}:00`,
    mood: parseMoodValue(row.mood, rowNumber),
    note: normalizeText(row.sub_mood) ?? undefined,
    tags: parseActivityTokens(row.activities),
  };
};

const parseMoodscapeRecord = (row, rowIndex) => {
  const rowNumber = rowIndex + 2;
  const timestampSource =
    row.timestamp ?? row.created_at ?? row.date ?? row.datetime ?? row.full_date ?? null;

  const record = {
    timestamp: parseMoodscapeTimestamp(timestampSource, rowNumber),
    mood: parseMoodValue(row.mood, rowNumber),
    tags: parseTags(row.tags ?? row.activities),
  };

  const energy = parseOptionalScaleValue(row.energy, rowNumber);
  if (energy !== null) {
    record.energy = energy;
  }

  const note = normalizeText(row.note ?? row.sub_mood);
  if (note !== null) {
    record.note = note;
  }

  const locationCity = normalizeText(row.location_city ?? row.city);
  if (locationCity !== null) {
    record.location_city = locationCity;
  }

  const features = parseFeatures(row, rowNumber);
  if (features) {
    record.features = features;
  }

  const latitude = parseOptionalFloat(row.latitude, rowNumber);
  const longitude = parseOptionalFloat(row.longitude, rowNumber);
  if (latitude !== null) {
    record.latitude = latitude;
  }
  if (longitude !== null) {
    record.longitude = longitude;
  }

  return record;
};

const parseMoodscapeSleepLog = (row, rowIndex) => {
  const rowNumber = rowIndex + 2;

  return {
    sleep_date: parseSleepDate(row.sleep_date, rowNumber),
    hours_slept: parseRequiredFloat(row.hours_slept ?? row.sleep_hours, rowNumber, {
      min: 0,
      max: 16,
    }),
    sleep_quality: parseSleepQualityValue(row.sleep_quality, rowNumber),
  };
};

const parseMoodscapeEntry = (row, rowIndex) => {
  const timestampSource =
    row.timestamp ?? row.created_at ?? row.date ?? row.datetime ?? row.full_date ?? null;
  const entryType = resolveMoodscapeEntryType(row);
  const hasTimestamp = Boolean(normalizeText(timestampSource));
  const hasMood = Boolean(normalizeText(row.mood));
  const hasSleepDate = Boolean(normalizeText(row.sleep_date));
  const hasSleepHours = Boolean(normalizeText(row.hours_slept ?? row.sleep_hours));
  const hasSleepQuality = Boolean(normalizeText(row.sleep_quality));
  const hasSleepPayload = hasSleepDate || hasSleepHours || hasSleepQuality;

  if (entryType === 'sleep' || (!entryType && hasSleepPayload && !hasTimestamp && !hasMood)) {
    return {
      record: null,
      sleepLog: parseMoodscapeSleepLog(row, rowIndex),
    };
  }

  const record = parseMoodscapeRecord(row, rowIndex);
  const sleepLog = hasSleepPayload ? parseMoodscapeSleepLog(row, rowIndex) : null;

  return {
    record,
    sleepLog,
  };
};

export const parseImportFile = (csvText) => {
  const { headers, rows } = parseCSV(csvText);
  const headerSet = new Set(headers);

  if (rows.length === 0) {
    throw createImportError('empty_file');
  }

  const isDaylio = DAYLIO_REQUIRED_HEADERS.every((header) => headerSet.has(header));
  const hasSleepHeaders =
    headerSet.has('sleep_date') &&
    (headerSet.has('hours_slept') || headerSet.has('sleep_hours')) &&
    headerSet.has('sleep_quality');
  const isMoodscape =
    headerSet.has('entry_type') ||
    hasSleepHeaders ||
    (headerSet.has('mood') &&
      MOODSCAPE_TIMESTAMP_HEADERS.some((header) => headerSet.has(header)));

  if (!isDaylio && !isMoodscape) {
    throw createImportError('unsupported_format');
  }

  const source = isDaylio ? 'daylio' : 'moodscape';
  const records = [];
  const sleepLogs = [];

  if (source === 'daylio') {
    for (const [rowIndex, row] of rows.entries()) {
      records.push(parseDaylioRecord(row, rowIndex));
    }
  } else {
    for (const [rowIndex, row] of rows.entries()) {
      const entry = parseMoodscapeEntry(row, rowIndex);

      if (entry.record) {
        records.push(entry.record);
      }

      if (entry.sleepLog) {
        sleepLogs.push(entry.sleepLog);
      }
    }
  }

  if (records.length === 0 && sleepLogs.length === 0) {
    throw createImportError('empty_file');
  }

  return { source, records, sleepLogs };
};
