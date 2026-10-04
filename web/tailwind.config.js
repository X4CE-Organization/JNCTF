/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{vue,ts,js}'],
  // 关掉 preflight：项目已有自己的基础样式，避免和 Naive UI 的默认样式打架
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#00a878', soft: 'rgba(0,168,120,0.1)' },
      },
    },
  },
  plugins: [],
};
