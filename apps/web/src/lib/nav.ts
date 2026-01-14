/**
 * Navigation helper for MPA with base path support
 */

// Get base path from Vite, ensuring no trailing slash
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/**
 * Navigate to a path within the app
 * @param path - Path relative to base (e.g., "/kiosco/")
 */
export function go(path: string): void {
    const url = BASE + path;
    window.location.href = url;
}

/**
 * Get current path without base prefix
 */
export function currentPath(): string {
    return window.location.pathname.replace(BASE, '') || '/';
}
