import { auth } from './auth.js';

const routes = new Map();
let notFoundHandler = null;

export const router = {
    register(path, handler, { admin = false } = {}) {
        routes.set(path, { handler, admin });
    },
    notFound(handler) { notFoundHandler = handler; },

    navigate(path) {
        window.location.hash = path.startsWith('#') ? path : `#${path}`;
    },

    async handle() {
        const hash = window.location.hash.slice(1) || '/';
        const [path, queryString] = hash.split('?');
        const params = Object.fromEntries(new URLSearchParams(queryString || ''));

        let matched = null;
        let pathParams = {};
        for (const [pattern, route] of routes) {
            const regex = new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$');
            const m = path.match(regex);
            if (m) {
                matched = route;
                pathParams = m.groups || {};
                break;
            }
        }

        if (!matched) {
            notFoundHandler?.();
            return;
        }
        if (matched.admin && !auth.isAdmin()) {
            notFoundHandler?.('Not enough rights');
            return;
        }

        if (path !== '/login' && !auth.isLoggedIn()) {
            this.navigate('/login');
            return;
        }

        try {
            await matched.handler({ params: pathParams, query: params });
        } catch (e) {
            console.error(e);
        }
    },

    init() {
        window.addEventListener('hashchange', () => this.handle());
        window.addEventListener('DOMContentLoaded', () => this.handle());
        if (document.readyState !== 'loading') this.handle();
    },
};