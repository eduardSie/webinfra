import { api } from '../api.js';
import { auth } from '../auth.js';
import { toast, loading, modal, confirm, statusBadge, escapeHtml, formatDate } from '../ui.js';
import { router } from '../router.js';

export async function renderServiceDetails({ params }) {
    const container = document.getElementById('view-container');
    loading(container);

    let service;
    try { service = await api.services.get(params.id); }
    catch (e) { toast.error(e.message); router.navigate('/services'); return; }

    container.innerHTML = `
        <div class="page-header">
            <div>
                <a href="#/services" class="text-dim" style="text-decoration:none">← All Services</a>
                <div class="page-title" style="margin-top:6px">${escapeHtml(service.name)}</div>
                <div class="page-subtitle">${statusBadge(service.status)} · created ${formatDate(service.created_at)}</div>
            </div>
            ${auth.isAdmin() ? `
                <div class="flex gap-8">
                    <button class="btn btn-ghost" id="edit-btn">Edit</button>
                    <button class="btn btn-danger" id="delete-btn">Delete</button>
                </div>` : ''}
        </div>

        <div class="card">
            <h3>Description</h3>
            <p class="mt-16 text-dim">${escapeHtml(service.description || 'No description provided.')}</p>
        </div>

        ${auth.isAdmin() ? `
            <div class="card mt-16" id="access-card">
                <div class="flex" style="justify-content:space-between;align-items:center;margin-bottom:12px">
                    <h3>User Access</h3>
                    <button class="btn btn-sm" id="grant-btn">+ Grant Access</button>
                </div>
                <div id="access-list" class="text-dim">Loading...</div>
            </div>
        ` : ''}
    `;

    if (auth.isAdmin()) {
        document.getElementById('edit-btn').onclick = () => openEditModal(service);
        document.getElementById('delete-btn').onclick = async () => {
            if (!await confirm({
                title: 'Delete Service',
                message: `Delete «${escapeHtml(service.name)}»? This action is irreversible.`,
                confirmText: 'Delete',
                danger: true,
            })) return;
            try {
                await api.services.delete(service.id);
                toast.success('Service deleted');
                router.navigate('/services');
            } catch (e) { toast.error(e.message); }
        };

        await loadAccessList(service.id);
        document.getElementById('grant-btn').onclick = () => openGrantModal(service.id);
    }
}

async function loadAccessList(serviceId) {
    const box = document.getElementById('access-list');
    try {
        const list = await api.services.listAccess(serviceId);
        if (list.length === 0) {
            box.innerHTML = '<p class="text-dim">No access granted. Only administrators can see this service.</p>';
            return;
        }
        box.innerHTML = `
            <table>
                <thead><tr><th>User</th><th>Email</th><th>Granted</th><th></th></tr></thead>
                <tbody>
                    ${list.map(a => `
                        <tr>
                            <td><b>${escapeHtml(a.username)}</b></td>
                            <td class="text-dim">${escapeHtml(a.email)}</td>
                            <td class="text-dim">${formatDate(a.granted_at)}</td>
                            <td>
                                <button class="btn btn-sm btn-danger" data-revoke="${a.user_id}">Revoke</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        box.querySelectorAll('[data-revoke]').forEach(b => b.onclick = async () => {
            if (!await confirm({
                title: 'Revoke Access?',
                message: 'The user will no longer see this service and its associated resources',
                confirmText: 'Revoke',
                danger: true,
            })) return;
            try {
                await api.services.revokeAccess(serviceId, b.dataset.revoke);
                toast.success('Access revoked');
                loadAccessList(serviceId);
            } catch (e) { toast.error(e.message); }
        });
    } catch (e) { toast.error(e.message); }
}

async function openGrantModal(serviceId) {
    let users = [];
    try { users = await api.users.list(); }
    catch (e) { toast.error(e.message); return; }

    let accessList = [];
    try { accessList = await api.services.listAccess(serviceId); } catch {}
    const alreadyHas = new Set(accessList.map(a => a.user_id));

    const candidates = users.filter(u => !u.is_admin && u.is_active && !alreadyHas.has(u.id));
    if (candidates.length === 0) {
        toast.warning('No available users to grant access');
        return;
    }

    modal({
        title: 'Grant Access to Service',
        body: `
            <div class="form-group">
                <label>User</label>
                <select class="form-control" id="f-user">
                    ${candidates.map(u => `<option value="${u.id}">${escapeHtml(u.username)} (${escapeHtml(u.email)})</option>`).join('')}
                </select>
            </div>
            <p class="text-dim" style="font-size:12px">
                The user will gain access to the service and all its associated resources.
            </p>
        `,
        confirmText: 'Grant Access',
        onConfirm: async () => {
            try {
                await api.services.grantAccess(serviceId, +document.getElementById('f-user').value);
                toast.success('Access granted');
                loadAccessList(serviceId);
                return true;
            } catch (e) { toast.error(e.message); return false; }
        },
    });
}

function openEditModal(service) {
    modal({
        title: 'Edit Service',
        body: `
            <div class="form-group">
                <label>Name</label>
                <input class="form-control" id="f-name" value="${escapeHtml(service.name)}" />
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea class="form-control" id="f-desc">${escapeHtml(service.description || '')}</textarea>
            </div>
            <div class="form-group">
                <label>Status</label>
                <select class="form-control" id="f-status">
                    ${['active','inactive','maintenance','deprecated']
                        .map(s => `<option value="${s}" ${service.status===s?'selected':''}>${s}</option>`).join('')}
                </select>
            </div>
        `,
        confirmText: 'Save',
        onConfirm: async () => {
            try {
                await api.services.update(service.id, {
                    name: document.getElementById('f-name').value.trim(),
                    description: document.getElementById('f-desc').value.trim() || null,
                    status: document.getElementById('f-status').value,
                });
                toast.success('Saved');
                renderServiceDetails({ params: { id: service.id } });
                return true;
            } catch (e) { toast.error(e.message); return false; }
        },
    });
}