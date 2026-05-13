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
                <div class="page-subtitle">Service Domains · ${endpoints.length}</div>
            </div>
            ${auth.isAdmin() ? `<button class="btn" id="create-btn">+ Create Endpoint</button>` : ''}
        </div>
        <div class="card">
            ${endpoints.length === 0 ? emptyState('No endpoints configured', '🌐') : `
                <table>
                    <thead><tr>
                        <th>Domain</th><th>Port</th><th>Service</th><th>Created</th>
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
                                    <button class="btn btn-sm btn-danger" data-delete="${e.id}">Delete</button>
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
            if (services.length === 0) { toast.warning('Create a service first'); return; }
            modal({
                title: 'New Endpoint',
                body: `
                    <div class="form-group"><label>Domain *</label>
                        <input class="form-control" id="f-dom" placeholder="api.company.com" /></div>
                    <div class="form-group"><label>Port</label>
                        <input type="number" class="form-control" id="f-port" value="443" min="1" max="65535" /></div>
                    <div class="form-group"><label>Service</label>
                        <select class="form-control" id="f-svc">
                            ${services.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}
                        </select>
                    </div>
                `,
                confirmText: 'Create',
                onConfirm: async () => {
                    try {
                        await api.endpoints.create({
                            domain:     document.getElementById('f-dom').value.trim(),
                            port:       +document.getElementById('f-port').value,
                            service_id: +document.getElementById('f-svc').value,
                        });
                        toast.success('Endpoint created');
                        renderEndpoints();
                        return true;
                    } catch (e) { toast.error(e.message); return false; }
                },
            });
        };

        container.querySelectorAll('[data-delete]').forEach(b => b.onclick = async () => {
            if (!await confirm({
                title: 'Delete Endpoint',
                message: 'Are you sure you want to delete this endpoint?',
                confirmText: 'Delete',
                danger: true,
            })) return;
            try {
                await api.endpoints.delete(b.dataset.delete);
                toast.success('Endpoint deleted');
                renderEndpoints();
            } catch (e) { toast.error(e.message); }
        });
    }
}
