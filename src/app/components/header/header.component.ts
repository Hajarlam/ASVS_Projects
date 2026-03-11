import { Component, OnInit, OnDestroy, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService, User } from '../../services/auth.service';
import { AsvsService } from '../../services/asvs.service';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, FormsModule, CommonModule],
  template: `
    <header class="header">
      <div class="header-inner">

        <!-- Logo -->
        <div class="logo" (click)="goHome()">
          <div class="logo-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 7V12C3 16.5 7 20.7 12 22C17 20.7 21 16.5 21 12V7L12 2Z" fill="url(#lg)"/>
              <path d="M9 12L11 14L15 10" stroke="white" stroke-width="2" stroke-linecap="round"/>
              <defs><linearGradient id="lg" x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
                <stop stop-color="var(--accent-rose)"/><stop offset="1" stop-color="var(--accent-purple)"/>
              </linearGradient></defs>
            </svg>
          </div>
          <div class="logo-text">
            <span class="logo-title">ASVS</span>
            <span class="logo-sub">Application Security Verification Standard</span>
          </div>
        </div>

        <!-- Search -->
        <div class="search-wrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="8" stroke="var(--text-muted)" stroke-width="2"/>
            <path d="M21 21L16.65 16.65" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <input type="text" placeholder="Rechercher..." [(ngModel)]="searchTerm" (keyup.enter)="search()" class="search-input">
        </div>

        <nav class="nav">
          <a routerLink="/dashboard" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}" class="nav-link">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="2"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="2"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="2"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="2"/></svg>
            Dashboard
          </a>

          <!-- Filtres Pass/Fail/NA — toujours visibles quand connecté -->
          @if (currentUser) {
            <div class="status-filters">
              <button class="sf-btn pass" [class.active]="activeFilter === 'pass'" (click)="setFilter('pass')" title="Voir les Réussies">
                ✅ <span class="sf-count">{{ passCount }}</span>
              </button>
              <button class="sf-btn fail" [class.active]="activeFilter === 'fail'" (click)="setFilter('fail')" title="Voir les Échouées">
                ❌ <span class="sf-count">{{ failCount }}</span>
              </button>
              <button class="sf-btn na" [class.active]="activeFilter === 'na'" (click)="setFilter('na')" title="Voir les N/A">
                ➖ <span class="sf-count">{{ naCount }}</span>
              </button>
              @if (activeFilter) {
                <button class="sf-btn sf-clear" (click)="clearFilter()">✕</button>
              }
            </div>
          }

          <a routerLink="/security" routerLinkActive="active" class="nav-link nav-security">🛡️ Sécurité</a>

          <a routerLink="/chat" routerLinkActive="active" class="nav-link nav-ai">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            Chat IA
            <span class="ai-badge">IA</span>
          </a>

          <button class="theme-toggle" (click)="toggleTheme()">
            @if (isDark) {
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="2"/><line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            } @else {
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" stroke-width="2"/></svg>
            }
          </button>

          @if (currentUser) {
            <div class="user-menu-wrap">
              <button class="user-btn" (click)="toggleUserMenu()">
                <div class="user-avatar" [class.admin-av]="currentUser.role === 'admin'">{{ currentUser.username.charAt(0).toUpperCase() }}</div>
                <div class="user-info-mini">
                  <span class="user-name">{{ currentUser.username }}</span>
                  <span class="user-role" [class.admin]="currentUser.role === 'admin'">{{ currentUser.role === 'admin' ? '🛡️ Admin' : '👤 User' }}</span>
                </div>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" [style.transform]="userMenuOpen ? 'rotate(180deg)' : ''"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
              </button>
              @if (userMenuOpen) {
                <div class="user-dropdown">
                  <div class="dropdown-info">
                    <div class="d-name">{{ currentUser.username }}</div>
                    <div class="d-email">{{ currentUser.email }}</div>
                    <div class="d-mode" [class.backend]="isBackend">{{ isBackend ? '🔐 Mode JWT' : '💾 Mode local' }}</div>
                  </div>
                  @if (currentUser.role === 'admin') {
                    <div class="dropdown-item" (click)="router.navigate(['/admin']); userMenuOpen=false">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="2"/></svg>
                      Gestion utilisateurs
                    </div>
                  }
                  <div class="dropdown-item" (click)="router.navigate(['/security']); userMenuOpen=false">🛡️ Centre de Sécurité</div>
                  <button class="dropdown-logout" (click)="logout()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                    Déconnexion
                  </button>
                </div>
              }
            </div>
          } @else {
            <button class="login-btn" (click)="router.navigate(['/login'])">🔐 Connexion</button>
          }
        </nav>
      </div>
    </header>
  `,
  styles: [`
    .header { background: var(--bg-header); backdrop-filter: blur(24px); border-bottom: 1px solid var(--bg-card-border); position: sticky; top: 0; z-index: 1000; padding: 0 2rem; }
    .header-inner { max-width: 1300px; margin: 0 auto; display: flex; align-items: center; gap: 1rem; height: 64px; }
    .logo { display: flex; align-items: center; gap: 0.7rem; cursor: pointer; flex-shrink: 0; }
    .logo-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, rgba(255,61,135,0.15), rgba(196,77,255,0.15)); border: 1px solid rgba(255,106,170,0.3); }
    .logo-text { display: flex; flex-direction: column; }
    .logo-title { font-size: 0.95rem; font-weight: 800; letter-spacing: 1.5px; background: linear-gradient(135deg, var(--accent-pink), var(--accent-purple)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .logo-sub { font-size: 0.6rem; color: var(--text-muted); }
    .search-wrap { flex: 1; max-width: 320px; display: flex; align-items: center; gap: 0.5rem; background: var(--bg-input); border: 1.5px solid var(--bg-card-border); border-radius: 10px; padding: 0 0.75rem; transition: border-color 0.2s; }
    .search-wrap:focus-within { border-color: var(--accent-pink); }
    .search-input { flex: 1; background: none; border: none; outline: none; color: var(--text-primary); font-size: 0.85rem; padding: 0.6rem 0; font-family: inherit; }
    .search-input::placeholder { color: var(--text-muted); }
    .nav { display: flex; align-items: center; gap: 0.3rem; margin-left: auto; flex-wrap: nowrap; }
    .nav-link { display: flex; align-items: center; gap: 0.4rem; color: var(--text-secondary); text-decoration: none; font-size: 0.82rem; font-weight: 600; padding: 0.4rem 0.75rem; border-radius: 9px; transition: all 0.2s; border: 1px solid transparent; white-space: nowrap; }
    .nav-link:hover { color: var(--text-primary); background: var(--bg-card); }
    .nav-link.active { color: var(--accent-pink); background: rgba(255,106,170,0.1); border-color: rgba(255,106,170,0.2); }
    .nav-security.active { color: #00c49a; background: rgba(0,196,154,0.1); border-color: rgba(0,196,154,0.2); }
    .nav-ai { position: relative; }
    .ai-badge { font-size: 0.55rem; font-weight: 800; background: linear-gradient(135deg, var(--accent-rose), var(--accent-purple)); color: white; border-radius: 4px; padding: 1px 4px; }
    .theme-toggle { display: flex; align-items: center; color: var(--text-secondary); background: var(--bg-card); border: 1.5px solid var(--bg-card-border); border-radius: 9px; padding: 0.4rem 0.55rem; cursor: pointer; transition: all 0.2s; }
    .theme-toggle:hover { color: var(--accent-pink); border-color: var(--accent-pink); }
    /* ── Status Filters ── */
    .status-filters { display: flex; align-items: center; gap: 0.15rem; background: var(--bg-card); border: 1.5px solid var(--bg-card-border); border-radius: 10px; padding: 0.18rem; flex-shrink: 0; }
    .sf-btn { display: flex; align-items: center; gap: 0.2rem; padding: 0.25rem 0.55rem; border-radius: 7px; border: none; background: transparent; cursor: pointer; font-size: 0.73rem; font-weight: 700; font-family: inherit; color: var(--text-secondary); transition: all 0.18s; white-space: nowrap; }
    .sf-btn:hover { background: var(--bg-input); }
    .sf-btn.pass.active { background: rgba(0,196,154,0.18); color: #00c49a; }
    .sf-btn.fail.active { background: rgba(255,82,82,0.18); color: #ff6b6b; }
    .sf-btn.na.active { background: rgba(255,165,0,0.18); color: #f0a500; }
    .sf-clear { color: var(--text-muted); font-size: 0.68rem; padding: 0.25rem 0.4rem; }
    .sf-clear:hover { color: #ff6b6b; }
    .sf-count { font-size: 0.62rem; background: var(--bg-secondary); border-radius: 4px; padding: 1px 4px; min-width: 16px; text-align: center; }
    /* ── User menu ── */
    .user-menu-wrap { position: relative; }
    .user-btn { display: flex; align-items: center; gap: 0.55rem; background: var(--bg-card); border: 1.5px solid var(--bg-card-border); border-radius: 11px; padding: 0.35rem 0.7rem; cursor: pointer; color: var(--text-primary); font-family: inherit; transition: all 0.2s; }
    .user-btn:hover { border-color: rgba(255,106,170,0.4); }
    .user-avatar { width: 26px; height: 26px; border-radius: 7px; background: rgba(255,61,135,0.15); border: 1.5px solid rgba(255,61,135,0.3); display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 800; color: var(--accent-rose); }
    .user-avatar.admin-av { background: rgba(196,77,255,0.15); border-color: rgba(196,77,255,0.3); color: var(--accent-purple); }
    .user-info-mini { display: flex; flex-direction: column; gap: 1px; }
    .user-name { font-size: 0.78rem; font-weight: 700; line-height: 1; }
    .user-role { font-size: 0.62rem; color: var(--text-muted); }
    .user-role.admin { color: var(--accent-purple); }
    .user-dropdown { position: absolute; right: 0; top: calc(100% + 8px); background: var(--bg-secondary); border: 1.5px solid var(--bg-card-border); border-radius: 14px; padding: 0.6rem; min-width: 200px; box-shadow: 0 12px 40px rgba(0,0,0,0.3); z-index: 200; animation: dropIn 0.15s ease; }
    @keyframes dropIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
    .dropdown-info { padding: 0.5rem; border-bottom: 1px solid var(--bg-card-border); margin-bottom: 0.4rem; }
    .d-name { font-size: 0.85rem; font-weight: 700; color: var(--text-primary); }
    .d-email { font-size: 0.72rem; color: var(--text-muted); margin-top: 2px; }
    .d-mode { font-size: 0.68rem; margin-top: 4px; color: var(--text-muted); background: var(--bg-card); padding: 2px 6px; border-radius: 5px; display: inline-block; }
    .d-mode.backend { color: #00c49a; background: rgba(0,196,154,0.1); }
    .dropdown-item { display: flex; align-items: center; gap: 0.55rem; padding: 0.5rem; border-radius: 8px; font-size: 0.8rem; color: var(--text-secondary); cursor: pointer; transition: all 0.15s; }
    .dropdown-item:hover { background: var(--bg-card); color: var(--text-primary); }
    .dropdown-logout { display: flex; align-items: center; gap: 0.55rem; width: 100%; padding: 0.5rem; border-radius: 8px; font-size: 0.8rem; color: #ff6b6b; background: none; border: none; cursor: pointer; font-family: inherit; transition: all 0.15s; margin-top: 0.2rem; }
    .dropdown-logout:hover { background: rgba(255,82,82,0.1); }
    .login-btn { background: linear-gradient(135deg, var(--accent-rose), var(--accent-purple)); border: none; border-radius: 9px; color: white; padding: 0.45rem 0.9rem; font-size: 0.8rem; font-weight: 700; cursor: pointer; font-family: inherit; transition: all 0.2s; }
    .login-btn:hover { opacity: 0.9; }
  `]
})
export class HeaderComponent implements OnInit, OnDestroy {
  searchTerm = '';
  isDark = true;
  currentUser: User | null = null;
  userMenuOpen = false;
  isBackend = false;
  activeFilter: 'pass' | 'fail' | 'na' | null = null;
  passCount = 0;
  failCount = 0;
  naCount = 0;
  private subs: Subscription[] = [];
  private isBrowser: boolean;

  constructor(
    public router: Router,
    private auth: AuthService,
    private asvsService: AsvsService,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit() {
    if (this.isBrowser) {
      const saved = localStorage.getItem('asvs_theme') || 'dark';
      this.isDark = saved === 'dark';
      document.documentElement.setAttribute('data-theme', this.isDark ? 'dark' : 'light');
      document.addEventListener('click', this.onDocClick);
    }
    this.subs.push(this.auth.getAuthState().subscribe(s => {
      this.currentUser = s.currentUser;
      this.isBackend = s.mode === 'backend';
    }));
    this.subs.push(this.asvsService.getStats().subscribe(stats => {
      if (stats) {
        this.passCount = stats.passed;
        this.failCount = stats.failed;
        this.naCount = stats.na;
      }
    }));
    // Detect current route for filter reset
    this.subs.push(this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe(e => {
      if (!e.url.includes('/search')) this.activeFilter = null;
    }));
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
    if (this.isBrowser) document.removeEventListener('click', this.onDocClick);
  }

  onDocClick = (e: MouseEvent) => {
    if (!(e.target as HTMLElement).closest('.user-menu-wrap')) this.userMenuOpen = false;
  };

  setFilter(status: 'pass' | 'fail' | 'na') {
    if (this.activeFilter === status) {
      this.activeFilter = null;
      this.router.navigate(['/dashboard']);
    } else {
      this.activeFilter = status;
      this.router.navigate(['/search'], { queryParams: { status } });
    }
  }

  clearFilter() {
    this.activeFilter = null;
    this.router.navigate(['/dashboard']);
  }

  toggleTheme() {
    this.isDark = !this.isDark;
    if (this.isBrowser) {
      document.documentElement.setAttribute('data-theme', this.isDark ? 'dark' : 'light');
      localStorage.setItem('asvs_theme', this.isDark ? 'dark' : 'light');
    }
  }

  toggleUserMenu() { this.userMenuOpen = !this.userMenuOpen; }
  goHome() { this.router.navigate(['/dashboard']); }

  async logout() {
    this.userMenuOpen = false;
    await this.auth.logout();
    this.router.navigate(['/login']);
  }

  search() {
    if (this.searchTerm.trim()) this.router.navigate(['/search'], { queryParams: { q: this.searchTerm } });
  }
}
