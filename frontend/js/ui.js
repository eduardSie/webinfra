export const toast = {
    show(message, type = 'info', duration = 3500) {
        const container = document.getElementById('toast-container');
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.textContent = message;
        container.appendChild(el);
        setTimeout(() => {
            el.style.animation = 'slideIn 0.2s reverse';
            setTimeout(() => el.remove(), 200);
        }, duration);
    },
    success(m) { this.show(m, 'success'); },
    error(m) { this.show(m, 'error', 5000); },
    warning(m) { this.show(m, 'warning'); },
};

export function modal({ title, body, onConfirm, confirmText = 'OK', danger = false }) {
    const root = document.getElementById('modal-root');
    root.innerHTML = '';
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
        <div class="modal">
            <div class="modal-title">${title}</div>
            <div class="modal-body"></div>
            <div class="modal-actions">
                <button class="btn btn-ghost" data-act="cancel">Отмена</button>
                <button class="btn ${danger ? 'btn-danger' : ''}" data-act="confirm">${confirmText}</button>
            </div>
        </div>
    `;
    root.appendChild(backdrop);
    const bodyEl = backdrop.querySelector('.modal-body');
    if (typeof body === 'string') bodyEl.innerHTML = body;
    else if (body instanceof Node) bodyEl.appendChild(body);

    const close = () => root.innerHTML = '';
    backdrop.querySelector('[data-act=cancel]').onclick = close;
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
    backdrop.querySelector('[data-act=confirm]').onclick = async () => {
        try {
            const ok = await onConfirm?.(backdrop);
            if (ok !== false) close();
        } catch (e) { /* оставить модалку */ }
    };
}

export function confirm({ title = 'Подтверждение', message, confirmText = 'Подтвердить', danger = false }) {
    return new Promise((resolve) => {
        modal({
            title,
            body: `<p>${message}</p>`,
            confirmText,
            danger,
            onConfirm: () => { resolve(true); return true; },
        });
        // при отмене Promise остаётся висящим — ок для наших задач (можно recolve(false) на close)
    });
}

export function statusBadge(status) {
    return `<span class="badge badge-${status}">${status}</span>`;
}

export function formatDate(d) {
    if (!d) return '—';
    const dt = new Date(d);
    return dt.toLocaleString('ru-RU', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function loading(container) {
    container.innerHTML = `<div class="page-loader"><div class="loader"></div></div>`;
}

export function emptyState(message, icon = '📭') {
    return `<div class="empty-state"><div class="icon">${icon}</div><div>${message}</div></div>`;
}

export function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}