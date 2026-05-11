import { api } from '../api.js';
import { auth } from '../auth.js';
import { toast, loading, modal, escapeHtml, emptyState, formatDate } from '../ui.js';

export async function renderSSL() {
    const container = document.getElementById('view-container');
    loading(container);

    const [endpoints, certs] = await Promise.all([
        api.endpoints.list(),
        api.ssl.checkExpiry(365),   // забираем все с запасом для табличного вида
    ]);

    container.innerHTML = `
        <div class="page-header">
            <div>
                <div class="page-title">SSL сертификаты</div>
                <div class="page-subtitle">Мониторинг истекающих ключей</div>
            </div>
            ${auth.isAdmin() ? `<button class="btn" id="attach-btn">+ Привязать сертификат</button>` : ''}
        </div>
        <div class="card">
            ${certs.length === 0 ? emptyState('Сертификатов не найдено', '🔒') : `
                <table>
                    <thead><tr>
                        <th>Endpoint</th><th>Сервис</th><th>Издатель</th>
                        <th>Действителен до</th><th>Осталось дней</th><th>Статус</th>
                    </tr></thead>
                    <tbody>
                        ${certs.map(c => {
                            let badge;
                            if (c.is_expired) badge = '<span class="badge badge-deprecated">Просрочен</span>';
                            else if (c.days_until_expiry <= 14) badge = '<span class="badge badge-maintenance">Скоро истечёт</span>';
                            else badge = '<span class="badge badge-active">OK</span>';
                            return `
                                <tr>
                                    <td><b>${escapeHtml(c.endpoint_domain || '—')}</b></td>
                                    <td>${escapeHtml(c.service_name || '—')}</td>
                                    <td>${escapeHtml(c.issuer)}</td>
                                    <td>${formatDate(c.valid_to)}</td>
                                    <td><b>${c.days_until_expiry}</b></td>
                                    <td>${badge}</td>
                                </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            `}

        </div>
    `;

    if (auth.isAdmin()) {
        document.getElementById('attach-btn').onclick = () => {
            if (endpoints.length === 0) { toast.warning('Нет endpoints'); return; }
            modal({
                title: 'Привязать SSL сертификат',
                body: `
                    <div class="form-group"><label>Endpoint</label>
                        <select class="form-control" id="f-ep">
                            ${endpoints.map(e => `<option value="${e.id}">${escapeHtml(e.domain)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group"><label>Издатель</label>
                        <input class="form-control" id="f-iss" placeholder="Let's Encrypt" /></div>
                    <div class="grid grid-2">
                        <div class="form-group"><label>Действителен с</label>
                            <input type="datetime-local" class="form-control" id="f-from" /></div>
                        <div class="form-group"><label>Действителен до</label>
                            <input type="datetime-local" class="form-control" id="f-to" /></div>
                    </div>
                `,
                confirmText: 'Привязать',
                onConfirm: async () => {
                    try {
                        await api.ssl.attach({
                            endpoint_id: +document.getElementById('f-ep').value,
                            issuer: document.getElementById('f-iss').value.trim(),
                            valid_from: new Date(document.getElementById('f-from').value).toISOString(),
                            valid_to: new Date(document.getElementById('f-to').value).toISOString(),
                        });
                        toast.success('Сертификат привязан');
                        renderSSL();
                        return true;
                    } catch (e) { toast.error(e.message); return false; }
                },
            });
        };
    }
}