/**
 * Centralized mappers for UI labels
 * Single source of truth for Services, Status, and Triage mapping.
 */

export function serviceLabel(serviceId?: string): string {
    if (!serviceId) return "—";

    // Normalize input
    const s = serviceId.toUpperCase();

    if (s === "A" || s.startsWith("ADM")) return "Admisión";
    if (s === "E" || s.startsWith("EXT")) return "Extracciones";
    if (s === "C" || s.startsWith("CON")) return "Consulta General";
    if (s === "V" || s.startsWith("VAC")) return "Vacunación";

    return "—";
}

export function statusLabel(status?: string): string {
    if (!status) return "En espera";

    const s = status.toLowerCase();

    if (s === "waiting" || s === "enespera") return "En espera";
    if (s === "called" || s === "llamado") return "Llamado";
    if (s === "serving" || s === "enatencion" || s === "en atención") return "En atención";
    if (s === "done" || s === "finalizado" || s === "finished") return "Finalizado";
    if (s === "noshow" || s === "nopresentado" || s === "no presentado") return "No presentado";

    return "En espera";
}

export function triageLabel(level?: string): string {
    if (!level) return "AZUL";

    const l = level.toUpperCase();

    if (l === "RED" || l === "ROJO") return "ROJO";
    if (l === "ORANGE" || l === "NARANJA") return "NARANJA";
    if (l === "YELLOW" || l === "AMARILLO") return "AMARILLO";
    if (l === "GREEN" || l === "VERDE") return "VERDE";
    if (l === "BLUE" || l === "AZUL") return "AZUL";

    return "AZUL";
}

export function safeText(v: unknown, fallback = "—"): string {
    if (v === null || v === undefined || v === "") return fallback;
    if (typeof v === 'string') return v;
    if (typeof v === 'number') return String(v);
    return fallback;
}
