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
                <div class="page-title">Добро пожаловать, ${escapeHtml(auth.getUser().username)}</div>
                <div class="page-subtitle">Обзор ваших сервисов и ресурсов</div>
            </div>
        </div>

        <div class="grid grid-4">
            <div class="card stat-card">
                <div class="stat-label">Мои сервисы</div>
                <div class="stat-value">${services.length}</div>
                <div class="stat-hint">${activeServices} активных</div>
            </div>
            <div class="card stat-card">
                <div class="stat-label">Ресурсы</div>
                <div class="stat-value">${resources.length}</div>
                <div class="stat-hint">${attachedRes} подключено</div>
            </div>
            <div class="card stat-card">
                <div class="stat-label">SSL истекает скоро</div>
                <div class="stat-value" style="color: ${expiringSoon ? 'var(--warning)' : 'var(--success)'}">${expiringSoon}</div>
                <div class="stat-hint">в ближайшие 30 дней</div>
            </div>
            <div class="card stat-card">
                <div class="stat-label">Просроченные SSL</div>
                <div class="stat-value" style="color: ${expired ? 'var(--danger)' : 'var(--success)'}">${expired}</div>
                <div class="stat-hint">требуют замены</div>
            </div>
        </div>

        <div class="card mt-16">
            <h3 class="mb-16">Мои сервисы</h3>
            ${services.length === 0 ? '<p class="text-dim">У вас пока нет сервисов.</p>' : `
                <table>
                    <thead><tr><th>Название</th><th>Статус</th><th>Создан</th></tr></thead>
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