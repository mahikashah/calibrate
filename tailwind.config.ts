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
        // Primary — muted turquoise; sage stays for success/supporting accents.
        brand: {
          DEFAULT: "#3F817D",
          soft: "#E2F1ED",
          ink: "#2A5F5C",
        },
        sage: {
          DEFAULT: "#91A88D",
          soft: "#E1F0DD",
          ink: "#4D6E52",
        },
        // Semantic confidence colors — these ENCODE data, not decoration.
        clear: "#208B8B",
        emerging: "#A16B2B",
        insufficient: "#91A88D",
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        serif: ["Georgia", "Cambria", "Times New Roman", "Times", "serif"],
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
