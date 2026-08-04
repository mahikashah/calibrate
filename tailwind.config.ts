import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F7F5EC",
        surface: "#FFFEF9",
        ink: "#171814",
        muted: "#5F665E",
        line: "#D8E4D5",
        // Primary accent — calm turquoise and green, used with restraint.
        brand: {
          DEFAULT: "#27834F",
          soft: "#E1F0DD",
          ink: "#1E613B",
        },
        // Semantic confidence colors — these ENCODE data, not decoration.
        clear: "#208B8B", // technique is clearly winning
        emerging: "#A16B2B", // still close, keep testing
        insufficient: "#91A88D", // not enough data yet
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "SF Mono",
          "Menlo",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(23,24,20,0.04), 0 1px 3px rgba(23,24,20,0.06)",
        lift: "0 8px 24px rgba(23,24,20,0.10)",
      },
      borderRadius: {
        xl: "14px",
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        rise: "rise 0.4s ease both",
      },
    },
  },
  plugins: [],
};

export default config;
