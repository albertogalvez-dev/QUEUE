/**
 * Turno page - Ticket lookup by code or DNI
 * Supports QR simulation via query params
 * Dual mode: API or Mock based on VITE_USE_API
 */
import { go } from '../lib/nav';
import { USE_API } from '../lib/config';
import {
    getTicketByCode as mockGetTicketByCode,
    getActiveTicketByDoc as mockGetActiveTicketByDoc,
    normalizeTicketCode,
    isValidTicketCode,
    getQueuePosition as mockGetQueuePosition,
    initDemoStateIfNeeded,
    type Ticket,
    type TriageLevel
} from '../lib/mockStore';
import {
    getTicketByCode as apiGetTicketByCode,
    getActiveTicketByDoc as apiGetActiveTicketByDoc,
    getQueue as apiGetQueue
} from '../lib/apiClient';
import type { TicketDto } from '../lib/apiTypes';
import { startStoreSync } from '../lib/storeSync';

console.log('page: turno');

// Ensure demo state exists (for mock mode)
initDemoStateIfNeeded();

// Elements
const turnoForm = document.getElementById('turno-form') as HTMLFormElement;
const inputTicket = document.getElementById('input-ticket') as HTMLInputElement;
const inputHint = document.getElementById('input-hint');
const turnoTabs = document.getElementById('turno-tabs');
const turnoError = document.getElementById('turno-error');
const turnoErrorText = document.getElementById('turno-error-text');
const turnoCard = document.getElementById('turno-card');
const btnConsultar = document.getElementById('btn-consultar');
const btnActualizar = document.getElementById('btn-actualizar');

// Result elements
const turnoStatusHeader = document.getElementById('turno-status-header');
const turnoCodigo = document.getElementById('turno-codigo');
const turnoEstado = document.getElementById('turno-estado');
const turnoEstadoDesc = document.getElementById('turno-estado-desc');
const turnoServicio = document.getElementById('turno-servicio');
const turnoPuestoContainer = document.getElementById('turno-puesto-container');
const turnoPuesto = document.getElementById('turno-puesto');
const turnoTriajeContainer = document.getElementById('turno-triaje-container');
const turnoTriaje = document.getElementById('turno-triaje');
const turnoPreferente = document.getElementById('turno-preferente');
const turnoPosicionContainer = document.getElementById('turno-posicion-container');
const turnoPosicion = document.getElementById('turno-posicion');

// State
let currentTab: 'ticket' | 'dni' = 'ticket';
let lastQuery: { type: 'ticket' | 'dni'; value: string } | null = null;
let refreshInterval: number | null = null;
let isLoading = false;

// Unified ticket interface for rendering
interface TurnoTicket {
    id: string;
    code: string;
    serviceId: string;
    serviceName: string;
    status: string;
    triage: TriageLevel | null;
    preferente: boolean;
    counterName: string | null;
}

// Triage colors
const triageConfig: Record<TriageLevel, { bg: string; text: string; label: string }> = {
    RED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Inmediato' },
    ORANGE: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Muy urgente' },
    YELLOW: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Urgente' },
    GREEN: { bg: 'bg-green-100', text: 'text-green-700', label: 'Normal' },
    BLUE: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'No urgente' },
};

// Status colors
const statusConfig: Record<string, { bg: string; icon: string; label: string; desc: string }> = {
    Waiting: { bg: 'bg-yellow-500', icon: 'schedule', label: 'En espera', desc: 'Espere a ser llamado en pantalla' },
    Called: { bg: 'bg-primary', icon: 'campaign', label: 'Llamado', desc: 'Acuda al puesto indicado' },
    Serving: { bg: 'bg-blue-500', icon: 'person', label: 'En atención', desc: 'Está siendo atendido' },
    Done: { bg: 'bg-gray-500', icon: 'check_circle', label: 'Finalizado', desc: 'Atención completada' },
    NoShow: { bg: 'bg-red-500', icon: 'person_off', label: 'No presentado', desc: 'No se presentó a la cita' },
};

// Tab switching
turnoTabs?.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab') as 'ticket' | 'dni';
        if (tab) switchTab(tab);
    });
});

function switchTab(tab: 'ticket' | 'dni'): void {
    currentTab = tab;

    // Update tab appearance
    turnoTabs?.querySelectorAll('button').forEach(btn => {
        const isActive = btn.getAttribute('data-tab') === tab;
        btn.className = isActive
            ? 'flex-1 py-2.5 text-sm font-bold rounded-lg bg-white dark:bg-slate-700 text-primary dark:text-primary shadow-sm ring-1 ring-black/5 dark:ring-white/5 transition-all text-center'
            : 'flex-1 py-2.5 text-sm font-semibold rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors text-center';
    });

    // Update input placeholder & hint
    if (inputTicket) {
        inputTicket.placeholder = tab === 'ticket' ? 'A-023' : '12345678A';
        inputTicket.value = '';
    }
    if (inputHint) {
        inputHint.textContent = tab === 'ticket'
            ? 'Ejemplo: A-023, E-001, C-010'
            : 'Introduce tu DNI para buscar turnos activos';
    }

    // Hide results
    hideResults();
}

function hideResults(): void {
    turnoError?.classList.add('hidden');
    turnoCard?.classList.add('hidden');
    btnActualizar?.classList.add('hidden');
    clearRefreshInterval();
}

function showError(message: string): void {
    hideResults();
    if (turnoErrorText) turnoErrorText.textContent = message;
    turnoError?.classList.remove('hidden');
}

function showLoading(): void {
    if (btnConsultar) {
        btnConsultar.textContent = 'Buscando...';
        btnConsultar.setAttribute('disabled', 'true');
    }
    isLoading = true;
}

function hideLoading(): void {
    if (btnConsultar) {
        btnConsultar.textContent = 'Consultar';
        btnConsultar.removeAttribute('disabled');
    }
    isLoading = false;
}

function clearRefreshInterval(): void {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}

function updateURL(code: string): void {
    const url = new URL(window.location.href);
    url.searchParams.set('ticket', code);
    history.replaceState(null, '', url.toString());
}

// Convert API TicketDto to unified TurnoTicket
function apiToTurnoTicket(dto: TicketDto): TurnoTicket {
    return {
        id: dto.id,
        code: dto.code,
        serviceId: dto.serviceId,
        serviceName: dto.serviceName,
        status: dto.status,
        triage: dto.triage as TriageLevel | null,
        preferente: dto.preferente,
        counterName: dto.counterName
    };
}

// Convert Mock Ticket to unified TurnoTicket
function mockToTurnoTicket(t: Ticket): TurnoTicket {
    return {
        id: t.id,
        code: t.code,
        serviceId: t.serviceId,
        serviceName: t.serviceName,
        status: t.status,
        triage: t.triage,
        preferente: t.preferente,
        counterName: t.counterName
    };
}

// Calculate position in queue (API mode)
async function calculatePositionApi(ticket: TurnoTicket): Promise<number> {
    if (ticket.status !== 'Waiting') return 0;

    try {
        const queue = await apiGetQueue(ticket.serviceId);
        const waitingTickets = queue.filter(t => t.status === 'Waiting');
        const index = waitingTickets.findIndex(t => t.id === ticket.id);
        return index >= 0 ? index + 1 : waitingTickets.length + 1;
    } catch {
        return 0;
    }
}

// Main lookup function
async function lookupTicket(): Promise<void> {
    if (isLoading) return;

    const value = inputTicket?.value.trim() || '';

    if (!value) {
        showError('Por favor, introduce un número de turno o DNI.');
        return;
    }

    showLoading();
    let ticket: TurnoTicket | null = null;
    let position = 0;

    try {
        if (USE_API) {
            // API Mode
            if (currentTab === 'ticket') {
                const code = normalizeTicketCode(value);

                if (!isValidTicketCode(code)) {
                    showError('Formato de turno no válido. Ejemplo: A-023');
                    hideLoading();
                    return;
                }

                try {
                    const dto = await apiGetTicketByCode(code);
                    ticket = apiToTurnoTicket(dto);
                } catch {
                    ticket = null;
                }
                lastQuery = { type: 'ticket', value: code };
            } else {
                const dto = await apiGetActiveTicketByDoc(value);
                ticket = dto ? apiToTurnoTicket(dto) : null;
                lastQuery = { type: 'dni', value: value.toUpperCase() };
            }

            if (ticket) {
                position = await calculatePositionApi(ticket);
            }
        } else {
            // Mock Mode
            if (currentTab === 'ticket') {
                const code = normalizeTicketCode(value);

                if (!isValidTicketCode(code)) {
                    showError('Formato de turno no válido. Ejemplo: A-023');
                    hideLoading();
                    return;
                }

                const mockTicket = mockGetTicketByCode(code);
                ticket = mockTicket ? mockToTurnoTicket(mockTicket) : null;
                if (mockTicket) position = mockGetQueuePosition(mockTicket.id);
                lastQuery = { type: 'ticket', value: code };
            } else {
                const mockTicket = mockGetActiveTicketByDoc(value);
                ticket = mockTicket ? mockToTurnoTicket(mockTicket) : null;
                if (mockTicket) position = mockGetQueuePosition(mockTicket.id);
                lastQuery = { type: 'dni', value: value.toUpperCase() };
            }
        }

        if (!ticket) {
            showError('No se encuentra un turno activo con esos datos.');
            hideLoading();
            return;
        }

        renderTicket(ticket, position);
        updateURL(ticket.code);
        startRefreshInterval();
    } catch (err) {
        console.error('Error looking up ticket:', err);
        showError('Error de conexión. Pulse actualizar para reintentar.');
    } finally {
        hideLoading();
    }
}

function renderTicket(ticket: TurnoTicket, position: number): void {
    hideResults();

    const status = statusConfig[ticket.status] || statusConfig.Waiting;

    // Update header color
    if (turnoStatusHeader) {
        turnoStatusHeader.className = `${status.bg} text-white px-6 py-4`;
    }

    // Update main fields
    if (turnoCodigo) turnoCodigo.textContent = ticket.code;
    if (turnoEstado) turnoEstado.textContent = status.label;
    if (turnoEstadoDesc) turnoEstadoDesc.textContent = status.desc;
    if (turnoServicio) turnoServicio.textContent = ticket.serviceName;

    // Show/hide puesto
    if (ticket.status === 'Called' || ticket.status === 'Serving') {
        turnoPuestoContainer?.classList.remove('hidden');
        turnoPuestoContainer?.classList.add('flex');
        if (turnoPuesto) turnoPuesto.textContent = ticket.counterName || 'Puesto';
        if (turnoEstadoDesc && ticket.status === 'Called') {
            turnoEstadoDesc.textContent = `Acuda a ${ticket.counterName || 'puesto indicado'}`;
        }
    } else {
        turnoPuestoContainer?.classList.add('hidden');
        turnoPuestoContainer?.classList.remove('flex');
    }

    // Show triage if exists
    if (ticket.triage) {
        turnoTriajeContainer?.classList.remove('hidden');
        turnoTriajeContainer?.classList.add('flex');
        const triage = triageConfig[ticket.triage];
        if (turnoTriaje && triage) {
            turnoTriaje.textContent = triage.label;
            turnoTriaje.className = `inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${triage.bg} ${triage.text} border border-current/20`;
        }
        if (turnoPreferente) {
            turnoPreferente.classList.toggle('hidden', !ticket.preferente);
        }
    } else {
        turnoTriajeContainer?.classList.add('hidden');
        turnoTriajeContainer?.classList.remove('flex');
    }

    // Show position if waiting
    if (ticket.status === 'Waiting' && position > 0) {
        turnoPosicionContainer?.classList.remove('hidden');
        turnoPosicionContainer?.classList.add('flex');
        if (turnoPosicion) turnoPosicion.textContent = String(position);
    } else {
        turnoPosicionContainer?.classList.add('hidden');
        turnoPosicionContainer?.classList.remove('flex');
    }

    // Show card and refresh button
    turnoCard?.classList.remove('hidden');
    btnActualizar?.classList.remove('hidden');
}

function startRefreshInterval(): void {
    clearRefreshInterval();

    refreshInterval = window.setInterval(() => {
        refreshCurrentLookup();
    }, 10000);
}

// Manual refresh
async function refreshCurrentLookup(): Promise<void> {
    if (!lastQuery || isLoading) return;

    let ticket: TurnoTicket | null = null;
    let position = 0;

    try {
        if (USE_API) {
            if (lastQuery.type === 'ticket') {
                try {
                    const dto = await apiGetTicketByCode(lastQuery.value);
                    ticket = apiToTurnoTicket(dto);
                } catch {
                    ticket = null;
                }
            } else {
                const dto = await apiGetActiveTicketByDoc(lastQuery.value);
                ticket = dto ? apiToTurnoTicket(dto) : null;
            }
            if (ticket) {
                position = await calculatePositionApi(ticket);
            }
        } else {
            if (lastQuery.type === 'ticket') {
                const mockTicket = mockGetTicketByCode(lastQuery.value);
                ticket = mockTicket ? mockToTurnoTicket(mockTicket) : null;
                if (mockTicket) position = mockGetQueuePosition(mockTicket.id);
            } else {
                const mockTicket = mockGetActiveTicketByDoc(lastQuery.value);
                ticket = mockTicket ? mockToTurnoTicket(mockTicket) : null;
                if (mockTicket) position = mockGetQueuePosition(mockTicket.id);
            }
        }

        if (ticket) {
            renderTicket(ticket, position);
        }
    } catch (err) {
        console.error('Error refreshing ticket:', err);
    }
}

// Event handlers
btnConsultar?.addEventListener('click', (e) => {
    e.preventDefault();
    lookupTicket();
});

turnoForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    lookupTicket();
});

btnActualizar?.addEventListener('click', () => {
    lookupTicket();
});

// Parse query params on load
async function initFromQueryParams(): Promise<void> {
    const params = new URLSearchParams(window.location.search);
    const ticketCode = params.get('ticket');
    const docValue = params.get('doc');

    if (ticketCode) {
        switchTab('ticket');
        if (inputTicket) inputTicket.value = ticketCode;
        await lookupTicket();
    } else if (docValue) {
        switchTab('dni');
        if (inputTicket) inputTicket.value = docValue;
        await lookupTicket();
    }
}

// Initialize
initFromQueryParams();

// Cross-tab sync for instant updates (mock mode only)
if (!USE_API) {
    startStoreSync(() => refreshCurrentLookup());
}
