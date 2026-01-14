/**
 * Demo Capture Script v5 - Comprehensive Screenshots Only
 * - Per user request: "no videos, just photos of all parts"
 * - Full coverage of all UI states
 */

const DEMO_URL = process.env.DEMO_URL || 'http://localhost:5173';
const BASE_PATH = '';
const RUN_ID = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);

async function main() {
    try {
        const { chromium } = await import('playwright');
        const { mkdir, writeFile } = await import('fs/promises');
        const { join } = await import('path');

        const OUTPUT_DIR = join(process.cwd(), 'fotos', RUN_ID);
        const SCREEN_DIR = join(OUTPUT_DIR, 'screens');

        console.log(`[Capture] Run: ${RUN_ID}`);
        console.log(`[Capture] Output: ${OUTPUT_DIR}`);

        await mkdir(SCREEN_DIR, { recursive: true });

        const browser = await chromium.launch({
            headless: false,
            args: ['--start-maximized', '--window-size=1920,1080']
        });

        const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
        const page = await context.newPage();

        // Pages to capture
        const SCENARIOS = [
            { path: '/', name: '01_landing', desc: 'Landing Page' },
            { path: '/kiosco/', name: '02_kiosco_input', desc: 'Kiosk: DNI Input' },

            // Kiosk Ticket (Simulate via URL params or actions)
            {
                action: async (p) => {
                    await p.goto(`${DEMO_URL}${BASE_PATH}/kiosco/`);
                    await p.click('#keypad-numeric button:has-text("1")'); // Enter mock DNI
                    await p.click('#btn-confirmar-doc');
                    await p.waitForTimeout(500);
                    // Walk-in selection
                    if (await p.isVisible('button[data-service-id="A"]')) {
                        await p.click('button[data-service-id="A"]');
                    } else if (await p.isVisible('#btn-confirmar-llegada')) {
                        await p.click('#btn-confirmar-llegada');
                    }
                    await p.waitForSelector('[data-testid="ticket-code-display"]');
                    await p.waitForTimeout(3000); // Wait for print animation
                },
                name: '03_kiosco_ticket',
                desc: 'Kiosk: Ticket Issued'
            },

            { path: '/operador/login/', name: '04_operador_login', desc: 'Operator: Login' },

            {
                action: async (p) => {
                    await p.goto(`${DEMO_URL}${BASE_PATH}/operador/login/`);
                    if (await p.isVisible('button:has-text("Entrar como Operador")')) {
                        await p.click('button:has-text("Entrar como Operador")');
                        await p.waitForURL('**/operador/');
                    }
                    await p.waitForTimeout(1000);
                },
                name: '05_operador_panel',
                desc: 'Operator: Queue Panel'
            },

            { path: '/pantalla/', name: '06_pantalla_tv', desc: 'TV Display: Waiting Room' },

            {
                path: '/analitica/',
                name: '07_analitica',
                desc: 'Analytics Dashboard'
            },

            { path: '/admin/servicios/', name: '08_admin_servicios', desc: 'Admin: Services' },
            { path: '/admin/puestos/', name: '09_admin_puestos', desc: 'Admin: Counters' },
            { path: '/turno/', name: '10_turno_publico', desc: 'Mobile: Public Status' }
        ];

        for (const scene of SCENARIOS) {
            console.log(`[Capture] 📸 Snap: ${scene.desc}`);
            try {
                if (scene.action) {
                    await scene.action(page);
                } else {
                    await page.goto(`${DEMO_URL}${BASE_PATH}${scene.path}`);
                }

                await page.waitForLoadState('networkidle');
                await page.waitForTimeout(1000); // Settle

                await page.screenshot({ path: join(SCREEN_DIR, scene.name + '.png') });
            } catch (err) {
                console.error(`[Capture] Failed ${scene.name}:`, err.message);
            }
        }

        console.log('[Capture] ✅ All Screenshots Saved');
        await browser.close();

    } catch (e) {
        console.error('CRITICAL:', e);
        process.exit(1);
    }
}

main();
