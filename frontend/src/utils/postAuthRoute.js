import { getLogicalDateKey } from './date';
import { useRecordsStore } from '../stores/records';
import { useSleepStore } from '../stores/sleep';

export const getPostAuthTargetPath = ({ now = new Date() } = {}) => {
  const recordsStore = useRecordsStore();
  const sleepStore = useSleepStore();
  const todayKey = getLogicalDateKey(now);

  if (!sleepStore.logsByDate[todayKey] && !recordsStore.recordsByDate[todayKey]) {
    return '/sleep';
  }

  return '/records';
};

export const navigateToPostAuthRoute = async (router, { replace = true } = {}) => {
  const recordsStore = useRecordsStore();
  const sleepStore = useSleepStore();
  let targetPath = '/records';

  try {
    await Promise.all([recordsStore.ensureLoaded(), sleepStore.ensureLoaded()]);
    targetPath = getPostAuthTargetPath();
  } catch (error) {
    console.error('Failed to resolve post-auth route:', error);
  }

  if (router.currentRoute.value.path !== targetPath) {
    await (replace ? router.replace(targetPath) : router.push(targetPath));
  }

  return targetPath;
};
