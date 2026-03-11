import { Component, OnInit, OnDestroy, ChangeDetectorRef, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AiDrawerService } from '../../services/ai-drawer.service';
import { AiService } from '../../services/ai.service';

@Component({
  selector: 'app-ai-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Overlay -->
    @if (isOpen) {
      <div class="drawer-overlay" (click)="close()"></div>
    }

    <!-- Drawer panel -->
    <div class="ai-drawer" [class.drawer-open]="isOpen">
      <!-- Header -->
      <div class="drawer-header">
        <div class="drawer-title">
          <div class="drawer-icon">✦</div>
          <div>
            <div class="drawer-name">Analyse Gemini IA</div>
            <div class="drawer-model">gemini-2.5-flash</div>
          </div>
        </div>
        <button class="drawer-close" (click)="close()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <!-- Req info -->
      @if (reqInfo) {
        <div class="drawer-req-info">
          <span class="req-id-badge">{{ reqInfo.requirementId }}</span>
          <span class="req-category">{{ reqInfo.context }}</span>
        </div>
        <div class="drawer-req-text">{{ reqInfo.requirement }}</div>
      }

      <!-- Divider -->
      <div class="drawer-divider"></div>

      <!-- Content -->
      <div class="drawer-body">
        @if (loading) {
          <div class="drawer-loading">
            <div class="loading-dots">
              <span></span><span></span><span></span>
            </div>
            <p>Gemini IA analyse la requête...</p>
          </div>
        }

        @if (!loading && response) {
          <div class="drawer-response">
            @for (seg of parseResponse(response); track $index) {
              @if (seg.type === 'text') {
                <div class="resp-text" [innerHTML]="formatText(seg.content)"></div>
              }
              @if (seg.type === 'code') {
                <div class="resp-code-block">
                  <div class="resp-code-header">
                    <span class="resp-code-lang">{{ seg.language }}</span>
                    <button class="resp-copy-btn" (click)="copyCode(seg.content, $index)" [class.copied]="copiedIdx === $index">
                      @if (copiedIdx === $index) {
                        ✓ Copié
                      } @else {
                        📋 Copier
                      }
                    </button>
                  </div>
                  <pre class="resp-code"><code>{{ seg.content }}</code></pre>
                </div>
              }
            }
            <div class="resp-footer">
              <button class="drawer-copy-msg-btn" (click)="copyFullMessage(response)" [class.copied]="copiedFull">
                @if (copiedFull) {
                  ✓ Copié
                } @else {
                  📋 Copier la réponse
                }
              </button>
            </div>
          </div>
        }

        @if (!loading && !response) {
          <div class="drawer-empty">
            <div class="empty-icon">✦</div>
            <p>L'analyse apparaîtra ici</p>
          </div>
        }
      </div>

      <!-- Footer: free chat input -->
      <div class="drawer-footer">
        <div class="drawer-input-wrap">
          <input
            type="text"
            [(ngModel)]="followUpText"
            placeholder="Question de suivi..."
            (keyup.enter)="askFollowUp()"
            [disabled]="loading"
            class="drawer-input"
          >
          <button class="drawer-send" (click)="askFollowUp()" [disabled]="loading || !followUpText.trim()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .drawer-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.4);
      z-index: 998;
      animation: fadeIn 0.2s ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    .ai-drawer {
      position: fixed;
      top: 0; right: 0; bottom: 0;
      width: 480px;
      max-width: 95vw;
      background: var(--bg-secondary);
      border-left: 1.5px solid var(--bg-card-border);
      z-index: 999;
      display: flex;
      flex-direction: column;
      transform: translateX(100%);
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: -8px 0 40px rgba(0,0,0,0.3);
    }
    .ai-drawer.drawer-open {
      transform: translateX(0);
    }

    /* Header */
    .drawer-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1.25rem 1.5rem;
      border-bottom: 1.5px solid var(--bg-card-border);
      flex-shrink: 0;
    }
    .drawer-title { display: flex; align-items: center; gap: 0.85rem; }
    .drawer-icon {
      width: 40px; height: 40px; border-radius: 12px;
      background: linear-gradient(135deg, rgba(255,61,135,0.15), rgba(196,77,255,0.15));
      border: 1.5px solid rgba(255,106,170,0.3);
      display: flex; align-items: center; justify-content: center;
      font-size: 1.1rem; color: var(--accent-rose);
      animation: float 4s ease-in-out infinite;
    }
    @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
    .drawer-name { font-size: 0.95rem; font-weight: 700; color: var(--text-primary); }
    .drawer-model {
      font-size: 0.7rem; color: var(--accent-purple);
      font-family: 'JetBrains Mono', monospace;
      background: rgba(196,77,255,0.1); border-radius: 4px;
      padding: 1px 6px; display: inline-block; margin-top: 2px;
    }
    .drawer-close {
      width: 32px; height: 32px; border-radius: 8px;
      background: var(--bg-card); border: 1.5px solid var(--bg-card-border);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; color: var(--text-muted); transition: all 0.2s;
    }
    .drawer-close:hover { color: #ff6b6b; border-color: rgba(255,82,82,0.3); }

    /* Req info */
    .drawer-req-info {
      display: flex; align-items: center; gap: 0.6rem;
      padding: 1rem 1.5rem 0.5rem;
      flex-shrink: 0;
    }
    .req-id-badge {
      padding: 0.25rem 0.65rem; border-radius: 6px;
      background: rgba(255,61,135,0.12); color: var(--accent-rose);
      font-size: 0.78rem; font-weight: 700;
      font-family: 'JetBrains Mono', monospace;
    }
    .req-category { font-size: 0.78rem; color: var(--text-muted); }
    .drawer-req-text {
      padding: 0 1.5rem 1rem;
      font-size: 0.82rem; color: var(--text-secondary);
      line-height: 1.5; flex-shrink: 0;
    }
    .drawer-divider {
      height: 1px; background: var(--bg-card-border);
      margin: 0; flex-shrink: 0;
    }

    /* Body */
    .drawer-body {
      flex: 1; overflow-y: auto; padding: 1.25rem 1.5rem;
    }
    .drawer-body::-webkit-scrollbar { width: 4px; }
    .drawer-body::-webkit-scrollbar-track { background: transparent; }
    .drawer-body::-webkit-scrollbar-thumb { background: var(--bg-card-border); border-radius: 4px; }

    /* Loading */
    .drawer-loading {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; padding: 3rem 1rem; gap: 1rem;
    }
    .loading-dots { display: flex; gap: 6px; }
    .loading-dots span {
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--accent-rose);
      animation: bounce 1.2s infinite ease-in-out;
    }
    .loading-dots span:nth-child(1) { animation-delay: 0s; }
    .loading-dots span:nth-child(2) { animation-delay: 0.2s; }
    .loading-dots span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes bounce { 0%,80%,100%{transform:scale(0.6);opacity:0.5} 40%{transform:scale(1);opacity:1} }
    .drawer-loading p { font-size: 0.85rem; color: var(--text-muted); margin: 0; }

    /* Empty */
    .drawer-empty {
      display: flex; flex-direction: column; align-items: center;
      padding: 3rem 1rem; gap: 0.75rem; color: var(--text-muted);
    }
    .empty-icon { font-size: 2rem; opacity: 0.3; }
    .drawer-empty p { font-size: 0.85rem; margin: 0; }

    /* Response */
    .drawer-response { font-size: 0.875rem; color: var(--text-secondary); line-height: 1.7; }
    .resp-text { margin-bottom: 0.75rem; }
    .resp-text :global(strong) { color: var(--text-primary); font-weight: 700; }
    .resp-text :global(h1), .resp-text :global(h2), .resp-text :global(h3) {
      color: var(--text-primary); font-weight: 700; margin: 1rem 0 0.5rem;
    }
    .resp-text :global(h3) { font-size: 0.9rem; }
    .resp-text :global(code) {
      background: var(--bg-card); padding: 1px 5px;
      border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 0.8rem;
      color: var(--accent-rose);
    }
    .resp-text :global(ul) { padding-left: 1.2rem; margin: 0.4rem 0; }
    .resp-text :global(li) { margin-bottom: 0.25rem; }

    /* Code blocks */
    .resp-footer {
      display: flex; justify-content: flex-end; margin-top: 1rem;
    }
    .drawer-copy-msg-btn {
      display: inline-flex; align-items: center; gap: 0.35rem;
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
      padding: 4px 10px; border-radius: 6px;
      font-size: 0.72rem; font-family: 'Outfit', sans-serif; font-weight: 600;
      color: var(--text-muted); cursor: pointer; transition: all 0.2s ease;
    }
    .drawer-copy-msg-btn:hover {
      background: rgba(255,106,170,0.12);
      border-color: rgba(255,106,170,0.3);
      color: var(--accent-pink);
    }
    .drawer-copy-msg-btn.copied {
      background: rgba(77,255,180,0.08);
      border-color: rgba(77,255,180,0.4);
      color: var(--accent-green);
    }

    .resp-code-block {
      background: #0d0d0d; border: 1.5px solid rgba(255,255,255,0.07);
      border-radius: 10px; margin: 0.75rem 0; overflow: hidden;
    }
    .resp-code-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.5rem 0.85rem;
      background: rgba(255,255,255,0.04);
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .resp-code-lang {
      font-size: 0.7rem; font-family: 'JetBrains Mono', monospace;
      color: var(--accent-purple); font-weight: 600; text-transform: uppercase;
    }
    .resp-copy-btn {
      font-size: 0.72rem; padding: 0.2rem 0.6rem; border-radius: 5px;
      background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
      color: var(--text-muted); cursor: pointer; transition: all 0.2s; font-family: inherit;
    }
    .resp-copy-btn:hover { background: rgba(255,106,170,0.12); color: var(--accent-pink); }
    .resp-copy-btn.copied { color: var(--accent-green); border-color: rgba(0,196,154,0.3); }
    .resp-code {
      padding: 0.9rem 1rem; margin: 0; overflow-x: auto;
      font-family: 'JetBrains Mono', monospace; font-size: 0.78rem;
      line-height: 1.6; color: #e2e8f0;
      white-space: pre-wrap; word-break: break-word;
    }

    /* Footer */
    .drawer-footer {
      padding: 1rem 1.5rem;
      border-top: 1.5px solid var(--bg-card-border);
      flex-shrink: 0;
    }
    .drawer-input-wrap {
      display: flex; align-items: center; gap: 0.5rem;
      background: var(--bg-card); border: 1.5px solid var(--bg-card-border);
      border-radius: 10px; padding: 0.4rem 0.5rem 0.4rem 0.85rem;
      transition: border-color 0.2s;
    }
    .drawer-input-wrap:focus-within { border-color: rgba(255,106,170,0.4); }
    .drawer-input {
      flex: 1; background: none; border: none; outline: none;
      color: var(--text-primary); font-size: 0.85rem; font-family: inherit;
      padding: 0.25rem 0;
    }
    .drawer-input::placeholder { color: var(--text-muted); }
    .drawer-input:disabled { opacity: 0.5; }
    .drawer-send {
      width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0;
      background: linear-gradient(135deg, var(--accent-rose), var(--accent-purple));
      border: none; color: white; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.2s;
    }
    .drawer-send:hover:not(:disabled) { opacity: 0.85; }
    .drawer-send:disabled { opacity: 0.4; cursor: not-allowed; }

    @media (max-width: 600px) {
      .ai-drawer { width: 100vw; }
    }
  `]
})
export class AiDrawerComponent implements OnInit, OnDestroy {
  isOpen = false;
  loading = false;
  response = '';
  reqInfo: { requirementId: string; requirement: string; context: string } | null = null;
  followUpText = '';
  copiedIdx: number | null = null;
  copiedFull = false;
  private followUpHistory: { role: string; text: string }[] = [];
  private isBrowser: boolean;
  private subs: Subscription[] = [];

  constructor(
    private drawerService: AiDrawerService,
    private aiService: AiService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit() {
    this.subs.push(
      this.drawerService.isOpen$.subscribe(open => {
        this.isOpen = open;
        if (open) this.loadAnalysis();
        this.cdr.detectChanges();
      })
    );
    this.subs.push(
      this.drawerService.request.subscribe(req => {
        this.reqInfo = req;
        this.response = '';
        this.followUpText = '';
        this.followUpHistory = [];
      })
    );
  }

  ngOnDestroy() { this.subs.forEach(s => s.unsubscribe()); }

  async loadAnalysis() {
    const req = this.drawerService.getRequest();
    if (!req) return;
    this.loading = true;
    this.response = '';
    this.cdr.detectChanges();
    const result = await this.aiService.getExplanation({
      requirementId: req.requirementId,
      requirement: req.requirement,
      context: req.context
    });
    this.response = result;
    const seedQuestion = `Analyse ASVS ${req.requirementId} (${req.context}): ${req.requirement}`;
    this.followUpHistory = [{ role: 'user', text: seedQuestion }, { role: 'model', text: result }];
    this.loading = false;
    this.cdr.detectChanges();
  }

  async askFollowUp() {
    const text = this.followUpText.trim();
    if (!text || this.loading) return;
    this.followUpText = '';
    this.loading = true;
    this.cdr.detectChanges();
    const req = this.drawerService.getRequest();
    const contextualQuestion = req
      ? `Question utilisateur (prioritaire): ${text}
Contexte ASVS (utiliser seulement si pertinent): ${req.requirementId} (${req.context}) - ${req.requirement}
Instruction: reponds d'abord a la question utilisateur, sans melanger avec d'autres sujets.`
      : text;
    const result = await this.aiService.chat(contextualQuestion, this.followUpHistory, { fastMode: false });
    this.followUpHistory.push({ role: 'user', text: contextualQuestion });
    this.followUpHistory.push({ role: 'model', text: result });
    if (this.followUpHistory.length > 30) this.followUpHistory = this.followUpHistory.slice(-30);
    this.response = result;
    this.loading = false;
    this.cdr.detectChanges();
  }

  close() { this.drawerService.close(); }

  parseResponse(text: string): { type: 'text' | 'code'; content: string; language?: string }[] {
    const segments: { type: 'text' | 'code'; content: string; language?: string }[] = [];
    const regex = /```(\w+)?\n?([\s\S]*?)```/g;
    let lastIndex = 0, match;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
      segments.push({ type: 'code', language: match[1] || 'code', content: match[2].trim() });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) segments.push({ type: 'text', content: text.slice(lastIndex) });
    return segments;
  }

  formatText(text: string): string {
    const safe = this.escapeHtml(text);
    return safe
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
      .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
      .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
      .replace(/^- (.*?)$/gm, '<li>$1</li>')
      .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  async copyCode(code: string, idx: number) {
    if (!this.isBrowser) return;
    try { await navigator.clipboard.writeText(code); } catch { /* ignore */ }
    this.copiedIdx = idx;
    setTimeout(() => { this.copiedIdx = null; this.cdr.detectChanges(); }, 2000);
    this.cdr.detectChanges();
  }

  async copyFullMessage(text: string) {
    if (!this.isBrowser) return;
    try { await navigator.clipboard.writeText(text); } catch {
      const el = document.createElement('textarea');
      el.value = text; document.body.appendChild(el); el.select();
      document.execCommand('copy'); document.body.removeChild(el);
    }
    this.copiedFull = true;
    setTimeout(() => { this.copiedFull = false; this.cdr.detectChanges(); }, 2000);
    this.cdr.detectChanges();
  }
}
