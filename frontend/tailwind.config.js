/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['selector', 'html.theme-dark'],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Kept: `bg-void` is still used in App.jsx. Value realigned to the new
        // neutral-50 so the app shell matches the redesigned surfaces.
        void: "#f5f7fa",

        // Redesign token layer. Overriding a built-in palette name inside
        // `extend` replaces that scale wholesale - intended, so the ~7,000
        // existing slate-*/blue-*/emerald-*/rose-*/amber-*/violet-*/cyan-*
        // class names resolve to the new system without being edited.
        slate: {
          50: "#f5f7fa", 100: "#edf0f5", 200: "#e0e5ed", 300: "#c8d0dd",
          400: "#98a3b5", 500: "#6c7789", 600: "#4e5867", 700: "#39424f",
          800: "#242b35", 900: "#161c24", 950: "#0d1219",
        },
        blue: {
          50: "#eef3ff", 100: "#dde6ff", 200: "#bcd0ff", 300: "#8fb0ff",
          400: "#5c87fb", 500: "#3a63f0", 600: "#2549d6", 700: "#1c37ab",
          800: "#1a3088", 900: "#182a6d", 950: "#101c4a",
        },
        emerald: {
          50: "#e8f7f0", 100: "#cdeee0", 200: "#a3e0c9", 300: "#6ecdaa",
          400: "#3ab98a", 500: "#12a06a", 600: "#0d8055", 700: "#0a6544",
          800: "#084f36", 900: "#06402c", 950: "#032418",
        },
        rose: {
          50: "#fdedec", 100: "#fbd9d7", 200: "#f6b8b5", 300: "#ee908c",
          400: "#e26965", 500: "#d64545", 600: "#b83232", 700: "#942626",
          800: "#741f1f", 900: "#5c1a1a", 950: "#300c0c",
        },
        amber: {
          50: "#fdf4e3", 100: "#fbe9c4", 200: "#f6d68c", 300: "#eebf51",
          400: "#dda527", 500: "#c88a09", 600: "#a26f06", 700: "#7d5605",
          800: "#614304", 900: "#4c3503", 950: "#291c02",
        },
        violet: {
          50: "#f2eefe", 100: "#e6ddfd", 200: "#cfbdfb", 300: "#b199f8",
          400: "#9376f7", 500: "#7a5af5", 600: "#6440dd", 700: "#4f31b0",
          800: "#3e278a", 900: "#32206e", 950: "#1c1140",
        },
        cyan: {
          50: "#e9f4fb", 100: "#d2e9f7", 200: "#a8d3ef", 300: "#79b9e3",
          400: "#4c9dd3", 500: "#2b7fbf", 600: "#1f6499", 700: "#184f79",
          800: "#133e5f", 900: "#10334d", 950: "#081d2c",
        },

        crm: {
          bg: "#f5f7fa",
          surface: "#ffffff",
          muted: "#edf0f5",
          border: "#e0e5ed",
          ink: "#161c24",
          subtle: "#6c7789",
          accent: "#2549d6",
        },

        text: {
          primary: "#161c24",
          secondary: "#4e5867",
          tertiary: "#98a3b5"
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'Arial', 'sans-serif'],
        display: ['Inter', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'Arial', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      animation: {
        'spin-slow': 'spin 120s linear infinite',
      },
      // Three elevation levels. The legacy keys stay as aliases so no component
      // has to change; they are removed in Phase 14.
      boxShadow: {
        'crm-soft': '0 1px 2px rgba(16,24,40,.05)',
        'crm-card': '0 1px 2px rgba(16,24,40,.06), 0 8px 20px -12px rgba(16,24,40,.24)',
        'crm-panel': '0 12px 36px -14px rgba(16,24,40,.28), 0 2px 6px rgba(16,24,40,.06)',

        clay: '0 1px 2px rgba(16,24,40,.05)',
        'clay-sm': '0 1px 2px rgba(16,24,40,.05)',
        'clay-inset': '0 1px 2px rgba(16,24,40,.05)',
        'glass-light': '0 1px 2px rgba(16,24,40,.06), 0 8px 20px -12px rgba(16,24,40,.24)',
        'glass-light-hover': '0 12px 36px -14px rgba(16,24,40,.28), 0 2px 6px rgba(16,24,40,.06)',
        'flat-card': '0 1px 2px rgba(16,24,40,.06), 0 8px 20px -12px rgba(16,24,40,.24)',
      }
    },
  },
  plugins: [],
}
