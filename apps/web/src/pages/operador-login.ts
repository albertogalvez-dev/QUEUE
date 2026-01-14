console.log("page: operador-login");
import { USE_API } from '../lib/config';
import { login } from '../lib/apiClient';

const form = document.querySelector('form');
const emailInput = document.getElementById('email') as HTMLInputElement;
const passwordInput = document.getElementById('password') as HTMLInputElement;
const loginBtn = document.querySelector('button[type="button"]') as HTMLButtonElement;
const roleInputs = document.querySelectorAll('input[name="role"]');

// Quick Demo Login Handler
loginBtn?.addEventListener('click', async () => {
    const rawUsername = emailInput.value.trim(); // "admin" or "operador" or email
    const password = passwordInput.value;

    // Determine selected role for local logic (API returns role)
    // Actually, API returns role.

    // Mapping email to username if needed, or just use raw.
    // Demo users: "admin", "operador".
    // If user types "admin@salud.gov", clean it?
    // Let's just use raw value for now. "admin" "operador" expected.

    if (USE_API) {
        // Real Login
        try {
            loginBtn.disabled = true;
            loginBtn.textContent = "Autenticando...";

            const response = await login(rawUsername, password);

            // Save Token
            localStorage.setItem('QUEUE_AUTH_TOKEN', response.token);
            localStorage.setItem('QUEUE_AUTH_ROLE', response.role);
            localStorage.setItem('QUEUE_AUTH_USERNAME', response.username);

            // Redirect
            window.location.href = '/operador/';
        } catch (error) {
            console.error(error);
            alert("Error de acceso: Credenciales inválidas o servidor no disponible.");
            loginBtn.disabled = false;
            loginBtn.textContent = "Entrar";
            loginBtn.classList.remove('bg-primary');
            loginBtn.classList.add('bg-red-600');
            setTimeout(() => {
                loginBtn.classList.remove('bg-red-600');
                loginBtn.classList.add('bg-primary');
            }, 2000);
        }
    } else {
        // Mock Login (always success for demo)
        if (!rawUsername) {
            alert("Introduce un usuario (demo: operador)");
            return;
        }
        localStorage.setItem('QUEUE_AUTH_ROLE', 'Operator'); // Default
        window.location.href = '/operador/';
    }
});

// Allow Enter key
passwordInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loginBtn.click();
});
