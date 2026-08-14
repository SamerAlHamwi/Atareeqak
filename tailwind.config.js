/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary — brand navy (sampled from app screens: #203858)
        "primary": "#1E3A5C",
        "primary-container": "#142943",
        "on-primary": "#ffffff",
        "on-primary-container": "#C7D8EC",
        "primary-fixed": "#DCE6F2",
        "primary-fixed-dim": "#AEC5DE",
        "on-primary-fixed": "#0F2136",
        "on-primary-fixed-variant": "#2C4A6B",
        "inverse-primary": "#AEC5DE",
        "surface-tint": "#1E3A5C",

        // Secondary — brand orange accent (sampled from app screens: #E8870D)
        "secondary": "#E8830A",
        "secondary-container": "#FCE3C2",
        "on-secondary": "#ffffff",
        "on-secondary-container": "#7A4100",
        "secondary-fixed": "#FBDDB0",
        "secondary-fixed-dim": "#F3B86B",
        "on-secondary-fixed": "#2E1800",
        "on-secondary-fixed-variant": "#7A4100",

        // Tertiary — status green (verified/completed/pending pills)
        "tertiary": "#1F6D34",
        "tertiary-container": "#0E3D1E",
        "on-tertiary": "#ffffff",
        "on-tertiary-container": "#A8E6BB",
        "tertiary-fixed": "#C9F2D3",
        "tertiary-fixed-dim": "#8FDBA5",
        "on-tertiary-fixed": "#062814",
        "on-tertiary-fixed-variant": "#1B5E31",

        // Error — kept standard, unrelated to the brand refresh
        "error": "#ba1a1a",
        "error-container": "#ffdad6",
        "on-error": "#ffffff",
        "on-error-container": "#93000a",

        // Neutral surfaces — cool navy-tinted grays
        "background": "#F7F8FA",
        "surface": "#F7F8FA",
        "surface-dim": "#D9DCE1",
        "surface-bright": "#F7F8FA",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#F1F3F6",
        "surface-container": "#EBEDF1",
        "surface-container-high": "#E5E8EC",
        "surface-container-highest": "#DFE2E7",
        "surface-variant": "#E1E5EB",
        "on-surface": "#1A2230",
        "on-surface-variant": "#4A5568",
        "on-background": "#1A2230",
        "outline": "#6B7688",
        "outline-variant": "#D3D8E0",
        "inverse-surface": "#29313D",
        "inverse-on-surface": "#EFF1F4"
      },
      fontFamily: {
        "headline": ["Cairo", "Manrope", "sans-serif"],
        "body": ["Cairo", "Inter", "sans-serif"],
        "label": ["Cairo", "Inter", "sans-serif"],
        "sans": ["Cairo", "Inter", "sans-serif"],
        "display": ["Cairo", "Manrope", "sans-serif"],
      },
      boxShadow: {
        'ambient': '0 12px 40px rgba(30, 58, 92, 0.06)',
      },
    },
  },
  plugins: [],
}
