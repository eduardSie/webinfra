import { api } from '../api.js';
import { auth } from '../auth.js';
import { toast, loading, modal, confirm, escapeHtml, emptyState } from '../ui.js';

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
                <div class="page-title">Resources</div>
                <div class="page-subtitle">${resources.length} servers</div>
            </div>
            ${auth.isAdmin() ? `<button class="btn" id="create-btn">+ Add Server</button>` : ''}
        </div>
        <div class="card">
            ${resources.length === 0 ? emptyState('No resources available', '🖥') : `
                <table>
                    <thead><tr>
                        <th>Hostname</th><th>IP</th><th>CPU</th><th>RAM</th><th>Disk</th>
                        <th>Service</th><th>Status</th>${auth.isAdmin() ? '<th></th>' : ''}
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
                                    : '<span class="text-dim">Free</span>'}</td>
                                <td>${r.is_attached
                                    ? '<span class="badge badge-active">Attached</span>'
                                    : '<span class="badge badge-inactive">Free</span>'}</td>
                                ${auth.isAdmin() ? `<td class="flex gap-8">
                                    ${r.is_attached
                                        ? `<button class="btn btn-sm btn-ghost" data-detach="${r.id}">Detach</button>`
                                        : `<button class="btn btn-sm" data-allocate="${r.id}">Allocate</button>
                                           <button class="btn btn-sm btn-danger" data-delete="${r.id}">Delete</button>`}
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
                toast.success('Resource detached');
                renderResources();
            } catch (e) { toast.error(e.message); }
        });

        container.querySelectorAll('[data-allocate]').forEach(b =>
            b.onclick = () => openAllocateModal(b.dataset.allocate, services));

        container.querySelectorAll('[data-delete]').forEach(b => b.onclick = async () => {
            if (!await confirm({
                title: 'Delete Resource',
                message: 'The server will be deleted permanently. Continue?',
                confirmText: 'Delete',
                danger: true,
            })) return;
            try {
                await api.resources.delete(b.dataset.delete);
                toast.success('Resource deleted');
                renderResources();
            } catch (e) { toast.error(e.message); }
        });
    }
}

function openCreateModal() {
    modal({
        title: 'New Server',
        body: `
            <div class="grid grid-2">
                <div class="form-group"><label>Hostname *</label><input class="form-control" id="f-host" /></div>
                <div class="form-group"><label>IP адреса *</label><input class="form-control" id="f-ip" placeholder="192.168.1.10" /></div>
                <div class="form-group"><label>CPU cores</label><input type="number" class="form-control" id="f-cpu" min="1" max="256" value="4" /></div>
                <div class="form-group"><label>RAM (GB)</label><input type="number" class="form-control" id="f-ram" min="1" value="8" /></div>
                <div class="form-group"><label>Disk (GB)</label><input type="number" class="form-control" id="f-disk" min="1" value="100" /></div>
            </div>
        `,
        confirmText: 'Add Server',
        onConfirm: async () => {
            const payload = {
                hostname:  document.getElementById('f-host').value.trim(),
                ip_address:document.getElementById('f-ip').value.trim(),
                cpu_cores: +document.getElementById('f-cpu').value,
                ram_gb:    +document.getElementById('f-ram').value,
                disk_gb:   +document.getElementById('f-disk').value,
            };
            if (!payload.hostname || !payload.ip_address) { toast.error('Fill in all fields'); return false; }
            try {
                await api.resources.create(payload);
                toast.success('Server added');
                renderResources();
                return true;
            } catch (e) { toast.error(e.message); return false; }
        },
    });
}

function openAllocateModal(resourceId, services) {
    if (services.length === 0) { toast.warning('Create a service first'); return; }
    modal({
        title: 'Allocate to Service',
        body: `
            <div class="form-group">
                <label>Service</label>
                <select class="form-control" id="f-svc">
                    ${services.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}
                </select>
            </div>
        `,
        confirmText: 'Allocate',
        onConfirm: async () => {
            try {
                await api.resources.allocate(resourceId, +document.getElementById('f-svc').value);
                toast.success('Resource allocated');
                renderResources();
                return true;
            } catch (e) { toast.error(e.message); return false; }
        },
    });
}
