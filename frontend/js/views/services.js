import { api } from '../api.js';
import { auth } from '../auth.js';
import { toast, loading, modal, confirm, statusBadge, escapeHtml, emptyState, formatDate } from '../ui.js';
import { router } from '../router.js';

export async function renderServices() {
    const container = document.getElementById('view-container');
    loading(container);

    let services;
    try { services = await api.services.my(); }
    catch (e) { toast.error(e.message); return; }

    container.innerHTML = `
        <div class="page-header">
            <div>
                <div class="page-title">Services</div>
                <div class="page-subtitle">${services.length} total</div>
            </div>
            ${auth.isAdmin() ? `<button class="btn" id="create-btn">+ New Service</button>` : ''}
        </div>
        <div class="card">
            ${services.length === 0
                ? emptyState('No services available', '📦')
                : `<table>
                        <thead><tr>
                            <th>Name</th><th>Description</th><th>Status</th><th>Created</th><th></th>
                        </tr></thead>
                        <tbody>
                            ${services.map(s => `
                                <tr>
                                    <td><b>${escapeHtml(s.name)}</b></td>
                                    <td class="text-dim">${escapeHtml(s.description || '—')}</td>
                                    <td>${statusBadge(s.status)}</td>
                                    <td class="text-dim">${formatDate(s.created_at)}</td>
                                    <td>
                                        <button class="btn btn-sm btn-ghost" data-details="${s.id}">Details</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>`
            }
        </div>
    `;

    container.querySelectorAll('[data-details]').forEach(b =>
        b.onclick = () => router.navigate(`/services/${b.dataset.details}`));

    if (auth.isAdmin()) {
        document.getElementById('create-btn').onclick = () => openCreateModal();
    }
}

function openCreateModal() {
    modal({
        title: 'Create New Service',
        body: `
            <div class="form-group">
                <label>Name *</label>
                <input class="form-control" id="f-name" placeholder="e.g., Payments API" />
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea class="form-control" id="f-desc"></textarea>
            </div>
            <div class="form-group">
                <label>Status</label>
                <select class="form-control" id="f-status">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="maintenance">Maintenance</option>
                </select>
            </div>
        `,
        confirmText: 'Create',
        onConfirm: async () => {
            const name = document.getElementById('f-name').value.trim();
            if (name.length < 2) { toast.error('Name must be at least 2 characters'); return false; }
            try {
                await api.services.create({
                    name,
                    description: document.getElementById('f-desc').value.trim() || null,
                    status: document.getElementById('f-status').value,
                });
                toast.success('Service created');
                renderServices();
                return true;
            } catch (e) { toast.error(e.message); return false; }
        }
    });
}