import { api } from '../api.js';
import { auth } from '../auth.js';
import { toast, loading, modal, escapeHtml, emptyState, formatDate } from '../ui.js';

export async function renderEndpoints() {
    const container = document.getElementById('view-container');
    loading(container);

    const [endpoints, services] = await Promise.all([
        api.endpoints.list(),
        auth.isAdmin() ? api.services.my() : Promise.resolve([]),
    ]);

    container.innerHTML = `
        <div class="page-header">
            <div>
                <div class="page-title">Endpoints</div>
                <div class="page-subtitle">Домены сервисов · ${endpoints.length}</div>
            </div>
            ${auth.isAdmin() ? `<button class="btn" id="create-btn">+ Настроить endpoint</button>` : ''}
        </div>
        <div class="card">
            ${endpoints.length === 0 ? emptyState('Endpoints не заданы', '🌐') : `
                <table>
                    <thead><tr><th>Домен</th><th>Порт</th><th>Сервис</th><th>Создан</th></tr></thead>
                    <tbody>
                        ${endpoints.map(e => `
                            <tr>
                                <td><b>${escapeHtml(e.domain)}</b></td>
                                <td><code>${e.port}</code></td>
                                <td>${e.service_name 
                                    ? `<b>${escapeHtml(e.service_name)}</b>` 
                                    : `<span class="text-dim">#${e.service_id}</span>`}</td>

                                <td class="text-dim">${formatDate(e.created_at)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `}
        </div>
    `;

    if (auth.isAdmin()) {
        document.getElementById('create-btn').onclick = () => {
            if (services.length === 0) { toast.warning('Сначала создайте сервис'); return; }
            modal({
                title: 'Новый endpoint',
                body: `
                    <div class="form-group"><label>Домен *</label>
                        <input class="form-control" id="f-dom" placeholder="api.company.com" /></div>
                    <div class="form-group"><label>Порт</label>
                        <input type="number" class="form-control" id="f-port" value="443" /></div>
                    <div class="form-group"><label>Сервис</label>
                        <select class="form-control" id="f-svc">
                            ${services.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}
                        </select>
                    </div>
                `,
                confirmText: 'Создать',
                onConfirm: async () => {
                    try {
                        await api.endpoints.create({
                            domain: document.getElementById('f-dom').value.trim(),
                            port: +document.getElementById('f-port').value,
                            service_id: +document.getElementById('f-svc').value,
                        });
                        toast.success('Endpoint создан');
                        renderEndpoints();
                        return true;
                    } catch (e) { toast.error(e.message); return false; }
                }
            });
        };
    }
}