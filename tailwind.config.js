import tailwindAnimate from "tailwindcss-animate";
import daisyui from 'daisyui';

/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
    theme: {
        container: {
            center: true,
            padding: "2rem",
            screens: {
                "2xl": "1400px",
            },
        },
        extend: {
            fontFamily: {
                sans: ['Inter', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
            },
            // ─── Semantic typography scale ─────────────────────────────────────────
            // Source of truth. Prefer these over raw `text-[Npx]` so hierarchy stays
            // consistent across pages. Scale: display > h1 > h2 > h3 > body > body-sm
            // > caption > eyebrow > micro. Line-height / letter-spacing / weight are
            // locked per step so callers only need one class.
            fontSize: {
                display:  ['clamp(2rem, 5vw, 3rem)', { lineHeight: '1.05', letterSpacing: '-0.03em',  fontWeight: '800' }],
                h1:       ['1.75rem',                  { lineHeight: '1.15', letterSpacing: '-0.025em', fontWeight: '800' }],
                h2:       ['1.375rem',                 { lineHeight: '1.2',  letterSpacing: '-0.02em',  fontWeight: '700' }],
                h3:       ['1.125rem',                 { lineHeight: '1.25', letterSpacing: '-0.015em', fontWeight: '700' }],
                'card-title': ['0.9375rem',            { lineHeight: '1.25', letterSpacing: '-0.01em',  fontWeight: '700' }],
                body:     ['0.9375rem',                { lineHeight: '1.5',  letterSpacing: '-0.003em', fontWeight: '400' }],
                'body-sm':['0.8125rem',                { lineHeight: '1.45', letterSpacing: '0',        fontWeight: '500' }],
                caption:  ['0.75rem',                  { lineHeight: '1.3',  letterSpacing: '0',        fontWeight: '500' }],
                eyebrow:  ['0.6875rem',                { lineHeight: '1.2',  letterSpacing: '0.14em',   fontWeight: '700' }],
                micro:    ['0.625rem',                 { lineHeight: '1.2',  letterSpacing: '0.08em',   fontWeight: '700' }],
            },
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)',
                // Semantic radius scale — unified for 2026 premium aesthetic
                input: '12px',   // form inputs, small controls
                image: '16px',   // photos, gallery items (rounded-2xl)
                card:  '24px',   // must try, reviews, curator tips (rounded-3xl)
                sheet: '28px',   // modals, large sections
                pill:  '9999px', // chips, pills, round buttons
            },
            transitionDuration: {
                '0': '0ms',
            },
            colors: {
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                card: {
                    DEFAULT: 'hsl(var(--card))',
                    foreground: 'hsl(var(--card-foreground))'
                },
                popover: {
                    DEFAULT: 'hsl(var(--popover))',
                    foreground: 'hsl(var(--popover-foreground))'
                },
                primary: {
                    DEFAULT: 'hsl(var(--primary))',
                    foreground: 'hsl(var(--primary-foreground))'
                },
                secondary: {
                    DEFAULT: 'hsl(var(--secondary))',
                    foreground: 'hsl(var(--secondary-foreground))'
                },
                muted: {
                    DEFAULT: 'hsl(var(--muted))',
                    foreground: 'hsl(var(--muted-foreground))'
                },
                accent: {
                    DEFAULT: 'hsl(var(--accent))',
                    foreground: 'hsl(var(--accent-foreground))'
                },
                destructive: {
                    DEFAULT: 'hsl(var(--destructive))',
                    foreground: 'hsl(var(--destructive-foreground))'
                },
                border: 'hsl(var(--border))',
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))',
                chart: {
                    '1': 'hsl(var(--chart-1))',
                    '2': 'hsl(var(--chart-2))',
                    '3': 'hsl(var(--chart-3))',
                    '4': 'hsl(var(--chart-4))',
                    '5': 'hsl(var(--chart-5))'
                },
                surface: {
                    DEFAULT: 'hsl(220 20% 6%)',
                    elevated: 'hsl(220 20% 9%)',
                    foreground: 'hsl(220 20% 96%)'
                },
                sidebar: {
                    DEFAULT: 'hsl(var(--sidebar-background))',
                    foreground: 'hsl(var(--sidebar-foreground))',
                    primary: 'hsl(var(--sidebar-primary))',
                    'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
                    accent: 'hsl(var(--sidebar-accent))',
                    'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
                    border: 'hsl(var(--sidebar-border))',
                    ring: 'hsl(var(--sidebar-ring))'
                }
            },
            keyframes: {
                shimmer: {
                    '0%': { transform: 'translateX(-100%)' },
                    '100%': { transform: 'translateX(100%)' },
                },
                'aurora-1': {
                    '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
                    '50%': { transform: 'translate(50px, 30px) scale(1.2)' }
                },
                'aurora-2': {
                    '0%, 100%': { transform: 'translate(0, 0) scale(1.2)' },
                    '50%': { transform: 'translate(-30px, 50px) scale(1)' }
                },
                'aurora-3': {
                    '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
                    '50%': { transform: 'translate(40px, -40px) scale(1.3)' }
                },
                'accordion-down': {
                    from: {
                        height: '0'
                    },
                    to: {
                        height: 'var(--radix-accordion-content-height)'
                    }
                },
                'accordion-up': {
                    from: {
                        height: 'var(--radix-accordion-content-height)'
                    },
                    to: {
                        height: '0'
                    }
                }
            },
            animation: {
                'accordion-down': 'accordion-down 0.2s ease-out',
                'accordion-up': 'accordion-up 0.2s ease-out',
                'aurora-1': 'aurora-1 18s ease-in-out infinite',
                'aurora-2': 'aurora-2 20s ease-in-out infinite',
                'aurora-3': 'aurora-3 25s ease-in-out infinite'
            }
        }
    },
    plugins: [
        tailwindAnimate,
        daisyui,
    ],
    daisyui: {
        themes: [
            "light",
            "dark",
            {
                mytheme: {
                    "primary": "#3b82f6",
                    "primary-content": "#ffffff",
                    "secondary": "#f59e0b",
                    "accent": "#10b981",
                    "neutral": "#1f2937",
                    "base-100": "#ffffff",
                },
                mydark: {
                    "primary": "#60a5fa",
                    "primary-content": "#ffffff",
                    "secondary": "#fbbf24",
                    "accent": "#34d399",
                    "neutral": "#f3f4f6",
                    "base-100": "#1a1a1a",
                },
            },
        ],
        darkTheme: "dark",
        base: true,
        styled: true,
        utils: true,
        prefix: "",
        logs: true,
        themeRoot: ":root",
    },
}
