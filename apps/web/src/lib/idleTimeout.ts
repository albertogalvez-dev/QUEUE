/**
 * Idle timeout utility for kiosco pages
 */

type CleanupFn = () => void;

/**
 * Start an idle timeout that triggers after no user activity
 * @param seconds - Timeout duration in seconds
 * @param onTimeout - Callback when timeout is reached
 * @returns Cleanup function to remove listeners and clear timer
 */
export function startIdleTimeout(seconds: number, onTimeout: () => void): CleanupFn {
    let timeoutId: number;

    const resetTimer = () => {
        clearTimeout(timeoutId);
        timeoutId = window.setTimeout(onTimeout, seconds * 1000);
    };

    // Events that indicate user activity
    const events: (keyof WindowEventMap)[] = [
        'mousemove',
        'mousedown',
        'keydown',
        'touchstart',
        'scroll',
    ];

    // Add listeners
    events.forEach((event) => {
        window.addEventListener(event, resetTimer, { passive: true });
    });

    // Start initial timer
    resetTimer();

    // Return cleanup function
    return () => {
        clearTimeout(timeoutId);
        events.forEach((event) => {
            window.removeEventListener(event, resetTimer);
        });
    };
}
