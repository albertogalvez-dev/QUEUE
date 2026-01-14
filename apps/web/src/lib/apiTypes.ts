/**
 * API Data Transfer Objects
 * Matching backend DTOs for type safety
 */

/** Counter information for display */
export interface DisplayCounterDto {
    id: string;
    name: string;
}

/** A row in the display (ticket being served or waiting) */
export interface DisplayRowDto {
    code: string;  // API returns 'code', not 'ticketCode'
    serviceName: string;
    counterName: string | null;
    status: 'Waiting' | 'Called' | 'Serving' | 'Done' | 'NoShow';
}

/** Main display data from /api/display endpoint */
export interface DisplayDto {
    nowServing: DisplayRowDto[];
    next: DisplayRowDto[];
    timestamp: string;
}

/** Queue summary from /api/queue endpoint */
export interface QueueSummaryDto {
    serviceId: string;
    serviceName: string;
    waitingCount: number;
    averageWaitMinutes: number;
}

/** Ticket detail from /api/tickets endpoint */
export interface TicketDto {
    id: string;
    code: string;
    serviceId: string;
    serviceName: string;
    status: string;
    triage: string | null;
    preferente: boolean;
    counterName: string | null;
    createdAt: string;
    calledAt: string | null;
    servedAt: string | null;
}

/** Appointment from /api/appointments */
export interface AppointmentDto {
    id: string;
    date: string;
    time: string;
    serviceId: string;
    title: string;
}

/** Request payload for creating a ticket */
export interface CreateTicketRequest {
    doc: string;
    serviceId: string;
    appointmentId?: string | null;
    source?: string;
}

/** Service from /api/services */
export interface ServiceDto {
    id: string;
    name: string;
    prefix: string;
    isActive: boolean;
}

/** Counter/Workstation from /api/counters */
export interface CounterDto {
    id: string;
    name: string;
    serviceId: string;
    isActive: boolean;
}

// === Analytics Types ===
export interface AnalyticsTotals {
    created: number;
    called: number;
    started: number;
    finished: number;
    noShow: number;
    waitingNow: number;
    servingNow: number;
}

export interface AnalyticsTimings {
    avgWaitSeconds: number;
    p50WaitSeconds: number;
    p90WaitSeconds: number;
    avgServiceSeconds: number;
    p50ServiceSeconds: number;
    p90ServiceSeconds: number;
}

export interface ServiceStatsDto {
    serviceId: string;
    name: string;
    created: number;
    finished: number;
    avgWaitSeconds: number;
    avgServiceSeconds: number;
}

export interface CounterStatsDto {
    counterId: string;
    name: string;
    served: number;
    avgServiceSeconds: number;
}

export interface AnalyticsSummaryDto {
    window: string;
    generatedAt: string;
    totals: AnalyticsTotals;
    timings: AnalyticsTimings;
    byService: ServiceStatsDto[];
    topCounters: CounterStatsDto[];
}

export interface AnalyticsEventDto {
    ts: string;
    type: string;
    ticketCode: string;
    serviceId: string;
    counterId: string;
    actor: string;
}
