import { api } from '../api.js';
import { auth } from '../auth.js';
import { toast, loading, modal, escapeHtml, emptyState } from '../ui.js';

export async function renderResources() {
    const container = document.getElementById('view-container');
    loading(container);

    const [resources, services] = await Promise.all([
        api.resources.status(),
        auth.isAdmin() ? api.services.my() : Promise.resolve([]),
    ]);

    container.innerHTML = `
        <div class="page-header">
            <div>
                <div class="page-title">Ресурсы</div>
                <div class="page-subtitle">${resources.length} серверов</div>
            </div>
            ${auth.isAdmin() ? `<button class="btn" id="create-btn">+ Добавить сервер</button>` : ''}
        </div>
        <div class="card">
            ${resources.length === 0 ? emptyState('Нет ресурсов', '🖥') : `
                <table>
                    <thead><tr>
                        <th>Hostname</th><th>IP</th><th>CPU</th><th>RAM</th><th>Disk</th>
                        <th>Сервис</th><th>Статус</th>${auth.isAdmin()?'<th></th>':''}
                    </tr></thead>
                    <tbody>
                        ${resources.map(r => `
                            <tr>
                                <td><b>${escapeHtml(r.hostname)}</b></td>
                                <td><code>${escapeHtml(r.ip_address)}</code></td>
                                <td>${r.cpu_cores} cores</td>
                                <td>${r.ram_gb} GB</td>
                                <td>${r.disk_gb} GB</td>
                                <td>${r.service_name 
                                    ? `<b>${escapeHtml(r.service_name)}</b> <span class="text-dim">#${r.service_id}</span>` 
                                    : '<span class="text-dim">свободен</span>'}</td>
                                <td>${r.is_attached 
                                    ? '<span class="badge badge-active">Attached</span>' 
                                    : '<span class="badge badge-inactive">Free</span>'}</td>
                                ${auth.isAdmin() ? `<td>
                                    ${r.is_attached
                                        ? `<button class="btn btn-sm btn-ghost" data-detach="${r.id}">Отвязать</button>`
                                        : `<button class="btn btn-sm" data-allocate="${r.id}">Привязать</button>`}
                                </td>` : ''}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `}
        </div>
    `;

    if (auth.isAdmin()) {
        document.getElementById('create-btn').onclick = () => openCreateModal();
        container.querySelectorAll('[data-detach]').forEach(b => b.onclick = async () => {
            try {
                await api.resources.detach(b.dataset.detach);
                toast.success('Ресурс отвязан');
                renderResources();
            } catch (e) { toast.error(e.message); }
        });
        container.querySelectorAll('[data-allocate]').forEach(b => b.onclick = () => openAllocateModal(b.dataset.allocate, services));
    }
}

function openCreateModal() {
    modal({
        title: 'Новый сервер',
        body: `
            <div class="grid grid-2">
                <div class="form-group"><label>Hostname *</label><input class="form-control" id="f-host" /></div>
                <div class="form-group"><label>IP адрес *</label><input class="form-control" id="f-ip" placeholder="192.168.1.10" /></div>
                <div class="form-group"><label>CPU cores</label><input type="number" class="form-control" id="f-cpu" min="1" value="4" /></div>
                <div class="form-group"><label>RAM (GB)</label><input type="number" class="form-control" id="f-ram" min="1" value="8" /></div>
                <div class="form-group"><label>Disk (GB)</label><input type="number" class="form-control" id="f-disk" min="1" value="100" /></div>
            </div>
        `,
        confirmText: 'Добавить',
        onConfirm: async () => {
            const payload = {
                hostname: document.getElementById('f-host').value.trim(),
                ip_address: document.getElementById('f-ip').value.trim(),
                cpu_cores: +document.getElementById('f-cpu').value,
                ram_gb: +document.getElementById('f-ram').value,
                disk_gb: +document.getElementById('f-disk').value,
            };
            if (!payload.hostname || !payload.ip_address) { toast.error('Заполните все поля'); return false; }
            try {
                await api.resources.create(payload);
                toast.success('Сервер добавлен');
                renderResources();
                return true;
            } catch (e) { toast.error(e.message); return false; }
        }
    });
}

function openAllocateModal(resourceId, services) {
    if (services.length === 0) { toast.warning('Сначала создайте сервис'); return; }
    modal({
        title: 'Привязать к сервису',
        body: `
            <div class="form-group">
                <label>Сервис</label>
                <select class="form-control" id="f-svc">
                    ${services.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}
                </select>
            </div>
        `,
        confirmText: 'Привязать',
        onConfirm: async () => {
            try {
                await api.resources.allocate(resourceId, +document.getElementById('f-svc').value);
                toast.success('Ресурс привязан');
                renderResources();
                return true;
            } catch (e) { toast.error(e.message); return false; }
        }
    });
}