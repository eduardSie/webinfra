import { api } from '../api.js';
import { auth } from '../auth.js';
import { toast, escapeHtml } from '../ui.js';
import { router } from '../router.js';

export function renderLogin() {
    document.getElementById('sidebar').classList.add('hidden');
    document.getElementById('main-content').classList.add('full');

    const container = document.getElementById('view-container');
    container.innerHTML = `
        <div class="login-wrap">
            <div class="login-card">
                <h1>Вход в Service Catalog</h1>
                <p>Введите корпоративные учётные данные</p>
                <form id="login-form">
                    <div class="form-group">
                        <label>Логин</label>
                        <input type="text" name="username" class="form-control" required autofocus />
                    </div>
                    <div class="form-group">
                        <label>Пароль</label>
                        <input type="password" name="password" class="form-control" required />
                    </div>
                    <button type="submit" class="btn" style="width:100%;justify-content:center" id="login-submit">
                        Войти
                    </button>
                </form>
            </div>
        </div>
    `;

    const form = document.getElementById('login-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('login-submit');
        const username = form.username.value.trim();
        const password = form.password.value;

        if (username.length < 3) { toast.error('Логин слишком короткий'); return; }

        btn.disabled = true;
        btn.innerHTML = '<span class="loader"></span> Вход...';
        try {
            const res = await api.login(username, password);
            auth.setToken(res.access_token);
            const me = await api.me();
            auth.setUser(me);
            toast.success(`Добро пожаловать, ${me.username}!`);
            router.navigate('/');
        } catch (e) {
            toast.error(e.message || 'Не удалось войти');
        } finally {
            btn.disabled = false;
            btn.innerHTML = 'Войти';
        }
    });
}