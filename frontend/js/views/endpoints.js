import { api } from '../api.js';
import { auth } from '../auth.js';
import { toast, loading, modal, confirm, escapeHtml, emptyState, formatDate } from '../ui.js';

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
                <div class="page-subtitle">Домени сервісів · ${endpoints.length}</div>
            </div>
            ${auth.isAdmin() ? `<button class="btn" id="create-btn">+ Налаштувати endpoint</button>` : ''}
        </div>
        <div class="card">
            ${endpoints.length === 0 ? emptyState('Endpoints не задані', '🌐') : `
                <table>
                    <thead><tr>
                        <th>Домен</th><th>Порт</th><th>Сервіс</th><th>Створено</th>
                        ${auth.isAdmin() ? '<th></th>' : ''}
                    </tr></thead>
                    <tbody>
                        ${endpoints.map(e => `
                            <tr>
                                <td><b>${escapeHtml(e.domain)}</b></td>
                                <td><code>${e.port}</code></td>
                                <td>${e.service_name
                                    ? `<b>${escapeHtml(e.service_name)}</b>`
                                    : `<span class="text-dim">#${e.service_id}</span>`}</td>
                                <td class="text-dim">${formatDate(e.created_at)}</td>
                                ${auth.isAdmin() ? `<td>
                                    <button class="btn btn-sm btn-danger" data-delete="${e.id}">Видалити</button>
                                </td>` : ''}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `}
        </div>
    `;

    if (auth.isAdmin()) {
        document.getElementById('create-btn').onclick = () => {
            if (services.length === 0) { toast.warning('Спочатку створіть сервіс'); return; }
            modal({
                title: 'Новий endpoint',
                body: `
                    <div class="form-group"><label>Домен *</label>
                        <input class="form-control" id="f-dom" placeholder="api.company.com" /></div>
                    <div class="form-group"><label>Порт</label>
                        <input type="number" class="form-control" id="f-port" value="443" min="1" max="65535" /></div>
                    <div class="form-group"><label>Сервіс</label>
                        <select class="form-control" id="f-svc">
                            ${services.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}
                        </select>
                    </div>
                `,
                confirmText: 'Створити',
                onConfirm: async () => {
                    try {
                        await api.endpoints.create({
                            domain:     document.getElementById('f-dom').value.trim(),
                            port:       +document.getElementById('f-port').value,
                            service_id: +document.getElementById('f-svc').value,
                        });
                        toast.success('Endpoint створено');
                        renderEndpoints();
                        return true;
                    } catch (e) { toast.error(e.message); return false; }
                },
            });
        };

        container.querySelectorAll('[data-delete]').forEach(b => b.onclick = async () => {
            if (!await confirm({
                title: 'Видалення endpoint',
                message: 'Endpoint і прив\'язаний SSL-сертифікат будуть видалені. Продовжити?',
                confirmText: 'Видалити',
                danger: true,
            })) return;
            try {
                await api.endpoints.delete(b.dataset.delete);
                toast.success('Endpoint видалено');
                renderEndpoints();
            } catch (e) { toast.error(e.message); }
        });
    }
}
