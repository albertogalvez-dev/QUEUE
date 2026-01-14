/**
 * Application configuration from environment variables
 * Feature flags and API settings
 */

/** Use backend API instead of mockStore for /pantalla */
export const USE_API = import.meta.env.VITE_USE_API === 'true';

/** Backend API base URL */
export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5150';

// Debug logging for config
if (import.meta.env.DEV) {
    console.log('[Config] USE_API:', USE_API);
    console.log('[Config] API_BASE:', API_BASE);
}
