import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, PLATFORM_ID, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="login-root" [class.light]="isLight">

      <!-- Ambient background layers -->
      <div class="bg-layer bg-noise"></div>
      <div class="bg-layer bg-grid"></div>
      <div class="bg-orb orb-1"></div>
      <div class="bg-orb orb-2"></div>
      <div class="bg-orb orb-3"></div>

      <!-- Back link -->
      <a class="back-link" routerLink="/">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 2L4 7L9 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Back
      </a>

      <!-- Theme toggle -->
      <button class="theme-toggle" type="button" (click)="toggleTheme()" [attr.aria-label]="isLight ? 'Dark mode' : 'Light mode'">
        <span class="toggle-track" [class.on]="isLight">
          <span class="toggle-thumb">
            @if (isLight) {
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="4.5" stroke="currentColor" stroke-width="1.8"/>
                <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
            } @else {
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
            }
          </span>
        </span>
      </button>

      <!-- Main shell -->
      <div class="shell" [class.loaded]="true">

        <!-- LEFT — Brand column -->
        <div class="brand-col">
          <div class="brand-top">
            <div class="logo-mark">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L3 7V12C3 16.5 7 20.7 12 22C17 20.7 21 16.5 21 12V7L12 2Z" fill="url(#g1)"/>
                <path d="M9 12L11 14L15 10" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>
                <defs>
                  <linearGradient id="g1" x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
                    <stop stop-color="#f472b6"/>
                    <stop offset="1" stop-color="#c084fc"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span class="logo-text">ASVS<em>Security</em></span>
          </div>

          <div class="brand-mid">
            <div class="eyebrow">Application Security</div>
            <h1 class="headline">
              Your workspace.<br>
              <span class="headline-accent">Secured.</span>
            </h1>
            <p class="tagline">
              Scan repositories, surface vulnerabilities, and export OWASP-mapped reports — all in one place.
            </p>
          </div>

          <ul class="feature-list">
            <li>
              <span class="feat-icon">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.4"/>
                  <path d="M5 8L7.2 10.2L11 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
              </span>
              Repository vulnerability scanning
            </li>
            <li>
              <span class="feat-icon">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.4"/>
                  <path d="M5 8L7.2 10.2L11 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
              </span>
              Dependency &amp; secret detection
            </li>
            <li>
              <span class="feat-icon">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.4"/>
                  <path d="M5 8L7.2 10.2L11 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
              </span>
              ASVS-aligned remediation workflow
            </li>
          </ul>

          <div class="status-badge" [class.online]="backendChecked && isBackend" [class.offline]="backendChecked && !isBackend">
            <span class="status-dot"></span>
            @if (!backendChecked) {
              Checking backend…
            } @else if (isBackend) {
              JWT mode &mdash; Backend online
            } @else {
              Local mode &mdash; Backend unavailable
            }
          </div>
        </div>

        <!-- Vertical divider -->
        <div class="divider"></div>

        <!-- RIGHT — Form column -->
        <div class="form-col">
          <div class="form-header">
            <h2 class="form-title">Sign in</h2>
            <p class="form-sub">Enter your credentials to continue.</p>
          </div>

          <div class="form-body">

            <div class="field-group" [class.has-error]="!!errorMsg">
              <div class="field">
                <label for="username">Username</label>
                <div class="input-wrap">
                  <span class="input-icon">
                    <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                      <circle cx="10" cy="6.5" r="3.5" stroke="currentColor" stroke-width="1.5"/>
                      <path d="M3 17c0-3.3 3.1-6 7-6s7 2.7 7 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                  </span>
                  <input
                    id="username"
                    type="text"
                    [(ngModel)]="username"
                    placeholder="admin or utilisateur"
                    (keyup.enter)="doLogin()"
                    [disabled]="loading"
                    autocomplete="username"
                  >
                </div>
              </div>

              <div class="field">
                <label for="password">Password</label>
                <div class="input-wrap">
                  <span class="input-icon">
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                      <rect x="4" y="9" width="12" height="9" rx="2" stroke="currentColor" stroke-width="1.5"/>
                      <path d="M7 9V6.5a3 3 0 0 1 6 0V9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                  </span>
                  <input
                    id="password"
                    [type]="showPwd ? 'text' : 'password'"
                    [(ngModel)]="password"
                    placeholder="Enter your password"
                    (keyup.enter)="doLogin()"
                    [disabled]="loading"
                    autocomplete="current-password"
                  >
                  <button class="eye-btn" type="button" (click)="showPwd = !showPwd" aria-label="Toggle visibility">
                    @if (showPwd) {
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                        <path d="M3 3L21 21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                        <path d="M10.7 10.7A2 2 0 0 0 13.3 13.3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                        <path d="M9.9 5.2A9.6 9.6 0 0 1 12 5c5 0 8.3 3.8 9.4 5.2a1.5 1.5 0 0 1 0 1.6a16.4 16.4 0 0 1-3.4 3.9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                        <path d="M6.1 6.1A16.1 16.1 0 0 0 2.6 10.2a1.5 1.5 0 0 0 0 1.6C3.7 13.2 7 17 12 17c1.2 0 2.3-.2 3.3-.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                      </svg>
                    } @else {
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                        <path d="M2.6 10.2C3.7 8.8 7 5 12 5s8.3 3.8 9.4 5.2a1.5 1.5 0 0 1 0 1.6C20.3 15.2 17 19 12 19s-8.3-3.8-9.4-5.2a1.5 1.5 0 0 1 0-1.6Z" stroke="currentColor" stroke-width="1.8"/>
                        <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/>
                      </svg>
                    }
                  </button>
                </div>
              </div>

              @if (errorMsg) {
                <div class="error-bar">
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="8.5" stroke="currentColor" stroke-width="1.4"/>
                    <path d="M10 6v4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                    <circle cx="10" cy="13.5" r="0.9" fill="currentColor"/>
                  </svg>
                  {{ errorMsg }}
                </div>
              }
            </div>

            <button
              class="submit-btn"
              type="button"
              (click)="doLogin()"
              [disabled]="loading || !username || !password"
            >
              <span class="btn-label">
                @if (loading) {
                  <span class="spinner"></span>
                  Authenticating…
                } @else {
                  Continue to Dashboard
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                }
              </span>
              <span class="btn-shine"></span>
            </button>
          </div>

          <!-- Demo accounts -->
          <div class="demo-block">
            <div class="demo-label">
              <span class="demo-line"></span>
              <span>Quick access</span>
              <span class="demo-line"></span>
            </div>
            <div class="demo-cards">
              <button class="demo-card" type="button" (click)="fillDemo('admin', 'admin123')">
                <span class="demo-pill admin">Admin</span>
                <span class="demo-cred">admin / admin123</span>
              </button>
              <button class="demo-card" type="button" (click)="fillDemo('utilisateur', 'user123')">
                <span class="demo-pill user">User</span>
                <span class="demo-cred">utilisateur / user123</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  `,
  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600&display=swap');

    /* ─── Reset & Tokens ─────────────────────────────────── */
    :host {
      --pink:       #f472b6;
      --pink-light: #fbb6da;
      --sky:        #7dd3fc;
      --mauve:      #c084fc;
      --accent-glow: rgba(196,132,252,0.18);
      --surface:    #080a10;
      --surface-2:  #0e1018;
      --surface-3:  #131623;
      --border:     rgba(196,132,252,0.13);
      --border-hi:  rgba(196,132,252,0.42);
      --text-1:     #f0eeff;
      --text-2:     #8e8aaa;
      --text-3:     #4a4760;
      --error:      #e07070;
      --error-bg:   rgba(200,70,70,0.1);
      --radius:     18px;
      --ff-serif:   'Cormorant Garamond', Georgia, serif;
      --ff-sans:    'DM Sans', sans-serif;
      --ff-mono:    'DM Mono', monospace;
    }

    /* ─── Root ────────────────────────────────────────────── */
    .login-root {
      font-family: var(--ff-sans);
      min-height: 100vh;
      background: var(--surface);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: clamp(1rem, 3vw, 2.5rem);
      position: relative;
      overflow: hidden;
      color: var(--text-1);
    }

    /* ─── Background layers ───────────────────────────────── */
    .bg-layer {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    .bg-noise {
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");
      background-size: 200px 200px;
      opacity: 0.6;
      mix-blend-mode: overlay;
    }
    .bg-grid {
      background-image:
        linear-gradient(rgba(196,132,252,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(125,211,252,0.03) 1px, transparent 1px);
      background-size: 48px 48px;
      mask-image: radial-gradient(ellipse 70% 70% at 50% 50%, black 40%, transparent 100%);
    }
    .bg-orb {
      position: absolute;
      border-radius: 50%;
      pointer-events: none;
      filter: blur(80px);
    }
    .orb-1 {
      width: 560px; height: 560px;
      top: -200px; left: -180px;
      background: radial-gradient(circle, rgba(244,114,182,0.12), transparent 70%);
    }
    .orb-2 {
      width: 420px; height: 420px;
      bottom: -160px; right: -120px;
      background: radial-gradient(circle, rgba(125,211,252,0.11), transparent 70%);
    }
    .orb-3 {
      width: 340px; height: 340px;
      top: 50%; right: 22%;
      transform: translateY(-50%);
      background: radial-gradient(circle, rgba(196,132,252,0.1), transparent 70%);
    }

    /* ─── Back link ──────────────────────────────────────── */
    .back-link {
      position: absolute;
      top: 1.4rem;
      left: 1.6rem;
      display: inline-flex;
      align-items: center;
      gap: 0.38rem;
      text-decoration: none;
      color: var(--text-3);
      font-size: 0.78rem;
      font-weight: 500;
      letter-spacing: 0.02em;
      transition: color 0.2s;
      z-index: 10;
    }
    .back-link:hover { color: var(--pink); }

    /* ─── Shell ──────────────────────────────────────────── */
    .shell {
      position: relative;
      z-index: 2;
      width: min(1020px, 100%);
      min-height: 580px;
      display: grid;
      grid-template-columns: 1.15fr 1px 0.85fr;
      border-radius: var(--radius);
      border: 1px solid var(--border);
      background: var(--surface-2);
      box-shadow:
        0 0 0 1px rgba(196,132,252,0.07),
        0 40px 100px rgba(0,0,0,0.65),
        inset 0 1px 0 rgba(196,132,252,0.1);
      overflow: hidden;
      opacity: 0;
      transform: translateY(16px);
      animation: shellIn 0.7s cubic-bezier(0.22,1,0.36,1) 0.1s forwards;
    }
    @keyframes shellIn {
      to { opacity: 1; transform: translateY(0); }
    }

    /* ─── Divider ─────────────────────────────────────────── */
    .divider {
      background: linear-gradient(
        to bottom,
        transparent,
        var(--border) 20%,
        var(--border-hi) 50%,
        var(--border) 80%,
        transparent
      );
      width: 1px;
    }

    /* ─── Brand column ───────────────────────────────────── */
    .brand-col {
      padding: clamp(1.8rem, 3vw, 3rem);
      display: flex;
      flex-direction: column;
      gap: 2rem;
      background: linear-gradient(145deg, rgba(244,114,182,0.05), rgba(125,211,252,0.03) 60%);
      position: relative;
    }
    .brand-col::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--pink-light), var(--sky), transparent);
      opacity: 0.3;
    }

    /* Logo */
    .brand-top {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .logo-mark {
      width: 42px; height: 42px;
      border-radius: 11px;
      border: 1px solid var(--border-hi);
      background: var(--surface-3);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(196,132,252,0.2);
      flex-shrink: 0;
    }
    .logo-text {
      font-family: var(--ff-sans);
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--text-2);
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .logo-text em {
      font-style: normal;
      color: var(--pink-light);
    }

    /* Headline */
    .brand-mid { display: flex; flex-direction: column; gap: 1rem; }
    .eyebrow {
      font-size: 0.7rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--sky);
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .eyebrow::before {
      content: '';
      display: block;
      width: 24px; height: 1px;
      background: var(--sky);
      opacity: 0.6;
    }
    .headline {
      margin: 0;
      font-family: var(--ff-serif);
      font-size: clamp(2.4rem, 3.8vw, 3.6rem);
      font-weight: 600;
      line-height: 1.08;
      letter-spacing: -0.01em;
      color: var(--text-1);
    }
    .headline-accent {
      background: linear-gradient(120deg, var(--pink), var(--mauve), var(--sky));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .tagline {
      margin: 0;
      font-size: 0.9rem;
      line-height: 1.72;
      color: var(--text-2);
      max-width: 42ch;
    }

    /* Feature list */
    .feature-list {
      list-style: none;
      margin: 0; padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.72rem;
    }
    .feature-list li {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      font-size: 0.86rem;
      color: var(--text-2);
    }
    .feat-icon {
      color: var(--mauve);
      display: flex;
      flex-shrink: 0;
    }

    /* Status */
    .status-badge {
      margin-top: auto;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.55rem 0.9rem;
      border-radius: 99px;
      border: 1px solid var(--border);
      background: var(--surface-3);
      font-size: 0.75rem;
      color: var(--text-3);
      width: fit-content;
    }
    .status-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: var(--text-3);
      flex-shrink: 0;
    }
    .status-badge.online .status-dot {
      background: #67e8f9;
      box-shadow: 0 0 6px rgba(103,232,249,0.7);
    }
    .status-badge.online { color: #67e8f9; border-color: rgba(103,232,249,0.25); }
    .status-badge.offline .status-dot { background: var(--pink); }
    .status-badge.offline { color: var(--pink); border-color: rgba(244,114,182,0.28); }

    /* ─── Form column ────────────────────────────────────── */
    .form-col {
      padding: clamp(1.8rem, 3vw, 3rem);
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 1.8rem;
      background: var(--surface-3);
      position: relative;
    }

    /* Form header */
    .form-title {
      margin: 0;
      font-family: var(--ff-serif);
      font-size: clamp(2rem, 3.2vw, 2.8rem);
      font-weight: 600;
      letter-spacing: -0.015em;
      color: var(--text-1);
      line-height: 1.1;
    }
    .form-sub {
      margin: 0.5rem 0 0;
      font-size: 0.86rem;
      color: var(--text-2);
      line-height: 1.55;
    }

    /* Fields */
    .form-body { display: flex; flex-direction: column; gap: 1.2rem; }
    .field-group { display: flex; flex-direction: column; gap: 0.85rem; }
    .field { display: flex; flex-direction: column; gap: 0.42rem; }
    .field label {
      font-size: 0.73rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--text-2);
    }
    .input-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }
    .input-icon {
      position: absolute;
      left: 0.9rem;
      color: var(--text-3);
      display: flex;
      pointer-events: none;
      transition: color 0.2s;
    }
    .input-wrap:focus-within .input-icon { color: var(--mauve); }

    .input-wrap input {
      width: 100%;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 12px;
      color: var(--text-1);
      font-family: var(--ff-sans);
      font-size: 0.88rem;
      padding: 0.82rem 0.92rem 0.82rem 2.6rem;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
      box-sizing: border-box;
    }
    .input-wrap input::placeholder { color: var(--text-3); }
    .input-wrap input:focus {
      border-color: var(--border-hi);
      box-shadow: 0 0 0 3px var(--accent-glow);
      background: rgba(8,10,16,0.9);
    }
    .input-wrap input:disabled { opacity: 0.5; cursor: not-allowed; }

    .eye-btn {
      position: absolute;
      right: 0.7rem;
      width: 2rem; height: 2rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface-3);
      color: var(--text-3);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      transition: color 0.2s, border-color 0.2s;
    }
    .eye-btn:hover { color: var(--mauve); border-color: var(--border-hi); }

    /* Error */
    .has-error .input-wrap input {
      border-color: rgba(224,112,112,0.45) !important;
    }
    .error-bar {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: var(--error-bg);
      border: 1px solid rgba(224,112,112,0.3);
      border-radius: 10px;
      padding: 0.6rem 0.8rem;
      font-size: 0.8rem;
      color: var(--error);
      line-height: 1.4;
      animation: errIn 0.25s ease;
    }
    @keyframes errIn {
      from { opacity: 0; transform: translateY(-4px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* Submit button */
    .submit-btn {
      position: relative;
      width: 100%;
      border: 1px solid rgba(244,114,182,0.5);
      border-radius: 12px;
      padding: 0.88rem 1.2rem;
      background: linear-gradient(135deg, #d946a8 0%, #c084fc 50%, #818cf8 100%);
      color: #fff;
      font-family: var(--ff-sans);
      font-size: 0.88rem;
      font-weight: 700;
      cursor: pointer;
      overflow: hidden;
      transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
      box-shadow: 0 6px 24px rgba(196,132,252,0.3), inset 0 1px 0 rgba(255,255,255,0.18);
    }
    .submit-btn:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 12px 32px rgba(196,132,252,0.42);
    }
    .submit-btn:active:not(:disabled) { transform: translateY(0); }
    .submit-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      box-shadow: none;
      background: linear-gradient(135deg, #7a3a6e, #6b4a9e);
    }
    .btn-label {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.45rem;
    }
    .btn-shine {
      position: absolute;
      inset: 0;
      background: linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.18) 50%, transparent 70%);
      transform: translateX(-100%);
      transition: transform 0.6s ease;
    }
    .submit-btn:hover .btn-shine { transform: translateX(100%); }

    .spinner {
      width: 14px; height: 14px;
      border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      animation: spin 0.75s linear infinite;
      flex-shrink: 0;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ─── Demo accounts ─────────────────────────────────── */
    .demo-block { display: flex; flex-direction: column; gap: 0.85rem; }
    .demo-label {
      display: flex;
      align-items: center;
      gap: 0.7rem;
      font-size: 0.7rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--text-3);
      font-weight: 600;
    }
    .demo-line {
      flex: 1;
      height: 1px;
      background: var(--border);
    }
    .demo-cards {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.65rem;
    }
    .demo-card {
      border: 1px solid var(--border);
      border-radius: 11px;
      background: var(--surface-2);
      padding: 0.75rem 0.85rem;
      text-align: left;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      font-family: var(--ff-sans);
      transition: border-color 0.2s, transform 0.2s, background 0.2s;
    }
    .demo-card:hover {
      border-color: var(--border-hi);
      transform: translateY(-1px);
      background: rgba(196,132,252,0.05);
    }
    .demo-pill {
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      padding: 0.18rem 0.55rem;
      border-radius: 99px;
      width: fit-content;
    }
    .demo-pill.admin {
      background: rgba(244,114,182,0.15);
      color: var(--pink-light);
      border: 1px solid rgba(244,114,182,0.3);
    }
    .demo-pill.user {
      background: rgba(125,211,252,0.12);
      color: var(--sky);
      border: 1px solid rgba(125,211,252,0.28);
    }
    .demo-cred {
      font-family: var(--ff-mono);
      font-size: 0.72rem;
      color: var(--text-3);
    }

    /* ─── Theme toggle ──────────────────────────────────── */
    .theme-toggle {
      position: absolute;
      top: 1.3rem;
      right: 1.6rem;
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
      z-index: 10;
    }
    .toggle-track {
      display: flex;
      align-items: center;
      width: 52px;
      height: 28px;
      border-radius: 99px;
      border: 1px solid var(--border);
      background: var(--surface-3);
      padding: 3px;
      transition: background 0.3s, border-color 0.3s, box-shadow 0.3s;
      box-shadow: inset 0 1px 3px rgba(0,0,0,0.3);
    }
    .toggle-track.on {
      background: linear-gradient(135deg, rgba(244,114,182,0.25), rgba(196,132,252,0.25));
      border-color: var(--border-hi);
      box-shadow: 0 0 10px rgba(196,132,252,0.2);
    }
    .toggle-thumb {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: var(--surface-2);
      border: 1px solid var(--border-hi);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--mauve);
      transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), background 0.3s, color 0.3s;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      transform: translateX(0);
    }
    .toggle-track.on .toggle-thumb {
      transform: translateX(24px);
      background: #fff;
      color: var(--pink);
      border-color: rgba(244,114,182,0.4);
    }

    /* ─── Light mode overrides ───────────────────────────── */
    .login-root.light {
      --surface:    #f4f0ff;
      --surface-2:  #faf8ff;
      --surface-3:  #ede8ff;
      --border:     rgba(156,90,210,0.18);
      --border-hi:  rgba(196,132,252,0.55);
      --text-1:     #1a1230;
      --text-2:     #6b5a8a;
      --text-3:     #a895c4;
      --accent-glow: rgba(196,132,252,0.14);
    }
    .login-root.light .bg-orb.orb-1 {
      background: radial-gradient(circle, rgba(244,114,182,0.18), transparent 70%);
    }
    .login-root.light .bg-orb.orb-2 {
      background: radial-gradient(circle, rgba(125,211,252,0.2), transparent 70%);
    }
    .login-root.light .bg-orb.orb-3 {
      background: radial-gradient(circle, rgba(196,132,252,0.14), transparent 70%);
    }
    .login-root.light .shell {
      box-shadow: 0 20px 60px rgba(100,60,180,0.15), 0 0 0 1px rgba(196,132,252,0.12);
    }
    .login-root.light .brand-col {
      background: linear-gradient(145deg, rgba(244,114,182,0.07), rgba(196,132,252,0.05) 60%);
    }
    .login-root.light .form-col {
      background: var(--surface-2);
    }
    .login-root.light .input-wrap input {
      background: #fff;
      color: var(--text-1);
    }
    .login-root.light .input-wrap input::placeholder { color: var(--text-3); }
    .login-root.light .demo-card {
      background: #fff;
    }
    .login-root.light .toggle-track {
      background: var(--surface-3);
    }

    /* ─── Responsive ─────────────────────────────────────── */
    @media (max-width: 860px) {
      .shell {
        grid-template-columns: 1fr;
      }
      .divider {
        display: none;
      }
      .brand-col {
        border-bottom: 1px solid var(--border);
        gap: 1.4rem;
      }
      .status-badge { margin-top: 0; }
    }
    @media (max-width: 480px) {
      .login-root { padding: 0.5rem; }
      .brand-col, .form-col { padding: 1.4rem; }
      .demo-cards { grid-template-columns: 1fr; }
    }
  `]
})
export class LoginComponent {
  username = '';
  password = '';
  loading = false;
  errorMsg = '';
  showPwd = false;
  isBackend = false;
  backendChecked = false;
  isLight = false;
  private isBrowser: boolean;

  constructor(
    private auth: AuthService,
    private router: Router,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.checkBackend();
  }

  private async checkBackend() {
    this.isBackend = await this.auth.refreshBackendAvailability();
    this.backendChecked = true;
  }

  toggleTheme() {
    this.isLight = !this.isLight;
  }

  fillDemo(user: string, pwd: string) {
    this.username = user;
    this.password = pwd;
    this.errorMsg = '';
  }

  async doLogin() {
    if (!this.username || !this.password || this.loading) return;
    this.loading = true;
    this.errorMsg = '';
    const result = await this.auth.login(this.username, this.password);
    this.loading = false;
    if (result.success) {
      this.router.navigate(['/dashboard']);
    } else {
      this.errorMsg = result.message;
    }
  }
}