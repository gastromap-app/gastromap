import { useState, useEffect } from 'react';
import { themeController } from '../utils/ThemeController';

export const useTheme = () => {
    // Initialize with current effective theme (or saved preference)
    // We want the 'resolved' theme for UI rendering (light vs dark)
    const [theme, setTheme] = useState(
        typeof window !== 'undefined'
            ? (document.documentElement.getAttribute('data-theme') || 'light')
            : 'light'
    );

    useEffect(() => {
        const handleThemeChange = () => {
            // e.detail.theme is the preference (auto, light, dark)
            // But we might want the *actual* applied theme for UI logic?
            // Actually ThemeController sets data-theme. Let's read that.
            // Or easier: just re-read the attribute or wait for the controller to tell us the resolved one.
            // For simplicity, let's trust the attribute on the element for "is it dark?".

            // A small delay might be needed if the DOM update happens async, 
            // but ThemeController is synchronous.
            const currentTheme = document.documentElement.getAttribute('data-theme');
            setTheme(currentTheme);
        };

        // We can listen to our custom event
        window.addEventListener('themechange', handleThemeChange);

        // Also listen to system changes if we are in auto mode
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleSystemChange = () => {
            // If we are in auto, the controller updates the DOM. 
            // We just need to know the DOM changed.
            // ThemeController logic should handle the DOM update. 
            // We just need to update our React state.
            setTimeout(() => {
                setTheme(document.documentElement.getAttribute('data-theme'));
            }, 10);
        };
        mediaQuery.addEventListener('change', handleSystemChange);

        return () => {
            window.removeEventListener('themechange', handleThemeChange);
            mediaQuery.removeEventListener('change', handleSystemChange);
        };
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        themeController.setTheme(newTheme);
    };

    return { theme, toggleTheme };
};
