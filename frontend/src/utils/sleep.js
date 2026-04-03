export const sortSleepLogsByNewest = (logs = []) =>
  [...logs].sort((left, right) => {
    const dateCompare = String(right.sleep_date ?? '').localeCompare(String(left.sleep_date ?? ''));
    if (dateCompare !== 0) {
      return dateCompare;
    }

    return new Date(right.updated_at || right.created_at || 0) - new Date(left.updated_at || left.created_at || 0);
  });

export const buildSleepLogsByDate = (logs = []) => {
  const map = {};

  for (const log of logs) {
    const key = String(log?.sleep_date ?? '').trim();
    if (!key) {
      continue;
    }

    if (!map[key] || new Date(log.updated_at || log.created_at || 0) > new Date(map[key].updated_at || map[key].created_at || 0)) {
      map[key] = log;
    }
  }

  return map;
};
