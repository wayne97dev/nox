import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        noir: "#05050B",
        night: "#0B0B17",
        veil: "#161329",
        shadow: "#1F1A3A",
        iris: "#A78BFA",
        violet: "#7C3AED",
        plum: "#5B21B6",
        cobalt: "#3B82F6",
        glow: "#C4B5FD",
        fog: "#E5E7EB",
        mist: "#9CA3AF",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      backgroundImage: {
        "noir-grad":
          "radial-gradient(ellipse 80% 60% at 50% -20%, rgba(124, 58, 237, 0.18), transparent 70%), radial-gradient(ellipse 60% 50% at 80% 110%, rgba(59, 130, 246, 0.12), transparent 70%)",
        "card-grad":
          "linear-gradient(180deg, rgba(167, 139, 250, 0.04) 0%, rgba(167, 139, 250, 0) 100%)",
      },
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        shimmer: "shimmer 2.5s linear infinite",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
