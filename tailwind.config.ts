import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef7ff',
          100: '#d9ecff',
          500: '#1f6da8',
          700: '#155180',
          900: '#0b2d4a',
        },
      },
    },
  },
  plugins: [],
};

export default config;
