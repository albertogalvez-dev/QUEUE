/**
 * Mock Store - Central state management for QUEUE! demo
 * Persists to localStorage for consistency across pages
 */

// === Types ===

export type TriageLevel = 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN' | 'BLUE';
export type TicketStatus = 'Waiting' | 'Called' | 'Serving' | 'Done' | 'NoShow';

export interface Service {
    id: string;
    name: string;
    prefix: string;
}

export interface Counter {
    id: string;
    name: string;
    serviceId: string;
}

export interface Appointment {
    id: string;
    docValue: string;
    serviceId: string;
    serviceName: string;
    time: string;
    doctor: string;
    room: string;
}

export interface Ticket {
    id: string;
    code: string;
    serviceId: string;
    serviceName: string;
    status: TicketStatus;
    triage: TriageLevel | null;
    preferente: boolean;
    createdAt: string;
    calledAt: string | null;
    counterId: string | null;
    counterName: string | null;
    docValue: string | null;
    appointmentId: string | null;
    note: string | null;
}

export interface DisplayRow {
    ticketCode: string;
    counterName: string;
    serviceName: string;
}

export interface DemoState {
    services: Service[];
    counters: Counter[];
    appointments: Appointment[];
    tickets: Ticket[];
    dailyCounters: Record<string, number>;
}

// === Constants ===

const STORAGE_KEY = 'QUEUE_DEMO_STATE_V1';

const DEFAULT_SERVICES: Service[] = [
    { id: 'admision', name: 'Admisión', prefix: 'A' },
    { id: 'extracciones', name: 'Extracciones', prefix: 'E' },
    { id: 'consulta', name: 'Consulta General', prefix: 'C' },
    { id: 'vacunacion', name: 'Vacunación', prefix: 'V' },
];

const DEFAULT_COUNTERS: Counter[] = [
    { id: 'adm-1', name: 'Ventanilla 1', serviceId: 'admision' },
    { id: 'adm-2', name: 'Ventanilla 2', serviceId: 'admision' },
    { id: 'ext-1', name: 'Box Extracciones 1', serviceId: 'extracciones' },
    { id: 'ext-2', name: 'Box Extracciones 2', serviceId: 'extracciones' },
    { id: 'con-1', name: 'Consulta 1', serviceId: 'consulta' },
    { id: 'con-2', name: 'Consulta 2', serviceId: 'consulta' },
    { id: 'con-3', name: 'Consulta 3', serviceId: 'consulta' },
    { id: 'vac-1', name: 'Sala Vacunación', serviceId: 'vacunacion' },
];

// Demo appointments for specific DNIs
const DEMO_APPOINTMENTS: Appointment[] = [
    // DNI 12345678A has 2 appointments
    { id: 'apt-1', docValue: '12345678A', serviceId: 'consulta', serviceName: 'Consulta General', time: '10:30', doctor: 'Dr. García', room: 'Consulta 1' },
    { id: 'apt-2', docValue: '12345678A', serviceId: 'extracciones', serviceName: 'Extracciones', time: '11:15', doctor: 'Enfermera López', room: 'Box 2' },
    // DNI 87654321B has 3 appointments
    { id: 'apt-3', docValue: '87654321B', serviceId: 'admision', serviceName: 'Admisión', time: '09:00', doctor: 'Administrativo', room: 'Ventanilla 1' },
    { id: 'apt-4', docValue: '87654321B', serviceId: 'consulta', serviceName: 'Consulta General', time: '09:30', doctor: 'Dra. Martínez', room: 'Consulta 2' },
    { id: 'apt-5', docValue: '87654321B', serviceId: 'vacunacion', serviceName: 'Vacunación', time: '10:00', doctor: 'Enfermero Ruiz', room: 'Sala Vacunación' },
    // DNI 11111111C has 1 appointment
    { id: 'apt-6', docValue: '11111111C', serviceId: 'consulta', serviceName: 'Consulta General', time: '11:00', doctor: 'Dr. Pérez', room: 'Consulta 3' },
];

// === State Management ===

const PING_KEY = 'QUEUE_DEMO_PING';

// Subscription system for reactive updates
export type StoreListener = () => void;
const listeners = new Set<StoreListener>();

/**
 * Subscribe to store changes
 * @returns unsubscribe function
 */
export function subscribe(listener: StoreListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/**
 * Notify all listeners of state change
 */
function notifyListeners(): void {
    listeners.forEach(fn => fn());
}

function loadState(): DemoState | null {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : null;
    } catch {
        return null;
    }
}

function saveState(state: DemoState): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    // Emit ping for cross-tab sync
    localStorage.setItem(PING_KEY, String(Date.now()));
    // Notify listeners in current tab
    notifyListeners();
}

function getState(): DemoState {
    const state = loadState();
    if (!state) {
        initDemoStateIfNeeded();
        return loadState()!;
    }
    return state;
}

// === Helpers ===

function generateId(): string {
    return Math.random().toString(36).substring(2, 11);
}

function generateTicketCode(prefix: string, state: DemoState): string {
    const key = prefix;
    const count = (state.dailyCounters[key] || 0) + 1;
    state.dailyCounters[key] = count;
    return `${prefix}-${String(count).padStart(3, '0')}`;
}

function getTriagePriority(triage: TriageLevel | null): number {
    const priorities: Record<TriageLevel, number> = {
        RED: 0,
        ORANGE: 1,
        YELLOW: 2,
        GREEN: 3,
        BLUE: 4,
    };
    return triage ? priorities[triage] : 5;
}

function sortQueue(tickets: Ticket[]): Ticket[] {
    return [...tickets].sort((a, b) => {
        // First by triage priority
        const triageA = getTriagePriority(a.triage);
        const triageB = getTriagePriority(b.triage);
        if (triageA !== triageB) return triageA - triageB;

        // Then by preferente
        if (a.preferente !== b.preferente) return a.preferente ? -1 : 1;

        // Finally by creation time (FIFO)
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
}

// === Public API ===

export function initDemoStateIfNeeded(): void {
    const existing = loadState();
    if (existing && existing.tickets.length > 0) {
        return; // Already initialized
    }

    const state: DemoState = {
        services: DEFAULT_SERVICES,
        counters: DEFAULT_COUNTERS,
        appointments: DEMO_APPOINTMENTS,
        tickets: [],
        dailyCounters: {},
    };

    // Seed 40 tickets
    const triageLevels: (TriageLevel | null)[] = ['RED', 'ORANGE', 'YELLOW', 'GREEN', 'BLUE', null];
    const statuses: TicketStatus[] = ['Waiting', 'Called', 'Serving'];

    for (let i = 0; i < 40; i++) {
        const service = DEFAULT_SERVICES[i % 4];
        const code = generateTicketCode(service.prefix, state);

        // Determine status distribution
        let status: TicketStatus = 'Waiting';
        if (i < 3) status = 'Called';
        else if (i < 5) status = 'Serving';

        // Determine triage (5 with RED/ORANGE)
        let triage: TriageLevel | null = null;
        if (i < 2) triage = 'RED';
        else if (i < 5) triage = 'ORANGE';
        else if (i < 10) triage = 'YELLOW';
        else if (i < 20) triage = 'GREEN';
        else if (i < 25) triage = 'BLUE';

        // 6 preferentes
        const preferente = i < 6 || i % 7 === 0;

        // Assign counter for Called/Serving
        let counterId: string | null = null;
        let counterName: string | null = null;
        if (status === 'Called' || status === 'Serving') {
            const serviceCounters = DEFAULT_COUNTERS.filter(c => c.serviceId === service.id);
            if (serviceCounters.length > 0) {
                const counter = serviceCounters[i % serviceCounters.length];
                counterId = counter.id;
                counterName = counter.name;
            }
        }

        const ticket: Ticket = {
            id: generateId(),
            code,
            serviceId: service.id,
            serviceName: service.name,
            status,
            triage,
            preferente,
            createdAt: new Date(Date.now() - (40 - i) * 60000).toISOString(),
            calledAt: status !== 'Waiting' ? new Date().toISOString() : null,
            counterId,
            counterName,
            docValue: null,
            appointmentId: null,
            note: null,
        };

        state.tickets.push(ticket);
    }

    saveState(state);
}

export function getServices(): Service[] {
    return getState().services;
}

export function getAppointments(docValue: string): Appointment[] {
    const state = getState();
    return state.appointments.filter(a => a.docValue === docValue.toUpperCase());
}

export function getTicketById(ticketId: string): Ticket | null {
    const state = getState();
    return state.tickets.find(t => t.id === ticketId) || null;
}

export function createTicket(params: {
    serviceId: string;
    docValue?: string;
    appointmentId?: string;
    triage?: TriageLevel;
    preferente?: boolean;
}): Ticket {
    const state = getState();
    const service = state.services.find(s => s.id === params.serviceId) || state.services[0];
    const code = generateTicketCode(service.prefix, state);

    const ticket: Ticket = {
        id: generateId(),
        code,
        serviceId: service.id,
        serviceName: service.name,
        status: 'Waiting',
        triage: params.triage || null,
        preferente: params.preferente || false,
        createdAt: new Date().toISOString(),
        calledAt: null,
        counterId: null,
        counterName: null,
        docValue: params.docValue || null,
        appointmentId: params.appointmentId || null,
        note: null,
    };

    state.tickets.push(ticket);
    saveState(state);

    return ticket;
}

export function getDisplay(): { nowServing: DisplayRow[]; next: DisplayRow[] } {
    const state = getState();

    const nowServing: DisplayRow[] = state.tickets
        .filter(t => t.status === 'Serving' || t.status === 'Called')
        .slice(0, 4)
        .map(t => ({
            ticketCode: t.code,
            counterName: t.counterName || 'Puesto 1',
            serviceName: t.serviceName,
        }));

    const waitingTickets = sortQueue(state.tickets.filter(t => t.status === 'Waiting'));
    const next: DisplayRow[] = waitingTickets
        .slice(0, 10)
        .map(t => ({
            ticketCode: t.code,
            counterName: '-',
            serviceName: t.serviceName,
        }));

    return { nowServing, next };
}

export function getQueue(serviceId: string): Ticket[] {
    const state = getState();
    const tickets = state.tickets.filter(t =>
        t.serviceId === serviceId &&
        (t.status === 'Waiting' || t.status === 'Called' || t.status === 'Serving')
    );
    return sortQueue(tickets);
}

export function getAllActiveTickets(): Ticket[] {
    const state = getState();
    return state.tickets.filter(t =>
        t.status === 'Waiting' || t.status === 'Called' || t.status === 'Serving'
    );
}

export function operatorCallNext(serviceId: string, counterId: string): Ticket | null {
    const state = getState();
    const counter = state.counters.find(c => c.id === counterId);

    const waitingTickets = sortQueue(
        state.tickets.filter(t => t.serviceId === serviceId && t.status === 'Waiting')
    );

    if (waitingTickets.length === 0) return null;

    const ticket = waitingTickets[0];
    ticket.status = 'Called';
    ticket.calledAt = new Date().toISOString();
    ticket.counterId = counterId;
    ticket.counterName = counter?.name || 'Puesto';

    saveState(state);
    return ticket;
}

export function operatorStart(ticketId: string): Ticket | null {
    const state = getState();
    const ticket = state.tickets.find(t => t.id === ticketId);

    if (!ticket || ticket.status !== 'Called') return null;

    ticket.status = 'Serving';
    saveState(state);
    return ticket;
}

export function operatorFinish(ticketId: string): Ticket | null {
    const state = getState();
    const ticket = state.tickets.find(t => t.id === ticketId);

    if (!ticket) return null;

    ticket.status = 'Done';
    saveState(state);
    return ticket;
}

export function operatorNoShow(ticketId: string): Ticket | null {
    const state = getState();
    const ticket = state.tickets.find(t => t.id === ticketId);

    if (!ticket) return null;

    ticket.status = 'NoShow';
    saveState(state);
    return ticket;
}

export function operatorRecall(ticketId: string): Ticket | null {
    const state = getState();
    const ticket = state.tickets.find(t => t.id === ticketId);

    if (!ticket || ticket.status !== 'Called') return null;

    ticket.calledAt = new Date().toISOString();
    saveState(state);
    return ticket;
}

/**
 * Call a specific ticket by ID (not the next in queue)
 */
export function operatorCallTicket(ticketId: string, counterId: string): Ticket | null {
    const state = getState();
    const ticket = state.tickets.find(t => t.id === ticketId);
    const counter = state.counters.find(c => c.id === counterId);

    // Allow calling Waiting tickets, or re-calling Called tickets
    if (!ticket || (ticket.status !== 'Waiting' && ticket.status !== 'Called')) return null;

    ticket.status = 'Called';
    ticket.calledAt = new Date().toISOString();
    ticket.counterId = counterId;
    ticket.counterName = counter?.name || 'Puesto';

    saveState(state);
    return ticket;
}

export function operatorTransfer(ticketId: string, toServiceId: string): Ticket | null {
    const state = getState();
    const ticket = state.tickets.find(t => t.id === ticketId);
    const newService = state.services.find(s => s.id === toServiceId);

    if (!ticket || !newService) return null;

    ticket.serviceId = toServiceId;
    ticket.serviceName = newService.name;
    ticket.status = 'Waiting';
    ticket.counterId = null;
    ticket.counterName = null;
    ticket.calledAt = null;

    saveState(state);
    return ticket;
}

export function getCountersForService(serviceId: string): Counter[] {
    const state = getState();
    return state.counters.filter(c => c.serviceId === serviceId);
}

// === Triage APIs ===

/**
 * Set triage level for a ticket
 */
export function setTriage(ticketId: string, level: TriageLevel): Ticket | null {
    const state = getState();
    const ticket = state.tickets.find(t => t.id === ticketId);

    if (!ticket) return null;

    ticket.triage = level;
    saveState(state);
    return ticket;
}

/**
 * Toggle or set preferente status
 */
export function togglePreferente(ticketId: string, value?: boolean): Ticket | null {
    const state = getState();
    const ticket = state.tickets.find(t => t.id === ticketId);

    if (!ticket) return null;

    ticket.preferente = value !== undefined ? value : !ticket.preferente;
    saveState(state);
    return ticket;
}

/**
 * Set clinical note for a ticket
 */
export function setTicketNote(ticketId: string, note: string): Ticket | null {
    const state = getState();
    const ticket = state.tickets.find(t => t.id === ticketId);

    if (!ticket) return null;

    ticket.note = note.substring(0, 120); // Max 120 chars
    saveState(state);
    return ticket;
}

/**
 * Get waiting tickets for triage, sorted by priority
 */
export function getWaitingTickets(serviceId?: string): Ticket[] {
    const state = getState();
    let tickets = state.tickets.filter(t =>
        t.status === 'Waiting' || t.status === 'Called'
    );

    if (serviceId) {
        tickets = tickets.filter(t => t.serviceId === serviceId);
    }

    return sortQueue(tickets);
}

// === Turno Lookup Helpers ===

/**
 * Normalize ticket code to uppercase and proper format
 */
export function normalizeTicketCode(input: string): string {
    return input.trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Validate ticket code format (X-###)
 */
export function isValidTicketCode(code: string): boolean {
    return /^[AECV]-\d{3}$/.test(code);
}

/**
 * Get ticket by code
 */
export function getTicketByCode(code: string): Ticket | null {
    const state = getState();
    const normalizedCode = normalizeTicketCode(code);
    return state.tickets.find(t => t.code === normalizedCode) || null;
}

/**
 * Get most recent active ticket by document (for demo)
 */
export function getActiveTicketByDoc(docValue: string): Ticket | null {
    const state = getState();
    const normalizedDoc = docValue.trim().toUpperCase();

    // Find tickets with this docValue that are still active
    const activeTickets = state.tickets
        .filter(t =>
            t.docValue === normalizedDoc &&
            (t.status === 'Waiting' || t.status === 'Called' || t.status === 'Serving')
        )
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return activeTickets[0] || null;
}

/**
 * Get position in queue for waiting tickets
 */
export function getQueuePosition(ticketId: string): number {
    const state = getState();
    const ticket = state.tickets.find(t => t.id === ticketId);
    if (!ticket || ticket.status !== 'Waiting') return 0;

    const queue = sortQueue(
        state.tickets.filter(t => t.serviceId === ticket.serviceId && t.status === 'Waiting')
    );

    const position = queue.findIndex(t => t.id === ticketId);
    return position >= 0 ? position + 1 : 0;
}

// Initialize on load
initDemoStateIfNeeded();

