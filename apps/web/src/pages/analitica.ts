/**
 * Analítica page - Analytics dashboard
 * Uses unified green sidebar with wireAllNav
 */

import { wireAllNav } from '../lib/wireNav';
import { USE_API, API_BASE } from '../lib/config';
import { getAnalyticsSummary } from '../lib/apiClient';
import type { AnalyticsSummaryDto, ServiceStatsDto, AnalyticsEventDto } from '../lib/apiTypes';

console.log('page: analitica');

// Wire all navigation links
wireAllNav();

let _eventSource: EventSource | null = null;

async function loadAnalytics() {
    if (!USE_API) return; // Keep mock if not using API

    try {
        const summary = await getAnalyticsSummary("24h");
        updateKPIs(summary);
        updateBreakdownTable(summary.byService);
    } catch (e) {
        console.error("Failed to load analytics", e);
    }
}

function setupLiveStream() {
    if (!USE_API) return;

    if (_eventSource) {
        _eventSource.close();
    }

    // Build URL with Auth
    let url = `${API_BASE}/api/analytics/stream`;
    const token = localStorage.getItem('QUEUE_AUTH_TOKEN');
    if (token) {
        url += `?access_token=${encodeURIComponent(token)}`;
    }

    const es = new EventSource(url);
    _eventSource = es;

    const indDot = document.getElementById('live-indicator-dot');
    const indPing = document.getElementById('live-indicator-ping');
    const statusText = document.getElementById('live-status-text');

    function setStatus(state: 'connected' | 'connecting' | 'offline') {
        if (!indDot || !statusText) return;
        if (state === 'connected') {
            indDot.classList.remove('bg-gray-400', 'bg-red-500');
            indDot.classList.add('bg-green-500');
            indPing?.classList.remove('hidden');
            statusText.textContent = 'En vivo';
            statusText.className = 'text-xs font-normal text-green-600 ml-1';
        } else if (state === 'connecting') {
            indDot.classList.remove('bg-green-500', 'bg-gray-400');
            indDot.classList.add('bg-yellow-500');
            indPing?.classList.add('hidden');
            statusText.textContent = 'Conectando...';
            statusText.className = 'text-xs font-normal text-yellow-600 ml-1';
        } else {
            indDot.classList.remove('bg-green-500', 'bg-yellow-500');
            indDot.classList.add('bg-gray-400');
            indPing?.classList.add('hidden');
            statusText.textContent = 'Offline';
            statusText.className = 'text-xs font-normal text-gray-500 ml-1';
        }
    }

    es.onopen = () => {
        console.log("[SSE] Connected");
        setStatus('connected');
    };

    es.onerror = (err) => {
        // console.error("[SSE] Error", err);
        // Browser handles reconnection, but we update UI
        if (es.readyState === EventSource.CLOSED) {
            setStatus('offline');
        } else {
            setStatus('connecting');
        }
    };

    es.addEventListener('ticket_event', (e) => {
        try {
            const evt = JSON.parse(e.data) as AnalyticsEventDto;
            addLiveEvent(evt);

            // Debounce refresh
            // Simply call loadAnalytics() to refresh counters
            loadAnalytics();
        } catch (err) {
            console.error("[SSE] Parse error", err);
        }
    });
}

function addLiveEvent(evt: AnalyticsEventDto) {
    const list = document.getElementById('live-feed-list');
    if (!list) return;

    // Remove placeholder
    const placeholder = list.querySelector('li.italic');
    if (placeholder) placeholder.remove();

    const li = document.createElement('li');
    li.className = "flex items-center gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors animate-fade-in-down";

    // Format: TIME | CODE | TYPE | Extra
    const time = new Date(evt.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Type Badge
    let typeClass = "bg-gray-100 text-gray-800";
    let icon = "info";

    switch (evt.type) {
        case "CREATED": typeClass = "bg-blue-100 text-blue-800"; icon = "add_circle"; break;
        case "CALLED": typeClass = "bg-green-100 text-green-800"; icon = "campaign"; break;
        case "STARTED": typeClass = "bg-green-100 text-green-800"; icon = "play_arrow"; break;
        case "FINISHED": typeClass = "bg-gray-100 text-gray-600"; icon = "check_circle"; break;
        case "NOSHOW": typeClass = "bg-red-100 text-red-800"; icon = "person_off"; break;
    }

    li.innerHTML = `
        <span class="text-xs text-gray-400 font-mono">${time}</span>
        <span class="font-bold text-[#101818] dark:text-gray-200">${evt.ticketCode}</span>
        <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${typeClass}">
            <span class="material-symbols-outlined text-[10px]">${icon}</span>
            ${evt.type}
        </span>
        <span class="text-xs text-gray-500 truncate flex-1">${evt.counterId !== '—' ? 'Mesa ' + evt.counterId : ''}</span>
    `;

    list.prepend(li);

    // Limit items
    while (list.children.length > 20) {
        list.lastElementChild?.remove();
    }
}

function updateKPIs(data: AnalyticsSummaryDto) {
    setText('kpi-created', data.totals.created.toString());
    setText('kpi-finished', data.totals.finished.toString());
    setText('kpi-noshow', data.totals.noShow.toString());

    // Rates
    const totalProcessed = data.totals.finished + data.totals.noShow;
    const finishRate = totalProcessed > 0 ? (data.totals.finished / totalProcessed * 100).toFixed(1) : "0";
    const noShowRate = totalProcessed > 0 ? (data.totals.noShow / totalProcessed * 100).toFixed(1) : "0";

    setText('kpi-finished-rate', `${finishRate}% tasa atención`);
    setText('kpi-noshow-rate', `${noShowRate}% tasa abandono`);

    // Wait Time
    const avgWaitMin = Math.round(data.timings.avgWaitSeconds / 60);
    setText('kpi-wait', avgWaitMin.toString());
}

function updateBreakdownTable(services: ServiceStatsDto[]) {
    const tbody = document.getElementById('table-areas-body');
    if (!tbody) return;

    tbody.innerHTML = '';

    services.forEach(s => {
        // Mock status logic based on Wait Time
        let statusColor = 'green';
        let statusText = 'Fluida';
        const waitMin = s.avgWaitSeconds / 60;

        if (waitMin > 30) { statusColor = 'red'; statusText = 'Saturada'; }
        else if (waitMin > 15) { statusColor = 'yellow'; statusText = 'Moderada'; }

        // Mock efficiency
        const efficiency = 90 + Math.floor(Math.random() * 10);

        const tr = document.createElement('tr');
        tr.className = "hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors";
        tr.innerHTML = `
            <td class="px-6 py-4 font-medium text-[#101818] dark:text-white flex items-center gap-3">
                <div class="w-8 h-8 rounded bg-primary/10 text-primary flex items-center justify-center">
                    <span class="material-symbols-outlined text-lg">medical_information</span>
                </div>
                ${s.name}
            </td>
            <td class="px-6 py-4 text-gray-600 dark:text-gray-400">—</td>
            <td class="px-6 py-4 text-center">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-${statusColor}-100 text-${statusColor}-800 dark:bg-${statusColor}-900/30 dark:text-${statusColor}-300">
                    <span class="w-1.5 h-1.5 rounded-full bg-${statusColor}-500"></span>
                    ${statusText}
                </span>
            </td>
            <td class="px-6 py-4 text-center font-bold text-[#101818] dark:text-white">${s.created}</td> <!-- Using Created as surrogate for Active/Load -->
            <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-2">
                    <span class="text-gray-600 dark:text-gray-400">${efficiency}%</span>
                    <div class="w-16 bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                        <div class="bg-primary h-full rounded-full" style="width: ${efficiency}%"></div>
                    </div>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function setText(id: string, text: string) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

// Init
loadAnalytics();
setupLiveStream();
