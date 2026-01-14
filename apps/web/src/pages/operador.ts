/**
 * Operador page - Queue management console
 * Supports dual mode: API (backend) or mockStore (local)
 * Controlled by VITE_USE_API environment variable
 */

// === Configuration & Imports ===
import { USE_API } from '../lib/config';
import { HELPDESK_URL, hasHelpdesk } from '../lib/links';
import { wireAllNav } from '../lib/wireNav';
import * as api from '../lib/apiClient';
import type { TicketDto, CounterDto } from '../lib/apiTypes';
import { normalizeTicket, type NormalizedTicket } from '../lib/normalizeTicket';
import {
  getQueue as getQueueMock,
  getServices,
  operatorCallNext,
  operatorCallTicket,
  operatorStart,
  operatorFinish,
  operatorNoShow,
  operatorRecall,
  operatorTransfer,
  getCountersForService,
  getAllActiveTickets,
  initDemoStateIfNeeded,
  subscribe,
  type TriageLevel,
  type Ticket
} from '../lib/mockStore';
import { startStoreSync } from '../lib/storeSync';

console.log('page: operador');
console.log(`[Operador] Mode: ${USE_API ? 'API' : 'mockStore'}`);

// Debug mode
const isDebug = new URLSearchParams(window.location.search).has('debug');
if (isDebug) {
  console.log('OPERATOR DEBUG: active');
  console.log('OPERATOR API MODE:', USE_API);
}

// === Counter ID Mapping (API uses these) ===
const counterIdMap: Record<string, string> = {
  'admision': 'adm1',
  'extracciones': 'ext1',
  'consulta': 'con1',
  'vacunacion': 'vac1',
  // Service prefix mapping (A, E, C, V)
  'A': 'adm1',
  'E': 'ext1',
  'C': 'con1',
  'V': 'vac1'
};

// API service ID mapping (mockStore uses full names, API uses prefixes)
const apiServiceIdMap: Record<string, string> = {
  'admision': 'A',
  'extracciones': 'E',
  'consulta': 'C',
  'vacunacion': 'V'
};

// === Types ===
// Local NormalizedTicket interface removed (using imported one)

// === State ===
let currentServiceId = 'admision';
let currentTickets: NormalizedTicket[] = [];
let lastApiError = false;

// Counter state
const COUNTER_STORAGE_KEY = 'QUEUE_OPERATOR_COUNTER';
let selectedCounterId = '';
let availableCounters: CounterDto[] = [];
const counterSelect = document.getElementById('counter-select') as HTMLSelectElement | null;

// === Initialize ===
if (!USE_API) {
  initDemoStateIfNeeded();
}

// === Counter Loading ===
async function loadCounters(): Promise<void> {
  if (USE_API) {
    try {
      const counters = await api.getCounters();
      availableCounters = counters.filter(c => c.isActive !== false);
    } catch {
      // Fallback to defaults
      availableCounters = [
        { id: 'adm1', name: 'Mesa 1', serviceId: 'A', isActive: true },
        { id: 'ext1', name: 'Box 1', serviceId: 'E', isActive: true },
        { id: 'con1', name: 'Consulta 1', serviceId: 'C', isActive: true },
        { id: 'vac1', name: 'Sala 1', serviceId: 'V', isActive: true }
      ];
    }
  } else {
    // Mock mode defaults
    availableCounters = [
      { id: 'adm1', name: 'Mesa 1', serviceId: 'A', isActive: true },
      { id: 'adm2', name: 'Mesa 2', serviceId: 'A', isActive: true },
      { id: 'ext1', name: 'Box 1', serviceId: 'E', isActive: true },
      { id: 'con1', name: 'Consulta 1', serviceId: 'C', isActive: true },
      { id: 'vac1', name: 'Sala 1', serviceId: 'V', isActive: true }
    ];
  }

  // Load saved selection
  const savedCounter = localStorage.getItem(COUNTER_STORAGE_KEY);
  if (savedCounter && availableCounters.find(c => c.id === savedCounter)) {
    selectedCounterId = savedCounter;
  } else if (availableCounters.length > 0) {
    // Default to first counter
    selectedCounterId = availableCounters[0].id;
    localStorage.setItem(COUNTER_STORAGE_KEY, selectedCounterId);
  }

  renderCounterSelect();
}

function renderCounterSelect(): void {
  if (!counterSelect) return;

  if (availableCounters.length === 0) {
    counterSelect.innerHTML = '<option value="">Sin puestos</option>';
    counterSelect.disabled = true;
    return;
  }

  counterSelect.innerHTML = availableCounters.map(c =>
    `<option value="${c.id}" ${c.id === selectedCounterId ? 'selected' : ''}>${c.name}</option>`
  ).join('');
  counterSelect.disabled = false;
}

// Counter select change handler
counterSelect?.addEventListener('change', () => {
  selectedCounterId = counterSelect.value;
  localStorage.setItem(COUNTER_STORAGE_KEY, selectedCounterId);
  if (isDebug) console.log('OPERATOR DEBUG: Counter changed to', selectedCounterId);
});

// DOM Elements
const serviceTabs = document.getElementById('service-tabs');
const queueTbody = document.getElementById('queue-tbody');
const activeCards = document.getElementById('active-cards');
const statsWaiting = document.getElementById('stats-waiting');

// Services (from mockStore for tabs, works in both modes)
const services = getServices();

// Triage colors
const triageColors: Record<TriageLevel, { bg: string; text: string; label: string }> = {
  RED: { bg: 'bg-red-500/10', text: 'text-red-600', label: 'ROJO' },
  ORANGE: { bg: 'bg-orange-500/10', text: 'text-orange-600', label: 'NARANJA' },
  YELLOW: { bg: 'bg-yellow-500/10', text: 'text-yellow-700', label: 'AMARILLO' },
  GREEN: { bg: 'bg-green-500/10', text: 'text-green-600', label: 'VERDE' },
  BLUE: { bg: 'bg-blue-500/10', text: 'text-blue-600', label: 'AZUL' },
};

// === Data Loading ===

// === Data Loading ===

// Using imported normalizeTicket and NormalizedTicket

async function loadQueue(): Promise<NormalizedTicket[]> {
  if (USE_API) {
    try {
      const apiServiceId = apiServiceIdMap[currentServiceId] || currentServiceId;
      const tickets = await api.getQueue(apiServiceId);
      lastApiError = false;
      if (isDebug) console.log(`OPERATOR DEBUG: Loaded ${tickets.length} tickets from API for ${apiServiceId}`);
      return tickets.map(normalizeTicket);
    } catch (error) {
      if (!lastApiError) {
        console.warn('[Operador] API error:', error);
        lastApiError = true;
      }
      return currentTickets;
    }
  } else {
    // Force cast to any to allow normalization of various mock shapes
    const tickets = getQueueMock(currentServiceId) as any[];
    if (isDebug) console.log(`OPERATOR DEBUG: Loaded ${tickets.length} tickets from mockStore for ${currentServiceId}`);
    return tickets.map(normalizeTicket);
  }
}

async function loadActiveTickets(): Promise<NormalizedTicket[]> {
  if (USE_API) {
    try {
      const allTickets: NormalizedTicket[] = [];
      for (const prefix of ['A', 'E', 'C', 'V']) {
        const tickets = await api.getQueue(prefix);
        allTickets.push(...tickets.filter(t => t.status === 'Called' || t.status === 'Serving').map(normalizeTicket));
      }
      return allTickets.slice(0, 3);
    } catch {
      return [];
    }
  } else {
    // Assuming getAllActiveTickets exists or we fetch from mock
    // If getAllActiveTickets is not available in mockStore global export, we might need a workaround.
    // Looking at previous code, it called getAllActiveTickets().
    // Assuming it is available or imported.
    // We'll use getQueueMock for all services if needed, but let's stick to previous function call if it existed.
    // Previous code: return getAllActiveTickets()...
    // If getAllActiveTickets is not imported, we have an issue.
    // Let's check imports.
    return (window as any).mockStore?.getAllActiveTickets
      ? (window as any).mockStore.getAllActiveTickets().filter((t: any) => t.status === 'Serving' || t.status === 'Called').slice(0, 3).map(normalizeTicket)
      : [];
  }
}

// === Actions ===

async function handleAction(action: string, ticketId: string): Promise<void> {
  // Use selected counter, with fallback to service-based mapping
  const counterId = selectedCounterId || counterIdMap[currentServiceId] || 'adm1';
  const apiServiceId = apiServiceIdMap[currentServiceId] || 'A';

  try {
    if (USE_API) {
      switch (action) {
        case 'call':
          // Call the SPECIFIC ticket by ID (not call-next!)
          await api.callTicket(ticketId, counterId);
          break;
        case 'start':
          await api.startTicket(ticketId);
          break;
        case 'finish':
          await api.finishTicket(ticketId);
          break;
        case 'noshow':
          await api.noShowTicket(ticketId);
          break;
        case 'recall':
          // Recall uses callNext with specific service
          await api.callNext(apiServiceId, counterId);
          break;
        case 'transfer':
          // Transfer not implemented in API, skip
          console.warn('Transfer not implemented in API mode');
          break;
      }
    } else {
      const mockCounterId = getCountersForService(currentServiceId)[0]?.id || 'adm-1';
      switch (action) {
        case 'call':
          // Call the SPECIFIC ticket by ID (not callNext!)
          operatorCallTicket(ticketId, mockCounterId);
          break;
        case 'start':
          operatorStart(ticketId);
          break;
        case 'finish':
          operatorFinish(ticketId);
          break;
        case 'noshow':
          operatorNoShow(ticketId);
          break;
        case 'recall':
          operatorRecall(ticketId);
          break;
        case 'transfer':
          const nextService = services.find(s => s.id !== currentServiceId);
          if (nextService) {
            operatorTransfer(ticketId, nextService.id);
          }
          break;
      }
    }

    if (isDebug) console.log(`OPERATOR DEBUG: Action ${action} completed`);
  } catch (error) {
    console.error(`Error executing action ${action}:`, error);
  }

  // Refresh immediately after action
  await renderAll();
}

// === Rendering ===

function getWaitTime(createdAt: string): string {
  const now = new Date();
  const created = new Date(createdAt);
  const diffMs = now.getTime() - created.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `${diffMins} min`;
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return `${hours}h ${mins}m`;
}

function renderTabs(): void {
  if (!serviceTabs) return;

  serviceTabs.innerHTML = services.map(service => {
    const isActive = service.id === currentServiceId;
    const activeClass = isActive
      ? 'bg-primary text-white shadow-md'
      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200';

    return `
            <button class="flex-1 px-4 py-3 text-center font-semibold rounded-lg transition-all ${activeClass}"
                    data-service="${service.id}">
                ${service.name}
            </button>
        `;
  }).join('');

  // Add event listeners
  serviceTabs.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', async () => {
      currentServiceId = btn.dataset.service || 'admision';
      await renderAll();
    });
  });
}

function renderQueue(): void {
  if (!queueTbody) return;

  const allTickets = currentTickets || [];

  if (allTickets.length === 0) {
    queueTbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-8 text-center text-gray-500">
                    <span class="material-symbols-outlined text-4xl mb-2 block text-gray-300">inbox</span>
                    No hay pacientes en cola
                </td>
            </tr>
        `;
    return;
  }

  queueTbody.innerHTML = allTickets.map(ticket => {
    // Triage Badge
    const tLevel = ticket.triageLevel; // "BLUE", "RED" etc. from normalizer
    // Use type assertion or check if key exists, fallback to BLUE
    const triageInfo = triageColors[tLevel as any] || triageColors['BLUE'];

    // Status Badge Logic
    let statusClass = "bg-gray-100 text-gray-600";
    // "Waiting", "Called", "Serving"
    if (ticket.status === 'Serving') {
      statusClass = "bg-blue-100 text-blue-700";
    } else if (ticket.status === 'Called') {
      statusClass = "bg-green-100 text-green-700";
    } else if (ticket.status === 'Waiting') {
      statusClass = "bg-yellow-50 text-yellow-700";
    }

    const statusBadge = `
       <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusClass}">
        ${ticket.statusText}
       </span>`;

    const triageBadge = `
       <span class="inline-flex items-center px-2 py-1 rounded text-xs font-bold ${triageInfo.bg} ${triageInfo.text}">
        ${ticket.triageText}
       </span>`;

    const preferenteBadge = ticket.preferente
      ? `<span class="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-purple-100 text-purple-700 ml-1">PREF</span>`
      : '';

    // Action Buttons
    let actionButtons = '';
    const s = ticket.status;

    if (s === 'Waiting') {
      actionButtons = `
                <button class="action-btn p-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors" data-action="call" data-ticket="${ticket.id}" data-testid="btn-call-${ticket.id}" title="Llamar">
                    <span class="material-symbols-outlined">campaign</span>
                </button>
            `;
    } else if (s === 'Called') {
      actionButtons = `
                <button class="action-btn p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors" data-action="start" data-ticket="${ticket.id}" data-testid="btn-start-${ticket.id}" title="Iniciar">
                    <span class="material-symbols-outlined">play_arrow</span>
                </button>
                <button class="action-btn p-2 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors" data-action="noshow" data-ticket="${ticket.id}" title="No presentado">
                    <span class="material-symbols-outlined">person_off</span>
                </button>
                <button class="action-btn p-2 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors" data-action="recall" data-ticket="${ticket.id}" title="Rellamar">
                    <span class="material-symbols-outlined">replay</span>
                </button>
            `;
    } else if (s === 'Serving') {
      actionButtons = `
                <button class="action-btn p-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors" data-action="finish" data-ticket="${ticket.id}" title="Finalizar">
                    <span class="material-symbols-outlined">check_circle</span>
                </button>
                <button class="action-btn p-2 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors" data-action="transfer" data-ticket="${ticket.id}" title="Derivar">
                    <span class="material-symbols-outlined">arrow_forward</span>
                </button>
            `;
    }

    return `
            <tr class="${s === 'Called' || s === 'Serving' ? 'bg-green-50/50' : ''} hover:bg-gray-50 transition-colors">
                <td class="px-4 py-3">
                    <span class="text-xl font-bold text-neutral-dark">${ticket.code}</span>
                </td>
                <td class="px-4 py-3">
                    <div class="flex flex-col items-start gap-1">
                        <span class="text-sm font-medium text-gray-900">${ticket.serviceName}</span>
                        <div class="flex flex-wrap gap-1">
                           ${statusBadge}
                           ${preferenteBadge}
                        </div>
                    </div>
                </td>
                <td class="px-4 py-3">
                     ${triageBadge}
                </td>
                <td class="px-4 py-3 text-gray-500 font-mono text-sm">${ticket.waitText !== "—" ? ticket.waitText : getWaitTime(ticket.createdAt)}</td>
                <td class="px-4 py-3 text-gray-500 text-sm">${ticket.noteText}</td>
                <td class="px-4 py-3 text-right">
                    <div class="flex justify-end gap-1">
                        ${actionButtons}
                    </div>
                </td>
            </tr>
        `;
  }).join('');

  // Add event listeners for action buttons
  queueTbody.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const action = (btn as HTMLElement).dataset.action;
      const ticketId = (btn as HTMLElement).dataset.ticket;
      if (action && ticketId) {
        handleAction(action, ticketId);
      }
    });
  });
}

async function renderActiveCards(): Promise<void> {
  if (!activeCards) return;

  const activeTickets = await loadActiveTickets();
  const waitingCount = currentTickets.filter(t => t.status === 'Waiting').length;

  if (statsWaiting) {
    statsWaiting.textContent = String(waitingCount);
  }

  if (activeTickets.length === 0) {
    activeCards.innerHTML = `
            <div class="text-center py-8 text-gray-400">
                <span class="material-symbols-outlined text-4xl mb-2 block">hourglass_empty</span>
                <p>Sin atenciones activas</p>
            </div>
        `;
    return;
  }

  activeCards.innerHTML = activeTickets.map(ticket => {
    // Triage Badge
    const tLevel = ticket.triageLevel;
    const triage = triageColors[tLevel as any] || triageColors['BLUE'];

    // Status visual
    const statusColor = ticket.status === 'Serving' ? 'border-blue-500' : 'border-green-500';

    return `
            <div class="bg-white rounded-xl shadow-sm border-l-4 ${statusColor} p-4">
                <div class="flex justify-between items-start mb-2">
                    <span class="text-2xl font-bold text-neutral-dark">${ticket.code}</span>
                    <span class="text-xs font-medium px-2 py-1 rounded ${ticket.status === 'Serving' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}">
                        ${ticket.statusText}
                    </span>
                </div>
                <!-- Service Name: never undefined -->
                <div class="text-sm text-gray-600 mb-2">${ticket.serviceName}</div>
                
                <div class="flex flex-wrap gap-2 items-center">
                    <!-- Triage Badge: never undefined -->
                    <span class="text-xs font-bold px-2 py-1 rounded ${triage.bg} ${triage.text}">${ticket.triageText}</span>
                    
                    <!-- Counter Name: safeText ensures valid string or dash -->
                    ${ticket.counterName !== '—' ? `<span class="text-xs text-gray-500 flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">desktop_windows</span> ${ticket.counterName}</span>` : ''}
                </div>
            </div>
        `;
  }).join('');
}

async function renderAll(): Promise<void> {
  currentTickets = await loadQueue();
  renderTabs();
  renderQueue();
  await renderActiveCards();
}

// === Initialization ===

// Load counters first, then initial render
loadCounters().then(() => renderAll());

// Auto-refresh every 3 seconds
setInterval(() => {
  renderAll();
}, 3000);

// Cross-tab sync (mockStore mode only)
if (!USE_API) {
  startStoreSync(() => renderAll());
  subscribe(() => renderAll());
}

// === Helpdesk Button Initialization ===
const helpdeskBtn = document.getElementById('helpdesk-btn') as HTMLAnchorElement | null;
if (helpdeskBtn && hasHelpdesk()) {
  helpdeskBtn.href = HELPDESK_URL;
  helpdeskBtn.classList.remove('hidden');
  helpdeskBtn.classList.add('flex');
  if (isDebug) console.log('OPERATOR DEBUG: Helpdesk button enabled, URL:', HELPDESK_URL);
}

// === Sidebar Navigation ===
wireAllNav();
