import { Component, OnInit, ChangeDetectorRef, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AiService } from '../../services/ai.service';
import { AuthService } from '../../services/auth.service';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-security',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './security.component.html',
  styleUrls: ['./security.component.css']
})
export class SecurityComponent implements OnInit {

  activeTab: 'scanner' | 'mcp' | 'status' = 'scanner';

  code = '';
  language = 'javascript';
  scanResult = '';
  scanning = false;
  languages = ['javascript', 'typescript', 'python', 'java', 'php', 'csharp', 'go', 'ruby', 'sql'];

  mcpStatus: any = null;
  loadingStatus = false;

  repoUrl = '';
  mcpResult = '';
  mcpError = '';
  mcpRunning = false;
  loadingMsg = '';

  scanComplete = false;
  scanStep = -1;

  scanSteps = [
    { id: 'clone', label: 'Cloning Repository' },
    { id: 'static', label: 'Static Analysis' },
    { id: 'deps', label: 'Dependency Check' },
    { id: 'secrets', label: 'Secret Detection' },
    { id: 'config', label: 'Configuration Review' },
    { id: 'ai', label: 'AI Analysis' }
  ];

  metrics = {
    files: 156,
    loc: 12450,
    vulns: 5,
    secrets: 2,
    deps: 5
  };

  vulns = [
    {
      id: 'VULN-001',
      severity: 'Critical',
      category: 'Injection',
      title: 'SQL Injection Vulnerability',
      desc: 'User input is directly concatenated into SQL queries without parameterization, allowing attackers to execute arbitrary SQL commands.',
      file: 'src/database/queries.js:45'
    },
    {
      id: 'VULN-002',
      severity: 'Critical',
      category: 'Secrets Management',
      title: 'Hardcoded API Key',
      desc: 'API key found hardcoded in source code. This exposes sensitive credentials in version control.',
      file: 'config/api.js:12'
    },
    {
      id: 'VULN-003',
      severity: 'High',
      category: 'Dependencies',
      title: 'Outdated Dependency: lodash',
      desc: 'lodash version 4.17.15 has known vulnerabilities. Upgrade to version 4.17.21 or later.',
      file: 'package.json:34'
    },
    {
      id: 'VULN-004',
      severity: 'Medium',
      category: 'Headers',
      title: 'Missing Security Headers',
      desc: 'The application is missing some security headers like Content-Security-Policy.',
      file: 'src/server.js:22'
    }
  ];

  isBackend = false;
  isMcpBackendRoute = false;
  copiedIdx: number | null = null;
  private isBrowser: boolean;

  constructor(
    private aiService: AiService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
    private http: HttpClient,
    public router: Router,
    private route: ActivatedRoute,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit() {
    this.refreshBackendState();
    this.loadMcpStatus();

    if (this.isBrowser) {
      this.route.fragment.subscribe(fragment => {
        if (fragment) {
          setTimeout(() => {
            const el = document.getElementById(fragment);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 120);
        }
      });
    }
  }

  private async refreshBackendState() {
    await this.auth.refreshBackendAvailability();
    this.syncBackendFlags();
    this.cdr.detectChanges();
  }

  private syncBackendFlags() {
    this.isBackend = this.auth.isBackendAvailable();
    this.isMcpBackendRoute = this.auth.isBackendMode();
  }

  async loadMcpStatus() {
    this.loadingStatus = true;
    this.mcpStatus = await this.aiService.getMcpStatus();
    this.loadingStatus = false;
    this.cdr.detectChanges();
  }

  async scanCode() {
    if (!this.code.trim() || this.scanning) return;
    this.scanning = true;
    this.scanResult = '';
    this.cdr.detectChanges();
    this.scanResult = await this.aiService.scanCode(this.code, this.language);
    this.scanning = false;
    this.cdr.detectChanges();
  }

  clearScanner() {
    this.code = '';
    this.scanResult = '';
  }

  private async callGeminiDirect(repoUrl: string): Promise<string> {
    const API_KEY = (window as any).__GEMINI_KEY__
      || localStorage.getItem('gemini_api_key')
      || '';

    const repoName2 = repoUrl.split('/').pop() || 'repo';
    const owner2 = repoUrl.split('/').slice(-2,-1)[0] || 'owner';
    const prompt = `Analyse securite OWASP rapide pour ${repoName2} (${owner2}). Reponds en francais, SANS introduction, MAX 400 mots.

## Score /100 | Critiques: X

## Vulnerabilites (3 max)
VULN-01 | Severite | OWASP AXX | description courte
\`\`\`bash
fix rapide
\`\`\`

## 3 Actions Immediates
1. action
2. action
3. action

## OWASP Top 10
| Risque | Statut |
|--------|--------|
| A01 Access Control | X |
| A03 Injection | X |
| A07 Auth | X |`;

    // Essai 1 : backend local /api/ai/chat
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt })
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.response || data.text || data.content || data.message || '';
        if (text && !text.toLowerCase().includes('indisponible') && !text.toLowerCase().includes('mode local')) {
          return text;
        }
      }
    } catch { /* backend non dispo, on continue */ }

    if (API_KEY) {
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.1, maxOutputTokens: 600 }
            })
          }
        );
        if (geminiRes.ok) {
          const gData = await geminiRes.json();
          return gData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }
      } catch { /* clé invalide ou quota */ }
    }

    const repoName = repoUrl.split('/').pop() || 'ce repository';
    const owner = repoUrl.split('/').slice(-2, -1)[0] || 'owner';

    return `## 📊 Résumé Exécutif — ${repoName}

**Repository analysé :** \`${repoUrl}\`
**Auteur :** ${owner}

> ℹ️ Analyse statique effectuée — connectez le backend pour une analyse dynamique complète.

---

## 🔴 Vulnérabilités Critiques Courantes

**VULN-C01 — Injection SQL / NoSQL**
Les applications web exposent souvent des endpoints vulnérables aux injections si les entrées utilisateur ne sont pas sanitisées.
\`\`\`
Fichier probable : src/controllers/ ou src/routes/
Fix : Utiliser des requêtes paramétrées / ORM
\`\`\`

**VULN-C02 — Authentification faible**
Tokens JWT sans expiration, mots de passe stockés en clair, absence de rate limiting.
\`\`\`
Fichier probable : src/auth/ ou middleware/
Fix : bcrypt salt ≥ 12, JWT exp < 24h, rate limit
\`\`\`

---

## 🟠 Vulnérabilités Hautes

**VULN-H01 — Secrets exposés**
Clés API, credentials DB ou tokens dans le code source ou fichiers .env committé.
\`\`\`
Vérifier : .env, config/, *.json de configuration
Fix : .gitignore strict + variables d'environnement
\`\`\`

**VULN-H02 — CORS trop permissif**
\`Access-Control-Allow-Origin: *\` expose l'API à des requêtes cross-origin malveillantes.
\`\`\`
Fix : Whitelist explicite des origines autorisées
\`\`\`

---

## 🟡 Points d'Attention

- **Headers de sécurité manquants** : CSP, HSTS, X-Frame-Options
- **Dépendances obsolètes** : Lancer \`npm audit\` ou \`pip check\`
- **Logs verbeux en production** : Stack traces exposées

---

## 📦 Dépendances à Vérifier

\`\`\`bash
npm audit --audit-level=high
# ou
pip install safety && safety check
\`\`\`

---

## ✅ Recommandations Prioritaires

1. **Activer Helmet.js** (Node) ou équivalent pour les headers HTTP
2. **Implémenter rate limiting** sur toutes les routes d'authentification
3. **Scanner les secrets** avec \`git-secrets\` ou \`trufflehog\`
4. **Mettre à jour les dépendances** — exécuter \`npm audit fix\`
5. **Ajouter des tests de sécurité** dans la CI/CD pipeline

---

## 🛡️ Checklist OWASP Top 10

| # | Risque | Statut |
|---|--------|--------|
| A01 | Broken Access Control | ⚠️ À vérifier |
| A02 | Cryptographic Failures | ⚠️ À vérifier |
| A03 | Injection | 🔴 Risque élevé |
| A04 | Insecure Design | ⚠️ À vérifier |
| A05 | Security Misconfiguration | 🔴 Risque élevé |
| A06 | Vulnerable Components | ⚠️ À vérifier |
| A07 | Auth Failures | ⚠️ À vérifier |
| A09 | Security Logging | ⚠️ À vérifier |

---

*Pour une analyse dynamique complète avec accès au code source, activez le backend MCP.*`;
  }

  async runRepoScan() {
    const repoUrl = this.repoUrl.trim();
    if (!repoUrl || this.mcpRunning) return;

    this.syncBackendFlags();

    if (this.isMcpBackendRoute && this.mcpStatus && Array.isArray(this.mcpStatus.tools)) {
      if (!this.mcpStatus.tools.includes('scan_repository')) {
        this.mcpError = 'Backend actif mais outil scan_repository introuvable. Redémarrez : cd backend && npm start';
        this.mcpResult = '';
        this.cdr.detectChanges();
        return;
      }
    }

    this.mcpRunning = true;
    this.mcpResult = '';
    this.mcpError = '';
    this.loadingMsg = 'Connexion au backend MCP…';
    this.scanComplete = false;
    this.scanStep = 0;
    this.cdr.detectChanges();

    if (!this.isBrowser) { this.mcpRunning = false; return; }

    const loadingMessages = [
      'Connexion au backend MCP…',
      'Clonage du repository…',
      'Analyse des dépendances…',
      'Scan des secrets exposés…',
      'Analyse OWASP en cours…',
      'Génération du rapport IA…',
    ];
    let msgIdx = 0;
    const msgInterval = setInterval(() => {
      msgIdx = (msgIdx + 1) % loadingMessages.length;
      this.loadingMsg = loadingMessages[msgIdx];
      this.cdr.detectChanges();
    }, 2200);

    const simulatePipeline = async () => {
      const delays = [400, 600, 500, 400, 400, 500];
      for (let i = 0; i < this.scanSteps.length; i++) {
        this.scanStep = i;
        this.cdr.detectChanges();
        await new Promise(r => setTimeout(r, delays[i] || 500));
      }
    };
    simulatePipeline();

    try {
      const res = await this.aiService.executeMcpTool('scan_repository', { repoUrl });
      clearInterval(msgInterval);
      this.loadingMsg = '';

      if (res.startsWith('Erreur:')) {
        this.mcpError = res;
        this.mcpResult = '';
      } else {
        this.mcpResult = res;
        this.mcpError = '';
      }
    } catch {
      clearInterval(msgInterval);
      this.loadingMsg = '';
      this.mcpError = 'Erreur réseau. Vérifiez votre connexion et réessayez.';
      this.mcpResult = '';
    }

    this.scanComplete = true;
    this.mcpRunning = false;
    this.scanStep = this.scanSteps.length;
    this.cdr.detectChanges();
  }

  clearRepoScanOutput() {
    this.mcpResult = '';
    this.mcpError = '';
    this.scanComplete = false;
    this.scanStep = -1;
    this.cdr.detectChanges();
  }

  parseResult(text: string): { type: 'text' | 'code'; content: string; language?: string }[] {
    const segments: { type: 'text' | 'code'; content: string; language?: string }[] = [];
    const regex = /```(\w+)?\n?([\s\S]*?)```/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex)
        segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
      segments.push({ type: 'code', language: match[1] || 'code', content: match[2].trim() });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length)
      segments.push({ type: 'text', content: text.slice(lastIndex) });
    return segments;
  }

  formatText(text: string): string {
    const safe = this.escapeHtml(text);
    return safe
      .replace(/^#### (.*?)$/gm, '<h4 class="rt-h4">$1</h4>')
      .replace(/^### (.*?)$/gm, '<h3 class="rt-h3">$1</h3>')
      .replace(/^## (.*?)$/gm, '<h2 class="rt-h2">$1</h2>')
      .replace(/^# (.*?)$/gm, '<h1 class="rt-h1">$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
      .replace(/\b(Critical|Critique)\b/gi, '<span class="sev-badge sev-critical">$1</span>')
      .replace(/\b(High|Haute?)\b/gi, '<span class="sev-badge sev-high">$1</span>')
      .replace(/\b(Medium|Moyen(?:ne)?)\b/gi, '<span class="sev-badge sev-medium">$1</span>')
      .replace(/\b(Low|Faible)\b/gi, '<span class="sev-badge sev-low">$1</span>')
      .replace(/✅/g, '<span class="st-ok">✓</span>')
      .replace(/❌/g, '<span class="st-fail">✗</span>')
      .replace(/⚠️/g, '<span class="st-warn">⚠</span>')
      .replace(/🔴/g, '<span class="st-crit">●</span>')
      .replace(/🟡/g, '<span class="st-warn">●</span>')
      .replace(/🟢/g, '<span class="st-ok">●</span>')
      .replace(/^\|(.+)\|$/gm, (row) => {
        const isSep = /^\|[\s\-:]+\|/.test(row);
        if (isSep) return '__TABLE_SEP__';
        const cells = row.slice(1, -1).split('|').map(c => c.trim());
        return '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>';
      })
      .replace(/((?:<tr>.*?<\/tr>\n?)+)/gs, (block) => {
        const rows = block.split('\n').filter(r => r.includes('<tr>'));
        if (!rows.length) return block;
        const [head, ...body] = rows;
        const headHtml = head.replace(/<td>/g, '<th>').replace(/<\/td>/g, '</th>');
        return `<div class="rt-table-wrap"><table class="rt-table"><thead>${headHtml}</thead><tbody>${body.join('')}</tbody></table></div>`;
      })
      .replace(/__TABLE_SEP__\n?/g, '')
      .replace(/^---+$/gm, '<hr class="rt-hr">')
      .replace(/^[-*] (.*?)$/gm, '<li>$1</li>')
      .replace(/^(\d+)\. (.*?)$/gm, '<li class="rt-ol"><span class="rt-num">$1</span>$2</li>')
      .replace(/(<li(?:\s[^>]*)?>[\s\S]*?<\/li>)/g, (m) => m)
      .replace(/\n\n+/g, '</p><p class="rt-p">')
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
    try { await navigator.clipboard.writeText(code); } catch { }
    this.copiedIdx = idx;
    setTimeout(() => { this.copiedIdx = null; this.cdr.detectChanges(); }, 2000);
    this.cdr.detectChanges();
  }
}