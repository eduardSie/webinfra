import { api } from '../api.js';
import { auth } from '../auth.js';
import { loading, escapeHtml, statusBadge } from '../ui.js';

export async function renderDashboard() {
    const container = document.getElementById('view-container');
    loading(container);

    const [services, resources, ssl] = await Promise.all([
        api.services.my().catch(() => []),
        api.resources.status().catch(() => []),
        api.ssl.checkExpiry(30).catch(() => []),
    ]);

    const activeServices = services.filter(s => s.status === 'active').length;
    const attachedRes = resources.filter(r => r.is_attached).length;
    const expiringSoon = ssl.filter(s => !s.is_expired).length;
    const expired = ssl.filter(s => s.is_expired).length;

    container.innerHTML = `
        <div class="page-header">
            <div>
                <div class="page-title">Welcome, ${escapeHtml(auth.getUser().username)}</div>
                <div class="page-subtitle">Overview of your services and resources</div>
            </div>
        </div>

        <div class="grid grid-4">
            <div class="card stat-card">
                <div class="stat-label">My Services</div>
                <div class="stat-value">${services.length}</div>
                <div class="stat-hint">${activeServices} active</div>
            </div>
            <div class="card stat-card">
                <div class="stat-label">Resources</div>
                <div class="stat-value">${resources.length}</div>
                <div class="stat-hint">${attachedRes} attached</div>
            </div>
            <div class="card stat-card">
                <div class="stat-label">SSL Expiring Soon</div>
                <div class="stat-value" style="color: ${expiringSoon ? 'var(--warning)' : 'var(--success)'}">${expiringSoon}</div>
                <div class="stat-hint">in the next 30 days</div>
            </div>
            <div class="card stat-card">
                <div class="stat-label">Expired SSL</div>
                <div class="stat-value" style="color: ${expired ? 'var(--danger)' : 'var(--success)'}">${expired}</div>
                <div class="stat-hint">require replacement</div>
            </div>
        </div>

        <div class="card mt-16">
            <h3 class="mb-16">My Services</h3>
            ${services.length === 0 ? '<p class="text-dim">You don\'t have any services yet.</p>' : `
                <table>
                    <thead><tr><th>Name</th><th>Status</th><th>Created</th></tr></thead>
                    <tbody>
                        ${services.map(s => `
                            <tr style="cursor:pointer" onclick="location.hash='#/services/${s.id}'">
                                <td><b>${escapeHtml(s.name)}</b></td>
                                <td>${statusBadge(s.status)}</td>
                                <td class="text-dim">${new Date(s.created_at).toLocaleDateString('ru-RU')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `}
        </div>
    `;
}