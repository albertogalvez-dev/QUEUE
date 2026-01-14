/**
 * API Client for Queue Demo Backend
 * Provides typed functions for all API endpoints
 */
import { API_BASE } from './config';
import type { TicketDto, DisplayDto, AppointmentDto, CreateTicketRequest, ServiceDto, CounterDto, AnalyticsSummaryDto, AnalyticsEventDto } from './apiTypes';

const TIMEOUT_MS = 8000;

/**
 * Base fetch with timeout and error handling
 */
async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const url = `${API_BASE}${path}`;

        const headers: Record<string, string> = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...options.headers as Record<string, string>,
        };

        const token = localStorage.getItem('QUEUE_AUTH_TOKEN');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers,
        });

        if (response.status === 401) {
            console.warn('Unauthorized (401). Please login.');
            // dispatch event?
        }

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Handle empty responses (204 No Content)
        const text = await response.text();
        return text ? JSON.parse(text) as T : {} as T;
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error(`Request timeout after ${TIMEOUT_MS}ms`);
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

// === Kiosco Endpoints ===

export async function getAppointmentsByDoc(doc: string): Promise<AppointmentDto[]> {
    return apiFetch<AppointmentDto[]>(`/api/appointments?doc=${doc}`);
}

export async function createTicket(request: CreateTicketRequest): Promise<TicketDto> {
    return apiFetch<TicketDto>('/api/tickets', {
        method: 'POST',
        body: JSON.stringify(request)
    });
}

export async function getTicketByCode(code: string): Promise<TicketDto> {
    return apiFetch<TicketDto>(`/api/tickets/by-code/${code}`);
}

export async function getActiveTicketByDoc(doc: string): Promise<TicketDto | null> {
    try {
        return await apiFetch<TicketDto>(`/api/tickets/active-by-doc?doc=${doc}`);
    } catch {
        return null; // 404 means no active ticket
    }
}

// === Display Endpoints ===

export async function getDisplay(): Promise<DisplayDto> {
    return apiFetch<DisplayDto>('/api/display');
}

// === Queue Endpoints ===

export async function getQueue(serviceId: string): Promise<TicketDto[]> {
    return apiFetch<TicketDto[]>(`/api/queues/${serviceId}`);
}

// === Action Endpoints ===

export async function callTicket(ticketId: string, counterId: string): Promise<TicketDto> {
    return apiFetch<TicketDto>(
        `/api/actions/call/${ticketId}?counterId=${counterId}`,
        { method: 'POST' }
    );
}

export async function callNext(serviceId: string, counterId: string): Promise<TicketDto> {
    return apiFetch<TicketDto>(
        `/api/actions/call-next?serviceId=${serviceId}&counterId=${counterId}`,
        { method: 'POST' }
    );
}

export async function startTicket(ticketId: string): Promise<TicketDto> {
    return apiFetch<TicketDto>(
        `/api/actions/start/${ticketId}`,
        { method: 'POST' }
    );
}

export async function finishTicket(ticketId: string): Promise<TicketDto> {
    return apiFetch<TicketDto>(
        `/api/actions/finish/${ticketId}`,
        { method: 'POST' }
    );
}

export async function noShowTicket(ticketId: string): Promise<TicketDto> {
    return apiFetch<TicketDto>(
        `/api/actions/noshow/${ticketId}`,
        { method: 'POST' }
    );
}

// Recall - maps to call-next for the specific ticket's service
export async function recallTicket(_ticketId: string, serviceId: string, counterId: string): Promise<TicketDto> {
    // Note: If backend has specific recall endpoint, use it instead
    // For now, this is a workaround using call-next
    return callNext(serviceId, counterId);
}

// === Triage Endpoints ===

export async function setTriage(ticketId: string, level: string): Promise<TicketDto> {
    return apiFetch<TicketDto>(
        `/api/actions/triage/${ticketId}?level=${level}`,
        { method: 'POST' }
    );
}

export async function setPreferente(ticketId: string, value: boolean): Promise<TicketDto> {
    return apiFetch<TicketDto>(
        `/api/actions/preferente/${ticketId}?value=${value}`,
        { method: 'POST' }
    );
}

export async function setNote(ticketId: string, note: string): Promise<TicketDto> {
    return apiFetch<TicketDto>(
        `/api/actions/note/${ticketId}`,
        {
            method: 'POST',
            body: JSON.stringify({ note })
        }
    );
}

// === Utility: Get all waiting tickets across services ===

export async function getAllWaitingTickets(): Promise<TicketDto[]> {
    const services = ['A', 'E', 'C', 'V'];
    const allTickets: TicketDto[] = [];

    for (const serviceId of services) {
        try {
            const queue = await getQueue(serviceId);
            const waiting = queue.filter(t => t.status === 'Waiting');
            allTickets.push(...waiting);
        } catch {
            // Continue if a service fails
        }
    }

    return allTickets;
}

// === Admin Endpoints ===

export async function getServices(): Promise<ServiceDto[]> {
    return apiFetch<ServiceDto[]>('/api/services');
}

export async function updateService(serviceId: string, update: Partial<ServiceDto>): Promise<ServiceDto> {
    return apiFetch<ServiceDto>(`/api/services/${serviceId}`, {
        method: 'PUT',
        body: JSON.stringify(update)
    });
}

export async function getCounters(): Promise<CounterDto[]> {
    return apiFetch<CounterDto[]>('/api/counters');
}

export async function createCounter(request: CounterDto): Promise<CounterDto> {
    return apiFetch<CounterDto>('/api/counters', {
        method: 'POST',
        body: JSON.stringify(request)
    });
}

export async function updateCounter(counterId: string, update: Partial<CounterDto>): Promise<CounterDto> {
    return apiFetch<CounterDto>(`/api/counters/${counterId}`, {
        method: 'PUT',
        body: JSON.stringify(update)
    });
}

// === Admin Endpoints ===

export async function resetDemo(): Promise<{ ok: boolean; ts: string }> {
    return apiFetch<{ ok: boolean; ts: string }>('/api/admin/reset', {
        method: 'POST'
    });
}

// === Auth Endpoints ===
export async function login(username: string, password: string): Promise<{ token: string; role: string; username: string }> {
    return apiFetch<{ token: string; role: string; username: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
    });
}
// === Analytics Endpoints ===
export async function getAnalyticsSummary(window: string = '24h'): Promise<AnalyticsSummaryDto> {
    return apiFetch<AnalyticsSummaryDto>(`/api/analytics/summary?window=${window}`);
}

export async function getAnalyticsEvents(limit: number = 50): Promise<AnalyticsEventDto[]> {
    return apiFetch<AnalyticsEventDto[]>(`/api/analytics/events?limit=${limit}`);
}
