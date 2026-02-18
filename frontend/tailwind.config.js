/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // NEW: The bright foundation (Off-White / Slate 50)
        void: "#F8FAFC",

        // NEW: Dark text for bright backgrounds
        text: {
          primary: "#0f172a", // Slate 900
          secondary: "#475569", // Slate 600
          tertiary: "#94a3b8" // Slate 400
        },

        // GEMSTONE PALETTE (Unchanged, but we will use them differently)
        gem: {
          cyan: "#22d3ee", cyanDark: "#06b6d4",
          gold: "#fbbf24", goldDark: "#d97706",
          pink: "#f472b6", pinkDark: "#be185d",
          violet: "#a78bfa", violetDark: "#7c3aed",
          emerald: "#34d399", emeraldDark: "#059669",
          sun: "#0ea5e9", // Slightly deeper blue for light mode sun
        }
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'Arial', 'sans-serif'],
        display: ['system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'Arial', 'sans-serif'],
        mono: ['system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'Arial', 'sans-serif'],
      },
      animation: {
        'spin-slow': 'spin 120s linear infinite',
      },
      boxShadow: {
        // NEW: Soft, expensive shadows for light mode
        'glass-light': '0 4px 30px rgba(0, 0, 0, 0.1)',
        'glass-light-hover': '0 10px 40px rgba(0, 0, 0, 0.15)',
      }
    },
  },
  safelist: [
    // Ensure these are safe for dynamic use
    'text-gem-cyan', 'text-gem-gold', 'text-gem-pink', 'text-gem-violet', 'text-gem-emerald',
    'bg-gem-cyan/10', 'bg-gem-gold/10', 'bg-gem-pink/10', 'bg-gem-violet/10', 'bg-gem-emerald/10',
    'border-gem-cyan/30', 'border-gem-gold/30', 'border-gem-pink/30', 'border-gem-violet/30', 'border-gem-emerald/30',
  ],
  plugins: [],
}
