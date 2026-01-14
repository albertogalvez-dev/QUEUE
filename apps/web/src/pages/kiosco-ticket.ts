/**
 * Kiosco Ticket page - ticket display and print simulation
 * Uses mockStore to get real ticket data
 */
import { go } from '../lib/nav';
import { startIdleTimeout } from '../lib/idleTimeout';
import { USE_API } from '../lib/config';
import { getTicketById as mockGetTicketById } from '../lib/mockStore';
import { getTicketByCode as apiGetTicketByCode } from '../lib/apiClient';

console.log('page: kiosco-ticket');

// Elements
const ticketCodigo = document.getElementById('ticket-codigo');
const ticketServicio = document.getElementById('ticket-servicio');
const ticketHora = document.getElementById('ticket-hora');
const estadoImpresion = document.getElementById('estado-impresion');
const btnFinalizar = document.getElementById('btn-finalizar');
const btnTicketBack = document.getElementById('btn-ticket-back');

// Get ticket identifier from sessionStorage or URL
const ticketId = sessionStorage.getItem('ticketId');
const ticketCode = sessionStorage.getItem('ticketCode') || new URLSearchParams(window.location.search).get('code');

// Interface for display
interface DisplayTicket {
    code: string;
    serviceName: string;
    time?: string;
}

// Initialize
async function init() {
    let ticket: DisplayTicket | null = null;

    if (USE_API && ticketCode) {
        try {
            const apiTicket = await apiGetTicketByCode(ticketCode);
            ticket = {
                code: apiTicket.code,
                serviceName: apiTicket.serviceName,
                // Format createdAt/Today to HH:mm if needed, but UI uses current time usually
                time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
            };
        } catch (err) {
            console.error('Error fetching ticket:', err);
        }
    } else if (!USE_API && ticketId) {
        const mockTicket = mockGetTicketById(ticketId);
        if (mockTicket) {
            ticket = {
                code: mockTicket.code,
                serviceName: mockTicket.serviceName
            };
        }
    }

    renderTicket(ticket);
}

// Get current time
function getCurrentTime(): string {
    const now = new Date();
    return now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

// Render ticket
function renderTicket(ticket: DisplayTicket | null) {
    if (ticket) {
        if (ticketCodigo) ticketCodigo.textContent = ticket.code;
        if (ticketServicio) ticketServicio.textContent = ticket.serviceName;
        if (ticketHora) ticketHora.textContent = ticket.time || getCurrentTime();
    } else {
        // Fallback or error
        if (ticketCodigo) ticketCodigo.textContent = '---';
        if (ticketServicio) ticketServicio.textContent = 'Error';
        if (ticketHora) ticketHora.textContent = getCurrentTime();
    }
}

// Simulate printing
// Simulate printing animation
if (estadoImpresion) {
    const progressText = document.querySelector('.text-xs.font-bold.text-primary'); // 85% label
    const progressBar = document.querySelector('.h-full.bg-primary') as HTMLElement; // Bar

    let progress = 0;
    const interval = setInterval(() => {
        progress += 5;
        if (progress > 100) progress = 100;

        if (progressBar) progressBar.style.width = `${progress}%`;
        if (progressText) progressText.textContent = `${progress}%`;

        if (progress >= 100) {
            clearInterval(interval);
            setTimeout(() => {
                estadoImpresion.textContent = 'Ticket impreso. Recoja su ticket.';
                // Optional: visual clue that ticket is ready
            }, 300);
        }
    }, 50); // ~1 sec total
}

// Finalizar - clear sessionStorage and go back to kiosco
function resetAndGoHome() {
    // Clear kiosco session data
    sessionStorage.removeItem('docValue');
    sessionStorage.removeItem('docType');
    sessionStorage.removeItem('mode');
    sessionStorage.removeItem('selectedService');
    sessionStorage.removeItem('ticketId');
    sessionStorage.removeItem('ticketCode');

    go('/kiosco/');
}

btnFinalizar?.addEventListener('click', resetAndGoHome);
btnTicketBack?.addEventListener('click', resetAndGoHome);

// Idle timeout - 60 seconds, redirect to kiosco
startIdleTimeout(60, () => {
    console.log('Idle timeout: redirecting to kiosco');
    resetAndGoHome();
});

// Run
init();
