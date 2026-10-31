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
        card: "0 1px 1px rgba(23,24,20,0.03), 0 2px 6px -1px rgba(23,24,20,0.05), 0 10px 24px -12px rgba(23,24,20,0.08)",
        lift: "0 2px 4px rgba(23,24,20,0.04), 0 14px 32px -10px rgba(23,24,20,0.16)",
        glow: "0 0 0 4px rgba(63,129,125,0.14)",
        "btn-primary": "inset 0 1px 0 rgba(255,255,255,0.2), 0 1px 2px rgba(23,24,20,0.18), 0 8px 20px -6px rgba(29,98,94,0.6)",
      },
      borderRadius: {
        xl: "14px",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        expand: {
          "0%": { opacity: "0", transform: "translateY(-4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
      },
      animation: {
        rise: "rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-in": "fade-in 0.3s ease both",
        expand: "expand 0.28s cubic-bezier(0.22, 1, 0.36, 1) both",
        shimmer: "shimmer 1.4s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
