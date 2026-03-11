import { Component } from '@angular/core';

@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  template: `
    <div class="spinner-wrap">
      <div class="spinner"></div>
      <span class="spinner-text">Loading...</span>
    </div>
  `,
  styles: [`
    .spinner-wrap { display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 2.5rem; gap: 1rem; }
    .spinner {
      width: 40px; height: 40px;
      border: 3px solid rgba(255,106,170,0.15);
      border-top-color: var(--accent-pink);
      border-radius: 50%;
      animation: spin 0.75s linear infinite;
    }
    .spinner-text { font-size: 0.8rem; color: var(--text-muted); font-family: 'Outfit', sans-serif; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class LoadingSpinnerComponent {}
