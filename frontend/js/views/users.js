import { api } from '../api.js';
import { toast, loading, modal, confirm, escapeHtml, formatDate } from '../ui.js';

export async function renderUsers() {
    const container = document.getElementById('view-container');
    loading(container);

    const users = await api.users.list();

    container.innerHTML = `
        <div class="page-header">
            <div>
                <div class="page-title">Користувачі</div>
                <div class="page-subtitle">${users.length} записів</div>
            </div>
            <button class="btn" id="create-btn">+ Додати</button>
        </div>
        <div class="card">
            <table>
                <thead><tr>
                    <th>Логін</th><th>Email</th><th>Роль</th><th>Активний</th><th>Створений</th><th></th>
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
                                    ? `<button class="btn btn-sm btn-danger" data-deact="${u.id}">Деактивувати</button>`
                                    : `<button class="btn btn-sm" data-act="${u.id}">Активувати</button>`}
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
            title: 'Деактивація',
            message: 'Користувач не зможе входити в систему.',
            confirmText: 'Деактивувати',
            danger: true,
        })) return;
        try {
            await api.users.deactivate(b.dataset.deact);
            toast.success('Деактивовано');
            renderUsers();
        } catch (e) { toast.error(e.message); }
    });

    container.querySelectorAll('[data-act]').forEach(b => b.onclick = async () => {
        try {
            await api.users.activate(b.dataset.act);
            toast.success('Користувача активовано');
            renderUsers();
        } catch (e) { toast.error(e.message); }
    });
}

function openCreateModal() {
    modal({
        title: 'Новий користувач',
        body: `
            <div class="form-group"><label>Логін *</label><input class="form-control" id="f-u" /></div>
            <div class="form-group"><label>Email *</label><input type="email" class="form-control" id="f-e" /></div>
            <div class="form-group"><label>Пароль *</label><input type="password" class="form-control" id="f-p"
                placeholder="Мін. 8 симв., велика літера + цифра" /></div>
            <div class="form-group"><label><input type="checkbox" id="f-a" /> Зробити адміністратором</label></div>
        `,
        confirmText: 'Створити',
        onConfirm: async () => {
            const password = document.getElementById('f-p').value;
            if (password.length < 8)                             { toast.error('Пароль мінімум 8 символів'); return false; }
            if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
                toast.error('Пароль повинен містити велику літеру та цифру'); return false;
            }
            try {
                await api.users.create({
                    username: document.getElementById('f-u').value.trim(),
                    email:    document.getElementById('f-e').value.trim(),
                    password,
                    is_admin: document.getElementById('f-a').checked,
                });
                toast.success('Користувача створено');
                renderUsers();
                return true;
            } catch (e) { toast.error(e.message); return false; }
        },
    });
}
