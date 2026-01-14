/**
 * External links configuration
 */

/** Helpdesk URL - opens support system in new tab */
export const HELPDESK_URL = import.meta.env.VITE_HELPDESK_URL || '';

/** Check if Helpdesk is configured */
export const hasHelpdesk = (): boolean => HELPDESK_URL.length > 0;
