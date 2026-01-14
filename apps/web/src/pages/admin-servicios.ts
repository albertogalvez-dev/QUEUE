/**
 * Admin Servicios page - Dynamic service configuration
 * Dual mode: API or Mock based on VITE_USE_API
 */
import { wireAllNav } from '../lib/wireNav';
import { USE_API } from '../lib/config';
import { getServices, updateService } from '../lib/apiClient';
import type { ServiceDto } from '../lib/apiTypes';

console.log('page: admin-servicios');

// Wire navigation
wireAllNav();

// Elements
const servicesTbody = document.getElementById('services-tbody');

// State
let services: ServiceDto[] = [];

// Toast notification
function showToast(message: string, isError = false): void {
    const existingToast = document.getElementById('admin-toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.id = 'admin-toast';
    toast.className = `fixed bottom-4 right-4 ${isError ? 'bg-red-600' : 'bg-primary'} text-white px-4 py-3 rounded-lg shadow-lg z-50`;
    toast.innerHTML = `
        <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-lg">${isError ? 'error' : 'check_circle'}</span>
            <span class="text-sm font-bold">${message}</span>
        </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Render services table
function renderServices(): void {
    if (!servicesTbody) return;

    if (services.length === 0) {
        servicesTbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-12 text-center text-slate-500">
                    <span class="material-symbols-outlined text-4xl mb-2">inbox</span>
                    <p class="text-sm">No hay servicios configurados</p>
                </td>
            </tr>
        `;
        return;
    }

    servicesTbody.innerHTML = services.map(service => {
        const isActive = service.isActive !== false;
        const rowClass = isActive ? '' : 'bg-slate-50/30 dark:bg-slate-800/10';
        const textClass = isActive ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500';

        return `
            <tr class="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${rowClass}" data-service-id="${service.id}">
                <td class="px-6 py-4">
                    <div class="flex flex-col">
                        <input type="text" 
                            class="text-sm font-semibold ${textClass} bg-transparent border-0 p-0 focus:ring-0 focus:outline-none w-full"
                            value="${service.name}"
                            data-field="name"
                            data-id="${service.id}">
                        <span class="text-xs text-slate-500 dark:text-slate-400">ID: ${service.id}</span>
                    </div>
                </td>
                <td class="px-6 py-4 text-center">
                    <span class="inline-flex items-center justify-center size-8 rounded bg-primary/10 text-primary font-mono text-sm font-bold border border-primary/20">
                        ${service.prefix || service.id}
                    </span>
                </td>
                <td class="px-6 py-4">
                    <div class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                        <span class="material-symbols-outlined text-[18px] text-slate-400">schedule</span>
                        10 min
                    </div>
                </td>
                <td class="px-6 py-4">
                    <span class="text-xs text-slate-500">—</span>
                </td>
                <td class="px-6 py-4">
                    <div class="relative inline-block w-10 mr-2 align-middle select-none">
                        <input type="checkbox" 
                            ${isActive ? 'checked' : ''}
                            class="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-2 border-slate-300 appearance-none cursor-pointer transition-all duration-300 checked:right-0 checked:border-primary"
                            id="toggle-${service.id}"
                            data-field="isActive"
                            data-id="${service.id}">
                        <label class="toggle-label block overflow-hidden h-5 rounded-full bg-slate-200 dark:bg-slate-700 cursor-pointer transition-colors duration-300"
                            for="toggle-${service.id}"></label>
                    </div>
                </td>
                <td class="px-6 py-4 text-right">
                    <button class="btn-save inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-primary text-white rounded hover:bg-primary-hover transition-colors"
                        data-id="${service.id}">
                        <span class="material-symbols-outlined text-[16px]">save</span>
                        Guardar
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    // Add event handlers
    servicesTbody.querySelectorAll('.btn-save').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const target = e.currentTarget as HTMLElement;
            const id = target.dataset.id!;
            await saveService(id);
        });
    });
}

// Save a service
async function saveService(serviceId: string): Promise<void> {
    const row = servicesTbody?.querySelector(`[data-service-id="${serviceId}"]`);
    if (!row) return;

    const nameInput = row.querySelector('[data-field="name"]') as HTMLInputElement;
    const activeInput = row.querySelector('[data-field="isActive"]') as HTMLInputElement;

    const updatedService = {
        id: serviceId,
        name: nameInput?.value || '',
        prefix: serviceId,
        isActive: activeInput?.checked ?? true
    };

    if (USE_API) {
        try {
            await updateService(serviceId, updatedService);

            // Update local state
            const index = services.findIndex(s => s.id === serviceId);
            if (index >= 0) {
                services[index] = { ...services[index], ...updatedService };
            }

            showToast('Servicio actualizado');
            renderServices();
        } catch (err) {
            console.error('Error updating service:', err);
            showToast('Error al guardar', true);
        }
    } else {
        // Mock mode - just update local state
        const index = services.findIndex(s => s.id === serviceId);
        if (index >= 0) {
            services[index] = { ...services[index], ...updatedService };
        }
        showToast('Guardado (modo demo)');
        renderServices();
    }
}

// Load services
async function loadServices(): Promise<void> {
    if (!servicesTbody) return;

    servicesTbody.innerHTML = `
        <tr>
            <td colspan="6" class="px-6 py-12 text-center text-slate-500">
                <span class="material-symbols-outlined text-4xl mb-2 animate-spin">progress_activity</span>
                <p class="text-sm">Cargando servicios...</p>
            </td>
        </tr>
    `;

    if (USE_API) {
        try {
            services = await getServices();
            renderServices();
        } catch (err) {
            console.error('Error loading services:', err);
            servicesTbody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-12 text-center text-red-500">
                        <span class="material-symbols-outlined text-4xl mb-2">error</span>
                        <p class="text-sm">Error al cargar servicios</p>
                        <button onclick="location.reload()" class="mt-2 px-4 py-2 bg-primary text-white rounded text-sm">Reintentar</button>
                    </td>
                </tr>
            `;
        }
    } else {
        // Mock mode - use default services
        services = [
            { id: 'A', name: 'Admisión', prefix: 'A', isActive: true },
            { id: 'E', name: 'Extracciones', prefix: 'E', isActive: true },
            { id: 'C', name: 'Consulta General', prefix: 'C', isActive: true },
            { id: 'V', name: 'Vacunación', prefix: 'V', isActive: true }
        ];
        renderServices();
    }
}

// Initialize
loadServices();
