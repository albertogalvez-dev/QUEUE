/**
 * Pantalla page - TV waiting room display
 * Supports dual mode: API (backend) or mockStore (local)
 * Controlled by VITE_USE_API environment variable
 */

// === Configuration & Imports ===
import { USE_API } from '../lib/config';
import { fetchJson } from '../lib/http';
import type { DisplayDto } from '../lib/apiTypes';
import { getDisplay, initDemoStateIfNeeded, subscribe, getAllActiveTickets, type TicketStatus } from '../lib/mockStore';
import { startStoreSync } from '../lib/storeSync';

console.log('page: pantalla');
console.log(`[Pantalla] Mode: ${USE_API ? 'API' : 'mockStore'}`);

// === Types ===
interface DisplayData {
  nowServing: DisplayRow[];
  next: DisplayRow[];
}

interface DisplayRow {
  ticketCode: string;
  serviceName: string;
  counterName: string;
  status?: TicketStatus;
}

interface CalloutEvent {
  ticketCode: string;
  status: TicketStatus;
  counterName: string;
  serviceName: string;
}

// === State ===
let lastDisplayData: DisplayData | null = null;
let lastApiError = false;

// Callout state
const lastStatusByTicketCode = new Map<string, TicketStatus>();
const lastEnqueuedAtByTicketCode = new Map<string, number>();
const calloutQueue: CalloutEvent[] = [];
let isShowingCallout = false;

// Config State
let soundEnabled = localStorage.getItem("QUEUE_TV_SOUND") === "true";
let autoDemoEnabled = localStorage.getItem("QUEUE_TV_AUTODEMO") === "true";
let lastFeaturedCode = "";

// Debug mode
const isDebug = new URLSearchParams(window.location.search).has('debug');
if (isDebug) {
  console.log('DISPLAY DEBUG: active');
  console.log(`DISPLAY DEBUG: USE_API = ${USE_API}`);
}

// === DOM Elements ===
const nowServingPrimary = document.getElementById('now-serving-primary');
const nowServingSecondary = document.getElementById('now-serving-secondary');
const nextList = document.getElementById('next-list');
const overlay = document.getElementById('callout-overlay');
const calloutStatusEl = document.getElementById('callout-status');
const calloutTicketEl = document.getElementById('callout-ticket');
const calloutCounterEl = document.getElementById('callout-counter');
const calloutServiceEl = document.getElementById('callout-service');
const tickerTrack = document.getElementById('tv-ticker-track');
const historyList = document.getElementById('history-list');

// Controls
const btnSound = document.getElementById('tv-sound-toggle');
const btnAuto = document.getElementById('tv-auto-toggle');
const btnFs = document.getElementById('tv-fullscreen-btn');
const controlsContainer = document.getElementById('tv-controls');

// === History State ===
const HISTORY_KEY = 'QUEUE_DISPLAY_HISTORY';
const MAX_HISTORY = 3;

interface HistoryEntry {
  ticketCode: string;
  counterName: string;
  status: TicketStatus;
  timestamp: number;
}

let callHistory: HistoryEntry[] = [];

// Load history from localStorage
function loadHistory(): void {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (stored) {
      callHistory = JSON.parse(stored);
    }
  } catch {
    callHistory = [];
  }
}

// Save history to localStorage
function saveHistory(): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(callHistory));
  } catch {
    // Ignore storage errors
  }
}

// Add to history
function addToHistory(event: CalloutEvent): void {
  const entry: HistoryEntry = {
    ticketCode: event.ticketCode,
    counterName: event.counterName,
    status: event.status,
    timestamp: Date.now()
  };

  // Don't add duplicates of the same ticket
  if (callHistory.length > 0 && callHistory[0].ticketCode === entry.ticketCode) {
    return;
  }

  callHistory.unshift(entry);
  if (callHistory.length > MAX_HISTORY) {
    callHistory = callHistory.slice(0, MAX_HISTORY);
  }
  saveHistory();
  renderHistory();
}

// Render history list
function renderHistory(): void {
  if (!historyList) return;

  if (callHistory.length === 0) {
    historyList.innerHTML = '<div class="text-gray-400 text-sm italic">Sin historial</div>';
    return;
  }

  historyList.innerHTML = callHistory.map((entry, i) => {
    const statusColor = entry.status === 'Serving' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-primary';
    const opacity = i === 0 ? 'opacity-100' : i === 1 ? 'opacity-80' : 'opacity-60';
    return `
      <div class="flex items-center gap-3 px-4 py-2 bg-white rounded-lg border border-gray-100 shadow-sm ${opacity} transition-all">
        <span class="font-bold text-lg text-neutral-dark tabular-nums">${entry.ticketCode}</span>
        <span class="text-sm text-gray-500">→</span>
        <span class="text-sm font-medium text-gray-600">${entry.counterName}</span>
        <span class="text-xs px-2 py-0.5 rounded-full ${statusColor} font-medium uppercase">
          ${entry.status === 'Serving' ? 'Atendido' : 'Llamado'}
        </span>
      </div>
    `;
  }).join('');
}

// === Initialize ===
if (!USE_API) {
  initDemoStateIfNeeded();
}

// Load history on init
loadHistory();
renderHistory();
initControls();

// === Data Loading ===

/**
 * Load display data from API or mockStore
 */
async function loadDisplay(): Promise<DisplayData> {
  if (USE_API) {
    try {
      const dto = await fetchJson<DisplayDto>('/api/display');
      lastApiError = false;
      return normalizeApiData(dto);
    } catch (error) {
      if (!lastApiError) {
        console.warn('[Pantalla] API error:', error);
        lastApiError = true;
      }
      // Return last known data or empty
      return lastDisplayData || { nowServing: [], next: [] };
    }
  } else {
    const data = getDisplay();
    return {
      nowServing: data.nowServing.map(r => ({
        ticketCode: r.ticketCode,
        serviceName: r.serviceName,
        counterName: r.counterName || 'Puesto'
      })),
      next: data.next.map(r => ({
        ticketCode: r.ticketCode,
        serviceName: r.serviceName,
        counterName: r.counterName || ''
      }))
    };
  }
}

/**
 * Normalize API response to internal format
 */
function normalizeApiData(dto: DisplayDto): DisplayData {
  return {
    nowServing: dto.nowServing.map(r => ({
      ticketCode: r.code,  // Map API 'code' to internal 'ticketCode'
      serviceName: r.serviceName,
      counterName: r.counterName || 'Puesto',
      status: r.status as TicketStatus
    })),
    next: dto.next.map(r => ({
      ticketCode: r.code,  // Map API 'code' to internal 'ticketCode'
      serviceName: r.serviceName,
      counterName: r.counterName || '',
      status: r.status as TicketStatus
    }))
  };
}

// === Rendering ===

function renderDisplay(data: DisplayData): void {
  const { nowServing, next } = data;

  // Render primary now serving card
  if (nowServingPrimary && nowServing.length > 0) {
    const primary = nowServing[0];
    const isNew = primary.ticketCode !== lastFeaturedCode;

    if (isNew) {
      lastFeaturedCode = primary.ticketCode;
      // Trigger Pulse on container via class toggle logic or key (react-style)
      // Since we replace innerHTML, we can just animate the new content or the container
      if (nowServingPrimary) {
        nowServingPrimary.classList.remove('tv-pulse');
        void nowServingPrimary.offsetWidth; // trigger reflow
        nowServingPrimary.classList.add('tv-pulse');
      }
    }

    nowServingPrimary.innerHTML = `
            <div class="absolute top-0 right-0 p-4 opacity-10">
                <span class="material-symbols-outlined text-9xl text-primary">campaign</span>
            </div>
            <div class="flex justify-between items-start z-10">
                <div>
                    <span class="bg-green-100 text-primary px-4 py-1 rounded-full text-lg font-bold uppercase tracking-wider mb-2 inline-block">Llamando</span>
                    <div class="text-gray-500 text-2xl font-medium uppercase mt-2">${primary.serviceName}</div>
                </div>
                <div class="text-right">
                    <div class="text-gray-900 text-5xl font-bold">${primary.counterName}</div>
                </div>
            </div>
            <div class="flex justify-center items-center py-6 z-10">
                <div class="text-[10rem] font-extrabold text-primary leading-none tracking-tighter tabular-nums">${primary.ticketCode}</div>
            </div>
        `;
  } else if (nowServingPrimary) {
    lastFeaturedCode = ""; // Reset
    nowServingPrimary.innerHTML = `
            <div class="absolute top-0 right-0 p-4 opacity-10">
                <span class="material-symbols-outlined text-9xl text-gray-300">hourglass_empty</span>
            </div>
            <div class="flex justify-center items-center h-full z-10">
                <div class="text-center">
                    <div class="text-gray-400 text-3xl font-medium">Sin llamadas activas</div>
                    <div class="text-gray-300 text-xl mt-2">Espere su turno</div>
                </div>
            </div>
        `;
  }

  // Render secondary now serving cards
  if (nowServingSecondary) {
    if (nowServing.length > 1) {
      const secondary = nowServing.slice(1, 3);
      nowServingSecondary.innerHTML = secondary.map(item => `
                <div class="bg-white rounded-xl border border-gray-100 p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
                    <div class="flex justify-between items-start mb-3">
                        <span class="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wider">En atención</span>
                        <span class="text-gray-500 font-bold">${item.counterName}</span>
                    </div>
                    <div class="text-center">
                        <span class="text-5xl font-bold text-neutral-dark tabular-nums">${item.ticketCode}</span>
                    </div>
                    <div class="text-gray-500 text-sm font-medium uppercase mt-2 text-center">${item.serviceName}</div>
                </div>
            `).join('');
    } else {
      nowServingSecondary.innerHTML = `
                <div class="bg-gray-50 rounded-xl border border-gray-100 p-5 flex flex-col justify-center opacity-50">
                    <div class="text-center text-gray-300"><span class="text-5xl font-bold">---</span></div>
                </div>
                <div class="bg-gray-50 rounded-xl border border-gray-100 p-5 flex flex-col justify-center opacity-50">
                    <div class="text-center text-gray-300"><span class="text-5xl font-bold">---</span></div>
                </div>
            `;
    }
  }

  // Render next list
  if (nextList) {
    if (next.length > 0) {
      nextList.innerHTML = next.map((item, i) => `
                <div class="grid grid-cols-12 gap-4 px-6 py-4 items-center ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50 rounded-lg'} border-b border-gray-100">
                    <div class="col-span-4 text-4xl font-bold text-neutral-dark tabular-nums">${item.ticketCode}</div>
                    <div class="col-span-8 text-2xl text-gray-600 font-medium truncate">${item.serviceName}</div>
                </div>
            `).join('');
    } else {
      nextList.innerHTML = `
                <div class="flex items-center justify-center h-full text-gray-300">
                    <span class="text-2xl">No hay turnos en espera</span>
                </div>
            `;
    }
  }

  // Store for next comparison
  lastDisplayData = data;
}

// === Clock ===

function updateClock(): void {
  const now = new Date();
  const timeEl = document.querySelector('.text-4xl.font-bold.text-neutral-dark');
  const dayEl = document.querySelector('.text-xl.font-medium.text-gray-600');
  const dateEl = document.querySelector('.text-lg.text-gray-500');

  if (timeEl) {
    timeEl.textContent = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }
  if (dayEl) {
    dayEl.textContent = now.toLocaleDateString('es-ES', { weekday: 'long' }).toUpperCase();
  }
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  }
}

// === Callout Detection ===

function detectEventsFromDisplay(data: DisplayData): void {
  const now = Date.now();

  // Check nowServing for new Called/Serving tickets
  data.nowServing.forEach(row => {
    const prevStatus = lastStatusByTicketCode.get(row.ticketCode);
    const currStatus = row.status || 'Called'; // Default to Called if in nowServing

    // Detect new appearance or status change
    if (!prevStatus || (currStatus !== prevStatus && (currStatus === 'Called' || currStatus === 'Serving'))) {
      const lastTime = lastEnqueuedAtByTicketCode.get(row.ticketCode) || 0;
      if (now - lastTime > 2000) { // 2s debounce
        if (isDebug) console.log(`DISPLAY DEBUG: Callout for ${row.ticketCode} -> ${currStatus}`);

        calloutQueue.push({
          ticketCode: row.ticketCode,
          status: currStatus,
          counterName: row.counterName,
          serviceName: row.serviceName
        });
        lastEnqueuedAtByTicketCode.set(row.ticketCode, now);
      }
    }
    lastStatusByTicketCode.set(row.ticketCode, currStatus);
  });
}

function detectEventsFromMockStore(): void {
  const tickets = getAllActiveTickets();
  const now = Date.now();

  tickets.forEach(ticket => {
    const prevStatus = lastStatusByTicketCode.get(ticket.code);
    const currStatus = ticket.status;

    if ((currStatus === 'Called' || currStatus === 'Serving') && prevStatus !== currStatus) {
      const lastTime = lastEnqueuedAtByTicketCode.get(ticket.code) || 0;
      if (now - lastTime > 2000) {
        if (isDebug) console.log(`DISPLAY DEBUG: Callout for ${ticket.code} -> ${currStatus}`);

        calloutQueue.push({
          ticketCode: ticket.code,
          status: currStatus,
          counterName: ticket.counterName || 'Puesto',
          serviceName: ticket.serviceName
        });
        lastEnqueuedAtByTicketCode.set(ticket.code, now);
      }
    }
    lastStatusByTicketCode.set(ticket.code, currStatus);
  });
}

// === Callout Display ===

function showNextCallout(): void {
  if (isShowingCallout || calloutQueue.length === 0 || !overlay) return;

  const event = calloutQueue.shift();
  if (!event) return;

  isShowingCallout = true;
  if (isDebug) console.log(`DISPLAY DEBUG: Showing callout for ${event.ticketCode} (${event.status})`);

  // Play Chime
  if (soundEnabled) {
    playChime();
  }

  // Pause ticker
  if (tickerTrack) tickerTrack.classList.add('paused');

  // Update content
  if (calloutStatusEl) {
    calloutStatusEl.textContent = event.status === 'Called' ? 'LLAMADO' : 'EN ATENCIÓN';
    calloutStatusEl.setAttribute('data-testid', 'tv-status-label');
  }
  if (calloutTicketEl) calloutTicketEl.textContent = event.ticketCode;
  if (calloutCounterEl) calloutCounterEl.textContent = event.counterName;
  if (calloutServiceEl) calloutServiceEl.textContent = event.serviceName;

  // Add to history
  addToHistory(event);

  // Set style based on status
  if (event.status === 'Serving') {
    overlay.classList.add('serving');
  } else {
    overlay.classList.remove('serving');
  }

  // Show overlay
  overlay.classList.remove('opacity-0', 'pointer-events-none', 'scale-95');
  overlay.classList.add('show', 'opacity-100', 'scale-100');

  // Hide after 2.5s
  setTimeout(() => {
    overlay.classList.remove('show', 'opacity-100', 'scale-100');
    overlay.classList.add('opacity-0', 'pointer-events-none', 'scale-95');

    // Resume ticker
    if (tickerTrack) tickerTrack.classList.remove('paused');

    // Process next
    setTimeout(() => {
      isShowingCallout = false;
      showNextCallout();
    }, 300);
  }, 2500);
}

// === Controls & Audio ===

function initControls() {
  // Sound
  updateSoundBtn();
  btnSound?.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    localStorage.setItem("QUEUE_TV_SOUND", soundEnabled.toString());
    updateSoundBtn();
    if (soundEnabled) playChime(); // Test
  });

  // Auto Demo
  updateAutoBtn();
  btnAuto?.addEventListener('click', () => {
    autoDemoEnabled = !autoDemoEnabled;
    localStorage.setItem("QUEUE_TV_AUTODEMO", autoDemoEnabled.toString());
    updateAutoBtn();
  });

  // Fullscreen
  btnFs?.addEventListener('click', toggleFullscreen);

  // Auto Hide
  let hideTimer: any;
  function resetHideTimer() {
    controlsContainer?.classList.remove('hidden-controls');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (document.fullscreenElement) {
        controlsContainer?.classList.add('hidden-controls');
      }
    }, 3000);
  }

  document.addEventListener('mousemove', resetHideTimer);
  document.addEventListener('keydown', resetHideTimer);
  resetHideTimer();
}

function updateSoundBtn() {
  if (!btnSound) return;
  const icon = btnSound.querySelector('span');
  if (soundEnabled) {
    btnSound.classList.add('active');
    if (icon) icon.textContent = 'volume_up';
  } else {
    btnSound.classList.remove('active');
    if (icon) icon.textContent = 'volume_off';
  }
}

function updateAutoBtn() {
  if (!btnAuto) return;
  if (autoDemoEnabled) {
    btnAuto.classList.add('active');
  } else {
    btnAuto.classList.remove('active');
  }
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(e => console.warn(e));
    if (btnFs) btnFs.querySelector('span')!.textContent = 'fullscreen_exit';
  } else {
    document.exitFullscreen();
    if (btnFs) btnFs.querySelector('span')!.textContent = 'fullscreen';
  }
}

async function playChime() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    // Oscillator 1 (Main Tone)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

    osc.start();
    osc.stop(ctx.currentTime + 0.5);

    // Oscillator 2 (Harmonic)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(880, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);

    gain2.gain.setValueAtTime(0.05, ctx.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    osc2.start();
    osc2.stop(ctx.currentTime + 0.4);
  } catch (e) {
    console.warn("Audio play failed", e);
  }
}

// === Auto Demo Loop ===
// Scroll list randomly if enabled
setInterval(() => {
  if (!autoDemoEnabled || !nextList) return;
  const parent = nextList.closest('.flex-1.overflow-hidden'); // The scroll container
  if (!parent) return;

  // Simple scroll animation
  if (parent.scrollTop + parent.clientHeight >= parent.scrollHeight - 10) {
    parent.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    parent.scrollBy({ top: 100, behavior: 'smooth' });
  }
}, 8000);


// === Main Update Loop ===

async function updateAndRender(source: string = 'init'): Promise<void> {
  if (isDebug) console.log(`DISPLAY DEBUG: Update from ${source}`);

  const data = await loadDisplay();
  renderDisplay(data);

  if (USE_API) {
    detectEventsFromDisplay(data);
  } else {
    detectEventsFromMockStore();
  }

  showNextCallout();
}

// === Initialization ===

// Initial render
updateAndRender('init');
updateClock();

// Auto-refresh every 3 seconds
setInterval(() => {
  updateAndRender('interval');
}, 3000);

// Update clock every second
setInterval(updateClock, 1000);

// Cross-tab sync (mockStore mode only)
if (!USE_API) {
  startStoreSync(() => updateAndRender('storeSync'));
  subscribe(() => updateAndRender('subscribe'));
}
