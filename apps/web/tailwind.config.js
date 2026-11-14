/** @type {import('tailwindcss').Config} */
// Tailwind v3 (see https://v3.tailwindcss.com/docs/guides/vite).
// Preflight is off for now: the app ships a hand-written reset in
// src/styles/global.css plus vendored styles (Arc, react-bits) that were not
// designed against Tailwind's reset. Enable it once the stylesheets are migrated.
export default {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {},
  },
  plugins: [],
};
