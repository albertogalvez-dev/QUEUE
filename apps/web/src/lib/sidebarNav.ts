/**
 * Sidebar Navigation Helper
 * Provides consistent navigation for the sidebar across all pages
 */

import * as nav from './nav';

// Navigation keys for sidebar items
export type NavKey = 'dashboard' | 'colas' | 'estadisticas' | 'config' | 'servicios' | 'puestos';

// Route mapping - relative paths within the app
export const SIDEBAR_ROUTES: Record<NavKey, string> = {
    dashboard: '/operador/',
    colas: '/operador/',
    estadisticas: '/analitica/',
    config: '/admin/servicios/',
    servicios: '/admin/servicios/',
    puestos: '/admin/puestos/'
};

// Active class used by the sidebar styling
const ACTIVE_CLASS = 'sidebar-active';
const INACTIVE_CLASSES = ['text-white/80', 'hover:bg-white/5', 'hover:text-white'];
const ACTIVE_EXTRA_CLASSES = ['text-white'];

/**
 * Wire up sidebar navigation for all items with data-nav attribute
 * Also sets href for fallback and applies active state
 */
export function wireSidebarNav(root: Document | HTMLElement = document): void {
    const currentPath = nav.currentPath();

    // Find all elements with data-nav
    const navItems = root.querySelectorAll<HTMLElement>('[data-nav]');

    navItems.forEach((item) => {
        const key = item.getAttribute('data-nav') as NavKey;
        if (!key || !SIDEBAR_ROUTES[key]) return;

        const route = SIDEBAR_ROUTES[key];

        // If it's an anchor, set href
        if (item instanceof HTMLAnchorElement) {
            item.href = import.meta.env.BASE_URL.replace(/\/$/, '') + route;
        }

        // Add click handler for consistent navigation
        item.addEventListener('click', (e) => {
            e.preventDefault();
            nav.go(route);
        });

        // Apply active state if current path matches route
        const isActive = currentPath === route || currentPath.startsWith(route.replace(/\/$/, ''));

        if (isActive) {
            item.classList.add(ACTIVE_CLASS, ...ACTIVE_EXTRA_CLASSES);
            item.classList.remove(...INACTIVE_CLASSES);

            // Make icon filled if has material-symbols-outlined
            const icon = item.querySelector('.material-symbols-outlined');
            if (icon) {
                icon.classList.add('fill-1');
            }

            // Make text bold
            const textSpan = item.querySelector('span:not(.material-symbols-outlined)');
            if (textSpan) {
                textSpan.classList.remove('font-medium');
                textSpan.classList.add('font-bold');
            }
        } else {
            item.classList.remove(ACTIVE_CLASS, ...ACTIVE_EXTRA_CLASSES);
            item.classList.add(...INACTIVE_CLASSES);
        }
    });
}
