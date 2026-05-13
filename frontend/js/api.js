import { auth } from './auth.js';
import { toast } from './ui.js';

const API_BASE = 'http://localhost:8000';

async function request(path, { method = 'GET', body, auth: needAuth = true, isForm = false } = {}) {
    const headers = {};
    if (!isForm) headers['Content-Type'] = 'application/json';

    if (needAuth) {
        const token = auth.getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
    }

    const config = { method, headers };
    if (body !== undefined) {
        config.body = isForm ? body : JSON.stringify(body);
    }

    let response;
    try {
        response = await fetch(`${API_BASE}${path}`, config);
    } catch (e) {
        toast.error('Мережева помилка. Сервер недоступний?');
        throw e;
    }

    if (response.status === 401) {
        auth.logout();
        window.location.hash = '#/login';
        throw new Error('Unauthorized');
    }

    if (response.status === 204) return null;

    const data = await response.json().catch(() => null);

    if (!response.ok) {
        const detail = data?.detail;
        let message = 'Помилка запиту';
        if (typeof detail === 'string') message = detail;
        else if (Array.isArray(detail)) {
            message = detail.map(e => `${e.loc?.slice(-1)}: ${e.msg}`).join('; ');
        }
        const err = new Error(message);
        err.status = response.status;
        err.data = data;
        throw err;
    }
    return data;
}

export const api = {
    login(username, password) {
        const form = new URLSearchParams();
        form.append('username', username);
        form.append('password', password);
        return request('/users/login', { method: 'POST', body: form, auth: false, isForm: true });
    },
    me: () => request('/users/me'),

    users: {
        list:       ()   => request('/users/'),
        create:     (d)  => request('/users/', { method: 'POST', body: d }),
        deactivate: (id) => request(`/users/${id}/deactivate`, { method: 'PATCH' }),
        activate:   (id) => request(`/users/${id}/activate`,   { method: 'PATCH' }),
    },

    services: {
        my:          ()          => request('/services/my'),
        get:         (id)        => request(`/services/${id}`),
        create:      (d)         => request('/services/', { method: 'POST', body: d }),
        update:      (id, d)     => request(`/services/${id}`, { method: 'PATCH', body: d }),
        delete:      (id)        => request(`/services/${id}`, { method: 'DELETE' }),
        listAccess:  (id)        => request(`/services/${id}/access`),
        grantAccess: (id, uid)   => request(`/services/${id}/access`, { method: 'POST', body: { user_id: uid } }),
        revokeAccess:(id, uid)   => request(`/services/${id}/access/${uid}`, { method: 'DELETE' }),
    },

    resources: {
        status:   ()          => request('/resources/status'),
        create:   (d)         => request('/resources/', { method: 'POST', body: d }),
        allocate: (id, svcId) => request(`/resources/${id}/allocate`, { method: 'POST', body: { service_id: svcId } }),
        detach:   (id)        => request(`/resources/${id}/detach`, { method: 'POST' }),
        delete:   (id)        => request(`/resources/${id}`, { method: 'DELETE' }),
    },

    endpoints: {
        list:   ()  => request('/endpoints/'),
        create: (d) => request('/endpoints/', { method: 'POST', body: d }),
        delete: (id)=> request(`/endpoints/${id}`, { method: 'DELETE' }),
    },

    ssl: {
        attach:      (d)         => request('/ssl/', { method: 'POST', body: d }),
        revoke:      (id)        => request(`/ssl/${id}`, { method: 'DELETE' }),
        checkExpiry: (days = 30) => request(`/ssl/expiry-check?days=${days}`),
    },

    reports: {
        global: () => request('/reports/global'),
    },
};
