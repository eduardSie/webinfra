const TOKEN_KEY = 'sc_token';
const USER_KEY = 'sc_user';

export const auth = {
    getToken() { return localStorage.getItem(TOKEN_KEY); },
    setToken(t) { localStorage.setItem(TOKEN_KEY, t); },

    getUser() {
        const raw = localStorage.getItem(USER_KEY);
        return raw ? JSON.parse(raw) : null;
    },
    setUser(user) { localStorage.setItem(USER_KEY, JSON.stringify(user)); },

    isLoggedIn() { return !!this.getToken(); },
    isAdmin() { return this.getUser()?.is_admin === true; },

    logout() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    },
};