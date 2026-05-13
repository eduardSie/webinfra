import { api } from '../api.js';
import { toast, loading, modal, confirm, escapeHtml, formatDate } from '../ui.js';

export async function renderUsers() {
    const container = document.getElementById('view-container');
    loading(container);

    const users = await api.users.list();

    container.innerHTML = `
        <div class="page-header">
            <div>
                <div class="page-title">Users</div>
                <div class="page-subtitle">${users.length} records</div>
            </div>
            <button class="btn" id="create-btn">+ Create</button>
        </div>
        <div class="card">
            <table>
                <thead><tr>
                    <th>Username</th><th>Email</th><th>Role</th><th>Active</th><th>Created</th><th></th>
                </tr></thead>
                <tbody>
                    ${users.map(u => `
                        <tr>
                            <td><b>${escapeHtml(u.username)}</b></td>
                            <td>${escapeHtml(u.email)}</td>
                            <td>${u.is_admin
                                ? '<span class="badge badge-active">Admin</span>'
                                : '<span class="badge badge-inactive">User</span>'}</td>
                            <td>${u.is_active ? '✓' : '<span style="color:var(--danger)">✗</span>'}</td>
                            <td class="text-dim">${formatDate(u.created_at)}</td>
                            <td class="flex gap-8">
                                ${u.is_active
                                    ? `<button class="btn btn-sm btn-danger" data-deact="${u.id}">Deactivate</button>`
                                    : `<button class="btn btn-sm" data-act="${u.id}">Activate</button>`}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    document.getElementById('create-btn').onclick = () => openCreateModal();

    container.querySelectorAll('[data-deact]').forEach(b => b.onclick = async () => {
        if (!await confirm({
            title: 'Deactivate User',
            message: 'User will not be able to log in.',
            confirmText: 'Deactivate',
            danger: true,
        })) return;
        try {
            await api.users.deactivate(b.dataset.deact);
            toast.success('User deactivated');
            renderUsers();
        } catch (e) { toast.error(e.message); }
    });

    container.querySelectorAll('[data-act]').forEach(b => b.onclick = async () => {
        try {
            await api.users.activate(b.dataset.act);
            toast.success('User activated');
            renderUsers();
        } catch (e) { toast.error(e.message); }
    });
}

function openCreateModal() {
    modal({
        title: 'Create User',
        body: `
            <div class="form-group"><label>Username *</label><input class="form-control" id="f-u" /></div>
            <div class="form-group"><label>Email *</label><input type="email" class="form-control" id="f-e" /></div>
            <div class="form-group"><label>Password *</label><input type="password" class="form-control" id="f-p"
                placeholder="Min. 8 chars, uppercase letter + digit" /></div>
            <div class="form-group"><label><input type="checkbox" id="f-a" /> Make Admin</label></div>
        `,
        confirmText: 'Create',
        onConfirm: async () => {
            const password = document.getElementById('f-p').value;
            if (password.length < 8)                             { toast.error('Password must be at least 8 characters'); return false; }
            if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
                toast.error('Password must contain an uppercase letter and a digit'); return false;
            }
            try {
                await api.users.create({
                    username: document.getElementById('f-u').value.trim(),
                    email:    document.getElementById('f-e').value.trim(),
                    password,
                    is_admin: document.getElementById('f-a').checked,
                });
                toast.success('User created');
                renderUsers();
                return true;
            } catch (e) { toast.error(e.message); return false; }
        },
    });
}
