import axios from 'axios';
import router from '../router';

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
});

api.interceptors.request.use(
    (config) => {
        const token = getCookie('auth_token') || localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = 'Bearer ' + token;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response && error.response.status === 401) {
            const [{ useAuthStore }, { usePredictionsStore }, { useRecordsStore }, { useSleepStore }] = await Promise.all([
                import('../stores/auth'),
                import('../stores/predictions'),
                import('../stores/records'),
                import('../stores/sleep'),
            ]);
            const authStore = useAuthStore();
            authStore.token = null;
            authStore.user = null;
            document.cookie = 'auth_token=; Max-Age=-99999999; path=/;';
            localStorage.removeItem('token');
            useRecordsStore().clearForLogout();
            usePredictionsStore().clearForLogout();
            useSleepStore().clearForLogout();
            router.push('/login');
        }
        return Promise.reject(error);
    }
);

export default api;
