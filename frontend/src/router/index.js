import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import WelcomeView from '../views/WelcomeView.vue';
import RecordsView from '../views/RecordsView.vue';
import LoginView from '../views/LoginView.vue';
import RegisterView from '../views/RegisterView.vue';
import CalendarView from '../views/CalendarView.vue';
import PredictionView from '../views/PredictionView.vue';
import SettingsView from '../views/SettingsView.vue';
import StatisticsView from '../views/StatisticsView.vue';
import SleepView from '../views/SleepView.vue';

const routes = [
    { path: '/', name: 'Welcome', component: WelcomeView, meta: { requiresAuth: false, guestOnly: true } },
    { path: '/records', name: 'Records', component: RecordsView, meta: { requiresAuth: true, index: 1 } },
    { path: '/sleep', name: 'Sleep', component: SleepView, meta: { requiresAuth: true, index: 2 } },
    { path: '/login', name: 'Login', component: LoginView, meta: { requiresAuth: false, guestOnly: true } },
    { path: '/register', name: 'Register', component: RegisterView, meta: { requiresAuth: false, guestOnly: true } },
    { path: '/statistics', name: 'Statistics', component: StatisticsView, meta: { requiresAuth: true, index: 3 } },
    { path: '/calendar', name: 'Calendar', component: CalendarView, meta: { requiresAuth: true, index: 4 } },
    { path: '/prediction', name: 'Prediction', component: PredictionView, meta: { requiresAuth: true, index: 5 } },
    { path: '/settings', name: 'Settings', component: SettingsView, meta: { requiresAuth: true, index: 6 } },
];

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
    scrollBehavior() {
        return { top: 0, left: 0 };
    }
});

router.beforeEach((to, from, next) => {
    const authStore = useAuthStore();

    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
        next({ name: 'Login' });
    } else if (to.meta.guestOnly && authStore.isAuthenticated) {
        next({ name: 'Records' });
    } else {
        next();
    }
});

export default router;
