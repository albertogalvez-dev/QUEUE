/**
 * Landing page (index) - Demo Reset functionality
 */
import { USE_API } from '../lib/config';
import { resetDemo as apiResetDemo } from '../lib/apiClient';
import { go } from '../lib/nav';

console.log('page: index (landing)');

// Reset button handler
const btnReset = document.getElementById('btn-reset-demo');

btnReset?.addEventListener('click', async () => {
    // Confirmation
    const confirmed = confirm('¿Reiniciar la demo? Esto borrará todos los tickets y dejará el sistema como nuevo.');
    if (!confirmed) return;

    try {
        // Show loading state
        btnReset.textContent = 'Reiniciando...';
        btnReset.setAttribute('disabled', 'true');

        // Call API or reset mock
        if (USE_API) {
            await apiResetDemo();
        } else {
            // Reset mockStore by clearing relevant localStorage keys
            localStorage.removeItem('QUEUE_MOCK_STORE');
            localStorage.removeItem('queue/mockStore');
        }

        // Clear TV history
        localStorage.removeItem('QUEUE_DISPLAY_HISTORY');

        // Show success toast (simple alert for now)
        alert('✅ Demo reiniciada correctamente');

        // Redirect to pantalla to start fresh
        go('/pantalla/');
    } catch (error) {
        console.error('Error resetting demo:', error);
        alert('❌ Error al reiniciar la demo. Comprueba que el backend está corriendo.');

        // Restore button state
        btnReset.innerHTML = `
            <span class="material-symbols-outlined text-[20px]">restart_alt</span>
            <span>Reset Demo</span>
        `;
        btnReset.removeAttribute('disabled');
    }
});
