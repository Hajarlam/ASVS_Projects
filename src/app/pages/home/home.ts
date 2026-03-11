import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { RouterLink } from '@angular/router';

type Locale = 'en' | 'fr';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="home-root" [class.light]="!isDark">

      <!-- ── Ambient layers ── -->
      <div class="bg-noise"></div>
      <div class="bg-grid"></div>
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
      <div class="orb orb-3"></div>
      <div class="orb orb-4"></div>

      <!-- ══ HEADER ══ -->
      <header class="navbar">
        <div class="navbar-inner">

          <a href="/" class="logo">
            <div class="logo-mark">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L3 7V12C3 16.5 7 20.7 12 22C17 20.7 21 16.5 21 12V7L12 2Z" fill="url(#nlg)"/>
                <path d="M9 12L11 14L15 10" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>
                <defs>
                  <linearGradient id="nlg" x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
                    <stop stop-color="#f472b6"/><stop offset="1" stop-color="#c084fc"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div class="logo-text">
              <span class="logo-name">ASVS<em>Security</em></span>
              <span class="logo-sub">Application Security Verification Standard</span>
            </div>
          </a>

          <nav class="nav-links">
            <a href="#how" class="nav-link">{{ copy.navHow }}</a>
            <a href="#features" class="nav-link">{{ copy.navFeatures }}</a>
          </nav>

          <div class="nav-actions">
            <!-- Theme toggle -->
            <button class="theme-toggle" type="button" (click)="toggleTheme()" [attr.aria-label]="isDark ? 'Light mode' : 'Dark mode'">
              <span class="t-track" [class.on]="!isDark">
                <span class="t-thumb">
                  @if (!isDark) {
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="4.5" stroke="currentColor" stroke-width="1.9"/>
                      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>
                    </svg>
                  } @else {
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>
                    </svg>
                  }
                </span>
              </span>
            </button>

            <!-- Lang toggle -->
            <button class="lang-btn" type="button" (click)="toggleLocale()">
              {{ locale === 'en' ? 'FR' : 'EN' }}
            </button>

            <a class="cta-btn" routerLink="/login">{{ copy.login }}</a>
          </div>

        </div>
      </header>

      <!-- ══ HERO ══ -->
      <main class="main-wrap">
        <section class="hero">
          <div class="hero-inner">

            <div class="eyebrow-pill">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L3 7V12C3 16.5 7 20.7 12 22C17 20.7 21 16.5 21 12V7L12 2Z" stroke="currentColor" stroke-width="2"/>
              </svg>
              {{ copy.badge }}
            </div>

            <h1 class="hero-h1">
              <span class="h1-line1">{{ copy.heroTitle1 }}</span>
              <span class="h1-line2">
                <span class="h1-dim">{{ copy.heroTitleDim }}</span>
                <span class="h1-shine">{{ copy.heroTitleHighlight }}</span>
              </span>
            </h1>

            <p class="hero-p">{{ copy.heroSubtitle }}</p>

            <div class="hero-actions">
              <a class="btn-primary" routerLink="/login">
                {{ copy.heroCta }}
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </a>
              <a class="btn-ghost" href="#how">{{ copy.heroCtaSecondary }}</a>
            </div>

            <!-- Stats row -->
            <div class="stats-row">
              @for (s of copy.stats; track s.label) {
                <div class="stat-item">
                  <span class="stat-val">{{ s.val }}</span>
                  <span class="stat-lbl">{{ s.label }}</span>
                </div>
              }
            </div>
          </div>

          <!-- Report card -->
          <aside class="report-shell">
            <div class="report-glow"></div>
            <div class="report-card">
              <div class="rc-header">
                <div class="rc-dots">
                  <span class="rcd red"></span>
                  <span class="rcd amber"></span>
                  <span class="rcd green"></span>
                </div>
                <span class="rc-title">Security Scan Report</span>
                <span class="rc-badge">Live</span>
              </div>
              <div class="rc-rows">
                @for (row of copy.reportRows; track row.label) {
                  <div class="rc-row" [ngClass]="row.tone">
                    <span class="rc-label">{{ row.label }}</span>
                    <span class="rc-level">{{ row.level }}</span>
                  </div>
                }
              </div>
              <div class="rc-footer">
                <div class="rc-bar-wrap">
                  <div class="rc-bar-label">Security Score</div>
                  <div class="rc-bar-track">
                    <div class="rc-bar-fill" style="width:72%"></div>
                  </div>
                  <span class="rc-bar-val">72%</span>
                </div>
              </div>
            </div>
          </aside>
        </section>

        <!-- ══ HOW IT WORKS ══ -->
        <section id="how" class="how-section">
          <div class="section-label">
            <span class="section-kicker">{{ copy.howKicker }}</span>
          </div>
          <h2 class="section-h2">{{ copy.howTitle }}</h2>
          <p class="section-p">{{ copy.howSub }}</p>

          <div class="how-grid">
            @for (card of copy.howCards; track card.title; let i = $index) {
              <article class="how-card" [attr.data-i]="i">
                <div class="hc-num">0{{ i + 1 }}</div>
                <div class="hc-icon">{{ card.icon }}</div>
                <h3>{{ card.title }}</h3>
                <p>{{ card.desc }}</p>
                <div class="hc-line"></div>
              </article>
            }
          </div>
        </section>

        <!-- ══ FEATURES ══ -->
        <section id="features" class="features-section">
          <div class="section-label">
            <span class="section-kicker">{{ copy.projectKicker }}</span>
          </div>
          <h2 class="section-h2">{{ copy.projectTitle }}</h2>

          <div class="feat-grid">
            @for (card of copy.projectCards; track card.title; let i = $index) {
              <article class="feat-card" [class.feat-wide]="i === 0">
                <div class="fc-accent"></div>
                <h3>{{ card.title }}</h3>
                <p>{{ card.desc }}</p>
              </article>
            }
          </div>
        </section>
      </main>

      <!-- ══ FOOTER ══ -->
      <footer class="footer">
        <div class="footer-cta-band">
          <div class="fcb-inner">
            <div class="fcb-orb"></div>
            <p class="fcb-kicker">{{ copy.footerKicker }}</p>
            <h3 class="fcb-title">{{ copy.footerTitle }}</h3>
            <a class="btn-primary" routerLink="/login">
              {{ copy.footerButton }}
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </a>
          </div>
        </div>

        <div class="footer-grid">
          <div class="fg-brand">
            <div class="fg-logo">
              <div class="logo-mark sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L3 7V12C3 16.5 7 20.7 12 22C17 20.7 21 16.5 21 12V7L12 2Z" fill="url(#flg)"/>
                  <path d="M9 12L11 14L15 10" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
                  <defs>
                    <linearGradient id="flg" x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
                      <stop stop-color="#f472b6"/><stop offset="1" stop-color="#c084fc"/>
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <span>ASVSSecurity</span>
            </div>
            <p>{{ copy.footerText }}</p>
          </div>

          <div class="fg-col">
            <h4>{{ copy.footerCol1Title }}</h4>
            <ul>
              @for (item of copy.footerCol1Items; track item) {
                <li>{{ item }}</li>
              }
            </ul>
          </div>

          <div class="fg-col">
            <h4>{{ copy.footerCol2Title }}</h4>
            <ul>
              @for (item of copy.footerCol2Items; track item) {
                <li>{{ item }}</li>
              }
            </ul>
          </div>
        </div>

        <div class="footer-bottom">
          <span>{{ copy.footerBottom }}</span>
          <a routerLink="/login">{{ copy.login }}</a>
        </div>
      </footer>

    </div>
  `,
  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600;700&display=swap');

    /* ── Tokens ───────────────────────────────────────── */
    :host {
      --pink:        #f472b6;
      --pink-light:  #fbb6da;
      --sky:         #7dd3fc;
      --sky-light:   #bae6fd;
      --mauve:       #c084fc;
      --mauve-light: #e9d5ff;
      --surface:     #07090f;
      --surface-2:   #0d0f18;
      --surface-3:   #121520;
      --surface-4:   #171b28;
      --border:      rgba(196,132,252,0.12);
      --border-hi:   rgba(196,132,252,0.4);
      --text-1:      #f0eeff;
      --text-2:      #8e8aaa;
      --text-3:      #4a4760;
      --glow:        rgba(196,132,252,0.16);
      --ff-serif:    'Cormorant Garamond', Georgia, serif;
      --ff-sans:     'DM Sans', sans-serif;
      --ff-mono:     'DM Mono', monospace;
    }

    /* ── Root ─────────────────────────────────────────── */
    .home-root {
      font-family: var(--ff-sans);
      min-height: 100vh;
      background: var(--surface);
      color: var(--text-1);
      position: relative;
      overflow-x: hidden;
    }

    /* ── Ambient layers ───────────────────────────────── */
    .bg-noise, .bg-grid, .orb {
      position: fixed;
      inset: 0;
      pointer-events: none;
    }
    .bg-noise {
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.032'/%3E%3C/svg%3E");
      background-size: 180px 180px;
      opacity: 0.55;
      mix-blend-mode: overlay;
      z-index: 0;
    }
    .bg-grid {
      background-image:
        linear-gradient(rgba(196,132,252,0.028) 1px, transparent 1px),
        linear-gradient(90deg, rgba(125,211,252,0.022) 1px, transparent 1px);
      background-size: 52px 52px;
      mask-image: radial-gradient(ellipse 80% 80% at 50% 30%, black 30%, transparent 100%);
      z-index: 0;
    }
    .orb {
      border-radius: 50%;
      filter: blur(100px);
      z-index: 0;
    }
    .orb-1 { width: 700px; height: 700px; top: -280px; left: -200px; background: radial-gradient(circle, rgba(244,114,182,0.1), transparent 70%); }
    .orb-2 { width: 500px; height: 500px; bottom: -200px; right: -150px; background: radial-gradient(circle, rgba(125,211,252,0.1), transparent 70%); }
    .orb-3 { width: 400px; height: 400px; top: 40%; left: 50%; transform: translate(-50%,-50%); background: radial-gradient(circle, rgba(196,132,252,0.08), transparent 70%); }
    .orb-4 { width: 300px; height: 300px; top: 60%; right: 10%; background: radial-gradient(circle, rgba(244,114,182,0.06), transparent 70%); }

    /* ── Navbar ───────────────────────────────────────── */
    .navbar {
      position: sticky;
      top: 0.6rem;
      z-index: 100;
      padding: 0 clamp(0.8rem, 2vw, 1.6rem);
    }
    .navbar-inner {
      max-width: 1160px;
      margin: 0 auto;
      height: 62px;
      display: flex;
      align-items: center;
      gap: 1rem;
      border-radius: 16px;
      border: 1px solid var(--border-hi);
      background: rgba(13,15,24,0.82);
      backdrop-filter: blur(20px);
      padding: 0 1.2rem;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(196,132,252,0.08);
      position: relative;
      overflow: hidden;
    }
    .navbar-inner::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent 5%, var(--pink) 30%, var(--sky) 60%, var(--mauve) 80%, transparent 95%);
      opacity: 0.6;
    }

    /* Logo */
    .logo { display: flex; align-items: center; gap: 0.65rem; text-decoration: none; flex-shrink: 0; }
    .logo-mark {
      width: 38px; height: 38px;
      border-radius: 10px;
      border: 1px solid var(--border-hi);
      background: var(--surface-3);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
      flex-shrink: 0;
    }
    .logo-mark.sm { width: 28px; height: 28px; border-radius: 8px; }
    .logo-name {
      font-family: var(--ff-sans);
      font-size: 0.88rem;
      font-weight: 700;
      color: var(--text-2);
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .logo-name em { font-style: normal; color: var(--pink-light); }
    .logo-sub { font-size: 0.58rem; color: var(--text-3); letter-spacing: 0.02em; }

    /* Nav links */
    .nav-links {
      display: flex;
      align-items: center;
      gap: 0.2rem;
      margin-left: auto;
    }
    .nav-link {
      font-size: 0.82rem;
      font-weight: 500;
      color: var(--text-2);
      text-decoration: none;
      padding: 0.38rem 0.72rem;
      border-radius: 8px;
      border: 1px solid transparent;
      transition: all 0.2s;
    }
    .nav-link:hover {
      color: var(--text-1);
      background: rgba(196,132,252,0.08);
      border-color: var(--border);
    }

    /* Nav actions */
    .nav-actions { display: flex; align-items: center; gap: 0.55rem; margin-left: 1rem; }

    /* Theme toggle */
    .theme-toggle { background: none; border: none; padding: 0; cursor: pointer; }
    .t-track {
      display: flex; align-items: center;
      width: 48px; height: 26px;
      border-radius: 99px;
      border: 1px solid var(--border);
      background: var(--surface-4);
      padding: 2px;
      transition: background 0.3s, border-color 0.3s;
    }
    .t-track.on {
      background: linear-gradient(135deg, rgba(244,114,182,0.2), rgba(196,132,252,0.2));
      border-color: var(--border-hi);
    }
    .t-thumb {
      width: 20px; height: 20px;
      border-radius: 50%;
      background: var(--surface-3);
      border: 1px solid var(--border-hi);
      display: flex; align-items: center; justify-content: center;
      color: var(--mauve);
      transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), background 0.3s, color 0.3s;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
    }
    .t-track.on .t-thumb {
      transform: translateX(22px);
      background: white;
      color: var(--pink);
      border-color: rgba(244,114,182,0.4);
    }

    /* Lang btn */
    .lang-btn {
      font-family: var(--ff-mono);
      font-size: 0.72rem;
      font-weight: 500;
      letter-spacing: 0.06em;
      color: var(--text-2);
      background: var(--surface-4);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.34rem 0.6rem;
      cursor: pointer;
      transition: all 0.2s;
      height: 30px;
    }
    .lang-btn:hover { color: var(--mauve); border-color: var(--border-hi); }

    /* CTA btn */
    .cta-btn {
      font-family: var(--ff-sans);
      font-size: 0.84rem;
      font-weight: 700;
      color: white;
      background: linear-gradient(135deg, #d946a8, #c084fc 50%, #818cf8);
      border: 1px solid rgba(244,114,182,0.4);
      border-radius: 10px;
      padding: 0.46rem 1rem;
      text-decoration: none;
      transition: all 0.2s;
      box-shadow: 0 4px 16px rgba(196,132,252,0.25), inset 0 1px 0 rgba(255,255,255,0.14);
      position: relative;
      overflow: hidden;
    }
    .cta-btn::after {
      content: '';
      position: absolute; inset: 0;
      background: linear-gradient(120deg, transparent 35%, rgba(255,255,255,0.15) 50%, transparent 65%);
      transform: translateX(-100%);
      transition: transform 0.5s ease;
    }
    .cta-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(196,132,252,0.38); }
    .cta-btn:hover::after { transform: translateX(100%); }

    /* ── Main ─────────────────────────────────────────── */
    .main-wrap {
      position: relative;
      z-index: 1;
      max-width: 1160px;
      margin: 0 auto;
      padding: 0 clamp(1rem, 3vw, 2rem);
    }

    /* ── Hero ─────────────────────────────────────────── */
    .hero {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
      align-items: center;
      padding: 4.5rem 0 3rem;
    }
    .hero-inner { display: flex; flex-direction: column; gap: 1.4rem; }

    .eyebrow-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.4rem 0.9rem;
      border-radius: 99px;
      border: 1px solid rgba(196,132,252,0.3);
      background: rgba(196,132,252,0.08);
      color: var(--mauve-light);
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      width: fit-content;
      animation: fadeUp 0.5s ease both;
    }

    .hero-h1 {
      margin: 0;
      font-family: var(--ff-serif);
      font-size: clamp(3rem, 5.5vw, 5.2rem);
      font-weight: 600;
      line-height: 1.05;
      letter-spacing: -0.015em;
      display: flex;
      flex-direction: column;
      animation: fadeUp 0.55s ease 0.05s both;
    }
    .h1-line1 { color: var(--text-1); }
    .h1-line2 { display: flex; flex-wrap: wrap; gap: 0.25em; align-items: baseline; }
    .h1-dim {
      background: linear-gradient(120deg, var(--sky), var(--sky-light));
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
    }
    .h1-shine {
      background: linear-gradient(120deg, var(--pink), var(--mauve), var(--sky));
      background-size: 200% auto;
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
      animation: gradShift 4s linear infinite;
    }
    @keyframes gradShift { to { background-position: 200% center; } }

    .hero-p {
      margin: 0;
      font-size: 1rem;
      line-height: 1.72;
      color: var(--text-2);
      max-width: 46ch;
      animation: fadeUp 0.6s ease 0.1s both;
    }

    .hero-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      animation: fadeUp 0.65s ease 0.15s both;
    }

    /* Primary btn */
    .btn-primary {
      display: inline-flex; align-items: center; gap: 0.45rem;
      font-family: var(--ff-sans);
      font-size: 0.9rem;
      font-weight: 700;
      color: white;
      background: linear-gradient(135deg, #d946a8, #c084fc 50%, #818cf8);
      border: 1px solid rgba(244,114,182,0.4);
      border-radius: 12px;
      padding: 0.78rem 1.3rem;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 6px 22px rgba(196,132,252,0.28), inset 0 1px 0 rgba(255,255,255,0.14);
      position: relative;
      overflow: hidden;
    }
    .btn-primary::after {
      content: ''; position: absolute; inset: 0;
      background: linear-gradient(120deg, transparent 35%, rgba(255,255,255,0.16) 50%, transparent 65%);
      transform: translateX(-100%); transition: transform 0.5s;
    }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 30px rgba(196,132,252,0.4); }
    .btn-primary:hover::after { transform: translateX(100%); }

    /* Ghost btn */
    .btn-ghost {
      display: inline-flex; align-items: center; gap: 0.4rem;
      font-family: var(--ff-sans);
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--text-2);
      background: var(--surface-3);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 0.78rem 1.3rem;
      text-decoration: none;
      transition: all 0.2s;
    }
    .btn-ghost:hover { color: var(--text-1); border-color: var(--border-hi); transform: translateY(-1px); }

    /* Stats */
    .stats-row {
      display: flex;
      gap: 1.8rem;
      padding-top: 0.5rem;
      border-top: 1px solid var(--border);
      animation: fadeUp 0.7s ease 0.2s both;
    }
    .stat-item { display: flex; flex-direction: column; gap: 0.18rem; }
    .stat-val {
      font-family: var(--ff-serif);
      font-size: 1.7rem;
      font-weight: 600;
      line-height: 1;
      background: linear-gradient(120deg, var(--pink), var(--mauve));
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
    }
    .stat-lbl { font-size: 0.73rem; color: var(--text-3); letter-spacing: 0.02em; }

    /* ── Report card ──────────────────────────────────── */
    .report-shell {
      position: relative;
      animation: fadeUp 0.7s ease 0.25s both;
    }
    .report-glow {
      position: absolute;
      inset: -60px;
      background: radial-gradient(circle at 50% 50%, rgba(196,132,252,0.18), transparent 70%);
      pointer-events: none;
      filter: blur(30px);
    }
    .report-card {
      position: relative;
      border-radius: 22px;
      border: 1px solid rgba(196,132,252,0.22);
      background: linear-gradient(160deg, rgba(13,15,24,0.96), rgba(18,16,32,0.98));
      box-shadow: 0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(196,132,252,0.1);
      overflow: hidden;
      backdrop-filter: blur(12px);
    }
    .report-card::before {
      content: '';
      position: absolute; top: 0; left: 0; right: 0; height: 1px;
      background: linear-gradient(90deg, transparent, var(--pink) 30%, var(--mauve) 70%, transparent);
      opacity: 0.7;
    }
    .rc-header {
      display: flex; align-items: center; gap: 0.7rem;
      padding: 1rem 1.15rem;
      border-bottom: 1px solid var(--border);
    }
    .rc-dots { display: flex; gap: 0.32rem; }
    .rcd { width: 10px; height: 10px; border-radius: 50%; }
    .rcd.red { background: #ff4d4f; }
    .rcd.amber { background: #f5b82f; }
    .rcd.green { background: #21cc75; }
    .rc-title { font-size: 0.82rem; color: var(--text-2); flex: 1; font-family: var(--ff-mono); }
    .rc-badge {
      font-size: 0.65rem; font-weight: 700; letter-spacing: 0.08em;
      padding: 0.18rem 0.5rem; border-radius: 99px;
      background: rgba(33,204,117,0.15); color: #21cc75;
      border: 1px solid rgba(33,204,117,0.3);
      text-transform: uppercase;
      animation: pulse 2s ease-in-out infinite;
    }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }

    .rc-rows { display: flex; flex-direction: column; gap: 0.55rem; padding: 0.9rem 1rem; }
    .rc-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.7rem 0.85rem;
      border-radius: 12px;
      border: 1px solid;
      font-size: 0.83rem;
    }
    .rc-label { color: #e8eeff; font-weight: 500; line-height: 1.35; }
    .rc-level { font-size: 0.7rem; font-weight: 800; padding: 0.22rem 0.62rem; border-radius: 99px; border: 1px solid; white-space: nowrap; font-family: var(--ff-mono); }

    .rc-row.critical { border-color: rgba(255,77,79,0.35); background: rgba(100,18,22,0.3); }
    .rc-row.critical .rc-level { background: rgba(255,77,79,0.18); border-color: rgba(255,77,79,0.38); color: #ffb0b1; }
    .rc-row.high { border-color: rgba(255,151,45,0.35); background: rgba(100,50,5,0.3); }
    .rc-row.high .rc-level { background: rgba(255,151,45,0.18); border-color: rgba(255,151,45,0.38); color: #ffc889; }
    .rc-row.medium { border-color: rgba(248,206,63,0.32); background: rgba(90,76,8,0.28); }
    .rc-row.medium .rc-level { background: rgba(248,206,63,0.18); border-color: rgba(248,206,63,0.35); color: #ffe79d; }
    .rc-row.pass { border-color: rgba(33,204,117,0.35); background: rgba(8,80,44,0.28); }
    .rc-row.pass .rc-level { background: rgba(33,204,117,0.18); border-color: rgba(33,204,117,0.35); color: #9cf5c6; }

    .rc-footer { padding: 0.85rem 1rem 1rem; border-top: 1px solid var(--border); }
    .rc-bar-wrap { display: flex; align-items: center; gap: 0.65rem; }
    .rc-bar-label { font-size: 0.73rem; color: var(--text-3); font-family: var(--ff-mono); white-space: nowrap; }
    .rc-bar-track { flex: 1; height: 6px; border-radius: 99px; background: var(--surface-4); overflow: hidden; }
    .rc-bar-fill { height: 100%; border-radius: 99px; background: linear-gradient(90deg, var(--pink), var(--mauve)); box-shadow: 0 0 8px rgba(196,132,252,0.5); }
    .rc-bar-val { font-size: 0.73rem; font-weight: 700; color: var(--mauve); font-family: var(--ff-mono); }

    /* ── How section ──────────────────────────────────── */
    .how-section, .features-section {
      padding: 4rem 0;
      text-align: center;
    }
    .section-label { margin-bottom: 0.6rem; }
    .section-kicker {
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--sky);
      display: inline-flex; align-items: center; gap: 0.5rem;
    }
    .section-kicker::before, .section-kicker::after {
      content: '';
      display: block; width: 20px; height: 1px;
      background: var(--sky); opacity: 0.5;
    }
    .section-h2 {
      margin: 0.4rem 0 0;
      font-family: var(--ff-serif);
      font-size: clamp(2rem, 3.5vw, 3rem);
      font-weight: 600;
      color: var(--text-1);
      letter-spacing: -0.01em;
    }
    .section-p {
      margin: 0.8rem auto 0;
      max-width: 52ch;
      font-size: 0.95rem;
      color: var(--text-2);
      line-height: 1.7;
    }

    /* How cards */
    .how-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
      margin-top: 2.5rem;
    }
    .how-card {
      position: relative;
      text-align: left;
      padding: 1.5rem;
      border-radius: 18px;
      border: 1px solid var(--border);
      background: linear-gradient(145deg, var(--surface-3), var(--surface-2));
      overflow: hidden;
      transition: transform 0.22s, border-color 0.22s, box-shadow 0.22s;
      cursor: default;
    }
    .how-card::before {
      content: '';
      position: absolute; top: 0; left: 0; right: 0; height: 1px;
      background: linear-gradient(90deg, transparent, var(--mauve), transparent);
      opacity: 0;
      transition: opacity 0.3s;
    }
    .how-card:hover { transform: translateY(-4px); border-color: var(--border-hi); box-shadow: 0 20px 48px rgba(0,0,0,0.4); }
    .how-card:hover::before { opacity: 1; }

    .hc-num {
      font-family: var(--ff-mono);
      font-size: 0.65rem;
      color: var(--text-3);
      letter-spacing: 0.06em;
      margin-bottom: 1rem;
    }
    .hc-icon {
      width: 40px; height: 40px;
      border-radius: 11px;
      border: 1px solid var(--border-hi);
      background: linear-gradient(135deg, rgba(125,211,252,0.1), rgba(196,132,252,0.1));
      display: flex; align-items: center; justify-content: center;
      font-family: var(--ff-mono);
      font-size: 0.75rem;
      color: var(--sky);
      margin-bottom: 0.9rem;
      box-shadow: 0 4px 14px rgba(0,0,0,0.25);
    }
    .how-card h3 {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-1);
      line-height: 1.3;
    }
    .how-card p {
      margin: 0.5rem 0 0;
      font-size: 0.84rem;
      color: var(--text-2);
      line-height: 1.62;
    }
    .hc-line {
      position: absolute; bottom: 0; left: 0; right: 0; height: 2px;
      background: linear-gradient(90deg, var(--pink), var(--mauve));
      transform: scaleX(0);
      transform-origin: left;
      transition: transform 0.3s ease;
    }
    .how-card:hover .hc-line { transform: scaleX(1); }

    /* Feat cards */
    .feat-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
      margin-top: 2.5rem;
    }
    .feat-card {
      text-align: left;
      padding: 1.6rem;
      border-radius: 18px;
      border: 1px solid var(--border);
      background: linear-gradient(145deg, var(--surface-3), var(--surface-2));
      transition: transform 0.22s, border-color 0.22s;
      position: relative;
      overflow: hidden;
    }
    .fc-accent {
      position: absolute; top: 0; left: 0; right: 0; height: 2px;
      background: linear-gradient(90deg, var(--pink), var(--mauve), var(--sky));
    }
    .feat-card:hover { transform: translateY(-3px); border-color: var(--border-hi); }
    .feat-wide { grid-column: span 1; }
    .feat-card h3 { margin: 0; font-size: 1.05rem; font-weight: 600; color: var(--text-1); }
    .feat-card p { margin: 0.55rem 0 0; font-size: 0.86rem; color: var(--text-2); line-height: 1.65; }

    /* ── Footer ───────────────────────────────────────── */
    .footer {
      position: relative; z-index: 1;
      max-width: 1160px;
      margin: 2rem auto 0;
      padding: 0 clamp(1rem, 3vw, 2rem) 2.5rem;
    }

    .footer-cta-band {
      border-radius: 22px;
      border: 1px solid var(--border-hi);
      background: linear-gradient(145deg, rgba(196,132,252,0.08), rgba(244,114,182,0.06));
      overflow: hidden;
      position: relative;
    }
    .footer-cta-band::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
      background: linear-gradient(90deg, transparent, var(--pink) 30%, var(--mauve) 70%, transparent);
      opacity: 0.7;
    }
    .fcb-inner {
      display: flex; flex-direction: column; align-items: center;
      text-align: center; gap: 1rem; padding: 3rem 2rem;
      position: relative;
    }
    .fcb-orb {
      position: absolute; inset: 0;
      background: radial-gradient(circle at 50% 100%, rgba(196,132,252,0.12), transparent 60%);
      pointer-events: none;
    }
    .fcb-kicker {
      font-size: 0.7rem; font-weight: 700; letter-spacing: 0.14em;
      text-transform: uppercase; color: var(--pink-light);
      position: relative;
    }
    .fcb-title {
      margin: 0; position: relative;
      font-family: var(--ff-serif);
      font-size: clamp(1.8rem, 3vw, 2.6rem);
      font-weight: 600; color: var(--text-1);
      line-height: 1.2; max-width: 40ch;
    }

    .footer-grid {
      margin-top: 2rem;
      display: grid;
      grid-template-columns: 2fr 1fr 1fr;
      gap: 2rem;
      padding: 2rem;
      border-radius: 18px;
      border: 1px solid var(--border);
      background: var(--surface-2);
    }
    .fg-logo {
      display: flex; align-items: center; gap: 0.6rem;
      font-family: var(--ff-sans); font-size: 1rem;
      font-weight: 700; color: var(--text-1);
      margin-bottom: 0.75rem;
    }
    .fg-brand p { font-size: 0.84rem; color: var(--text-2); line-height: 1.65; max-width: 34ch; }
    .fg-col h4 {
      margin: 0 0 0.9rem;
      font-size: 0.75rem; font-weight: 700;
      letter-spacing: 0.1em; text-transform: uppercase;
      color: var(--mauve);
    }
    .fg-col ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.45rem; }
    .fg-col li { font-size: 0.84rem; color: var(--text-2); }

    .footer-bottom {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1rem 0.5rem 0;
      border-top: 1px solid var(--border);
      margin-top: 0.5rem;
      font-size: 0.75rem; color: var(--text-3);
    }
    .footer-bottom a {
      color: var(--sky); text-decoration: none; font-weight: 600;
    }
    .footer-bottom a:hover { text-decoration: underline; }

    /* ── Light mode ───────────────────────────────────── */
    .home-root.light {
      --surface:    #f2eeff;
      --surface-2:  #faf8ff;
      --surface-3:  #ede8ff;
      --surface-4:  #e4dcfc;
      --border:     rgba(156,90,210,0.16);
      --border-hi:  rgba(196,132,252,0.45);
      --text-1:     #180f30;
      --text-2:     #6b5a8a;
      --text-3:     #a895c4;
      --glow:       rgba(196,132,252,0.12);
    }
    .home-root.light .navbar-inner {
      background: rgba(250,248,255,0.88);
      box-shadow: 0 8px 32px rgba(130,80,200,0.12);
    }
    .home-root.light .report-card {
      background: linear-gradient(160deg, rgba(255,255,255,0.98), rgba(245,240,255,0.98));
      border-color: rgba(196,132,252,0.28);
    }
    .home-root.light .how-card,
    .home-root.light .feat-card {
      background: linear-gradient(145deg, rgba(255,255,255,0.95), rgba(248,244,255,0.95));
      box-shadow: 0 4px 20px rgba(130,80,200,0.1);
    }
    .home-root.light .footer-grid {
      background: white;
      box-shadow: 0 2px 16px rgba(130,80,200,0.08);
    }
    .home-root.light .footer-cta-band {
      background: linear-gradient(145deg, rgba(240,232,255,0.9), rgba(255,236,248,0.85));
    }

    /* ── Animations ───────────────────────────────────── */
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(18px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── Responsive ───────────────────────────────────── */
    @media (max-width: 1000px) {
      .hero { grid-template-columns: 1fr; }
      .report-shell { max-width: 560px; margin: 0 auto; }
      .how-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 720px) {
      .how-grid, .feat-grid { grid-template-columns: 1fr; }
      .footer-grid { grid-template-columns: 1fr; }
      .nav-links { display: none; }
      .footer-bottom { flex-direction: column; align-items: flex-start; gap: 0.5rem; }
    }
    @media (max-width: 480px) {
      .hero { padding: 2.5rem 0 2rem; }
      .hero-h1 { font-size: clamp(2.2rem, 10vw, 3rem); }
      .hero-actions { flex-direction: column; align-items: flex-start; }
      .stats-row { gap: 1.2rem; }
    }
  `]
})
export class HomeComponent implements OnInit {
  isDark = true;
  locale: Locale = 'en';
  private readonly isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit() {
    if (!this.isBrowser) return;
    const savedTheme = localStorage.getItem('asvs_theme') || 'dark';
    this.isDark = savedTheme === 'dark';
    document.documentElement.setAttribute('data-theme', this.isDark ? 'dark' : 'light');
    const savedLocale = localStorage.getItem('asvs_home_locale');
    if (savedLocale === 'fr' || savedLocale === 'en') this.locale = savedLocale;
  }

  get copy() { return this.locale === 'en' ? this.content.en : this.content.fr; }

  toggleTheme() {
    this.isDark = !this.isDark;
    if (!this.isBrowser) return;
    document.documentElement.setAttribute('data-theme', this.isDark ? 'dark' : 'light');
    localStorage.setItem('asvs_theme', this.isDark ? 'dark' : 'light');
  }

  toggleLocale() {
    this.locale = this.locale === 'en' ? 'fr' : 'en';
    if (!this.isBrowser) return;
    localStorage.setItem('asvs_home_locale', this.locale);
  }

  private readonly content = {
    en: {
      navHow: 'How It Works',
      navFeatures: 'Features',
      login: 'Sign In',
      badge: 'Powered by OWASP ASVS Standards',
      heroTitle1: 'Secure Your Code with',
      heroTitleDim: 'AI-Powered',
      heroTitleHighlight: 'Analysis',
      heroSubtitle: 'Generate comprehensive Pass and Fail PDF security reports. Detect vulnerabilities and get AI-generated remediation suggestions mapped to OWASP ASVS requirements.',
      heroCta: 'Go to Dashboard',
      heroCtaSecondary: 'See How It Works',
      stats: [
        { val: '4.0', label: 'ASVS Version' },
        { val: '286', label: 'Controls Mapped' },
        { val: '100%', label: 'Open Standard' },
      ],
      reportRows: [
        { label: 'SQL Injection vulnerability detected', level: 'Critical', tone: 'critical' },
        { label: 'Outdated dependency: lodash', level: 'High', tone: 'high' },
        { label: 'Missing security headers', level: 'Medium', tone: 'medium' },
        { label: 'No hardcoded secrets found', level: 'Pass', tone: 'pass' },
      ],
      howKicker: 'How It Works',
      howTitle: 'Multi-Layer Security Scanning',
      howSub: 'Our scanner performs comprehensive analysis across multiple security dimensions.',
      howCards: [
        { icon: '</>', title: 'Static Analysis', desc: 'Detect vulnerabilities in your source code before they reach production.' },
        { icon: 'Pkg', title: 'Dependency Scan', desc: 'Identify outdated and vulnerable packages across your dependency tree.' },
        { icon: 'Cfg', title: 'Configuration Review', desc: 'Check for security misconfigurations in your infrastructure setup.' },
        { icon: 'Key', title: 'Secret Detection', desc: 'Find exposed API keys and credentials leaked into your codebase.' },
      ],
      projectKicker: 'Built For This Project',
      projectTitle: 'ASVS-Oriented Security Workflow',
      projectCards: [
        { title: 'ASVS Mapping', desc: 'Each finding is mapped to specific ASVS controls for direct compliance tracking and audit-ready reports.' },
        { title: 'AI Copilot', desc: 'Generate practical fixes and secure code snippets based on vulnerability context using AI.' },
        { title: 'Backend + MCP Ready', desc: 'Run repository scans and centralize outputs with your MCP-enabled backend infrastructure.' },
      ],
      footerKicker: 'Get Started Today',
      footerTitle: 'Secure your applications with a practical ASVS-first workflow.',
      footerButton: 'Open Dashboard',
      footerText: 'A focused security workspace for scanning, validating, and improving your codebase quality.',
      footerCol1Title: 'Core Modules',
      footerCol1Items: ['ASVS Dashboard', 'Security Center', 'AI Chat', 'Repository Scan'],
      footerCol2Title: 'Coverage',
      footerCol2Items: ['OWASP Top Risks', 'Dependency Hygiene', 'Secrets Exposure', 'Hardening Checks'],
      footerBottom: 'ASVSSecurity — OWASP ASVS v4 compatible toolkit',
    },
    fr: {
      navHow: 'Fonctionnement',
      navFeatures: 'Fonctionnalités',
      login: 'Connexion',
      badge: 'Basé sur les standards OWASP ASVS',
      heroTitle1: 'Sécurisez votre code avec une',
      heroTitleDim: 'Analyse propulsée',
      heroTitleHighlight: 'par l\'IA',
      heroSubtitle: 'Générez des rapports PDF de sécurité complets. Détectez les vulnérabilités et obtenez des suggestions de remédiation IA mappées aux exigences OWASP ASVS.',
      heroCta: 'Accéder au Dashboard',
      heroCtaSecondary: 'Voir le fonctionnement',
      stats: [
        { val: '4.0', label: 'Version ASVS' },
        { val: '286', label: 'Contrôles Mappés' },
        { val: '100%', label: 'Standard Ouvert' },
      ],
      reportRows: [
        { label: 'Vulnérabilité SQL Injection détectée', level: 'Critique', tone: 'critical' },
        { label: 'Dépendance obsolète : lodash', level: 'Élevé', tone: 'high' },
        { label: 'En-têtes de sécurité manquants', level: 'Moyen', tone: 'medium' },
        { label: 'Aucun secret hardcodé détecté', level: 'OK', tone: 'pass' },
      ],
      howKicker: 'Comment ça marche',
      howTitle: 'Scan multi-couches de sécurité',
      howSub: 'Le scanner analyse plusieurs dimensions pour couvrir les risques prioritaires.',
      howCards: [
        { icon: '</>', title: 'Analyse Statique', desc: 'Détection des failles dans le code source avant la mise en production.' },
        { icon: 'Pkg', title: 'Scan Dépendances', desc: 'Identification des packages obsolètes et vulnérables.' },
        { icon: 'Cfg', title: 'Revue Configuration', desc: 'Vérification des mauvaises configurations de sécurité.' },
        { icon: 'Key', title: 'Détection Secrets', desc: 'Recherche des clés API et credentials exposés dans le code.' },
      ],
      projectKicker: 'Inspiré du projet',
      projectTitle: 'Workflow sécurité orienté ASVS',
      projectCards: [
        { title: 'Mapping ASVS', desc: 'Chaque résultat est rattaché à un contrôle ASVS pour le suivi de conformité et les rapports d\'audit.' },
        { title: 'Copilote IA', desc: 'Génération de correctifs pratiques et snippets de code sécurisé selon le contexte de vulnérabilité.' },
        { title: 'Backend + MCP', desc: 'Exécution des scans repository et centralisation via backend compatible MCP.' },
      ],
      footerKicker: 'Commencer maintenant',
      footerTitle: 'Sécurisez vos applications avec un flow clair centré sur ASVS.',
      footerButton: 'Ouvrir le Dashboard',
      footerText: 'Un espace sécurité pour scanner, vérifier et améliorer votre code en continu.',
      footerCol1Title: 'Modules',
      footerCol1Items: ['Dashboard ASVS', 'Centre Sécurité', 'Chat IA', 'Scan Repository'],
      footerCol2Title: 'Couverture',
      footerCol2Items: ['Top risques OWASP', 'Hygiène dépendances', 'Exposition secrets', 'Checks hardening'],
      footerBottom: 'ASVSSecurity — toolkit compatible OWASP ASVS v4',
    },
  } as const;
}