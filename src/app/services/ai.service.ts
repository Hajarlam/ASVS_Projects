import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { GoogleGenAI } from '@google/genai';
import { AiRequest } from '../models/asvs.models';
import { AuthService } from './auth.service';

const BACKEND_URL = 'http://localhost:3000';

// ─── API KEY ROTATION ─────────────────────────────────────────────────────────
// Ajoutez autant de clés que vous voulez — rotation automatique sur quota épuisé
const GEMINI_API_KEYS: string[] = [
  'AIzaSyAlJ-fNr8-xkbuvBk2_yZluaPXAy-L7s9I', // clé 1
  //'AIzaSyC0f2e7YMptuneLK5s7r1qdnSYNcBmrS0Y', // clé 2
  //'AIzaSyBfaC3SOww2qrXXTLh3fMAcyZIjntHxkIc', // clé 3 — décommentez pour en ajouter
];
// ─────────────────────────────────────────────────────────────────────────────

export interface McpToolParameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface McpToolDescriptor {
  name: string;
  description: string;
  parameters: McpToolParameter[];
  exampleArgs: Record<string, any>;
}

export interface ChatOptions {
  fastMode?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AiService {
  private isBrowser: boolean;
  private readonly modelCandidates = ['gemini-2.0-flash', 'gemini-2.5-flash'];

  // Un client GoogleGenAI par clé — rotation automatique sur quota
  private readonly aiClients: GoogleGenAI[] = GEMINI_API_KEYS.map(key => new GoogleGenAI({ apiKey: key }));
  private currentKeyIndex = 0;

  constructor(@Inject(PLATFORM_ID) platformId: Object, private auth: AuthService) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  // Retourne le client actif
  private get ai(): GoogleGenAI {
    return this.aiClients[this.currentKeyIndex];
  }

  private extractErrorMessage(error: any): string {
    const raw = typeof error?.message === 'string'
      ? error.message
      : (typeof error === 'string' ? error : JSON.stringify(error || {}));
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.error?.message && typeof parsed.error.message === 'string') return parsed.error.message;
    } catch { }
    return raw;
  }

  private extractRetrySeconds(text: string): number | null {
    if (!text) return null;
    const m1 = text.match(/retry in\s+([\d.]+)s/i);
    if (m1?.[1]) return Math.max(1, Math.ceil(Number(m1[1])));
    const m2 = text.match(/"retryDelay":"(\d+)s"/i);
    if (m2?.[1]) return Math.max(1, Number(m2[1]));
    return null;
  }

  private isQuotaError(error: any): boolean {
    const msg = this.extractErrorMessage(error).toLowerCase();
    return msg.includes('resource_exhausted')
      || msg.includes('quota exceeded')
      || msg.includes('rate limit')
      || msg.includes('"code":429')
      || msg.includes(' 429 ');
  }

  private isDailyQuotaError(error: any): boolean {
    const msg = this.extractErrorMessage(error).toLowerCase();
    return msg.includes('perday')
      || msg.includes('per day')
      || msg.includes('requestsperday')
      || msg.includes('requests per day');
  }

  private shouldTryNextModel(error: any): boolean {
    const msg = this.extractErrorMessage(error).toLowerCase();
    return this.isQuotaError(error)
      || msg.includes('not found')
      || msg.includes('unsupported model')
      || msg.includes('invalid argument')
      || msg.includes('permission denied');
  }

  private formatAiError(error: any): string {
    const message = this.extractErrorMessage(error);
    if (this.isQuotaError(error)) {
      if (this.isDailyQuotaError(error)) {
        return 'Erreur quota Gemini: limite journaliere atteinte sur toutes les cles. Ajoutez une nouvelle API key ou reessayez demain.';
      }
      const retry = this.extractRetrySeconds(message);
      if (retry) return `Erreur quota Gemini: reessayez dans ${retry}s.`;
      return 'Erreur quota Gemini: limite atteinte sur toutes les cles. Reessayez plus tard.';
    }
    return `Erreur IA: ${message || 'Veuillez reessayer.'}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Génère du contenu avec rotation automatique clé × modèle.
   * Ordre: clé1/modèle1 → clé1/modèle2 → clé2/modèle1 → clé2/modèle2 → ...
   */
  private async generateWithFallback(
    buildRequest: (model: string) => { model: string; contents: string; config?: { temperature?: number; maxOutputTokens?: number } }
  ): Promise<any> {
    let lastError: any = null;
    let lastQuotaError: any = null;
    const startKeyIndex = this.currentKeyIndex;

    for (let keyAttempt = 0; keyAttempt < this.aiClients.length; keyAttempt++) {
      const keyIndex = (startKeyIndex + keyAttempt) % this.aiClients.length;
      const client = this.aiClients[keyIndex];

      for (const model of this.modelCandidates) {
        try {
          const request = buildRequest(model);
          const result = await client.models.generateContent(request);
          this.currentKeyIndex = keyIndex; // mémorise la clé qui a marché
          return result;
        } catch (e: any) {
          lastError = e;
          if (this.isQuotaError(e)) {
            lastQuotaError = e;
            continue; // quota → essaie le modèle/clé suivant
          }
          if (!this.shouldTryNextModel(e)) throw e;
        }
      }

      if (keyAttempt < this.aiClients.length - 1) {
        console.warn(`Clé Gemini #${keyIndex + 1} épuisée → rotation vers clé #${keyIndex + 2}`);
      }
    }

    // Dernier recours : attente courte + 1 retry si quota temporaire (pas journalier)
    if (lastQuotaError && !this.isDailyQuotaError(lastQuotaError)) {
      const retry = this.extractRetrySeconds(this.extractErrorMessage(lastQuotaError));
      if (retry && retry <= 20) {
        await this.sleep(retry * 1000);
        try {
          const req = buildRequest(this.modelCandidates[0]);
          return await this.aiClients[startKeyIndex].models.generateContent(req);
        } catch (e: any) {
          lastError = e;
        }
      }
    }

    throw lastQuotaError || lastError || new Error('Aucun modele Gemini disponible (toutes les cles epuisees).');
  }

  private getText(response: any): string {
    try {
      if (typeof response?.text === 'string' && response.text.trim()) return response.text.trim();
      if (typeof response?.text === 'function') {
        const text = response.text();
        if (typeof text === 'string' && text.trim()) return text.trim();
      }
      const parts = response?.candidates?.[0]?.content?.parts;
      if (Array.isArray(parts)) {
        const text = parts.map((p: any) => p?.text || '').join('').trim();
        if (text) return text;
      }
    } catch (e) { console.error('getText error:', e); }
    return '';
  }

  private isUsableResult(text: unknown): text is string {
    if (typeof text !== 'string') return false;
    const normalized = text.trim();
    if (!normalized) return false;
    const canonical = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return !/aucune\s+reponse\s+recue|no\s+response\s+received/.test(canonical);
  }

  private looksLikeQuotaText(text: string): boolean {
    const t = (text || '').toLowerCase();
    return t.includes('quota gemini')
      || t.includes('quota exceeded')
      || t.includes('resource_exhausted')
      || t.includes('rate limit')
      || t.includes('limite journaliere')
      || t.includes('quota gemini atteint');
  }

  private normalizeText(text: string): string {
    return (text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  private stripHtmlError(raw: string): string {
    const input = String(raw || '');
    const pre = input.match(/<pre>([\s\S]*?)<\/pre>/i);
    if (pre?.[1]) return pre[1].replace(/\s+/g, ' ').trim();
    return input.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private isRouteMissingError(status: number, message: string, path: string): boolean {
    const err = String(message || '').toLowerCase();
    const route = String(path || '').toLowerCase();
    return status === 404
      || err.includes(`cannot post ${route}`)
      || err.includes(`cannot get ${route}`);
  }

  private isUnknownToolError(message: string, tool: string): boolean {
    const normalized = this.normalizeText(message || '');
    const toolName = this.normalizeText(tool || '');
    return (
      normalized.includes('outil mcp inconnu')
      || normalized.includes('unknown mcp tool')
      || normalized.includes('unknown tool')
    ) && (!toolName || normalized.includes(toolName));
  }

  private hasCodeBlock(text: string): boolean {
    return /```[\s\S]*?```/.test(text || '');
  }

  private closeOpenCodeFence(text: string): string {
    const t = (text || '').trim();
    if (!t) return '';
    const fences = (t.match(/```/g) || []).length;
    if (fences % 2 === 1) return `${t}\n\`\`\``;
    return t;
  }

  private looksTruncatedAnswer(text: string): boolean {
    const t = (text || '').trim();
    if (!t) return true;
    if ((t.match(/```/g) || []).length % 2 === 1) return true;
    if (/[,:;\-\/]\s*$/.test(t.slice(-120))) return true;
    if (/(?:\b(et|ou|mais|donc|car|de|du|des|la|le|les|dans|avec|pour|par|sur|a|au|aux|to|and|or|but|because|with|for|in)\s*)$/i.test(t.slice(-160))) return true;
    const last = t.slice(-1);
    return !/[.!?`}>}\])]/.test(last) && t.length > 80;
  }

  private mergeContinuation(base: string, continuation: string): string {
    const a = (base || '').trim();
    const b = (continuation || '').trim();
    if (!a) return b;
    if (!b) return a;
    if (a.endsWith(b)) return a;
    return `${a}\n${b}`.trim();
  }

  private buildGuaranteedCodeSection(context: string): string {
    const fallback = this.buildLocalChatFallback(context || 'security', true);
    const m = fallback.match(/```(\w+)?\n([\s\S]*?)```/);
    if (m?.[2]) {
      const lang = m[1] || 'typescript';
      return `## Exemple de code a copier\n\`\`\`${lang}\n${m[2].trim()}\n\`\`\``;
    }
    return [
      '## Exemple de code a copier',
      '```typescript',
      "import { z } from 'zod';",
      'const schema = z.object({ email: z.string().email(), password: z.string().min(12) });',
      "app.post('/api/login', (req, res) => {",
      '  const parsed = schema.safeParse(req.body);',
      "  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });",
      '  return res.json({ ok: true });',
      '});',
      '```'
    ].join('\n');
  }

  private isHardErrorResponse(text: string): boolean {
    const t = (text || '').trim().toLowerCase();
    return t.startsWith('erreur:') || t.startsWith('error:') || t.startsWith('quota gemini') || t.startsWith('reponse bloquee');
  }

  private async ensureCompleteWithCode(draft: string, context: string): Promise<string> {
    let output = this.closeOpenCodeFence(draft || '');
    if (!output || this.isHardErrorResponse(output)) return output;

    if (this.looksTruncatedAnswer(output)) {
      try {
        const continuationResp = await this.generateWithFallback(model => ({
          model,
          contents: `Complete STRICTEMENT la reponse suivante sans repetition.\nContexte: ${context.slice(0, 700)}\n\nReponse actuelle:\n${output.slice(-2600)}\n\nRegles:\n- Continue a partir de la derniere idee.\n- Termine toutes les phrases.\n- Ferme les blocs markdown de code ouverts.\n- Pas de salutation.`,
          config: { temperature: 0.2, maxOutputTokens: 1800 }
        }));
        const continuation = this.getText(continuationResp);
        if (this.isUsableResult(continuation) && !this.looksLikeQuotaText(continuation)) {
          output = this.closeOpenCodeFence(this.mergeContinuation(output, continuation));
        }
      } catch { }
    }

    if (!this.hasCodeBlock(output)) {
      output = `${output}\n\n${this.buildGuaranteedCodeSection(context)}`.trim();
    }

    return this.closeOpenCodeFence(output);
  }

  private buildLocalChatFallback(message: string, fastMode: boolean): string {
    const q = this.normalizeText(message);

    if (q.includes('jwt') || q.includes('token')) {
      return [
        'JWT securise - approche detaillee:',
        '### Etapes',
        '1. Access token court (5-15 min) + refresh token avec rotation.',
        '2. Signature RS256/ES256, cle privee hors code source.',
        '3. Claims minimum: sub, iat, exp, jti, iss, aud.',
        '4. Verification stricte signature/exp/iss/aud cote serveur.',
        '5. Stockage recommande: cookie HttpOnly + Secure + SameSite=Strict.',
        '6. Revocation et blacklist jti pour logout et incidents.',
        '',
        '### Exemple TypeScript (Node/Express)',
        '```typescript',
        "import jwt from 'jsonwebtoken';",
        "const access = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET!, { expiresIn: '15m', issuer: 'asvs-app' });",
        "const refresh = jwt.sign({ sub: user.id, jti: crypto.randomUUID() }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '7d' });",
        '```'
      ].join('\n');
    }

    if (q.includes('sql') || q.includes('injection')) {
      return [
        'Prevention SQL Injection:',
        '### Exemple vulnerable',
        '```javascript',
        "const query = \"SELECT * FROM users WHERE email = '\" + email + \"'\";",
        '```',
        '### Exemple corrige',
        '```javascript',
        "const rows = await db.execute('SELECT * FROM users WHERE email = ?', [email]);",
        '```'
      ].join('\n');
    }

    if (/(mot[s]?\s+de\s+passe|password|hachage|hash|bcrypt|argon)/.test(q)) {
      return [
        'Bonnes pratiques mots de passe:',
        '```typescript',
        "import bcrypt from 'bcryptjs';",
        'const hash = await bcrypt.hash(password, 12);',
        'const ok = await bcrypt.compare(passwordAttempt, hash);',
        '```'
      ].join('\n');
    }

    if (fastMode) {
      return [
        'Plan securite rapide:',
        '```typescript',
        'app.use(helmet());',
        "app.use(rateLimit({ windowMs: 60_000, max: 100 }));",
        "app.post('/api/resource', requireAuth, validate(schema), handler);",
        '```'
      ].join('\n');
    }

    return [
      'Reponse detaillee (mode local):',
      '```typescript',
      "import helmet from 'helmet';",
      "import rateLimit from 'express-rate-limit';",
      'app.use(helmet());',
      "app.use(rateLimit({ windowMs: 60_000, max: 100 }));",
      "app.post('/api/login', validate(loginSchema), async (req, res) => res.json({ ok: true }));",
      '```'
    ].join('\n');
  }

  private buildLocalExplanationFallback(req: AiRequest): string {
    const topic = `${req.requirementId || ''} ${req.context || ''} ${req.requirement || ''}`.trim();
    const guidance = this.buildLocalChatFallback(topic, false);
    return `## Explication\n${guidance}\n\n## Implementation\n- Appliquez les controles au niveau serveur.\n- Ajoutez des tests de securite automatiques sur les cas negatifs.\n\n## Comment tester\n- Testez les entrees legitimes et malicieuses.\n- Verifiez logs, statut HTTP et absence de fuite de details techniques.`;
  }

  private buildLocalScanFallback(code: string, language: string): string {
    return [
      `Analyse locale de secours (${language}):`,
      '1. Cherchez la concatenation de donnees utilisateur dans les requetes SQL.',
      '2. Verifiez validation/normalisation des entrees et taille max.',
      '3. Controlez authz par role sur chaque route sensible.',
      '4. Cachez les details techniques dans les erreurs.',
      '5. Ajoutez tests negatifs (payloads malicieux) dans CI.',
      '',
      'Snippet recu:',
      '```' + language,
      code.slice(0, 600),
      '```'
    ].join('\n');
  }

  private buildLocalSecurityInfoFallback(query: string): string {
    return [
      `Resume securite (${query}):`,
      '- Description: faiblesse exploitable si les entrees et controles ne sont pas stricts.',
      '- Impact: fuite de donnees, escalation de privilege, indisponibilite.',
      '- Prevention: validation stricte, principe de moindre privilege, journalisation utile.',
      '- Verification: tests d intrusion sur les cas limites et malicieux.'
    ].join('\n');
  }

  // ─── LOCAL REPOSITORY SCAN via GitHub API + Gemini ───────────────────────────
  private async scanRepositoryLocal(repoUrl: string, branch: string = ''): Promise<string> {
    const repoUrl2 = (repoUrl || '').trim();
    if (!repoUrl2) return 'Erreur: URL du repository manquante.';

    const match = repoUrl2.match(/github\.com[/:]([^/]+)\/([^/.]+?)(?:\.git)?(?:[/?#].*)?$/i);
    if (!match) return `Erreur: URL GitHub non reconnue (${repoUrl2}). Format attendu: https://github.com/owner/repo`;

    const owner = match[1];
    const repo = match[2];

    let resolvedBranch = branch.trim();
    if (!resolvedBranch) {
      try {
        const metaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
        resolvedBranch = metaRes.ok ? ((await metaRes.json())?.default_branch || 'main') : 'main';
      } catch { resolvedBranch = 'main'; }
    }

    let fileTree: string[] = [];
    try {
      const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${resolvedBranch}?recursive=1`);
      if (treeRes.ok) {
        const treeData = await treeRes.json();
        fileTree = (treeData?.tree || []).filter((f: any) => f.type === 'blob').map((f: any) => f.path as string);
      }
    } catch { }

    if (fileTree.length === 0) {
      return `Erreur: impossible de lire l'arborescence du repository ${owner}/${repo} (branche: ${resolvedBranch}). Verifiez que le repo est public.`;
    }

    const priorityFiles = ['package.json', 'requirements.txt', 'pom.xml', 'build.gradle', 'go.mod', 'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml', '.env.example', '.env.sample', '.gitignore', 'nginx.conf', '.htaccess', 'web.config'];

    const scoreFile = (path: string): number => {
      const lower = path.toLowerCase();
      if (priorityFiles.some(p => lower.endsWith(p.toLowerCase()) || lower === p.toLowerCase())) return 100;
      if (lower.includes('security') || lower.includes('crypto') || lower.includes('hash') || lower.includes('encrypt')) return 95;
      if (lower.includes('auth') || lower.includes('login') || lower.includes('jwt') || lower.includes('token')) return 90;
      if (lower.includes('middleware') || lower.includes('guard') || lower.includes('interceptor')) return 85;
      if (lower.includes('user') || lower.includes('account') || lower.includes('password')) return 80;
      if (lower.includes('api') || lower.includes('route') || lower.includes('controller')) return 75;
      if (lower.includes('config') || lower.includes('setting') || lower.includes('env')) return 70;
      if (lower.includes('database') || lower.includes('db') || lower.includes('model') || lower.includes('schema')) return 65;
      if (lower.includes('test') || lower.includes('spec')) return 20;
      if (lower.includes('node_modules') || lower.includes('dist/') || lower.includes('build/') || lower.includes('.min.')) return 5;
      const ext = lower.split('.').pop() || '';
      if (['ts', 'js', 'py', 'java', 'go', 'rb', 'php', 'cs'].includes(ext)) return 50;
      return 10;
    };

    const securityExts = ['.ts', '.js', '.mjs', '.cjs', '.tsx', '.jsx', '.py', '.java', '.go', '.rb', '.php', '.cs', '.cpp', '.c', '.env.example', '.env.sample', '.gitignore', '.dockerignore'];

    const relevantFiles = fileTree
      .filter(p => {
        const lower = p.toLowerCase();
        if (lower.includes('node_modules/') || lower.includes('dist/') || lower.includes('.min.js')) return false;
        return securityExts.some(ext => lower.endsWith(ext)) || scoreFile(p) >= 60;
      })
      .sort((a, b) => scoreFile(b) - scoreFile(a))
      .slice(0, 30);

    const fetchedFiles: { path: string; content: string }[] = [];
    await Promise.allSettled(
      relevantFiles.slice(0, 15).map(async (filePath) => {
        try {
          const res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${resolvedBranch}/${filePath}`);
          if (res.ok) fetchedFiles.push({ path: filePath, content: (await res.text()).slice(0, 800) });
        } catch { }
      })
    );

    const prompt = `Tu es un expert en securite OWASP ASVS. Analyse ce repository GitHub pour identifier toutes les vulnerabilites de securite. Reponds en francais avec une analyse complete et actionnable.

## Repository: ${owner}/${repo} (branche: ${resolvedBranch})
## Arborescence (${fileTree.length} fichiers):
\`\`\`
${fileTree.slice(0, 200).join('\n')}
\`\`\`

## Fichiers cles:
${fetchedFiles.map(f => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n')}

## Format OBLIGATOIRE:
## Resume Executif [Score /10 + 3 phrases]
## Vulnerabilites Critiques [CWE, severite, fichier, impact, correction]
## Analyse des Dependances [CVE detectes]
## Configuration et Infrastructure [Docker, nginx, env...]
## Code Corrige [Blocs prets a copier]
## Plan d'Action Prioritaire [Top 5 actions]`;

    try {
      const r = await this.generateWithFallback(model => ({
        model,
        contents: prompt,
        config: { temperature: 0.15, maxOutputTokens: 4000 }
      }));
      const text = this.getText(r);
      if (!this.isUsableResult(text)) return this.buildRepositoryScanFallback(owner, repo, fileTree, fetchedFiles);
      return await this.ensureCompleteWithCode(text, `scan repository ${owner}/${repo}`);
    } catch (e: any) {
      if (this.isQuotaError(e)) return this.buildRepositoryScanFallback(owner, repo, fileTree, fetchedFiles);
      return this.formatAiError(e);
    }
  }

  private buildRepositoryScanFallback(owner: string, repo: string, fileTree: string[], fetchedFiles: { path: string; content: string }[]): string {
    const hasAuth = fileTree.some(f => /auth|login|jwt|token/i.test(f));
    const hasDocker = fileTree.some(f => /dockerfile|docker-compose/i.test(f));
    const hasDeps = fileTree.some(f => /package\.json|requirements\.txt|pom\.xml/i.test(f));
    return [
      `## Analyse de Securite: ${owner}/${repo}`,
      `**Fichiers analyses:** ${fileTree.length} detectes, ${fetchedFiles.length} examines.`,
      '',
      '## Points de vigilance',
      hasAuth ? '- ⚠️  Auth detectee: verifiez JWT, sessions, mots de passe.' : '',
      hasDocker ? '- ⚠️  Docker present: verifiez utilisateur non-root, secrets, ports.' : '',
      hasDeps ? '- ⚠️  Dependances detectees: auditez avec `npm audit` ou `pip-audit`.' : '',
      '',
      '## Checklist OWASP ASVS',
      '1. **Injection**: Requetes SQL parametrees uniquement.',
      '2. **Auth**: JWT RS256, refresh rotation, HttpOnly cookies.',
      '3. **Controle acces**: Chaque route verifiee cote serveur.',
      '4. **Secrets**: Pas de secrets en dur, .env dans .gitignore.',
      '5. **Logging**: Logs sans donnees sensibles.',
      '',
      '## Commandes audit',
      '```bash',
      'npm audit --audit-level=high',
      'git secrets --scan',
      'trivy fs . --severity HIGH,CRITICAL',
      '```'
    ].filter(Boolean).join('\n');
  }
  // ─────────────────────────────────────────────────────────────────────────────

  private buildMcpFallback(tool: string, args: Record<string, any>): string {
    if (tool === 'analyze_requirement') return this.buildLocalExplanationFallback({ requirementId: String(args?.['requirementId'] || 'N/A'), requirement: String(args?.['requirement'] || ''), context: String(args?.['context'] || '') });
    if (tool === 'scan_code') return this.buildLocalScanFallback(String(args?.['code'] || ''), String(args?.['language'] || 'javascript'));
    if (tool === 'chat') return this.buildLocalChatFallback(String(args?.['message'] || ''), !!args?.['fastMode']);
    if (tool === 'get_security_info') {
      const query = String(args?.['cwe'] ? `CWE-${args['cwe']}` : (args?.['topic'] || 'security-topic'));
      return this.buildLocalSecurityInfoFallback(query);
    }
    if (tool === 'scan_repository') return `Scan indisponible. Verifiez votre connexion.\nRepository: ${String(args?.['repoUrl'] || 'N/A')}`;
    return `Erreur: outil MCP inconnu (${tool}).`;
  }

  private async executeMcpToolLocal(tool: string, args: Record<string, any>): Promise<string> {
    if (tool === 'analyze_requirement') {
      const requirement = String(args?.['requirement'] || '').trim();
      if (!requirement) return 'Erreur: champ requirement requis.';
      return await this.getExplanation({ requirementId: String(args?.['requirementId'] || 'N/A'), requirement, context: String(args?.['context'] || '') });
    }
    if (tool === 'scan_code') {
      const code = String(args?.['code'] || '').trim();
      if (!code) return 'Erreur: champ code requis.';
      return await this.scanCode(code, String(args?.['language'] || 'javascript'));
    }
    if (tool === 'chat') {
      const message = String(args?.['message'] || '').trim();
      if (!message) return 'Erreur: champ message requis.';
      const history = Array.isArray(args?.['history'])
        ? args['history'].filter((h: any) => typeof h?.role === 'string' && typeof h?.text === 'string').map((h: any) => ({ role: h.role, text: h.text }))
        : [];
      return await this.chat(message, history, { fastMode: !!args?.['fastMode'] });
    }
    if (tool === 'get_security_info') {
      const cwe = String(args?.['cwe'] || '').trim();
      const topic = String(args?.['topic'] || '').trim();
      const query = cwe ? `CWE-${cwe}` : topic;
      if (!query) return 'Erreur: champ cwe ou topic requis.';
      const r = await this.generateWithFallback(model => ({
        model,
        contents: `Donne un resume de securite tres clair sur ${query} en francais: description, impact, prevention, avec un exemple de code securise obligatoire dans un bloc markdown.`,
        config: { temperature: 0.2, maxOutputTokens: 4000 }
      }));
      return this.getText(r) || this.buildLocalSecurityInfoFallback(query);
    }
    if (tool === 'scan_repository') {
      const repoUrl = String(args?.['repoUrl'] || '').trim();
      if (!repoUrl) return 'Erreur: champ repoUrl requis.';
      return await this.scanRepositoryLocal(repoUrl, String(args?.['branch'] || ''));
    }
    return `Erreur: outil MCP inconnu (${tool}).`;
  }

  private async executeMcpToolBackendLegacy(tool: string, args: Record<string, any>): Promise<string | null> {
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.auth.getToken()}` };

    const call = async (path: string, body: Record<string, any>): Promise<string | null> => {
      const res = await fetch(`${BACKEND_URL}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
      const raw = await res.text();
      let data: any = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { }
      if (!res.ok) {
        const err = this.stripHtmlError(typeof data?.error === 'string' ? data.error : (raw || `HTTP ${res.status}`)) || `HTTP ${res.status}`;
        if (this.isRouteMissingError(res.status, err, path)) return null;
        if (this.isUnknownToolError(err, tool)) return null;
        return `Erreur: MCP backend (${err}).`;
      }
      const result = typeof data?.result === 'string' ? data.result : '';
      if (!this.isUsableResult(result) || this.looksLikeQuotaText(result)) return this.buildMcpFallback(tool, body);
      return result;
    };

    if (tool === 'analyze_requirement') return await call('/api/mcp/analyze', { requirementId: String(args?.['requirementId'] || 'N/A'), requirement: String(args?.['requirement'] || ''), context: String(args?.['context'] || ''), code: String(args?.['code'] || '') });
    if (tool === 'scan_code') return await call('/api/mcp/scan-code', { code: String(args?.['code'] || ''), language: String(args?.['language'] || 'javascript'), requirementId: String(args?.['requirementId'] || '') });
    if (tool === 'chat') {
      const history = Array.isArray(args?.['history']) ? args['history'].filter((h: any) => typeof h?.role === 'string' && typeof h?.text === 'string').map((h: any) => ({ role: h.role, text: h.text })) : [];
      return await call('/api/mcp/chat', { message: String(args?.['message'] || ''), history, fastMode: !!args?.['fastMode'] });
    }
    if (tool === 'get_security_info') {
      const query = String(args?.['cwe'] ? `CWE-${args['cwe']}` : (args?.['topic'] || '')).trim();
      if (!query) return 'Erreur: champ cwe ou topic requis.';
      return this.buildLocalSecurityInfoFallback(query);
    }
    if (tool === 'scan_repository') {
      const repoUrl = String(args?.['repoUrl'] || '').trim();
      if (!repoUrl) return 'Erreur: champ repoUrl requis.';
      return await call('/api/mcp/scan-repository', { repoUrl });
    }
    return null;
  }

  async getExplanation(requirement: AiRequest): Promise<string> {
    if (this.auth.isBackendMode() && this.isBrowser) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/mcp/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.auth.getToken()}` },
          body: JSON.stringify({ requirementId: requirement.requirementId, requirement: requirement.requirement, context: requirement.context })
        });
        const raw = await res.text();
        let d: any = {};
        try { d = raw ? JSON.parse(raw) : {}; } catch { }
        if (res.ok && this.isUsableResult(d?.result)) {
          return await this.ensureCompleteWithCode(d.result, `ASVS ${requirement.requirementId} ${requirement.context || ''}: ${requirement.requirement}`);
        } else {
          const errText = typeof d?.error === 'string' ? d.error : raw;
          if (this.looksLikeQuotaText(errText || '')) return this.buildLocalExplanationFallback(requirement);
        }
      } catch { }
    }
    return this.explainDirect(requirement);
  }

  private async explainDirect(req: AiRequest): Promise<string> {
    try {
      const r = await this.generateWithFallback(model => ({
        model,
        contents: `Tu es expert en cybersecurite OWASP ASVS. Fournis une reponse detaillee, riche en explications, et tres actionnable en francais.\n\nContexte:\n- Requirement ID: ${req.requirementId}\n- Domaine: ${req.context || 'general'}\n- Exigence: ${req.requirement}\n\nContraintes ABSOLUES:\n- Commence directement par le contenu utile (pas de salutation).\n- Reponse complete: ne laisse aucune phrase inachevee.\n- FOURNIS SYSTEMATIQUEMENT DU CODE PRATIQUE DES TA PREMIERE REPONSE.\n- Blocs markdown avec le langage precise (ex: \`\`\`typescript).\n\nFormat:\n## Explication Detaillee\n## Risques Principaux\n## Etapes d'Implementation\n## Exemples et Code a Copier (OBLIGATOIRE)\n## Checklist de Verification`,
        config: { temperature: 0.2, maxOutputTokens: 4000 }
      }));
      const text = this.getText(r);
      const base = text || this.buildLocalExplanationFallback(req);
      return await this.ensureCompleteWithCode(base, `ASVS ${req.requirementId} ${req.context || ''}: ${req.requirement}`);
    } catch (e: any) {
      if (this.isQuotaError(e)) return this.buildLocalExplanationFallback(req);
      return this.formatAiError(e);
    }
  }

  async chat(message: string, history: { role: string; text: string }[], options: ChatOptions = {}): Promise<string> {
    const fastMode = !!options.fastMode;
    if (this.auth.isBackendMode() && this.isBrowser) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/mcp/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.auth.getToken()}` },
          body: JSON.stringify({ message, history, fastMode })
        });
        if (res.ok) {
          const d = await res.json();
          if (typeof d?.result === 'string' && this.looksLikeQuotaText(d.result)) return this.buildLocalChatFallback(message, fastMode);
          if (this.isUsableResult(d?.result)) return await this.ensureCompleteWithCode(d.result, message);
        }
      } catch { }
    }

    try {
      const hist = history.slice(fastMode ? -4 : -6).map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`).join('\n');
      const responseShape = fastMode
        ? 'Mode rapide: 1) Reponse directe 2) Etapes cles 3) Code IMMEDIAT 4) Verification.'
        : '## Explication Detaillee\n## Solution Recommandee\n## Exemple de Code a Copier (OBLIGATOIRE)\n## Comment Tester\n## Erreurs a Eviter';

      const r = await this.generateWithFallback(model => ({
        model,
        contents: `Tu es expert cybersecurite OWASP ASVS. Reponds en francais, pedagogique et pratique.\n${responseShape}\nRegles: pas de salutation, code obligatoire dans ta premiere reponse, blocs markdown avec langage.\n${hist ? `\nHistorique:\n${hist}\n` : ''}\nUser: ${message}`,
        config: { temperature: fastMode ? 0.2 : 0.25, maxOutputTokens: fastMode ? 2000 : 4000 }
      }));
      const text = this.getText(r);
      if (!text && r?.promptFeedback?.blockReason) return `Erreur: Reponse bloquee (${r.promptFeedback.blockReason}). Reformulez la question.`;
      return await this.ensureCompleteWithCode(text || this.buildLocalChatFallback(message, fastMode), message);
    } catch (e: any) {
      if (this.isQuotaError(e)) return this.buildLocalChatFallback(message, fastMode);
      return this.formatAiError(e);
    }
  }

  async scanCode(code: string, language: string): Promise<string> {
    if (this.auth.isBackendMode() && this.isBrowser) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/mcp/scan-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.auth.getToken()}` },
          body: JSON.stringify({ code, language })
        });
        if (res.ok) {
          const d = await res.json();
          if (this.isUsableResult(d?.result)) return await this.ensureCompleteWithCode(d.result, `scan code ${language}`);
        }
      } catch { }
    }

    try {
      const r = await this.generateWithFallback(model => ({
        model,
        contents: `Analyse ce code ${language} pour les vulnerabilites OWASP ASVS. Reponds en francais.\nRegles: pas de salutation, reponse complete.\n\`\`\`${language}\n${code}\n\`\`\`\n\n## Analyse des Vulnerabilites (severite, CWE, description)\n## Points positifs\n## Code Corrige (obligatoire, bloc markdown \`\`\`${language})\n## Score /10\n## Top 3 recommandations`
      }));
      const text = this.getText(r);
      return await this.ensureCompleteWithCode(text || this.buildLocalScanFallback(code, language), `scan code ${language}`);
    } catch (e: any) {
      if (this.isQuotaError(e)) return this.buildLocalScanFallback(code, language);
      return this.formatAiError(e);
    }
  }

  async getMcpStatus(): Promise<any> {
    if (!this.isBrowser) return null;
    try {
      const res = await fetch(`${BACKEND_URL}/api/mcp/status`, { headers: { 'Authorization': `Bearer ${this.auth.getToken()}` } });
      if (res.ok) return await res.json();
    } catch { }
    return null;
  }

  async getMcpTools(): Promise<McpToolDescriptor[]> {
    if (!this.isBrowser || !this.auth.isBackendMode()) return [];
    try {
      const res = await fetch(`${BACKEND_URL}/api/mcp/tools`, { headers: { 'Authorization': `Bearer ${this.auth.getToken()}` } });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data?.tools) ? data.tools : [];
    } catch { return []; }
  }

  async executeMcpTool(tool: string, args: Record<string, any>): Promise<string> {
    if (!this.isBrowser) return 'Erreur: MCP indisponible en mode SSR.';

    await this.auth.refreshBackendAvailability();
    if (!this.auth.isBackendMode()) {
      try { return await this.executeMcpToolLocal(tool, args); }
      catch (e: any) { return this.formatAiError(e); }
    }

    try {
      const legacy = await this.executeMcpToolBackendLegacy(tool, args);
      if (legacy !== null) return legacy;
    } catch { }

    try {
      const res = await fetch(`${BACKEND_URL}/api/mcp/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.auth.getToken()}` },
        body: JSON.stringify({ tool, args })
      });

      const rawText = await res.text();
      let data: any = {};
      try { data = rawText ? JSON.parse(rawText) : {}; } catch { }

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) return 'Erreur: Session expiree. Reconnectez-vous.';

        const backendError = this.stripHtmlError(String(data?.error || (rawText || '').trim() || `HTTP ${res.status}`)) || `HTTP ${res.status}`;
        const routeMissing = res.status === 404 || backendError.toLowerCase().includes('cannot post /api/mcp/execute');

        if (routeMissing) {
          try {
            const legacy = await this.executeMcpToolBackendLegacy(tool, args);
            if (legacy) return legacy;
          } catch { }
        }

        if (this.isUnknownToolError(backendError, tool)) {
          try { return await this.executeMcpToolLocal(tool, args); } catch { }
        }

        try {
          const localResult = await this.executeMcpToolLocal(tool, args);
          if (!localResult.startsWith('Erreur:')) return `Info: MCP backend indisponible (${backendError}). Execution locale:\n\n${localResult}`;
        } catch { }
        return `Erreur: MCP backend (${backendError}).`;
      }

      const result = typeof data?.result === 'string' ? data.result : '';
      if (!this.isUsableResult(result) || this.looksLikeQuotaText(result)) return this.buildMcpFallback(tool, args);
      return result;
    } catch (e: any) {
      try {
        const localResult = await this.executeMcpToolLocal(tool, args);
        if (!localResult.startsWith('Erreur:')) return `Info: MCP backend indisponible. Execution locale:\n\n${localResult}`;
      } catch { }
      return `Erreur: ${e?.message || 'Erreur reseau MCP.'}`;
    }
  }
}
