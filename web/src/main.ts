import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router';
import './style.css';

createApp(App).use(createPinia()).use(router).mount('#app');

// 注册 Service Worker，让「添加到主屏幕」后能像 App 一样打开（开发环境不注册，避免缓存干扰调试）
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* 注册失败不影响正常使用 */
    });
  });
}
