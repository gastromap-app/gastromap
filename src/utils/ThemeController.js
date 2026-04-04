class ThemeController {
    constructor() {
        this.STORAGE_KEY = 'theme';
        // Don't auto-init here if it causes hydration mismatches in React, 
        // but since we want it available globally, it's okay to have a singleton.
        // We'll rely on the script in index.html for the initial paint, 
        // and this for runtime switching.
    }

    getSavedTheme() {
        if (typeof window === 'undefined') return 'light';
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved && saved !== 'auto') return saved;
        return 'auto'; // Default to auto logic
    }

    getSystemTheme() {
        if (typeof window === 'undefined') return 'light';
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    applyTheme(theme) {
        if (typeof window === 'undefined') return;

        let actualTheme = theme;

        if (theme === 'auto') {
            actualTheme = this.getSystemTheme();
        }

        // Set data-theme for DaisyUI
        document.documentElement.setAttribute('data-theme', actualTheme);

        // Set class="dark" for Tailwind generic dark mode
        if (actualTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }

        // Save preference (unless it's just meant to be ephemeral, but here we save 'auto' or 'light'/'dark')
        // We don't save the resolved theme (actualTheme), we save the user preference (theme)
        if (theme !== this.getSavedTheme()) {
            localStorage.setItem(this.STORAGE_KEY, theme);
        }
    }

    setTheme(theme) {
        localStorage.setItem(this.STORAGE_KEY, theme);
        this.applyTheme(theme);
        window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
    }

    init() {
        // Sync state on load
        const saved = this.getSavedTheme();
        this.applyTheme(saved);

        // Watch system changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (this.getSavedTheme() === 'auto') {
                this.applyTheme('auto');
            }
        });
    }
}

export const themeController = new ThemeController();
// Initialize immediately on import to ensure listeners are active
if (typeof window !== 'undefined') {
    themeController.init();
}
