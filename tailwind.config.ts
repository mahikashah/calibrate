import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F5F6F8",
        surface: "#FFFFFF",
        ink: "#15171C",
        muted: "#697086",
        line: "#E4E7EC",
        // Primary accent — an ink-indigo, used with restraint.
        brand: {
          DEFAULT: "#4F46B8",
          soft: "#EEEDF9",
          ink: "#332C82",
        },
        // Semantic confidence colors — these ENCODE data, not decoration.
        clear: "#0E7C66", // technique is clearly winning
        emerging: "#B26A00", // still close, keep testing
        insufficient: "#8A90A2", // not enough data yet
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
        card: "0 1px 2px rgba(21,23,28,0.04), 0 1px 3px rgba(21,23,28,0.06)",
        lift: "0 8px 24px rgba(21,23,28,0.10)",
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
