import { api } from '../api.js';
import { toast, loading, modal, confirm, escapeHtml, formatDate } from '../ui.js';

export async function renderUsers() {
    const container = document.getElementById('view-container');
    loading(container);

    const users = await api.users.list();

    container.innerHTML = `
        <div class="page-header">
            <div>
                <div class="page-title">Пользователи</div>
                <div class="page-subtitle">${users.length} записей</div>
            </div>
            <button class="btn" id="create-btn">+ Добавить</button>
        </div>
        <div class="card">
            <table>
                <thead><tr>
                    <th>Логин</th><th>Email</th><th>Роль</th><th>Активен</th><th>Создан</th><th></th>
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
                            <td>${u.is_active ? `<button class="btn btn-sm btn-danger" data-deact="${u.id}">Деактивировать</button>` : ''}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    document.getElementById('create-btn').onclick = () => openCreateModal();
    container.querySelectorAll('[data-deact]').forEach(b => b.onclick = async () => {
        if (!await confirm({ title: 'Деактивация', message: 'Пользователь не сможет входить в систему', confirmText: 'Деактивировать', danger: true })) return;
        try {
            await api.users.deactivate(b.dataset.deact);
            toast.success('Деактивирован');
            renderUsers();
        } catch (e) { toast.error(e.message); }
    });
}

function openCreateModal() {
    modal({
        title: 'Новый пользователь',
        body: `
            <div class="form-group"><label>Логин *</label><input class="form-control" id="f-u" /></div>
            <div class="form-group"><label>Email *</label><input type="email" class="form-control" id="f-e" /></div>
            <div class="form-group"><label>Пароль *</label><input type="password" class="form-control" id="f-p" /></div>
            <div class="form-group"><label><input type="checkbox" id="f-a" /> Сделать администратором</label></div>
        `,
        confirmText: 'Создать',
        onConfirm: async () => {
            const password = document.getElementById('f-p').value;
            if (password.length < 8) { toast.error('Пароль минимум 8 символов'); return false; }
            if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
                toast.error('Пароль должен содержать заглавную букву и цифру'); return false;
            }
            try {
                await api.users.create({
                    username: document.getElementById('f-u').value.trim(),
                    email: document.getElementById('f-e').value.trim(),
                    password,
                    is_admin: document.getElementById('f-a').checked,
                });
                toast.success('Пользователь создан');
                renderUsers();
                return true;
            } catch (e) { toast.error(e.message); return false; }
        },
    });
}