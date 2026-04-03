import { defineStore } from 'pinia';
import { normalizeCoordinates } from '../utils/coordinates';

const resolveNominatimLanguage = (lang) => {
  const normalizedLang = String(lang || 'en').trim().toLowerCase();

  if (normalizedLang === 'by') {
    return 'be';
  }

  return normalizedLang || 'en';
};

const getStoredNumber = (key) => {
  const rawValue = localStorage.getItem(key);
  if (rawValue === null || rawValue === '') return null;

  const parsedValue = parseFloat(rawValue);
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const getStoredText = (key) => {
  const rawValue = localStorage.getItem(key);
  return rawValue && rawValue.trim() ? rawValue : '';
};

let activeSearchRequestId = 0;
let activeSearchController = null;

export const useLocationStore = defineStore('location', {
  state: () => ({
    lat: getStoredNumber('moodscape_lat'),
    lon: getStoredNumber('moodscape_lon'),
    cityName: getStoredText('moodscape_cityName'),
    isFirstVisit: localStorage.getItem('moodscape_geoPrompted') !== 'true',
    autoDetect: localStorage.getItem('moodscape_autoDetect') !== 'false',
    lastLocationTimestamp: parseInt(localStorage.getItem('moodscape_lastLocTs')) || 0,
    searchModalOpen: false,
    searchResults: [],
    isSearching: false,
  }),
  getters: {
    hasCoordinates: (state) => Number.isFinite(state.lat) && Number.isFinite(state.lon),
  },
  actions: {
    resetPrompt() {
      this.isFirstVisit = true;
      localStorage.removeItem('moodscape_geoPrompted');
    },
    setFinishedPrompt() {
      this.isFirstVisit = false;
      localStorage.setItem('moodscape_geoPrompted', 'true');
    },
    setAutoDetect(value) {
      this.autoDetect = value;
      localStorage.setItem('moodscape_autoDetect', value ? 'true' : 'false');
    },
    async setLocation(lat, lon, name = null) {
      const nextLat = Number(lat);
      const nextLon = Number(lon);

      if (!Number.isFinite(nextLat) || !Number.isFinite(nextLon)) {
        return;
      }

      this.lat = nextLat;
      this.lon = nextLon;
      localStorage.setItem('moodscape_lat', String(nextLat));
      localStorage.setItem('moodscape_lon', String(nextLon));
      this.lastLocationTimestamp = Date.now();
      localStorage.setItem('moodscape_lastLocTs', String(this.lastLocationTimestamp));

      if (name) {
        this.cityName = name;
        localStorage.setItem('moodscape_cityName', name);
      } else {
        await this.fetchCityName(nextLat, nextLon);
      }
    },
    async fetchCityName(lat, lon, lang = 'en') {
      const normalized = normalizeCoordinates(lat, lon);

      if (normalized.latitude === null || normalized.longitude === null) {
        return null;
      }

      try {
        const requestLanguage = resolveNominatimLanguage(lang);
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${normalized.latitude}&lon=${normalized.longitude}&accept-language=${requestLanguage}`
        );
        const data = await res.json();
        const city = data.address.city || data.address.town || data.address.village || data.address.state || 'Unknown';
        this.cityName = city;
        localStorage.setItem('moodscape_cityName', city);
        return city;
      } catch (e) {
        console.error('Failed to get city name', e);
        return null;
      }
    },
    async refreshCityNameForLocale(lang) {
      if (!this.hasCoordinates) {
        return;
      }
      await this.fetchCityName(this.lat, this.lon, lang);
    },
    async searchCities(query, lang = 'en') {
      const requestId = ++activeSearchRequestId;

      activeSearchController?.abort();
      activeSearchController = null;

      if (!query || query.trim().length < 2) {
        this.searchResults = [];
        this.isSearching = false;
        return;
      }
      this.isSearching = true;
      try {
        const requestLanguage = resolveNominatimLanguage(lang);
        activeSearchController = new AbortController();
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=6&addressdetails=1&accept-language=${requestLanguage}`,
          { signal: activeSearchController.signal }
        );
        const data = await res.json();
        if (requestId !== activeSearchRequestId) {
          return;
        }
        this.searchResults = data.map(item => ({
          name: item.address.city || item.address.town || item.address.village || item.display_name.split(',')[0],
          displayName: item.display_name,
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
        }));
      } catch (e) {
        if (e?.name === 'AbortError') {
          return;
        }
        console.error('City search failed', e);
        if (requestId === activeSearchRequestId) {
          this.searchResults = [];
        }
      } finally {
        if (requestId === activeSearchRequestId) {
          this.isSearching = false;
        }
        if (requestId === activeSearchRequestId) {
          activeSearchController = null;
        }
      }
    },
    requestBrowserLocation() {
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Геолокация не поддерживается вашим браузером (возможно, требуется HTTPS)'));
        } else {
          const attempt = (highAccuracy) => {
            navigator.geolocation.getCurrentPosition(
              async (position) => {
                const { latitude, longitude } = position.coords;
                await this.setLocation(latitude, longitude);
                resolve(position);
              },
              (error) => {
                console.warn(`Geolocation error (highAccuracy=${highAccuracy}):`, error);
                if (highAccuracy && error.code === 2) {
                  console.log('Retrying without high accuracy...');
                  attempt(false);
                } else {
                  let msg = 'Произошла ошибка при определении местоположения.';
                  if (error.code === 1) msg = 'Доступ к геолокации запрещен. Разрешите его в настройках Safari/браузера.';
                  if (error.code === 2) msg = 'Местоположение недоступно (Position Unavailable).';
                  if (error.code === 3) msg = 'Превышено время ожидания ответа от GPS.';
                  if (!window.isSecureContext) {
                    msg += ' (Внимание: API геолокации требует HTTPS соединения)';
                  }

                  reject(new Error(msg));
                }
              },
              {
                enableHighAccuracy: highAccuracy,
                timeout: highAccuracy ? 10000 : 15000,
                maximumAge: 0
              }
            );
          };
          attempt(true);
        }
      });
    },

    async ensureFreshLocation() {
      const THIRTY_MIN = 30 * 60 * 1000;

      if (!this.autoDetect || this.isFirstVisit) {
        return this.hasCoordinates;
      }

      if (!this.hasCoordinates || (Date.now() - this.lastLocationTimestamp > THIRTY_MIN)) {
        try {
          await this.requestBrowserLocation();
        } catch (e) {
        }
      }

      return this.hasCoordinates;
    },
    openSearchModal() {
      this.searchModalOpen = true;
    },
    closeSearchModal() {
      activeSearchRequestId += 1;
      activeSearchController?.abort();
      activeSearchController = null;
      this.searchModalOpen = false;
      this.isSearching = false;
      this.searchResults = [];
    }
  }
});
