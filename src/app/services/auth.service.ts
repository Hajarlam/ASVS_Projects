import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user';
  createdAt: string;
  lastLogin?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  currentUser: User | null;
  token: string | null;
  mode: 'backend' | 'local';
}

const BACKEND_URL = 'http://localhost:3000';
const SESSION_KEY = 'asvs_session';
const JWT_KEY = 'asvs_jwt';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private isBrowser: boolean;
  private authState$ = new BehaviorSubject<AuthState>({
    isAuthenticated: false, currentUser: null, token: null, mode: 'local'
  });
  private backendAvailable = false;
  private backendCheckPromise: Promise<void> | null = null;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    if (this.isBrowser) {
      this.initDefaultUsers();
      this.restoreSession();
      void this.ensureBackendChecked();
    }
  }

  private clearSession() {
    if (!this.isBrowser) return;
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(JWT_KEY);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(JWT_KEY);
    this.authState$.next({ isAuthenticated: false, currentUser: null, token: null, mode: 'local' });
  }

  private restoreSession() {
    if (!this.isBrowser) return;
    if (!sessionStorage.getItem(SESSION_KEY) && localStorage.getItem(SESSION_KEY)) {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(JWT_KEY);
    }

    const rawSession = sessionStorage.getItem(SESSION_KEY);
    const rawToken = sessionStorage.getItem(JWT_KEY);
    if (!rawSession) return;

    try {
      const user = JSON.parse(rawSession) as User;
      if (!user || typeof user.id !== 'string' || typeof user.username !== 'string') {
        this.clearSession();
        return;
      }
      this.authState$.next({
        isAuthenticated: true,
        currentUser: user,
        token: rawToken || null,
        mode: rawToken ? 'backend' : 'local'
      });
    } catch {
      this.clearSession();
    }
  }

  private async checkBackend() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/health`, { signal: AbortSignal.timeout(2000) });
      this.backendAvailable = res.ok;

      if (!this.backendAvailable) return;

      const token = sessionStorage.getItem(JWT_KEY);
      if (!token) return;

      const meRes = await fetch(`${BACKEND_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: AbortSignal.timeout(2000)
      }).catch(() => null);

      if (!meRes) return;

      if (meRes.status === 401 || meRes.status === 403) {
        this.clearSession();
        return;
      }

      if (meRes.ok) {
        const user = await meRes.json().catch(() => null);
        if (user?.id) {
          this.authState$.next({ isAuthenticated: true, currentUser: user, token, mode: 'backend' });
        }
      }
    } catch {
      this.backendAvailable = false;
    }
  }

  private async ensureBackendChecked(): Promise<void> {
    if (!this.isBrowser) return;
    if (!this.backendCheckPromise) {
      this.backendCheckPromise = this.checkBackend().finally(() => {
        this.backendCheckPromise = null;
      });
    }
    await this.backendCheckPromise;
  }

  private initDefaultUsers() {
    if (!this.isBrowser) return;
    if (!localStorage.getItem('asvs_users')) {
      const defaultUsers: User[] = [
        { id: 'admin-001', username: 'admin', email: 'admin@asvs.local', role: 'admin', createdAt: new Date().toISOString() },
        { id: 'user-001', username: 'utilisateur', email: 'user@asvs.local', role: 'user', createdAt: new Date().toISOString() }
      ];
      localStorage.setItem('asvs_users', JSON.stringify(defaultUsers));
      localStorage.setItem('asvs_passwords', JSON.stringify({ 'admin-001': btoa('admin123'), 'user-001': btoa('user123') }));
    }
  }

  getAuthState(): Observable<AuthState> { return this.authState$.asObservable(); }
  getCurrentUser(): User | null { return this.authState$.value.currentUser; }
  isAuthenticated(): boolean { return this.authState$.value.isAuthenticated; }
  isAdmin(): boolean { return this.authState$.value.currentUser?.role === 'admin'; }
  getToken(): string | null { return this.authState$.value.token; }
  isBackendMode(): boolean { return this.backendAvailable && this.authState$.value.mode === 'backend'; }
  isBackendAvailable(): boolean { return this.backendAvailable; }

  async refreshBackendAvailability(): Promise<boolean> {
    await this.ensureBackendChecked();
    return this.backendAvailable;
  }

  async login(username: string, password: string): Promise<{ success: boolean; message: string }> {
    if (!this.isBrowser) return { success: false, message: 'Non disponible' };
    await this.ensureBackendChecked();
    if (this.backendAvailable) return this.loginWithBackend(username, password);
    return this.loginWithLocalStorage(username, password);
  }

  private async loginWithBackend(username: string, password: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) return { success: false, message: data.error || 'Erreur de connexion.' };
      sessionStorage.setItem(JWT_KEY, data.token);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(data.user));
      this.authState$.next({ isAuthenticated: true, currentUser: data.user, token: data.token, mode: 'backend' });
      return { success: true, message: 'Connexion réussie (JWT).' };
    } catch {
      this.backendAvailable = false;
      return this.loginWithLocalStorage(username, password);
    }
  }

  private loginWithLocalStorage(username: string, password: string): { success: boolean; message: string } {
    const users: User[] = JSON.parse(localStorage.getItem('asvs_users') || '[]');
    const passwords: Record<string, string> = JSON.parse(localStorage.getItem('asvs_passwords') || '{}');
    const user = users.find(u => u.username === username || u.email === username);
    if (!user) return { success: false, message: 'Utilisateur introuvable.' };
    if (passwords[user.id] !== btoa(password)) return { success: false, message: 'Mot de passe incorrect.' };
    user.lastLogin = new Date().toISOString();
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    this.authState$.next({ isAuthenticated: true, currentUser: user, token: null, mode: 'local' });
    return { success: true, message: 'Connexion réussie.' };
  }

  async logout() {
    if (!this.isBrowser) return;
    const token = this.getToken();
    if (token && this.backendAvailable) {
      try { await fetch(`${BACKEND_URL}/api/auth/logout`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } }); } catch {}
    }
    this.clearSession();
  }

  async getAllUsers(): Promise<User[]> {
    if (!this.isBrowser) return [];
    if (this.backendAvailable) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/users`, { headers: { 'Authorization': `Bearer ${this.getToken()}` } });
        if (res.ok) return await res.json();
      } catch {}
    }
    return JSON.parse(localStorage.getItem('asvs_users') || '[]');
  }

  async addUser(data: { username: string; email: string; role: 'admin' | 'user'; password: string }): Promise<{ success: boolean; message: string }> {
    if (!this.isBrowser) return { success: false, message: 'Non disponible' };
    if (!this.isAdmin()) return { success: false, message: 'Accès refusé.' };
    if (this.backendAvailable) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.getToken()}` },
          body: JSON.stringify(data)
        });
        const result = await res.json();
        if (res.ok) return { success: true, message: 'Utilisateur créé (backend JWT).' };
        return { success: false, message: result.error };
      } catch {}
    }
    const users: User[] = JSON.parse(localStorage.getItem('asvs_users') || '[]');
    if (users.find(u => u.username === data.username || u.email === data.email)) return { success: false, message: 'Nom d\'utilisateur ou e-mail déjà utilisé.' };
    const newUser: User = { id: `user-${Date.now()}`, username: data.username, email: data.email, role: data.role, createdAt: new Date().toISOString() };
    users.push(newUser);
    localStorage.setItem('asvs_users', JSON.stringify(users));
    const passwords: Record<string, string> = JSON.parse(localStorage.getItem('asvs_passwords') || '{}');
    passwords[newUser.id] = btoa(data.password);
    localStorage.setItem('asvs_passwords', JSON.stringify(passwords));
    return { success: true, message: 'Utilisateur créé.' };
  }

  async deleteUser(userId: string): Promise<{ success: boolean; message: string }> {
    if (!this.isBrowser) return { success: false, message: 'Non disponible' };
    if (!this.isAdmin()) return { success: false, message: 'Accès refusé.' };
    if (userId === this.getCurrentUser()?.id) return { success: false, message: 'Impossible de supprimer votre propre compte.' };
    if (this.backendAvailable) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/users/${userId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${this.getToken()}` } });
        if (res.ok) { return { success: true, message: 'Utilisateur supprimé (backend).' }; }
      } catch {}
    }
    let users: User[] = JSON.parse(localStorage.getItem('asvs_users') || '[]');
    users = users.filter(u => u.id !== userId);
    localStorage.setItem('asvs_users', JSON.stringify(users));
    const passwords: Record<string, string> = JSON.parse(localStorage.getItem('asvs_passwords') || '{}');
    delete passwords[userId];
    localStorage.setItem('asvs_passwords', JSON.stringify(passwords));
    return { success: true, message: 'Utilisateur supprimé.' };
  }

  async updateUserRole(userId: string, role: 'admin' | 'user'): Promise<{ success: boolean; message: string }> {
    if (!this.isBrowser) return { success: false, message: 'Non disponible' };
    if (!this.isAdmin()) return { success: false, message: 'Accès refusé.' };
    if (this.backendAvailable) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/users/${userId}/role`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.getToken()}` }, body: JSON.stringify({ role })
        });
        if (res.ok) return { success: true, message: 'Rôle mis à jour (backend).' };
      } catch {}
    }
    const users: User[] = JSON.parse(localStorage.getItem('asvs_users') || '[]');
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) return { success: false, message: 'Utilisateur introuvable.' };
    users[idx].role = role;
    localStorage.setItem('asvs_users', JSON.stringify(users));
    return { success: true, message: 'Rôle mis à jour.' };
  }
}
