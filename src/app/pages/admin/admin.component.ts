import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, User } from '../../services/auth.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-page">
      <div class="admin-header animate-in">
        <button class="back-btn" (click)="router.navigate(['/dashboard'])">← Tableau de bord</button>
        <div class="admin-title-wrap">
          <div class="admin-icon">👥</div>
          <div>
            <h1>Gestion des Utilisateurs</h1>
            <p>Administrez les accès à la plateforme ASVS</p>
          </div>
        </div>
      </div>

      @if (successMsg) {
        <div class="alert success animate-in">✅ {{ successMsg }}</div>
      }
      @if (errorMsg) {
        <div class="alert error animate-in">❌ {{ errorMsg }}</div>
      }

      <!-- Add user form -->
      <div class="section-card animate-in">
        <div class="section-header">
          <h2>➕ Ajouter un utilisateur</h2>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label>Nom d'utilisateur *</label>
            <input type="text" [(ngModel)]="newUser.username" placeholder="ex: jean.dupont">
          </div>
          <div class="form-group">
            <label>E-mail *</label>
            <input type="email" [(ngModel)]="newUser.email" placeholder="ex: jean@exemple.fr">
          </div>
          <div class="form-group">
            <label>Mot de passe *</label>
            <input type="password" [(ngModel)]="newUser.password" placeholder="Minimum 6 caractères">
          </div>
          <div class="form-group">
            <label>Rôle *</label>
            <select [(ngModel)]="newUser.role">
              <option value="user">👤 Utilisateur</option>
              <option value="admin">🛡️ Administrateur</option>
            </select>
          </div>
        </div>
        <button class="add-btn" (click)="addUser()" [disabled]="!newUser.username || !newUser.email || !newUser.password">
          ➕ Créer l'utilisateur
        </button>
      </div>

      <!-- Users list -->
      <div class="section-card animate-in" style="animation-delay: 0.1s">
        <div class="section-header">
          <h2>📋 Liste des utilisateurs ({{ users.length }})</h2>
        </div>
        <div class="users-table">
          <div class="table-head">
            <span>Utilisateur</span>
            <span>E-mail</span>
            <span>Rôle</span>
            <span>Créé le</span>
            <span>Dernière connexion</span>
            <span>Actions</span>
          </div>
          @for (user of users; track user.id) {
            <div class="table-row" [class.current-user]="user.id === currentUserId">
              <div class="user-info">
                <div class="user-avatar" [class.admin-av]="user.role === 'admin'">
                  {{ user.username.charAt(0).toUpperCase() }}
                </div>
                <div>
                  <div class="username">{{ user.username }}</div>
                  @if (user.id === currentUserId) {
                    <div class="you-badge">Vous</div>
                  }
                </div>
              </div>
              <span class="email">{{ user.email }}</span>
              <span>
                <span class="role-badge" [class.admin]="user.role === 'admin'" [class.user-role]="user.role === 'user'">
                  {{ user.role === 'admin' ? '🛡️ Admin' : '👤 Utilisateur' }}
                </span>
              </span>
              <span class="date">{{ formatDate(user.createdAt) }}</span>
              <span class="date">{{ user.lastLogin ? formatDate(user.lastLogin) : '—' }}</span>
              <div class="actions">
                @if (user.id !== currentUserId) {
                  <select class="role-select" [value]="user.role" (change)="changeRole(user.id, $event)">
                    <option value="user">Utilisateur</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button class="del-btn" (click)="deleteUser(user.id)">🗑️</button>
                }
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .admin-page { padding: 2rem; max-width: 1200px; margin: 0 auto; }
    .animate-in { animation: fadeUp 0.4s ease both; }
    @keyframes fadeUp { from { opacity:0; transform: translateY(12px); } to { opacity:1; transform: translateY(0); } }

    .back-btn {
      background: var(--bg-card); border: 1.5px solid var(--bg-card-border);
      border-radius: 10px; padding: 0.5rem 1rem; color: var(--text-secondary);
      font-size: 0.85rem; cursor: pointer; transition: all 0.2s; margin-bottom: 1.5rem;
      display: inline-block;
    }
    .back-btn:hover { color: var(--text-primary); border-color: rgba(255,106,170,0.4); }

    .admin-header { margin-bottom: 2rem; }
    .admin-title-wrap { display: flex; align-items: center; gap: 1rem; }
    .admin-icon {
      width: 52px; height: 52px; border-radius: 14px; font-size: 1.5rem;
      background: rgba(255,61,135,0.1); border: 1.5px solid rgba(255,61,135,0.2);
      display: flex; align-items: center; justify-content: center;
    }
    h1 { font-size: 1.6rem; font-weight: 800; color: var(--text-primary); margin: 0 0 0.25rem; }
    p { color: var(--text-muted); font-size: 0.88rem; margin: 0; }

    .alert { padding: 0.9rem 1.2rem; border-radius: 12px; font-size: 0.88rem; margin-bottom: 1.2rem; }
    .alert.success { background: rgba(0,196,154,0.1); border: 1px solid rgba(0,196,154,0.3); color: var(--accent-green); }
    .alert.error { background: rgba(255,82,82,0.1); border: 1px solid rgba(255,82,82,0.3); color: #ff6b6b; }

    .section-card {
      background: var(--bg-secondary); border: 1.5px solid var(--bg-card-border);
      border-radius: 16px; padding: 1.8rem; margin-bottom: 1.5rem;
    }
    .section-header { margin-bottom: 1.5rem; }
    h2 { font-size: 1.05rem; font-weight: 700; color: var(--text-primary); margin: 0; }

    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.2rem; }
    .form-group label { display: block; font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.4rem; }
    .form-group input, .form-group select {
      width: 100%; padding: 0.7rem 0.9rem;
      background: var(--bg-card); border: 1.5px solid var(--bg-card-border);
      border-radius: 10px; color: var(--text-primary); font-size: 0.88rem;
      outline: none; transition: border-color 0.2s; box-sizing: border-box;
    }
    .form-group input:focus, .form-group select:focus { border-color: rgba(255,106,170,0.5); }
    .form-group select option { background: var(--bg-secondary); }

    .add-btn {
      padding: 0.75rem 1.5rem;
      background: linear-gradient(135deg, var(--accent-rose), var(--accent-purple));
      border: none; border-radius: 10px; color: white;
      font-size: 0.9rem; font-weight: 700; cursor: pointer; transition: all 0.2s;
    }
    .add-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
    .add-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .table-head {
      display: grid; grid-template-columns: 1.5fr 1.8fr 1fr 1fr 1.2fr 1fr;
      gap: 0.5rem; padding: 0.75rem 1rem; margin-bottom: 0.5rem;
      font-size: 0.72rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.5px; color: var(--text-muted);
    }
    .table-row {
      display: grid; grid-template-columns: 1.5fr 1.8fr 1fr 1fr 1.2fr 1fr;
      gap: 0.5rem; padding: 0.9rem 1rem; border-radius: 12px;
      background: var(--bg-card); border: 1.5px solid var(--bg-card-border);
      margin-bottom: 0.6rem; align-items: center; transition: border-color 0.2s;
    }
    .table-row:hover { border-color: rgba(255,106,170,0.25); }
    .table-row.current-user { border-color: rgba(255,106,170,0.4); background: rgba(255,61,135,0.04); }

    .user-info { display: flex; align-items: center; gap: 0.75rem; }
    .user-avatar {
      width: 36px; height: 36px; border-radius: 10px;
      background: rgba(255,61,135,0.1); border: 1.5px solid rgba(255,61,135,0.2);
      display: flex; align-items: center; justify-content: center;
      font-size: 0.95rem; font-weight: 800; color: var(--accent-rose);
    }
    .user-avatar.admin-av { background: rgba(196,77,255,0.1); border-color: rgba(196,77,255,0.25); color: var(--accent-purple); }
    .username { font-size: 0.88rem; font-weight: 700; color: var(--text-primary); }
    .you-badge {
      display: inline-block; padding: 0.1rem 0.4rem; background: rgba(255,61,135,0.15);
      border-radius: 4px; font-size: 0.65rem; color: var(--accent-rose); font-weight: 700;
    }
    .email { font-size: 0.82rem; color: var(--text-secondary); word-break: break-all; }
    .date { font-size: 0.78rem; color: var(--text-muted); font-family: 'JetBrains Mono', monospace; }

    .role-badge {
      padding: 0.25rem 0.7rem; border-radius: 7px; font-size: 0.75rem; font-weight: 700;
    }
    .role-badge.admin { background: rgba(196,77,255,0.15); color: var(--accent-purple); }
    .role-badge.user-role { background: rgba(0,196,154,0.15); color: var(--accent-green); }

    .actions { display: flex; align-items: center; gap: 0.5rem; }
    .role-select {
      padding: 0.3rem 0.5rem; background: var(--bg-primary);
      border: 1.5px solid var(--bg-card-border); border-radius: 7px;
      color: var(--text-secondary); font-size: 0.78rem; cursor: pointer; outline: none;
    }
    .del-btn {
      background: rgba(255,82,82,0.1); border: 1.5px solid rgba(255,82,82,0.2);
      border-radius: 8px; padding: 0.35rem 0.6rem; cursor: pointer;
      font-size: 0.9rem; transition: all 0.2s;
    }
    .del-btn:hover { background: rgba(255,82,82,0.2); }

    @media (max-width: 768px) {
      .form-grid { grid-template-columns: 1fr; }
      .table-head { display: none; }
      .table-row { grid-template-columns: 1fr; gap: 0.6rem; }
    }
  `]
})
export class AdminComponent implements OnInit {
  users: User[] = [];
  currentUserId = '';
  successMsg = '';
  errorMsg = '';

  newUser = { username: '', email: '', password: '', role: 'user' as 'admin' | 'user' };

  constructor(public router: Router, private auth: AuthService) {}

  ngOnInit() {
    const current = this.auth.getCurrentUser();
    if (!current || current.role !== 'admin') {
      this.router.navigate(['/dashboard']);
      return;
    }
    this.currentUserId = current.id;
    this.loadUsers();
  }

  async loadUsers() { this.users = await this.auth.getAllUsers(); }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  async addUser() {
    const result = await this.auth.addUser(this.newUser);
    if (result.success) {
      this.successMsg = result.message;
      this.newUser = { username: '', email: '', password: '', role: 'user' };
      this.loadUsers();
      setTimeout(() => this.successMsg = '', 4000);
    } else {
      this.errorMsg = result.message;
      setTimeout(() => this.errorMsg = '', 4000);
    }
  }

  async deleteUser(id: string) {
    if (!confirm('Confirmer la suppression de cet utilisateur ?')) return;
    const result = await this.auth.deleteUser(id);
    if (result.success) {
      this.successMsg = result.message;
      this.loadUsers();
      setTimeout(() => this.successMsg = '', 4000);
    } else {
      this.errorMsg = result.message;
      setTimeout(() => this.errorMsg = '', 4000);
    }
  }

  async changeRole(userId: string, event: Event) {
    const role = (event.target as HTMLSelectElement).value as 'admin' | 'user';
    const result = await this.auth.updateUserRole(userId, role);
    if (result.success) {
      this.successMsg = result.message;
      this.loadUsers();
      setTimeout(() => this.successMsg = '', 4000);
    }
  }
}
