import { defineStore } from 'pinia';
import api from '../api/axios';
import router from '../router';
import { navigateToPostAuthRoute } from '../utils/postAuthRoute';

export function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

export function setCookie(name, value, days) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/";
}

export function deleteCookie(name) {
    document.cookie = name + '=; Max-Age=-99999999; path=/;';
}

export const useAuthStore = defineStore('auth', {
    state: () => ({
        token: getCookie('auth_token') || localStorage.getItem('token') || null,
        user: null,
    }),
    getters: {
        isAuthenticated: (state) => !!state.token,
    },
    actions: {
        async fetchUser() {
            if (!this.token) return;
            try {
                const response = await api.get('/users/me');
                this.user = response.data;
            } catch (error) {
                console.error('Failed to fetch user:', error);
                if (error.response && error.response.status === 401) {
                    await this.logout({ notifyServer: false });
                }
            }
        },
        async login(credentials, { navigate = true } = {}) {
            const formData = new FormData();
            formData.append('username', credentials.username);
            formData.append('password', credentials.password);

            try {
                const response = await api.post('/auth/login', formData);
                this.token = response.data.access_token;
                setCookie('auth_token', this.token, 30);
                localStorage.setItem('token', this.token);

                await this.fetchUser();

                if (navigate) {
                    await navigateToPostAuthRoute(router);
                }
            } catch (error) {
                console.error('Login error:', error);
                throw error;
            }
        },
        async logout({ notifyServer = true } = {}) {
            try {
                if (notifyServer && this.token) {
                    await api.post('/auth/logout');
                }
            } catch (error) {
                if (error?.response?.status !== 401) {
                    console.error('Logout error:', error);
                }
            } finally {
                const [{ usePredictionsStore }, { useRecordsStore }, { useSleepStore }] = await Promise.all([
                    import('./predictions'),
                    import('./records'),
                    import('./sleep'),
                ]);
                useRecordsStore().clearForLogout();
                usePredictionsStore().clearForLogout();
                useSleepStore().clearForLogout();
                this.token = null;
                this.user = null;
                deleteCookie('auth_token');
                localStorage.removeItem('token');
                router.push('/login');
            }
        }
    }
});
