import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pitch: {
          950: "#05130d",
          900: "#0a1f16",
          800: "#0f2c1f",
          700: "#173d2b",
        },
        ink: {
          50: "#f4f7f5",
          200: "#c9d4cd",
          400: "#8fa398",
          600: "#5b6e62",
        },
        accent: {
          go: "#3ecf71",
          warn: "#e8b649",
          cool: "#5b8def",
          bad: "#e8615a",
        },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "system-ui", "sans-serif"],
        body: ["'Inter'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
