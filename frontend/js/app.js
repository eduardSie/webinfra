import { router } from './router.js';
import { auth } from './auth.js';
import { escapeHtml } from './ui.js';

import { renderLogin } from './views/login.js';
import { renderDashboard } from './views/dashboard.js';
import { renderServices } from './views/services.js';
import { renderServiceDetails } from './views/serviceDetails.js';
import { renderResources } from './views/resources.js';
import { renderEndpoints } from './views/endpoints.js';
import { renderSSL } from './views/ssl.js';
import { renderUsers } from './views/users.js';
import { renderReport } from './views/report.js';

// ----- Routes -----
router.register('/login', renderLogin);
router.register('/', renderDashboard);
router.register('/services', renderServices);
router.register('/services/:id', renderServiceDetails);
router.register('/resources', renderResources);
router.register('/endpoints', renderEndpoints);
router.register('/ssl', renderSSL);
router.register('/users', renderUsers, { admin: true });
router.register('/report', renderReport, { admin: true });

router.notFound((msg) => {
    document.getElementById('view-container').innerHTML = `
        <div class="card" style="text-align:center;padding:60px">
            <h2>404</h2>
            <p class="text-dim">${msg || 'Страница не найдена'}</p>
            <a href="#/" class="btn mt-16">На главную</a>
        </div>
    `;
});

// ----- Render sidebar after login -----
function renderSidebar() {
    const sidebar = document.getElementById('sidebar');
    const main = document.getElementById('main-content');
    const user = auth.getUser();
    if (!user) { sidebar.classList.add('hidden'); main.classList.add('full'); return; }
    sidebar.classList.remove('hidden');
    main.classList.remove('full');

    const nav = document.getElementById('nav-menu');
    const items = [
        { section: 'User Zone' },
        { path: '/', label: 'Дашборд', icon: '🏠' },
        { path: '/services', label: 'Мои сервисы', icon: '📦' },
        { path: '/resources', label: 'Ресурсы', icon: '🖥' },
        { path: '/endpoints', label: 'Endpoints', icon: '🌐' },
        { path: '/ssl', label: 'SSL', icon: '🔒' },
    ];
    if (user.is_admin) {
        items.push(
            { section: 'Admin Zone' },
            { path: '/users', label: 'Пользователи', icon: '👥' },
            { path: '/report', label: 'Global Report', icon: '📊' },
        );
    }

    nav.innerHTML = items.map(i => {
        if (i.section) return `<div class="nav-section">${i.section}</div>`;
        return `<a class="nav-item" data-path="${i.path}" href="#${i.path}">
            <span>${i.icon}</span><span>${i.label}</span>
        </a>`;
    }).join('');

    document.getElementById('user-info').innerHTML = `
        <div class="user-name">${escapeHtml(user.username)}</div>
        <div class="user-role">${user.is_admin ? 'Администратор' : 'Пользователь'}</div>
    `;

    updateActiveLink();
}

function updateActiveLink() {
    const path = window.location.hash.slice(1).split('?')[0] || '/';
    document.querySelectorAll('.nav-item').forEach(a => {
        const p = a.dataset.path;
        a.classList.toggle('active',
            p === path || (p !== '/' && path.startsWith(p)));
    });
}

document.getElementById('logout-btn').addEventListener('click', () => {
    auth.logout();
    window.location.hash = '#/login';
    window.location.reload();
});

window.addEventListener('hashchange', () => { renderSidebar(); });

// ---- Инициализация ----
if (!auth.isLoggedIn() && !window.location.hash.startsWith('#/login')) {
    window.location.hash = '#/login';
}
renderSidebar();
router.init();