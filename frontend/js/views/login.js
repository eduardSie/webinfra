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
                <h1>Login to Service Catalog</h1>
                <p>Enter your corporate credentials</p>
                <form id="login-form">
                    <div class="form-group">
                        <label>Username</label>
                        <input type="text" name="username" class="form-control" required autofocus />
                    </div>
                    <div class="form-group">
                        <label>Password</label>
                        <input type="password" name="password" class="form-control" required />
                    </div>
                    <button type="submit" class="btn" style="width:100%;justify-content:center" id="login-submit">
                        Login
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

        if (username.length < 3) { toast.error('Username is too short'); return; }

        btn.disabled = true;
        btn.innerHTML = '<span class="loader"></span> Logging in...';
        try {
            const res = await api.login(username, password);
            auth.setToken(res.access_token);
            const me = await api.me();
            auth.setUser(me);
            toast.success(`Welcome, ${me.username}!`);
            router.navigate('/');
        } catch (e) {
            toast.error(e.message || 'Failed to log in');
        } finally {
            btn.disabled = false;
            btn.innerHTML = 'Login';
        }
    });
}