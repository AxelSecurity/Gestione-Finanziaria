import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#10b981", dark: "#047857" },
        needs: "#3b82f6", wants: "#f59e0b", savings: "#10b981",
      },
    },
  },
  plugins: [],
} satisfies Config;
