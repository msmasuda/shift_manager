import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#09090b", // Deep slate almost black
        foreground: "#fafafa",
        surface: "rgba(24, 24, 27, 0.6)", // Slight transparency for glass effect
        surfaceHover: "rgba(39, 39, 42, 0.8)",
        accent: "#818cf8", // Soft indigo
        accentHover: "#6366f1",
        border: "rgba(255, 255, 255, 0.1)",
        warn: "#fbbf24",
        warnBg: "rgba(251, 191, 36, 0.1)",
        danger: "#f87171",
        success: "#34d399",
        textMuted: "#a1a1aa",
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'mesh-pattern': 'radial-gradient(at 40% 20%, rgba(99, 102, 241, 0.15) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(168, 85, 247, 0.15) 0px, transparent 50%), radial-gradient(at 0% 50%, rgba(236, 72, 153, 0.15) 0px, transparent 50%)',
      },
      boxShadow: {
        'glass': '0 4px 30px rgba(0, 0, 0, 0.1)',
        'glow': '0 0 20px rgba(129, 140, 248, 0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
} satisfies Config;
