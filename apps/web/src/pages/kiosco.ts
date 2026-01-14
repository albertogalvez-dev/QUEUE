/**
 * Kiosco page - DNI identification
 */
import { go } from '../lib/nav';
import { startIdleTimeout } from '../lib/idleTimeout';



// Elements
const inputDocValue = document.getElementById('input-doc-value');
const btnConfirmar = document.getElementById('btn-confirmar-doc');
const btnSinCita = document.getElementById('btn-sin-cita');
const errorContainer = document.getElementById('kiosco-error');
const btnBack = document.getElementById('btn-kiosco-back');

// Back button handler
if (btnBack) {
    btnBack.addEventListener('click', () => go('/'));
}

// State
let docValue = '';

// Update display
function updateDisplay(): void {
    if (inputDocValue) {
        inputDocValue.textContent = docValue || '';
    }
}

// Keypad handler
function handleKeypadClick(e: Event): void {
    const target = e.target as HTMLElement;
    const button = target.closest('button');
    if (!button) return;

    // Toggle Mode Logic
    if (button.id === 'btn-toggle-alpha' || button.id === 'btn-toggle-numeric') {
        toggleKeypadMode();
        return;
    }

    const text = button.textContent?.trim();
    const key = button.getAttribute('data-key') || text; // Use data-key for letters if present

    // Backspace
    if (button.getAttribute('aria-label') === 'Borrar' || text === 'backspace') {
        docValue = docValue.slice(0, -1);
        updateDisplay();
        return;
    }

    if (!key) return;

    // Input Handling (0-9, A-Z)
    // Allow numbers and letters, max 9 chars
    if (/^[0-9A-ZÑ]$/.test(key)) {
        if (docValue.length < 9) {
            docValue += key;
            updateDisplay();
        }
    }
}

// Toggle between Numeric and Alpha keypads
function toggleKeypadMode(): void {
    const numericPad = document.getElementById('keypad-numeric');
    const alphaPad = document.getElementById('keypad-alpha');

    if (numericPad && alphaPad) {
        if (numericPad.classList.contains('hidden')) {
            // Show Numeric, Hide Alpha
            numericPad.classList.remove('hidden');
            alphaPad.classList.add('hidden');
        } else {
            // Show Alpha, Hide Numeric
            numericPad.classList.add('hidden');
            alphaPad.classList.remove('hidden');
        }
    }
}

// Setup keypad listeners
const numericPad = document.getElementById('keypad-numeric');
const alphaPad = document.getElementById('keypad-alpha');

if (numericPad) numericPad.addEventListener('click', handleKeypadClick);
if (alphaPad) alphaPad.addEventListener('click', handleKeypadClick);


// Confirm button - navigate with cita mode
btnConfirmar?.addEventListener('click', () => {
    if (docValue.length < 1) {
        errorContainer?.classList.remove('hidden');
        setTimeout(() => errorContainer?.classList.add('hidden'), 3000);
        return;
    }

    sessionStorage.setItem('docValue', docValue);
    sessionStorage.setItem('docType', 'dni');
    sessionStorage.setItem('mode', 'cita');
    go('/kiosco/confirmacion/');
});

// Sin cita button - navigate with sinCita mode
btnSinCita?.addEventListener('click', () => {
    sessionStorage.setItem('docValue', docValue || 'guest');
    sessionStorage.setItem('docType', 'dni');
    sessionStorage.setItem('mode', 'sinCita');
    go('/kiosco/confirmacion/');
});

// Idle timeout - 60 seconds
startIdleTimeout(60, () => {
    // Already on kiosco, just reset
    docValue = '';
    updateDisplay();
    console.log('Idle timeout: reset');
});

// Initialize display
updateDisplay();
