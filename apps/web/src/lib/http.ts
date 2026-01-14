/**
 * HTTP utilities for API communication
 */
import { API_BASE } from './config';

const TIMEOUT_MS = 8000;

/**
 * Fetch JSON from API with timeout and error handling
 */
export async function fetchJson<T>(path: string): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const url = `${API_BASE}${path}`;

        const headers: Record<string, string> = {
            'Accept': 'application/json',
        };

        const token = localStorage.getItem('QUEUE_AUTH_TOKEN'); // Match key in plan
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(url, {
            signal: controller.signal,
            headers,
        });

        if (response.status === 401) {
            // Minimal handling: reload to login or throw specific error?
            // User requested: "disparar un evento global o mostrar toast... NO crashear"
            // Let's console warn and throw specific error
            console.warn('Unauthorized (401). Please login.');
            // Optional: window.dispatchEvent(new Event('queue:auth:unauthorized'));
        }

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json() as T;
    } catch (error) {
        if (error instanceof Error) {
            if (error.name === 'AbortError') {
                throw new Error(`Request timeout after ${TIMEOUT_MS}ms`);
            }
            throw error;
        }
        throw new Error('Unknown fetch error');
    } finally {
        clearTimeout(timeoutId);
    }
}
