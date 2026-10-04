import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from './stores/auth';

const routes = [
  { path: '/', name: 'home', component: () => import('./views/HomeView.vue') },
  { path: '/challenges', name: 'challenges', component: () => import('./views/ChallengeListView.vue') },
  { path: '/challenges/:id', name: 'challenge-detail', component: () => import('./views/ChallengeDetailView.vue') },
  { path: '/submissions', name: 'submissions', component: () => import('./views/SubmissionsView.vue') },
  { path: '/scoreboard', name: 'scoreboard', component: () => import('./views/ScoreboardView.vue') },
  { path: '/competitions', name: 'competitions', component: () => import('./views/CompetitionListView.vue') },
  { path: '/competitions/:id', name: 'competition-detail', component: () => import('./views/CompetitionDetailView.vue') },
  { path: '/competitions/:id/awd', name: 'awd', component: () => import('./views/AwdView.vue') },
  { path: '/teams', name: 'teams', component: () => import('./views/TeamListView.vue') },
  { path: '/teams/:id', name: 'team-detail', component: () => import('./views/TeamDetailView.vue') },
  { path: '/users/:username', name: 'user-profile', component: () => import('./views/UserProfileView.vue') },
  { path: '/writeups/:id', name: 'writeup-detail', component: () => import('./views/WriteupDetailView.vue') },
  {
    path: '/tickets',
    name: 'tickets',
    component: () => import('./views/TicketsView.vue'),
    meta: { auth: true },
  },
  {
    path: '/notifications',
    name: 'notifications',
    component: () => import('./views/NotificationsView.vue'),
    meta: { auth: true },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('./views/SettingsView.vue'),
    meta: { auth: true },
  },
  { path: '/login', name: 'login', component: () => import('./views/LoginView.vue') },
  { path: '/register', name: 'register', component: () => import('./views/RegisterView.vue') },
  { path: '/oauth/callback', name: 'oauth-callback', component: () => import('./views/OAuthCallbackView.vue') },
  {
    path: '/admin',
    component: () => import('./views/admin/AdminLayout.vue'),
    meta: { admin: true },
    children: [
      { path: '', name: 'admin-dashboard', component: () => import('./views/admin/DashboardView.vue') },
      { path: 'users', name: 'admin-users', component: () => import('./views/admin/UsersView.vue') },
      { path: 'challenges', name: 'admin-challenges', component: () => import('./views/admin/ChallengesView.vue') },
      { path: 'competitions', name: 'admin-competitions', component: () => import('./views/admin/CompetitionsView.vue') },
      { path: 'awx/:id', name: 'admin-awx', component: () => import('./views/admin/AwxPanel.vue') },
      { path: 'writeups', name: 'admin-writeups', component: () => import('./views/admin/WriteupsPanel.vue') },
      { path: 'tickets', name: 'admin-tickets', component: () => import('./views/admin/TicketsPanel.vue') },
      { path: 'announcements', name: 'admin-announcements', component: () => import('./views/admin/AnnouncementsPanel.vue') },
      { path: 'logs', name: 'admin-logs', component: () => import('./views/admin/LogsPanel.vue'), meta: { superadmin: true } },
      { path: 'settings', name: 'admin-settings', component: () => import('./views/admin/SettingsPanel.vue'), meta: { superadmin: true } },
    ],
  },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('./views/NotFoundView.vue') },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (auth.loading) await auth.bootstrap();
  if (to.meta.auth && !auth.isLogin) return { name: 'login', query: { redirect: to.fullPath } };
  if (to.meta.admin && !auth.isAdmin) return { name: 'not-found' };
  return true;
});
