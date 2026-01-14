/**
 * Universal Navigation Wiring Helper
 * Provides robust navigation for all sidebars across the app
 */

import * as nav from './nav';

// Get base path from Vite
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

// Standard routes for the app
export const ROUTES = {
    operador: '/operador/',
    analitica: '/analitica/',
    adminServicios: '/admin/servicios/',
    adminPuestos: '/admin/puestos/',
    pantalla: '/pantalla/',
    kiosco: '/kiosco/',
    turno: '/turno/',
};

/**
 * Canonical route matching - maps any label to a route
 * Keys are lowercase, trimmed, with accents normalized
 */
const LABEL_TO_ROUTE: Record<string, string> = {
    // Dashboard / Home
    'dashboard': ROUTES.operador,
    'inicio': ROUTES.operador,
    'home': ROUTES.operador,

    // Queue management
    'gestión de colas': ROUTES.operador,
    'gestion de colas': ROUTES.operador,
    'gestión de turnos': ROUTES.operador,
    'gestion de turnos': ROUTES.operador,
    'colas': ROUTES.operador,
    'turnos': ROUTES.operador,
    'tickets': ROUTES.operador,

    // Analytics
    'estadísticas': ROUTES.analitica,
    'estadisticas': ROUTES.analitica,
    'analítica': ROUTES.analitica,
    'analitica': ROUTES.analitica,
    'analytics': ROUTES.analitica,
    'reportes': ROUTES.analitica,

    // Configuration
    'configuración': ROUTES.adminServicios,
    'configuracion': ROUTES.adminServicios,
    'config': ROUTES.adminServicios,
    'ajustes': ROUTES.adminServicios,
    'settings': ROUTES.adminServicios,

    // Admin sections
    'servicios': ROUTES.adminServicios,
    'áreas/servicios': ROUTES.adminServicios,
    'areas/servicios': ROUTES.adminServicios,
    'puestos': ROUTES.adminPuestos,
    'puestos/consultas': ROUTES.adminPuestos,
    'usuarios': ROUTES.operador,
    'personal': ROUTES.operador,

    // Screens
    'pantallas': ROUTES.pantalla,
    'pantalla': ROUTES.pantalla,
    'tv': ROUTES.pantalla,
    'display': ROUTES.pantalla,

    // Kiosk
    'kiosco': ROUTES.kiosco,
    'kiosk': ROUTES.kiosco,

    // Mobile turn
    'turno': ROUTES.turno,
    'mi turno': ROUTES.turno,
};

/**
 * Data-nav attribute to route mapping
 */
const DATA_NAV_TO_ROUTE: Record<string, string> = {
    'dashboard': ROUTES.operador,
    'colas': ROUTES.operador,
    'estadisticas': ROUTES.analitica,
    'config': ROUTES.adminServicios,
    'servicios': ROUTES.adminServicios,
    'puestos': ROUTES.adminPuestos,
    'pantalla': ROUTES.pantalla,
    'kiosco': ROUTES.kiosco,
    'turno': ROUTES.turno,
};

/**
 * Normalize text for matching - lowercase, trim, collapse spaces, remove accents
 */
function normalizeLabel(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, ''); // Remove diacritics
}

/**
 * Wire a single clickable element to navigate to a route
 */
export function wireClickable(el: HTMLElement, route: string): void {
    // Set href if it's an anchor
    if (el instanceof HTMLAnchorElement) {
        el.href = BASE + route;
    }

    // Add click handler
    el.addEventListener('click', (e) => {
        e.preventDefault();
        nav.go(route);
    });
}

/**
 * Main function - wire ALL navigation in the document
 * Uses multiple strategies: data-nav, text matching, selectors
 */
export function wireAllNav(root: ParentNode = document): void {
    // Find all potential navigation links
    const selectors = [
        'aside a',
        'nav a',
        '.sidebar a',
        '[role="navigation"] a',
        'header a[data-nav]',
    ];

    const allLinks = root.querySelectorAll<HTMLAnchorElement>(selectors.join(', '));

    allLinks.forEach((link) => {
        let route: string | undefined;

        // Strategy 1: Check data-nav attribute
        const dataNav = link.getAttribute('data-nav');
        if (dataNav && DATA_NAV_TO_ROUTE[dataNav]) {
            route = DATA_NAV_TO_ROUTE[dataNav];
        }

        // Strategy 2: Match by visible text
        if (!route) {
            const textSpan = link.querySelector('span:not(.material-symbols-outlined)');
            const visibleText = textSpan?.textContent?.trim() || link.textContent?.trim() || '';
            const normalizedText = normalizeLabel(visibleText);

            // Try exact match first
            if (LABEL_TO_ROUTE[normalizedText]) {
                route = LABEL_TO_ROUTE[normalizedText];
            } else {
                // Try partial match
                for (const [label, r] of Object.entries(LABEL_TO_ROUTE)) {
                    if (normalizedText.includes(label) || label.includes(normalizedText)) {
                        route = r;
                        break;
                    }
                }
            }

            if (!route && visibleText && visibleText.length > 0) {
                console.warn('wireNav: no match for label:', visibleText);
            }
        }

        // Wire if we found a route
        if (route) {
            wireClickable(link, route);
        }
    });

    console.log('[wireNav] Wired', allLinks.length, 'navigation links');
}

// Re-export existing functions for backward compatibility
export { ROUTES as routes };
export function wireNavByText(root: ParentNode = document, map: Record<string, string>): void {
    const anchors = root.querySelectorAll<HTMLAnchorElement>('nav a, aside a');
    anchors.forEach((anchor) => {
        const textSpan = anchor.querySelector('span:not(.material-symbols-outlined)');
        const visibleText = textSpan?.textContent?.trim() || anchor.textContent?.trim() || '';
        const route = map[visibleText];
        if (route) {
            wireClickable(anchor, route);
        }
    });
}
