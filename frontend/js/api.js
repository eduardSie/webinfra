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
        toast.error('Сетевая ошибка. Сервер недоступен?');
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
        let message = 'Ошибка запроса';
        if (typeof detail === 'string') message = detail;
        else if (Array.isArray(detail)) {
            // Pydantic validation errors
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
    // Auth
    login(username, password) {
        const form = new URLSearchParams();
        form.append('username', username);
        form.append('password', password);
        return request('/users/login', {
            method: 'POST',
            body: form,
            auth: false,
            isForm: true,
        });
    },
    me: () => request('/users/me'),

    // Users
    users: {
        list: () => request('/users/'),
        create: (data) => request('/users/', { method: 'POST', body: data }),
        deactivate: (id) => request(`/users/${id}/deactivate`, { method: 'PATCH' }),
    },

    // Services
    services: {
        my: () => request('/services/my'),
        get: (id) => request(`/services/${id}`),
        create: (data) => request('/services/', { method: 'POST', body: data }),
        update: (id, data) => request(`/services/${id}`, { method: 'PATCH', body: data }),
        delete: (id) => request(`/services/${id}`, { method: 'DELETE' }),
        listAccess: (id) => request(`/services/${id}/access`),
        grantAccess: (id, userId) => request(`/services/${id}/access`, {
            method: 'POST', body: { user_id: userId }
        }),
        revokeAccess: (id, userId) => request(`/services/${id}/access/${userId}`, {
            method: 'DELETE'
        }),
    },

    // Resources
    resources: {
        status: () => request('/resources/status'),
        create: (data) => request('/resources/', { method: 'POST', body: data }),
        allocate: (id, serviceId) => request(`/resources/${id}/allocate`, {
            method: 'POST', body: { service_id: serviceId }
        }),
        detach: (id) => request(`/resources/${id}/detach`, { method: 'POST' }),
    },

    // Endpoints
    endpoints: {
        list: () => request('/endpoints/'),
        create: (data) => request('/endpoints/', { method: 'POST', body: data }),
    },

    // SSL
    ssl: {
        attach: (data) => request('/ssl/', { method: 'POST', body: data }),
        checkExpiry: (days = 30) => request(`/ssl/expiry-check?days=${days}`),
    },

    // Reports
    reports: {
        global: () => request('/reports/global'),
    },
};