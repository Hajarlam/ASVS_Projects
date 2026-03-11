import { Component, Inject, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { HeaderComponent } from './components/header/header.component';
import { AiDrawerComponent } from './components/ai-drawer/ai-drawer.component';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, HeaderComponent, AiDrawerComponent],
  template: `
    <div class="app">
      @if (showShell) {
        <app-header></app-header>
      }

      <main class="main-content">
        <router-outlet></router-outlet>
      </main>

      @if (showShell) {
        <footer class="footer">
          <div class="footer-content">
            <p>OWASP ASVS Application Security Verification Standard</p>
          </div>
        </footer>

        <app-ai-drawer></app-ai-drawer>
      }
    </div>
  `
})
export class AppComponent implements OnInit, OnDestroy {
  showShell = false;
  private readonly publicRoutes = new Set(['/', '/login']);
  private readonly isBrowser: boolean;
  private authSub?: Subscription;
  private navSub?: Subscription;

  constructor(
    private router: Router,
    private auth: AuthService,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  private normalizeUrl(url: string): string {
    return (url || '/').split('?')[0].split('#')[0];
  }

  private isPublicUrl(url: string): boolean {
    return this.publicRoutes.has(this.normalizeUrl(url));
  }

  private syncShell(url: string) {
    this.showShell = this.auth.isAuthenticated() && !this.isPublicUrl(url);
  }

  ngOnInit() {
    if (!this.isBrowser) return;

    const initialUrl = this.router.url || '/';
    this.syncShell(initialUrl);

    if (!this.auth.isAuthenticated() && !this.isPublicUrl(initialUrl)) {
      this.router.navigate(['/login']);
    } else if (this.auth.isAuthenticated() && this.normalizeUrl(initialUrl) === '/login') {
      this.router.navigate(['/dashboard']);
    }

    this.authSub = this.auth.getAuthState().subscribe(state => {
      const currentUrl = this.router.url || '/';
      this.syncShell(currentUrl);

      if (!state.isAuthenticated && !this.isPublicUrl(currentUrl)) {
        this.router.navigate(['/login']);
      } else if (state.isAuthenticated && this.normalizeUrl(currentUrl) === '/login') {
        this.router.navigate(['/dashboard']);
      }
    });

    this.navSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => {
        const url = e.urlAfterRedirects || e.url;
        this.syncShell(url);

        if (!this.auth.isAuthenticated() && !this.isPublicUrl(url)) {
          this.router.navigate(['/login']);
        } else if (this.auth.isAuthenticated() && this.normalizeUrl(url) === '/login') {
          this.router.navigate(['/dashboard']);
        }
      });
  }

  ngOnDestroy() {
    this.authSub?.unsubscribe();
    this.navSub?.unsubscribe();
  }
}
