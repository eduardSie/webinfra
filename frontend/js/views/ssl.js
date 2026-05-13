import { api } from '../api.js';
import { auth } from '../auth.js';
import { toast, loading, modal, confirm, escapeHtml, emptyState, formatDate } from '../ui.js';

export async function renderSSL() {
    const container = document.getElementById('view-container');
    loading(container);

    const [endpoints, certs] = await Promise.all([
        api.endpoints.list(),
        api.ssl.checkExpiry(365),   
    ]);

    container.innerHTML = `
        <div class="page-header">
            <div>
                <div class="page-title">SSL сертифікати</div>
                <div class="page-subtitle">Моніторинг термінів дії</div>
            </div>
            ${auth.isAdmin() ? `<button class="btn" id="attach-btn">+ Прив'язати сертифікат</button>` : ''}
        </div>
        <div class="card">
            ${certs.length === 0 ? emptyState('Сертифікатів не знайдено', '🔒') : `
                <table>
                    <thead><tr>
                        <th>Endpoint</th><th>Сервіс</th><th>Видавець</th>
                        <th>Дійсний до</th><th>Залишилось днів</th><th>Статус</th>
                        ${auth.isAdmin() ? '<th></th>' : ''}
                    </tr></thead>
                    <tbody>
                        ${certs.map(c => {
                            let badge;
                            if (c.is_expired)               badge = '<span class="badge badge-deprecated">Прострочено</span>';
                            else if (c.days_until_expiry <= 14) badge = '<span class="badge badge-maintenance">Скоро закінчиться</span>';
                            else                            badge = '<span class="badge badge-active">OK</span>';
                            return `
                                <tr>
                                    <td><b>${escapeHtml(c.endpoint_domain || '—')}</b></td>
                                    <td>${escapeHtml(c.service_name || '—')}</td>
                                    <td>${escapeHtml(c.issuer)}</td>
                                    <td>${formatDate(c.valid_to)}</td>
                                    <td><b>${c.days_until_expiry}</b></td>
                                    <td>${badge}</td>
                                    ${auth.isAdmin() ? `<td>
                                        <button class="btn btn-sm btn-danger" data-revoke="${c.id}">Відкликати</button>
                                    </td>` : ''}
                                </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            `}
        </div>
    `;

    if (auth.isAdmin()) {
        document.getElementById('attach-btn').onclick = () => {
            if (endpoints.length === 0) { toast.warning('Немає endpoints'); return; }
            const freeEndpoints = endpoints.filter(e => !certs.some(c => c.endpoint_id === e.id));
            if (freeEndpoints.length === 0) { toast.warning('Всі endpoints вже мають сертифікат'); return; }
            modal({
                title: 'Прив\'язати SSL сертифікат',
                body: `
                    <div class="form-group"><label>Endpoint</label>
                        <select class="form-control" id="f-ep">
                            ${freeEndpoints.map(e => `<option value="${e.id}">${escapeHtml(e.domain)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group"><label>Видавець</label>
                        <input class="form-control" id="f-iss" placeholder="Let's Encrypt" /></div>
                    <div class="grid grid-2">
                        <div class="form-group"><label>Дійсний з</label>
                            <input type="datetime-local" class="form-control" id="f-from" /></div>
                        <div class="form-group"><label>Дійсний до</label>
                            <input type="datetime-local" class="form-control" id="f-to" /></div>
                    </div>
                `,
                confirmText: 'Прив\'язати',
                onConfirm: async () => {
                    const issuer = document.getElementById('f-iss').value.trim();
                    const fromVal = document.getElementById('f-from').value;
                    const toVal   = document.getElementById('f-to').value;
                    if (!issuer || !fromVal || !toVal) { toast.error('Заповніть всі поля'); return false; }
                    try {
                        await api.ssl.attach({
                            endpoint_id: +document.getElementById('f-ep').value,
                            issuer,
                            valid_from: new Date(fromVal).toISOString(),
                            valid_to:   new Date(toVal).toISOString(),
                        });
                        toast.success('Сертифікат прив\'язано');
                        renderSSL();
                        return true;
                    } catch (e) { toast.error(e.message); return false; }
                },
            });
        };

        container.querySelectorAll('[data-revoke]').forEach(b => b.onclick = async () => {
            if (!await confirm({
                title: 'Відкликати сертифікат?',
                message: 'SSL-сертифікат буде видалено. Endpoint залишиться активним.',
                confirmText: 'Відкликати',
                danger: true,
            })) return;
            try {
                await api.ssl.revoke(b.dataset.revoke);
                toast.success('Сертифікат відкликано');
                renderSSL();
            } catch (e) { toast.error(e.message); }
        });
    }
}
