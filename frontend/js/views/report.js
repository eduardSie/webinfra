import { api } from '../api.js';
import { loading, escapeHtml } from '../ui.js';

export async function renderReport() {
    const container = document.getElementById('view-container');
    loading(container);
    const r = await api.reports.global();

    container.innerHTML = `
        <div class="page-header">
            <div>
                <div class="page-title">Global Infrastructure Report</div>
                <div class="page-subtitle">Summary across the entire platform</div>
            </div>
        </div>

        <div class="grid grid-4">
            <div class="card stat-card">
                <div class="stat-label">Total Services</div>
                <div class="stat-value">${r.services.total}</div>
            </div>
            <div class="card stat-card">
                <div class="stat-label">Resources</div>
                <div class="stat-value">${r.resources.total}</div>
                <div class="stat-hint">${r.resources.attached} attached · ${r.resources.free} free</div>
            </div>
            <div class="card stat-card">
                <div class="stat-label">Endpoints</div>
                <div class="stat-value">${r.network.endpoints}</div>
                <div class="stat-hint">${r.network.ssl_certificates} SSL</div>
            </div>
            <div class="card stat-card">
                <div class="stat-label">Total Capacity</div>
                <div class="stat-value">${r.resources.capacity.cpu_cores}</div>
                <div class="stat-hint">CPU cores</div>
            </div>
        </div>

        <div class="grid grid-2 mt-16">
            <div class="card">
                <h3>Services by Status</h3>
                ${Object.entries(r.services.by_status).map(([k, v]) => `
                    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
                        <span class="badge badge-${k}">${k}</span>
                        <b>${v}</b>
                    </div>
                `).join('') || '<p class="text-dim">No data available</p>'}
            </div>
            <div class="card">
                <h3>Total Resources</h3>
                <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
                    <span>CPU cores</span><b>${r.resources.capacity.cpu_cores}</b>
                </div>
                <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
                    <span>RAM</span><b>${r.resources.capacity.ram_gb} GB</b>
                </div>
                <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
                    <span>Disk</span><b>${r.resources.capacity.disk_gb} GB</b>
                </div>
            </div>
        </div>
    `;
}