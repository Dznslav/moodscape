<template>
  <div class="page">
    <div class="bg-glow" aria-hidden="true"></div>

    <div class="content">

      <header class="page-header">
        <div>
          <p class="page-caption">{{ $t('settings.pageCaption') }}</p>
          <h1 class="page-title">{{ $t('settings.pageTitle') }}</h1>
        </div>
      </header>


      <section class="section section--clickable" @click="toggleProfileEdit">
        <div class="avatar">{{ avatarLetter }}</div>
        <div class="profile-info">
          <p class="profile-name">{{ authStore.user?.name || $t('settings.defaultUser') }}</p>
          <p class="profile-email">{{ authStore.user?.email || '—' }}</p>
        </div>
        <span class="list-item__chevron" :class="{ 'chevron--rotated': isProfileEditing }">›</span>
      </section>


      <div class="edit-wrapper" :class="{ 'edit-wrapper--open': isProfileEditing }">
        <div class="edit-content">
          <form @submit.prevent="saveProfile" class="edit-form">
            <div class="edit-field">
              <label class="edit-label">{{ $t('settings.profileName') }}</label>
              <input type="text" class="edit-input" v-model="editName" :placeholder="$t('settings.profileName')" />
            </div>
            <div class="edit-field">
              <label class="edit-label">{{ $t('settings.profileEmail') }}</label>
              <input type="email" class="edit-input" v-model="editEmail" :placeholder="$t('settings.profileEmail')" />
            </div>
            <p v-if="profileError" class="edit-error">{{ profileError }}</p>
            <p v-if="profileSuccess" class="edit-success">{{ profileSuccess }}</p>
            <button type="submit" class="btn btn--primary btn--block" :disabled="isSavingProfile">
              {{ isSavingProfile ? '...' : $t('settings.profileSave') }}
            </button>
          </form>
        </div>
      </div>


      <section class="section-group">
        <h2 class="section-title">{{ $t('settings.appearance') }}</h2>
        <div class="list-card">
          <div class="list-item">
            <span class="list-item__icon">{{ themeStore.theme === 'dark' ? '🌙' : '☀️' }}</span>
            <span class="list-item__label">{{ themeStore.theme === 'dark' ? $t('settings.darkTheme') : $t('settings.lightTheme') }}</span>
            <button
              class="theme-toggle"
              :class="{ 'theme-toggle--on': themeStore.theme === 'dark' }"
              @click="toggleTheme"
              :aria-label="themeStore.theme === 'dark' ? $t('settings.lightTheme') : $t('settings.darkTheme')"
            >
              <span class="theme-toggle__thumb"></span>
            </button>
          </div>
        </div>
      </section>

      <section class="section-group">
        <h2 class="section-title">{{ $t('settings.feedback') }}</h2>
        <p class="section-desc">{{ $t('settings.hapticsDesc') }}</p>
        <div class="list-card">
          <div class="list-item">
            <span class="list-item__icon">📳</span>
            <div class="list-item__copy">
              <span class="list-item__label">{{ $t('settings.haptics') }}</span>
              <span class="list-item__meta">{{ hapticsSupportText }}</span>
            </div>
            <button
              class="theme-toggle"
              :class="{ 'theme-toggle--on': hapticsStore.enabled && hapticsStore.isAvailable }"
              :disabled="!hapticsStore.isAvailable"
              @click="toggleHaptics"
              :aria-label="$t('settings.haptics')"
            >
              <span class="theme-toggle__thumb"></span>
            </button>
          </div>
        </div>
      </section>


      <section v-if="authStore.user?.analytics_consent" class="section-group">
        <h2 class="section-title">{{ $t('location.settingsTitle') }}</h2>
        <div class="list-card">
          <button class="list-item" @click="openLocationSearch">
            <span class="list-item__icon">📍</span>
            <span class="list-item__label">{{ locationStore.cityName || $t('location.notSet') }}</span>
            <span class="list-item__chevron">›</span>
          </button>
          <div class="list-item list-item--border-top">
            <span class="list-item__icon">📡</span>
            <span class="list-item__label">{{ $t('location.autoDetect') }}</span>
            <button
              class="theme-toggle"
              :class="{ 'theme-toggle--on': locationStore.autoDetect }"
              @click="toggleAutoDetect"
            >
              <span class="theme-toggle__thumb"></span>
            </button>
          </div>
        </div>
      </section>


      <section class="section-group">
        <h2 class="section-title">{{ $t('settings.language') }}</h2>
        <div class="list-card">
          <div class="list-item" @click="toggleLanguageDropdown" :class="{'list-item--expanded': isLangDropdownOpen}">
            <span class="list-item__icon">🌐</span>
            <span class="list-item__label">{{ activeLangLabel }}</span>
            <span class="list-item__chevron" :class="{'chevron--rotated': isLangDropdownOpen}">›</span>
          </div>

          <div class="dropdown-wrapper" :class="{ 'dropdown-wrapper--open': isLangDropdownOpen }">
            <div class="dropdown-content">
              <button
                class="dropdown-item"
                :class="{ 'dropdown-item--active': $i18n.locale === 'by' }"
                @click="changeLanguage('by')"
              >
                Беларуская
                <span v-if="$i18n.locale === 'by'" class="check-icon">✓</span>
              </button>
              <button
                class="dropdown-item"
                :class="{ 'dropdown-item--active': $i18n.locale === 'ru' }"
                @click="changeLanguage('ru')"
              >
                Русский
                <span v-if="$i18n.locale === 'ru'" class="check-icon">✓</span>
              </button>
              <button
                class="dropdown-item"
                :class="{ 'dropdown-item--active': $i18n.locale === 'en' }"
                @click="changeLanguage('en')"
              >
                English
                <span v-if="$i18n.locale === 'en'" class="check-icon">✓</span>
              </button>
              <button
                class="dropdown-item"
                :class="{ 'dropdown-item--active': $i18n.locale === 'sk' }"
                @click="changeLanguage('sk')"
              >
                Slovenčina
                <span v-if="$i18n.locale === 'sk'" class="check-icon">✓</span>
              </button>
            </div>
          </div>
        </div>
      </section>




      <section class="section-group">
        <h2 class="section-title">{{ $t('settings.account') }}</h2>
        <div class="list-card">
          <button class="list-item" @click="handleLogout">
            <span class="list-item__icon">🚪</span>
            <span class="list-item__label">{{ $t('settings.logout') }}</span>
            <span class="list-item__chevron">›</span>
          </button>
        </div>
      </section>


      <section class="section-group">
        <h2 class="section-title">{{ $t('settings.dataManagement') }}</h2>
        <p class="section-desc">
          {{ $t('settings.dataDesc') }}
        </p>
        <div class="list-card">
          <button class="list-item" @click="showGdprModal = true">
            <span class="list-item__icon">🛡️</span>
            <span class="list-item__label">{{ $t('settings.manageConsent') }}</span>
            <span class="list-item__chevron">›</span>
          </button>
          <button class="list-item list-item--border-top" @click="downloadCSV" :disabled="isDownloading">
            <span class="list-item__icon">📥</span>
            <span class="list-item__label">{{ isDownloading ? $t('settings.preparingData') : $t('settings.downloadData') }}</span>
            <span class="list-item__chevron">›</span>
          </button>
        </div>
        <div class="import-card" :class="{ 'import-card--expanded': isImportExpanded }">
          <button type="button" class="import-card__toggle" :aria-expanded="isImportExpanded" @click="toggleImportSection">
            <div class="import-card__toggle-copy">
              <p class="import-card__title">{{ $t('settings.importTitle') }}</p>
              <p class="import-card__summary">{{ importSummary }}</p>
            </div>
            <span class="list-item__chevron" :class="{ 'chevron--rotated': isImportExpanded }">›</span>
          </button>

          <div class="import-card__panel" :class="{ 'import-card__panel--open': isImportExpanded }">
            <div class="import-card__panel-inner">
              <div class="import-card__header">
                <p class="import-card__desc">{{ $t('settings.importDesc') }}</p>
              </div>

              <div class="import-card__actions">
                <button type="button" class="btn btn--secondary btn--grow" @click="openImportPicker">
                  {{ $t('settings.chooseImportFile') }}
                </button>
                <button type="button" class="btn btn--primary btn--grow" :disabled="!selectedImportFile || isImporting" @click="importCSV">
                  {{ isImporting ? $t('settings.importingData') : $t('settings.importData') }}
                </button>
              </div>

              <p class="import-card__file">
                {{ selectedImportFile?.name
                  ? $t('settings.selectedImportFile', { name: selectedImportFile.name })
                  : $t('settings.importFormats') }}
              </p>

              <label class="import-toggle">
                <input v-model="overwriteExistingOnImport" type="checkbox" class="import-toggle__checkbox" />
                <span>{{ $t('settings.importOverwrite') }}</span>
              </label>

              <p class="import-card__hint">{{ $t('settings.importHint') }}</p>
              <p class="import-card__hint import-card__hint--muted">{{ $t('settings.importDaylioEnergyHint') }}</p>
              <p v-if="importError" class="edit-error">{{ importError }}</p>
              <p v-if="importSuccess" class="edit-success">{{ importSuccess }}</p>
            </div>
          </div>
        </div>
        <input
          ref="importFileInput"
          class="sr-only-input"
          type="file"
          accept=".csv,text/csv"
          @change="handleImportFileChange"
        />
      </section>


      <section class="section-group">
        <h2 class="section-title danger-title">{{ $t('settings.dangerZone') }}</h2>
        <div class="list-card danger-card">
          <button class="list-item danger-item" @click="startDeleteFlow">
            <span class="list-item__icon">🗑️</span>
            <span class="list-item__label">{{ $t('settings.deleteAccount') }}</span>
            <span class="list-item__chevron">›</span>
          </button>
        </div>
        <p class="danger-warning">{{ $t('settings.dangerWarning') }}</p>
      </section>

      <FooterSection />

    </div>

    <GdprConsentModal v-model:isVisible="showGdprModal" />


    <Transition name="delete-fade">
      <div v-if="deleteStep > 0" class="delete-overlay" @click.self="cancelDelete">
        <div class="delete-card">

          <template v-if="deleteStep === 1">
            <div class="delete-icon">⚠️</div>
            <h3 class="delete-title">{{ $t('settings.deleteStep1Title') }}</h3>
            <p class="delete-text">{{ $t('settings.deleteStep1Text') }}</p>
            <div class="delete-actions">
              <button class="btn btn--secondary btn--grow" @click="cancelDelete">{{ $t('settings.btnCancel') }}</button>
              <button class="btn btn--primary btn--grow" @click="goToDeleteStep2">{{ $t('settings.btnContinue') }}</button>
            </div>
          </template>


          <template v-if="deleteStep === 2">
            <div class="delete-icon">🔐</div>
            <h3 class="delete-title">{{ $t('settings.deleteStep2Title') }}</h3>
            <p class="delete-text">{{ $t('settings.deleteStep2Text') }} <strong>DELETE</strong></p>
            <input
              type="text"
              class="delete-input"
              v-model="deleteConfirmText"
              placeholder="DELETE"
              autocomplete="off"
            />
            <div class="delete-actions">
              <button class="btn btn--secondary btn--grow" @click="cancelDelete">{{ $t('settings.btnCancel') }}</button>
              <button class="btn btn--primary btn--grow" :disabled="deleteConfirmText !== 'DELETE'" @click="goToDeleteStep3">
                {{ $t('settings.btnContinue') }}
              </button>
            </div>
          </template>


          <template v-if="deleteStep === 3">
            <div class="delete-icon">🧮</div>
            <h3 class="delete-title">{{ $t('settings.deleteStep3Title') }}</h3>
            <p class="delete-text">{{ $t('settings.deleteStep3Text') }}</p>
            <p class="math-challenge">{{ mathA }} + {{ mathB }} = ?</p>
            <input
              type="number"
              class="delete-input"
              v-model.number="mathAnswer"
              :placeholder="$t('settings.mathPlaceholder')"
              autocomplete="off"
            />
            <p v-if="deleteError" class="edit-error">{{ deleteError }}</p>
            <div class="delete-actions">
              <button class="btn btn--secondary btn--grow" @click="cancelDelete">{{ $t('settings.btnCancel') }}</button>
              <button class="btn btn--danger btn--grow" :disabled="isDeleting" @click="executeDelete">
                {{ isDeleting ? '...' : $t('settings.btnDeleteFinal') }}
              </button>
            </div>
          </template>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useThemeStore } from '../stores/theme';
import { useLocationStore } from '../stores/location';
import { useRecordsStore } from '../stores/records';
import { useSleepStore } from '../stores/sleep';
import { useHapticsStore } from '../stores/haptics';
import api from '../api/axios';
import FooterSection from '../components/FooterSection.vue';
import { useI18n } from 'vue-i18n';
import { applyDocumentLanguage, setPreferredLocale } from '../i18n';
import { parseImportFile } from '../importRecords';
import { useBodyScrollLock } from '../composables/useBodyScrollLock';
import { playHaptic, previewHaptics } from '../utils/haptics';

const { t, locale } = useI18n();

const authStore  = useAuthStore();
const themeStore = useThemeStore();
const locationStore = useLocationStore();
const recordsStore = useRecordsStore();
const sleepStore = useSleepStore();
const hapticsStore = useHapticsStore();
const isLangDropdownOpen = ref(false);

const hapticsSupportText = computed(() => {
  if (!hapticsStore.isAvailable) {
    return t('settings.hapticsUnavailable');
  }

  return hapticsStore.enabled ? t('settings.hapticsOn') : t('settings.hapticsOff');
});

const toggleTheme = () => {
  themeStore.toggle();
  playHaptic('toggle');
};

const activeLangLabel = computed(() => {
  const labels = { ru: 'Русский', en: 'English', by: 'Беларуская', sk: 'Slovenčina' };
  return labels[locale.value] || 'English';
});

const toggleLanguageDropdown = () => {
  isLangDropdownOpen.value = !isLangDropdownOpen.value;
  playHaptic('toggle');
};

const changeLanguage = (newLocale) => {
  const didChange = locale.value !== newLocale;
  locale.value = setPreferredLocale(newLocale);
  isLangDropdownOpen.value = false;
  if (didChange) {
    playHaptic('picker');
  }
};
watch(locale, (newLang, oldLang) => {
  if (newLang === oldLang) return;
  applyDocumentLanguage(newLang);
  locationStore.refreshCityNameForLocale(newLang);
});

const toggleAutoDetect = async () => {
  const shouldEnable = !locationStore.autoDetect;
  playHaptic('toggle');

  if (!shouldEnable) {
    locationStore.setAutoDetect(false);
    return;
  }

  try {
    await locationStore.requestBrowserLocation();
    locationStore.setAutoDetect(true);
    playHaptic('success');
  } catch (error) {
    console.error('Failed to enable browser location:', error);
    locationStore.setAutoDetect(false);
    playHaptic('error');
  }
};

const openLocationSearch = () => {
  playHaptic('secondaryNav');
  locationStore.openSearchModal();
};

const toggleHaptics = () => {
  if (!hapticsStore.isAvailable) {
    return;
  }

  const nextEnabled = !hapticsStore.enabled;

  if (nextEnabled) {
    hapticsStore.setEnabled(nextEnabled);
    previewHaptics();
    return;
  }

  playHaptic('toggle', { cooldownMs: 0 });
  hapticsStore.setEnabled(nextEnabled);
};
const isProfileEditing = ref(false);
const editName = ref('');
const editEmail = ref('');
const isSavingProfile = ref(false);
const profileError = ref('');
const profileSuccess = ref('');

const avatarLetter = computed(() => {
  const n = authStore.user?.name || authStore.user?.email || 'U';
  return n.charAt(0).toUpperCase();
});

const toggleProfileEdit = () => {
  isProfileEditing.value = !isProfileEditing.value;
  playHaptic(isProfileEditing.value ? 'openPanel' : 'closePanel');
  if (isProfileEditing.value) {
    editName.value = authStore.user?.name || '';
    editEmail.value = authStore.user?.email || '';
    profileError.value = '';
    profileSuccess.value = '';
  }
};

const saveProfile = async () => {
  isSavingProfile.value = true;
  profileError.value = '';
  profileSuccess.value = '';
  playHaptic('submit');
  try {
    const payload = {};
    if (editName.value && editName.value !== authStore.user?.name) {
      payload.name = editName.value;
    }
    if (editEmail.value && editEmail.value !== authStore.user?.email) {
      payload.email = editEmail.value;
    }
    if (Object.keys(payload).length === 0) {
      isProfileEditing.value = false;
      return;
    }
    const res = await api.put('/users/me', payload);
    authStore.user = res.data;
    profileSuccess.value = t('settings.profileSaved');
    playHaptic('success');
    setTimeout(() => {
      isProfileEditing.value = false;
      profileSuccess.value = '';
    }, 1200);
  } catch (err) {
    profileError.value = err.response?.data?.detail || t('settings.profileSaveError');
    playHaptic('error');
  } finally {
    isSavingProfile.value = false;
  }
};
const handleLogout = async () => {
  playHaptic('submit');
  await authStore.logout();
};
const isDownloading = ref(false);
const importFileInput = ref(null);
const selectedImportFile = ref(null);
const overwriteExistingOnImport = ref(false);
const isImporting = ref(false);
const isImportExpanded = ref(false);
const importError = ref('');
const importSuccess = ref('');

const importSummary = computed(() => {
  if (importSuccess.value) {
    return importSuccess.value;
  }

  if (importError.value) {
    return importError.value;
  }

  if (selectedImportFile.value?.name) {
    return t('settings.selectedImportFile', { name: selectedImportFile.value.name });
  }

  return t('settings.importFormats');
});

const formatImportError = (error) => {
  if (error?.code === 'empty_file') return t('settings.importEmptyFile');
  if (error?.code === 'unsupported_format') return t('settings.importUnsupportedFormat');
  if (error?.code === 'invalid_row') return t('settings.importInvalidRow', { row: error.row });
  return error?.response?.data?.detail || t('settings.importFail');
};

const openImportPicker = () => {
  playHaptic('secondaryNav');
  importFileInput.value?.click();
};

const toggleImportSection = () => {
  isImportExpanded.value = !isImportExpanded.value;
  playHaptic(isImportExpanded.value ? 'openPanel' : 'closePanel');
};

const handleImportFileChange = (event) => {
  const [file] = Array.from(event.target.files || []);
  selectedImportFile.value = file || null;
  isImportExpanded.value = true;
  importError.value = '';
  importSuccess.value = '';
  if (file) {
    playHaptic('picker');
  }
};

const serializeCsvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const getExportRows = ({ records, sleepLogs }) => {
  const rowsByDate = new Map();

  for (const row of records) {
    const dateKey = String(row.timestamp ?? '').slice(0, 10);
    if (!dateKey) {
      continue;
    }

    rowsByDate.set(dateKey, {
      ...(rowsByDate.get(dateKey) ?? {}),
      timestamp: row.timestamp ?? '',
      mood: row.mood ?? '',
      energy: row.energy ?? '',
      note: row.note ?? '',
      tags: Array.isArray(row.tags) ? row.tags.join(' | ') : '',
      location_city: row.location_city ?? '',
      weather_temp: row.features?.temp ?? '',
      weather_humidity: row.features?.humidity ?? '',
      weather_rain: row.features?.rain ?? '',
      weather_clouds: row.features?.clouds ?? '',
      features: row.features ? JSON.stringify(row.features) : '',
      sleep_date: rowsByDate.get(dateKey)?.sleep_date ?? dateKey,
      hours_slept: rowsByDate.get(dateKey)?.hours_slept ?? '',
      sleep_quality: rowsByDate.get(dateKey)?.sleep_quality ?? '',
      sort_key: row.timestamp ?? `${dateKey}T23:59:59`,
    });
  }

  for (const log of sleepLogs) {
    const dateKey = String(log.sleep_date ?? '').trim();
    if (!dateKey) {
      continue;
    }

    rowsByDate.set(dateKey, {
      timestamp: rowsByDate.get(dateKey)?.timestamp ?? '',
      mood: rowsByDate.get(dateKey)?.mood ?? '',
      energy: rowsByDate.get(dateKey)?.energy ?? '',
      note: rowsByDate.get(dateKey)?.note ?? '',
      tags: rowsByDate.get(dateKey)?.tags ?? '',
      location_city: rowsByDate.get(dateKey)?.location_city ?? '',
      weather_temp: rowsByDate.get(dateKey)?.weather_temp ?? '',
      weather_humidity: rowsByDate.get(dateKey)?.weather_humidity ?? '',
      weather_rain: rowsByDate.get(dateKey)?.weather_rain ?? '',
      weather_clouds: rowsByDate.get(dateKey)?.weather_clouds ?? '',
      features: rowsByDate.get(dateKey)?.features ?? '',
      sleep_date: dateKey,
      hours_slept: log.hours_slept ?? '',
      sleep_quality: log.sleep_quality ?? '',
      sort_key: rowsByDate.get(dateKey)?.sort_key ?? `${dateKey}T04:00:00`,
    });
  }

  return Array.from(rowsByDate.values()).sort((left, right) => right.sort_key.localeCompare(left.sort_key));
};

const downloadCSV = async () => {
  isDownloading.value = true;
  playHaptic('submit');
  try {
    const [records, sleepLogs] = await Promise.all([
      recordsStore.records.length ? recordsStore.records : recordsStore.ensureLoaded(),
      sleepStore.logs.length ? sleepStore.logs : sleepStore.ensureLoaded(),
    ]);

    if (!records.length && !sleepLogs.length) { alert(t('settings.noData')); return; }

    const headers = [
      'timestamp',
      'mood',
      'energy',
      'note',
      'tags',
      'location_city',
      'weather_temp',
      'weather_humidity',
      'weather_rain',
      'weather_clouds',
      'features',
      'sleep_date',
      'hours_slept',
      'sleep_quality',
    ];
    const exportRows = getExportRows({ records, sleepLogs });
    const csv = [
      headers.join(','),
      ...exportRows.map((row) =>
        headers
          .map((header) => serializeCsvCell(row[header]))
          .join(',')
      )
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = 'moodscape_full_data.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    playHaptic('success');
  } catch {
    alert(t('settings.downloadFail'));
    playHaptic('error');
  }
  finally { isDownloading.value = false; }
};
const importCSV = async () => {
  if (!selectedImportFile.value) {
    importError.value = t('settings.importNoFile');
    playHaptic('error');
    return;
  }

  isImporting.value = true;
  importError.value = '';
  importSuccess.value = '';
  playHaptic('submit');

  try {
    const csvText = await selectedImportFile.value.text();
    const parsed = parseImportFile(csvText);
    const totals = {
      imported: 0,
      skipped: 0,
      total: 0,
      updated: 0,
    };

    if (parsed.records.length > 0) {
      const response = await api.post('/records/import', {
        source: parsed.source,
        overwrite_existing: overwriteExistingOnImport.value,
        records: parsed.records,
      });

      totals.total += response.data.total;
      totals.imported += response.data.imported;
      totals.updated += response.data.updated;
      totals.skipped += response.data.skipped;
    }

    if (parsed.sleepLogs.length > 0) {
      const response = await api.post('/sleep-logs/import', {
        overwrite_existing: overwriteExistingOnImport.value,
        sleep_logs: parsed.sleepLogs,
      });

      totals.total += response.data.total;
      totals.imported += response.data.imported;
      totals.updated += response.data.updated;
      totals.skipped += response.data.skipped;
    }

    importSuccess.value = t('settings.importResult', totals);
    recordsStore.invalidate();
    sleepStore.invalidate();
    await Promise.all([recordsStore.refresh(), sleepStore.refresh()]);
    selectedImportFile.value = null;
    if (importFileInput.value) {
      importFileInput.value.value = '';
    }
    playHaptic('success');
  } catch (error) {
    importError.value = formatImportError(error);
    playHaptic('error');
  } finally {
    isImporting.value = false;
  }
};

const deleteStep = ref(0);
const deleteConfirmText = ref('');
const mathA = ref(0);
const mathB = ref(0);
const mathAnswer = ref(null);
const isDeleting = ref(false);
const deleteError = ref('');

useBodyScrollLock(computed(() => deleteStep.value > 0));

const startDeleteFlow = () => {
  playHaptic('warning');
  deleteStep.value = 1;
  deleteConfirmText.value = '';
  mathAnswer.value = null;
  deleteError.value = '';
};

const cancelDelete = () => {
  playHaptic('closePanel');
  deleteStep.value = 0;
  deleteConfirmText.value = '';
  mathAnswer.value = null;
  deleteError.value = '';
};
import GdprConsentModal from '../components/GdprConsentModal.vue';
const showGdprModal = ref(false);

const generateMathChallenge = () => {
  mathA.value = Math.floor(Math.random() * 50) + 10;
  mathB.value = Math.floor(Math.random() * 50) + 10;
};

const goToDeleteStep2 = () => {
  playHaptic('warning');
  deleteStep.value = 2;
};

const goToDeleteStep3 = () => {
  playHaptic('warning');
  deleteStep.value = 3;
  generateMathChallenge();
};

const executeDelete = async () => {
  if (mathAnswer.value !== mathA.value + mathB.value) {
    deleteError.value = t('settings.mathWrong');
    playHaptic('error');
    return;
  }
  isDeleting.value = true;
  deleteError.value = '';
  playHaptic('destructive');
  try {
    await api.delete('/users/me');
    await authStore.logout({ notifyServer: false });
  } catch {
    deleteError.value = t('settings.deleteFail');
    playHaptic('error');
  } finally {
    isDeleting.value = false;
  }
};
</script>

<style scoped>

.edit-wrapper {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
.edit-wrapper--open {
  grid-template-rows: 1fr;
}
.edit-content {
  overflow: hidden;
}
.edit-form {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  padding: 0 0.125rem;
}
.edit-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.edit-label {
  font-family: 'Inter', sans-serif;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.edit-input {
  width: 100%;
  padding: 0.8125rem 1rem;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  color: var(--text-primary);
  font-family: 'Inter', sans-serif;
  font-size: 0.9375rem;
  outline: none;
  transition: border-color 0.2s;
  -webkit-appearance: none;
}
.edit-input:focus { border-color: #F15A22; }
.edit-input::placeholder { color: var(--text-tertiary); }

.edit-error {
  font-family: 'Inter', sans-serif;
  font-size: 0.8125rem;
  color: #ef4444;
}
.edit-success {
  font-family: 'Inter', sans-serif;
  font-size: 0.8125rem;
  color: #22c55e;
}
.btn-save {
  padding: 0.8125rem;
  border-radius: 12px;
  background: #F15A22;
  color: white;
  font-family: 'Inter', sans-serif;
  font-size: 0.9375rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: opacity 0.2s;
}
.btn-save:hover:not(:disabled) { opacity: 0.9; }
.btn-save:disabled { opacity: 0.45; cursor: not-allowed; }


.delete-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  padding: 1.5rem;
}
.delete-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 24px;
  padding: 2rem 1.75rem;
  max-width: 400px;
  width: 100%;
  text-align: center;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.3);
  animation: card-rise 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes card-rise {
  from { opacity: 0; transform: translateY(20px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.delete-icon {
  font-size: 3rem;
  margin-bottom: 0.75rem;
}
.delete-title {
  font-family: 'Syne', sans-serif;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}
.delete-text {
  font-family: 'Inter', sans-serif;
  font-size: 0.9375rem;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: 1.25rem;
}
.delete-input {
  width: 100%;
  padding: 0.8125rem 1rem;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  color: var(--text-primary);
  font-family: 'Inter', sans-serif;
  font-size: 1rem;
  text-align: center;
  outline: none;
  margin-bottom: 1.25rem;
  transition: border-color 0.2s;
  -webkit-appearance: none;
}
.delete-input:focus { border-color: #ef4444; }
.math-challenge {
  font-family: 'Syne', sans-serif;
  font-size: 1.75rem;
  font-weight: 700;
  color: #ef4444;
  margin-bottom: 1rem;
  letter-spacing: 0.05em;
}
.delete-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.5rem;
}
.btn-delete-cancel {
  flex: 1;
  padding: 0.8125rem;
  border-radius: 12px;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  font-family: 'Inter', sans-serif;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}
.btn-delete-cancel:hover { background: var(--bg-page); }
.btn-delete-next {
  flex: 1;
  padding: 0.8125rem;
  border-radius: 12px;
  background: #F15A22;
  color: white;
  font-family: 'Inter', sans-serif;
  font-size: 0.9375rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: opacity 0.2s;
}
.btn-delete-next:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-delete-final {
  flex: 1;
  padding: 0.8125rem;
  border-radius: 12px;
  background: #ef4444;
  color: white;
  font-family: 'Inter', sans-serif;
  font-size: 0.9375rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: opacity 0.2s;
}
.btn-delete-final:disabled { opacity: 0.4; cursor: not-allowed; }

.delete-fade-enter-active,
.delete-fade-leave-active { transition: opacity 0.25s ease; }
.delete-fade-enter-from,
.delete-fade-leave-to { opacity: 0; }


.dropdown-wrapper {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  background: rgba(0,0,0,0.02);
  border-top: 1px solid transparent;
}
:root[data-theme='dark'] .dropdown-wrapper {
  background: rgba(255,255,255,0.02);
}

.dropdown-wrapper--open {
  grid-template-rows: 1fr;
  border-top-color: var(--border-color);
}

.dropdown-content {
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.dropdown-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 0.875rem 1rem 0.875rem 3.1rem;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-family: 'Inter', sans-serif;
  font-size: 0.9375rem;
  text-align: left;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}
.dropdown-item:hover {
  background: var(--bg-input);
  color: var(--text-primary);
}
.dropdown-item--active {
  color: #F15A22;
  font-weight: 500;
}
.check-icon {
  font-size: 1.125rem;
}

.chevron--rotated {
  transform: rotate(90deg);
}

.list-item__chevron {
  color: var(--text-tertiary);
  font-size: 1.25rem;
  font-weight: 300;
  line-height: 1;
  flex-shrink: 0;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.page {
  min-height: 100dvh;
  background: var(--bg-page);
  position: relative;
  padding-bottom: var(--nav-height, 4.5rem);
  transition: background 0.3s ease;
  display: flex;
  flex-direction: column;
}

.bg-glow {
  position: fixed;
  inset: 0;
  background: var(--app-page-glow);
  pointer-events: none;
  z-index: 0;
  transition: opacity 0.3s ease;
}

.content {
  position: relative;
  z-index: 1;
  max-width: 600px;
  width: 100%;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 2rem;
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 1.5rem;
}

.page-caption {
  font-family: 'Inter', sans-serif;
  font-size: 0.875rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #F15A22;
  margin-bottom: 0.25rem;
}

.page-title {
  font-family: 'Syne', sans-serif;
  font-size: clamp(1.75rem, 5vw, 2rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--text-primary);
  line-height: 1;
}


.section {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 1.125rem;
  transition: background 0.3s ease, border-color 0.3s ease;
}
.section--clickable {
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.section--clickable:active {
  background: var(--bg-input);
}

.avatar {
  width: 52px; height: 52px;
  border-radius: 50%;
  background: linear-gradient(135deg, #F15A22, #c94710);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Syne', sans-serif;
  font-size: 1.375rem;
  font-weight: 700;
  color: white;
  flex-shrink: 0;
}

.profile-name {
  font-family: 'Syne', sans-serif;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.profile-email {
  font-family: 'Inter', sans-serif;
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-top: 0.125rem;
}
.profile-info { flex: 1; }


.section-group { display: flex; flex-direction: column; gap: 0.5rem; }

.section-title {
  font-family: 'Inter', sans-serif;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  padding: 0 0.25rem;
}

.section-desc {
  font-family: 'Inter', sans-serif;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.55;
  padding: 0 0.25rem;
}


.list-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  overflow: hidden;
  transition: background 0.3s ease, border-color 0.3s ease;
}

.import-card {
  display: flex;
  flex-direction: column;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  overflow: hidden;
}

.import-card__toggle {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem;
  background: none;
  border: none;
  color: inherit;
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.import-card__toggle-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.import-card__summary {
  font-family: 'Inter', sans-serif;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--text-secondary);
  margin: 0;
  padding-right: 0.5rem;
  overflow-wrap: anywhere;
}

.import-card__panel {
  max-height: 0;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition:
    max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.18s ease,
    visibility 0s linear 0.3s,
    border-color 0.2s ease;
  border-top: 0 solid transparent;
  overflow: hidden;
}

.import-card__panel--open {
  max-height: 36rem;
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transition:
    max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.2s ease,
    visibility 0s linear 0s,
    border-color 0.2s ease;
  border-top-width: 1px;
  border-top-color: var(--border-color);
}

.import-card__panel-inner {
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  padding: 0 1rem 1rem;
  min-height: 0;
}

.import-card__header {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.import-card__title {
  font-family: 'Syne', sans-serif;
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.import-card__desc,
.import-card__file,
.import-card__hint {
  font-family: 'Inter', sans-serif;
  font-size: 0.875rem;
  line-height: 1.55;
  color: var(--text-secondary);
  margin: 0;
}

.import-card__hint--muted {
  color: var(--text-tertiary);
}

.import-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.btn-secondary,
.btn-primary {
  flex: 1 1 180px;
  min-height: 46px;
  padding: 0.8125rem 1rem;
  border-radius: 12px;
  font-family: 'Inter', sans-serif;
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s, background 0.2s, border-color 0.2s;
}

.btn-secondary {
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
}

.btn-primary {
  background: #F15A22;
  border: 1px solid #F15A22;
  color: white;
}

.btn-secondary:hover,
.btn-primary:hover {
  opacity: 0.92;
}

.btn-secondary:disabled,
.btn-primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.import-toggle {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  font-family: 'Inter', sans-serif;
  font-size: 0.875rem;
  color: var(--text-primary);
}

.import-toggle__checkbox {
  width: 18px;
  height: 18px;
  accent-color: #F15A22;
  flex-shrink: 0;
}

.sr-only-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.list-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 1rem;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-primary);
  font-family: 'Inter', sans-serif;
  font-size: 0.9375rem;
  transition: background 0.2s;
  text-align: left;
  -webkit-tap-highlight-color: transparent;
}
.list-item:active { background: var(--bg-input); }
.list-item:disabled { opacity: 0.5; cursor: not-allowed; }
.list-item--border-top { border-top: 1px solid var(--border-color); }

.list-item__icon  { font-size: 1.1rem; flex-shrink: 0; }
.list-item__copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.list-item__label { flex: 1; }
.list-item__meta {
  font-family: 'Inter', sans-serif;
  font-size: 0.75rem;
  color: var(--text-tertiary);
}
.list-item__chevron {
  color: var(--text-tertiary);
  font-size: 1.25rem;
  font-weight: 300;
  line-height: 1;
}


.theme-toggle {
  position: relative;
  width: 48px;
  height: 28px;
  border-radius: 99px;
  background: var(--border-color);
  border: none;
  cursor: pointer;
  transition: background 0.3s ease;
  flex-shrink: 0;
  padding: 0;
  -webkit-tap-highlight-color: transparent;
}
.theme-toggle:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.theme-toggle--on {
  background: #F15A22;
}
.theme-toggle__thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: white;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 1px 4px rgba(0,0,0,0.2);
}
.theme-toggle--on .theme-toggle__thumb {
  transform: translateX(20px);
}


.danger-title { color: rgba(239,68,68,0.7); }
.danger-card  { border-color: rgba(239,68,68,0.18); background: rgba(239,68,68,0.04); }
.danger-item  { color: #ef4444; }
.danger-warning {
  font-family: 'Inter', sans-serif;
  font-size: 0.75rem;
  color: rgba(239,68,68,0.5);
  padding: 0 0.25rem;
}
</style>
