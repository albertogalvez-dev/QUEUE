/**
 * Store Sync - Cross-tab synchronization using localStorage events
 * Listens for changes from other tabs and triggers callbacks
 */

const STORAGE_KEY = 'QUEUE_DEMO_STATE_V1';
const PING_KEY = 'QUEUE_DEMO_PING';

/**
 * Start listening for cross-tab storage changes
 * @param onChange Callback to execute when another tab modifies the store
 * @returns Cleanup function to stop listening
 */
export function startStoreSync(onChange: () => void): () => void {
    const handleStorage = (e: StorageEvent) => {
        // Trigger on main state change or ping
        if (e.key === STORAGE_KEY || e.key === PING_KEY) {
            onChange();
        }
    };

    window.addEventListener('storage', handleStorage);

    return () => {
        window.removeEventListener('storage', handleStorage);
    };
}

/**
 * Simple debounce utility for preventing render spam
 */
export function debounce<T extends (...args: unknown[]) => void>(
    fn: T,
    delay: number
): T {
    let timeoutId: ReturnType<typeof setTimeout>;
    return ((...args: unknown[]) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    }) as T;
}
