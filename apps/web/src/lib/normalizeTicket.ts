/**
 * Ticket Normalizer
 * Ensures consistent data structure for API and Mock tickets.
 * Eliminates 'undefined' in the UI.
 */
import { serviceLabel, statusLabel, triageLabel, safeText } from './mappers';

export type NormalizedTicket = {
    id: string;
    code: string;
    serviceId: string;
    serviceName: string;
    status: string;
    statusText: string;
    triageLevel: string;
    triageText: string;
    preferente: boolean;
    waitText: string;
    noteText: string;
    counterName: string;
    createdAt: string;
};

export function normalizeTicket(raw: any): NormalizedTicket {
    if (!raw) {
        // Return safe empty object if raw is null
        return {
            id: "unknown",
            code: "—",
            serviceId: "—",
            serviceName: "—",
            status: "Waiting",
            statusText: "En espera",
            triageLevel: "BLUE",
            triageText: "AZUL",
            preferente: false,
            waitText: "—",
            noteText: "—",
            counterName: "—",
            createdAt: new Date().toISOString()
        };
    }

    // 1. Basic fields
    const id = safeText(raw.id || raw.Id, "unknown");
    const code = safeText(raw.code || raw.Code, "—");

    // 2. Service
    // Try to infer from raw.serviceId, raw.ServiceId, or even the code prefix (e.g. A-001)
    let rawServiceId = raw.serviceId || raw.ServiceId;
    if (!rawServiceId && code.includes('-')) {
        rawServiceId = code.split('-')[0];
    }
    const serviceId = safeText(rawServiceId, "A"); // Default to A if completely unknown
    const serviceName = serviceLabel(serviceId);

    // 3. Status
    const rawStatus = raw.status || raw.Status;
    const statusText = statusLabel(rawStatus);
    const status = rawStatus || "Waiting";

    // 4. Triage
    const rawTriage = raw.triageLevel || raw.TriageLevel || raw.triage; // API might use 'triage'
    const triageText = triageLabel(rawTriage);
    // Normalize to UPPERCASE for color map keys
    const triageLevel = (typeof rawTriage === 'string' ? rawTriage.toUpperCase() : "BLUE") || "BLUE";

    // 5. Preferente
    const preferente = Boolean(raw.preferente || raw.Preferente);

    // 6. Wait text
    const waitText = safeText(raw.waitingTime || raw.waitTime || raw.waitText, "—");

    // createdAt (API: CreatedAt, Mock: createdAt)
    const createdAt = safeText(raw.createdAt || raw.CreatedAt, new Date().toISOString());

    // 7. Note
    const noteText = safeText(raw.note || raw.Note || raw.notas, "—");

    // 8. Counter
    const counterName = safeText(raw.counterName || raw.counter || raw.CounterName, "—");

    return {
        id,
        code,
        serviceId,
        serviceName,
        status,
        statusText,
        triageLevel,
        triageText,
        preferente,
        waitText,
        noteText,
        counterName,
        createdAt
    };
}
