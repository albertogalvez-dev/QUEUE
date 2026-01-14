/**
 * Admin Puestos page - Dynamic counter management
 * Dual mode: API or Mock based on VITE_USE_API
 */
import { wireAllNav } from '../lib/wireNav';
import { USE_API } from '../lib/config';
import { getServices, getCounters, updateCounter } from '../lib/apiClient';
import { serviceLabel } from '../lib/mappers';
import type { ServiceDto, CounterDto } from '../lib/apiTypes';

console.log('page: admin-puestos');

// Wire navigation
wireAllNav();

// Elements
const countersGrid = document.getElementById('counters-grid');

// State
let services: ServiceDto[] = [];
let counters: CounterDto[] = [];

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

// Get service options HTML
function getServiceOptions(selectedId: string): string {
    const defaultServices = ['A', 'E', 'C', 'V'];
    const options = services.length > 0 ? services : defaultServices.map(id => ({ id, name: serviceLabel(id), isActive: true, prefix: id }));

    return options.map(s => `
        <option value="${s.id}" ${s.id === selectedId ? 'selected' : ''}>
            ${s.name || serviceLabel(s.id)}
        </option>
    `).join('');
}

// Render counters grid
function renderCounters(): void {
    if (!countersGrid) return;

    if (counters.length === 0) {
        countersGrid.innerHTML = `
            <div class="col-span-full text-center py-12 text-slate-500">
                <span class="material-symbols-outlined text-4xl mb-2">inbox</span>
                <p class="text-sm">No hay puestos configurados</p>
            </div>
        `;
        return;
    }

    countersGrid.innerHTML = counters.map(counter => {
        const isActive = counter.isActive !== false;
        const borderColor = isActive ? 'bg-emerald-500' : 'bg-slate-300';
        const statusClass = isActive
            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700';

        return `
            <div class="group relative bg-surface-light dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-primary/30 shadow-sm hover:shadow-md transition-all" data-counter-id="${counter.id}">
                <div class="absolute top-0 bottom-0 left-0 w-1.5 ${borderColor}"></div>
                <div class="p-5 flex flex-col h-full">
                    <div class="flex justify-between items-start mb-4">
                        <div class="flex-1">
                            <div class="flex items-center gap-2 mb-1">
                                <input type="text" 
                                    class="text-lg font-bold text-slate-900 dark:text-white bg-transparent border-0 p-0 focus:ring-0 w-full"
                                    value="${counter.name}"
                                    data-field="name"
                                    data-id="${counter.id}">
                            </div>
                            <div class="flex items-center gap-2">
                                <select class="text-sm text-slate-500 dark:text-slate-400 bg-transparent border-0 p-0 focus:ring-0 cursor-pointer"
                                    data-field="serviceId"
                                    data-id="${counter.id}">
                                    ${getServiceOptions(counter.serviceId)}
                                </select>
                            </div>
                        </div>
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusClass} border">
                            ${isActive ? 'Activo' : 'Inactivo'}
                        </span>
                    </div>
                    <div class="mt-auto space-y-3">
                        <div class="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                            <span class="text-xs text-slate-500">ID: ${counter.id}</span>
                            <label class="flex items-center gap-2 ml-auto cursor-pointer">
                                <input type="checkbox" 
                                    ${isActive ? 'checked' : ''}
                                    class="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                                    data-field="isActive"
                                    data-id="${counter.id}">
                                <span class="text-xs text-slate-500">Activo</span>
                            </label>
                        </div>
                        <button class="btn-save w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm font-medium"
                            data-id="${counter.id}">
                            <span class="material-symbols-outlined text-[18px]">save</span>
                            Guardar
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Add event handlers
    countersGrid.querySelectorAll('.btn-save').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const target = e.currentTarget as HTMLElement;
            const id = target.dataset.id!;
            await saveCounter(id);
        });
    });
}

// Save a counter
async function saveCounter(counterId: string): Promise<void> {
    const card = countersGrid?.querySelector(`[data-counter-id="${counterId}"]`);
    if (!card) return;

    const nameInput = card.querySelector('[data-field="name"]') as HTMLInputElement;
    const serviceSelect = card.querySelector('[data-field="serviceId"]') as HTMLSelectElement;
    const activeInput = card.querySelector('[data-field="isActive"]') as HTMLInputElement;

    const updatedCounter: CounterDto = {
        id: counterId,
        name: nameInput?.value || '',
        serviceId: serviceSelect?.value || 'A',
        isActive: activeInput?.checked ?? true
    };

    if (USE_API) {
        try {
            await updateCounter(counterId, updatedCounter);

            // Update local state
            const index = counters.findIndex(c => c.id === counterId);
            if (index >= 0) {
                counters[index] = { ...counters[index], ...updatedCounter };
            }

            showToast('Puesto actualizado');
            renderCounters();
        } catch (err) {
            console.error('Error updating counter:', err);
            showToast('Error al guardar', true);
        }
    } else {
        // Mock mode - just update local state
        const index = counters.findIndex(c => c.id === counterId);
        if (index >= 0) {
            counters[index] = { ...counters[index], ...updatedCounter };
        }
        showToast('Guardado (modo demo)');
        renderCounters();
    }
}

// Load data
async function loadData(): Promise<void> {
    if (!countersGrid) return;

    countersGrid.innerHTML = `
        <div class="col-span-full text-center py-12 text-slate-500">
            <span class="material-symbols-outlined text-4xl mb-2 animate-spin">progress_activity</span>
            <p class="text-sm">Cargando puestos...</p>
        </div>
    `;

    if (USE_API) {
        try {
            // Load services first (for dropdown)
            services = await getServices();
            // Load counters
            counters = await getCounters();
            renderCounters();
        } catch (err) {
            console.error('Error loading data:', err);
            countersGrid.innerHTML = `
                <div class="col-span-full text-center py-12 text-red-500">
                    <span class="material-symbols-outlined text-4xl mb-2">error</span>
                    <p class="text-sm">Error al cargar puestos</p>
                    <button onclick="location.reload()" class="mt-2 px-4 py-2 bg-primary text-white rounded text-sm">Reintentar</button>
                </div>
            `;
        }
    } else {
        // Mock mode - use default data
        services = [
            { id: 'A', name: 'Admisión', prefix: 'A', isActive: true },
            { id: 'E', name: 'Extracciones', prefix: 'E', isActive: true },
            { id: 'C', name: 'Consulta General', prefix: 'C', isActive: true },
            { id: 'V', name: 'Vacunación', prefix: 'V', isActive: true }
        ];
        counters = [
            { id: 'adm1', name: 'Ventanilla 1', serviceId: 'A', isActive: true },
            { id: 'adm2', name: 'Ventanilla 2', serviceId: 'A', isActive: true },
            { id: 'ext1', name: 'Box 1', serviceId: 'E', isActive: true },
            { id: 'con1', name: 'Consulta 1', serviceId: 'C', isActive: true },
            { id: 'vac1', name: 'Sala 1', serviceId: 'V', isActive: true }
        ];
        renderCounters();
    }
}

// Initialize
loadData();
