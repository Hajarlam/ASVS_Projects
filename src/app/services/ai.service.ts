import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { GoogleGenAI } from '@google/genai';
import { AiRequest } from '../models/asvs.models';
import { AuthService } from './auth.service';

const BACKEND_URL = 'http://localhost:3000';

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
  private ai = new GoogleGenAI({ apiKey: 'AIzaSyACIQK1JIi_ARGqCpc4Ao_XS-xy8WB78_g' });
  private readonly modelCandidates = ['gemini-2.0-flash', 'gemini-2.5-flash'];

  constructor(@Inject(PLATFORM_ID) platformId: Object, private auth: AuthService) {
    this.isBrowser = isPlatformBrowser(platformId);
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
        return 'Erreur quota Gemini: limite journaliere atteinte. Ajoutez une API key/plan payant ou reutilisez demain.';
      }
      const retry = this.extractRetrySeconds(message);
      if (retry) return `Erreur quota Gemini: reessayez dans ${retry}s.`;
      return 'Erreur quota Gemini: limite atteinte. Reessayez plus tard ou changez de modele/API key.';
    }
    return `Erreur IA: ${message || 'Veuillez reessayer.'}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async generateWithFallback(
    buildRequest: (model: string) => { model: string; contents: string; config?: { temperature?: number; maxOutputTokens?: number } }
  ): Promise<any> {
    let lastError: any = null;
    let lastQuotaError: any = null;

    const tryOnce = async (): Promise<any> => {
      for (const model of this.modelCandidates) {
        try {
          const request = buildRequest(model);
          return await this.ai.models.generateContent(request);
        } catch (e: any) {
          lastError = e;
          if (this.isQuotaError(e)) lastQuotaError = e;
          if (!this.shouldTryNextModel(e)) throw e;
        }
      }
      throw lastError || new Error('Aucun modele Gemini disponible.');
    };

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        return await tryOnce();
      } catch (e: any) {
        lastError = e;
        if (this.isQuotaError(e)) lastQuotaError = e;

        if (!lastQuotaError || this.isDailyQuotaError(lastQuotaError) || attempt >= 2) {
          throw lastQuotaError || lastError || new Error('Aucun modele Gemini disponible.');
        }

        const retry = this.extractRetrySeconds(this.extractErrorMessage(lastQuotaError));
        if (!retry || retry > 20) {
          throw lastQuotaError || lastError || new Error('Aucun modele Gemini disponible.');
        }
        await this.sleep(retry * 1000);
      }
    }

    throw lastQuotaError || lastError || new Error('Aucun modele Gemini disponible.');
  }

  // Extrait le texte de la réponse Gemini (gère les 2 formats SDK)
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
    const canonical = normalized
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
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
    return (text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private stripHtmlError(raw: string): string {
    const input = String(raw || '');
    const pre = input.match(/<pre>([\s\S]*?)<\/pre>/i);
    if (pre?.[1]) {
      return pre[1].replace(/\s+/g, ' ').trim();
    }
    const noTags = input.replace(/<[^>]+>/g, ' ');
    return noTags.replace(/\s+/g, ' ').trim();
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
    if (/(?:\b(et|ou|mais|donc|car|de|du|des|la|le|les|dans|avec|pour|par|sur|a|au|aux|to|and|or|but|because|with|for|in)\s*)$/i.test(t.slice(-160))) {
      return true;
    }
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
      '',
      'const schema = z.object({ email: z.string().email(), password: z.string().min(12) });',
      '',
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
    return t.startsWith('erreur:')
      || t.startsWith('error:')
      || t.startsWith('quota gemini')
      || t.startsWith('reponse bloquee');
  }

  private async ensureCompleteWithCode(draft: string, context: string): Promise<string> {
    let output = this.closeOpenCodeFence(draft || '');
    if (!output || this.isHardErrorResponse(output)) return output;

    if (this.looksTruncatedAnswer(output)) {
      try {
        const continuationResp = await this.generateWithFallback(model => ({
          model,
          contents: `Complete STRICTEMENT la reponse suivante sans repetition.
Contexte: ${context.slice(0, 700)}

Reponse actuelle:
${output.slice(-2600)}

Regles:
- Continue a partir de la derniere idee.
- Termine toutes les phrases.
- Ferme les blocs markdown de code ouverts.
- Pas de salutation.`,
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
        '',
        "const access = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET!, {",
        "  expiresIn: '15m',",
        "  issuer: 'asvs-app',",
        "  audience: 'asvs-users'",
        '});',
        '',
        "const refresh = jwt.sign({ sub: user.id, jti: crypto.randomUUID() }, process.env.JWT_REFRESH_SECRET!, {",
        "  expiresIn: '7d'",
        '});',
        '```'
      ].join('\n');
    }

    if (q.includes('sql') || q.includes('injection')) {
      return [
        'Prevention SQL Injection:',
        '### Regles',
        '1. Requetes preparees/parametrees uniquement.',
        '2. Interdire la concatenation SQL des entrees utilisateur.',
        '3. Validation des entrees (taille, format, allowlist).',
        '4. Compte DB a privilege minimal (jamais admin applicatif).',
        '5. Logs d erreurs sans exposer la requete complete.',
        '',
        '### Exemple vulnerable',
        '```javascript',
        "const query = \"SELECT * FROM users WHERE email = '\" + email + \"'\";",
        'const rows = await db.query(query);',
        '```',
        '',
        '### Exemple corrige',
        '```javascript',
        "const query = 'SELECT * FROM users WHERE email = ?';",
        'const rows = await db.execute(query, [email]);',
        '```'
      ].join('\n');
    }

    if (/(mot[s]?\s+de\s+passe|password|hachage|hash|bcrypt|argon)/.test(q)) {
      return [
        'Bonnes pratiques mots de passe:',
        '### Regles',
        '1. Hachage Argon2id (ou bcrypt cost >= 12) + salt unique.',
        '2. Minimum 12 caracteres + blocage des mots de passe faibles.',
        '3. MFA pour comptes sensibles.',
        '4. Rate-limit login + verrouillage temporaire + journalisation.',
        '5. Reset via token unique, court et usage unique.',
        '',
        '### Exemple TypeScript (bcrypt)',
        '```typescript',
        "import bcrypt from 'bcryptjs';",
        '',
        'const hash = await bcrypt.hash(password, 12);',
        'const ok = await bcrypt.compare(passwordAttempt, hash);',
        "if (!ok) throw new Error('Identifiants invalides');",
        '```'
      ].join('\n');
    }

    if (q.includes('api') || q.includes('endpoint') || q.includes('route')) {
      return [
        'Securisation API:',
        '### Checklist',
        '1. Auth forte (JWT verifie cote serveur) + authorization par role.',
        '2. Validation stricte des payloads (schema + taille).',
        '3. Rate limiting + protection brute-force.',
        '4. CORS minimal + headers de securite (helmet).',
        '5. Monitoring des erreurs 401/403/429/5xx.',
        '',
        '### Exemple middleware Express',
        '```typescript',
        'app.use(helmet());',
        "app.use(rateLimit({ windowMs: 60_000, max: 100 }));",
        '',
        "app.post('/api/admin/action', requireAuth, requireRole('admin'), validate(bodySchema), handler);",
        '```'
      ].join('\n');
    }

    if (fastMode) {
      return [
        'Plan securite rapide:',
        '1. Identifiez la surface d attaque (entrees utilisateur, auth, donnees sensibles).',
        '2. Bloquez les attaques evidentes: validation stricte + requetes parametrees + controles d acces.',
        '3. Ajoutez protections runtime: rate-limit, logs securite, gestion d erreurs sans fuite.',
        '',
        'Exemple minimal Express:',
        '```typescript',
        'app.use(helmet());',
        "app.use(rateLimit({ windowMs: 60_000, max: 100 }));",
        "app.post('/api/resource', requireAuth, validate(schema), handler);",
        '```'
      ].join('\n');
    }

    return [
      'Reponse detaillee (mode local):',
      '## Diagnostic',
      '- Le sujet n est pas explicitement reconnu, je fournis une base securite reutilisable.',
      '',
      '## Strategie',
      '1. Definir les actifs sensibles et les roles autorises.',
      '2. Valider toutes les entrees (schema, type, taille, allowlist).',
      '3. Proteger les acces (auth + authorization + moindre privilege).',
      '4. Durcir l execution (rate-limit, timeouts, headers securite, logs).',
      '5. Verifier avec tests negatifs et pentest cible.',
      '',
      '## Exemple de code (Node/Express)',
      '```typescript',
      "import helmet from 'helmet';",
      "import rateLimit from 'express-rate-limit';",
      '',
      'app.use(helmet());',
      "app.use(rateLimit({ windowMs: 60_000, max: 100 }));",
      '',
      "app.post('/api/login', validate(loginSchema), async (req, res) => {",
      '  // Toujours valider puis appliquer auth/logique metier',
      "  return res.status(200).json({ ok: true });",
      '});',
      '```',
      '',
      '## Verification',
      '- Testez payloads invalides, injection, brute force, acces sans role.',
      '- Verifiez statuts HTTP (400/401/403/429) et logs exploitables.'
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

  private buildMcpFallback(tool: string, args: Record<string, any>): string {
    if (tool === 'analyze_requirement') {
      return this.buildLocalExplanationFallback({
        requirementId: String(args?.['requirementId'] || 'N/A'),
        requirement: String(args?.['requirement'] || ''),
        context: String(args?.['context'] || '')
      });
    }
    if (tool === 'scan_code') {
      return this.buildLocalScanFallback(
        String(args?.['code'] || ''),
        String(args?.['language'] || 'javascript')
      );
    }
    if (tool === 'chat') {
      return this.buildLocalChatFallback(String(args?.['message'] || ''), !!args?.['fastMode']);
    }
    if (tool === 'get_security_info') {
      const cwe = String(args?.['cwe'] || '').trim();
      const topic = String(args?.['topic'] || '').trim();
      const query = cwe ? `CWE-${cwe}` : topic;
      return this.buildLocalSecurityInfoFallback(query || 'security-topic');
    }
    if (tool === 'scan_repository') {
      const repoUrl = String(args?.['repoUrl'] || '').trim();
      return `Scan repository indisponible en mode local. Activez le backend puis relancez avec un lien GitHub.\nRepository: ${repoUrl || 'N/A'}`;
    }
    return `Erreur: outil MCP inconnu (${tool}).`;
  }

  private async executeMcpToolLocal(tool: string, args: Record<string, any>): Promise<string> {
    if (tool === 'analyze_requirement') {
      const requirement = String(args?.['requirement'] || '').trim();
      if (!requirement) return 'Erreur: champ requirement requis.';
      return await this.getExplanation({
        requirementId: String(args?.['requirementId'] || 'N/A'),
        requirement,
        context: String(args?.['context'] || '')
      });
    }

    if (tool === 'scan_code') {
      const code = String(args?.['code'] || '').trim();
      const language = String(args?.['language'] || 'javascript');
      if (!code) return 'Erreur: champ code requis.';
      return await this.scanCode(code, language);
    }

    if (tool === 'chat') {
      const message = String(args?.['message'] || '').trim();
      if (!message) return 'Erreur: champ message requis.';
      const history = Array.isArray(args?.['history'])
        ? args['history']
          .filter((h: any) => typeof h?.role === 'string' && typeof h?.text === 'string')
          .map((h: any) => ({ role: h.role, text: h.text }))
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
        contents: `Donne un resume de securite tres clair, rapide et pedagogique sur ${query} en francais: description detaillee, impact, mesures de prevention. IL EST OBLIGATOIRE D'INCLURE IMMEDIATEMENT DANS TA PREMIERE REPONSE au moins un exemple de code clair et securise, facile a copier (dans un bloc markdown avec le langage precise). N'attends pas de question de suivi. Sois concis et rapide.`,
        config: { temperature: 0.2, maxOutputTokens: 4000 }
      }));
      return this.getText(r) || this.buildLocalSecurityInfoFallback(query);
    }

    if (tool === 'scan_repository') {
      return 'Erreur: scan_repository necessite le mode backend actif (JWT + API MCP).';
    }

    return `Erreur: outil MCP inconnu (${tool}).`;
  }

  private async executeMcpToolBackendLegacy(tool: string, args: Record<string, any>): Promise<string | null> {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.auth.getToken()}`
    };

    const call = async (path: string, body: Record<string, any>): Promise<string | null> => {
      const res = await fetch(`${BACKEND_URL}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
      const raw = await res.text();
      let data: any = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { }
      if (!res.ok) {
        const rawError = typeof data?.error === 'string'
          ? data.error
          : (raw || `HTTP ${res.status}`);
        const err = this.stripHtmlError(rawError) || `HTTP ${res.status}`;
        if (this.isRouteMissingError(res.status, err, path)) {
          return null;
        }
        if (this.isUnknownToolError(err, tool)) {
          return null;
        }
        return `Erreur: MCP backend (${err}).`;
      }
      const result = typeof data?.result === 'string' ? data.result : '';
      if (!this.isUsableResult(result) || this.looksLikeQuotaText(result)) {
        return this.buildMcpFallback(tool, body);
      }
      return result;
    };

    if (tool === 'analyze_requirement') {
      return await call('/api/mcp/analyze', {
        requirementId: String(args?.['requirementId'] || 'N/A'),
        requirement: String(args?.['requirement'] || ''),
        context: String(args?.['context'] || ''),
        code: String(args?.['code'] || '')
      });
    }

    if (tool === 'scan_code') {
      return await call('/api/mcp/scan-code', {
        code: String(args?.['code'] || ''),
        language: String(args?.['language'] || 'javascript'),
        requirementId: String(args?.['requirementId'] || '')
      });
    }

    if (tool === 'chat') {
      const history = Array.isArray(args?.['history'])
        ? args['history']
          .filter((h: any) => typeof h?.role === 'string' && typeof h?.text === 'string')
          .map((h: any) => ({ role: h.role, text: h.text }))
        : [];
      return await call('/api/mcp/chat', {
        message: String(args?.['message'] || ''),
        history,
        fastMode: !!args?.['fastMode']
      });
    }

    if (tool === 'get_security_info') {
      const cwe = String(args?.['cwe'] || '').trim();
      const topic = String(args?.['topic'] || '').trim();
      const query = cwe ? `CWE-${cwe}` : topic;
      if (!query) return 'Erreur: champ cwe ou topic requis.';

      // Legacy backend has no dedicated endpoint for this tool; avoid /execute 404.
      return this.buildLocalSecurityInfoFallback(query);
    }

    if (tool === 'scan_repository') {
      const repoUrl = String(args?.['repoUrl'] || '').trim();
      if (!repoUrl) return 'Erreur: champ repoUrl requis.';
      return await call('/api/mcp/scan-repository', {
        repoUrl
      });
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
        if (res.ok) {
          if (this.isUsableResult(d?.result)) {
            return await this.ensureCompleteWithCode(
              d.result,
              `ASVS ${requirement.requirementId} ${requirement.context || ''}: ${requirement.requirement}`
            );
          }
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
        contents: `Tu es expert en cybersecurite OWASP ASVS. Fournis une reponse detaillee, riche en explications, et tres actionnable en francais.

Contexte:
- Requirement ID: ${req.requirementId}
- Domaine: ${req.context || 'general'}
- Exigence: ${req.requirement}

Contraintes de reponse ABSOLUES:
- Commence directement par le contenu utile (pas de salutation).
- N'ecris jamais "En tant qu'expert" ou une formule similaire.
- Ne melange pas avec d'autres exigences non mentionnees.
- Reponse complete: ne laisse aucune phrase inachevee.
- FOURNIS SYSTEMATIQUEMENT DU CODE PRATIQUE DES TA TOUTE PREMIERE REPONSE.
- Donne au moins un exemple de code executable et facile a copier (utilise obligatoirement les blocs markdown avec le nom du langage, e.g. \`\`\`typescript).
- Sois tres pedagogique et engageant dans tes explications (meilleure discussion).
- Explique pourquoi chaque mesure reduit le risque et comment la tester.

Format strict:
## Explication Detaillee
## Risques Principaux
## Etapes d'Implementation
## Exemples et Code a Copier (OBLIGATOIRE IMMEDIATEMENT)
## Checklist de Verification`,
        config: { temperature: 0.2, maxOutputTokens: 4000 }
      }));
      const text = this.getText(r);
      const base = text || this.buildLocalExplanationFallback(req);
      return await this.ensureCompleteWithCode(
        base,
        `ASVS ${req.requirementId} ${req.context || ''}: ${req.requirement}`
      );
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
          if (typeof d?.result === 'string' && this.looksLikeQuotaText(d.result)) {
            return this.buildLocalChatFallback(message, fastMode);
          }
          if (this.isUsableResult(d?.result)) {
            return await this.ensureCompleteWithCode(d.result, message);
          }
        }
      } catch { }
    }

    try {
      const histWindow = fastMode ? 4 : 6;
      const hist = history
        .slice(-histWindow)
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
        .join('\n');
      const responseShape = fastMode
        ? [
          'Mode rapide active.',
          'Format obligatoire pour ta TOUTE PREMIERE reponse:',
          '1) Reponse directe (2-3 phrases).',
          '2) Etapes cles (3 a 5 points max).',
          '3) Mini exemple de code IMMEDIAT (obligatoire, a copier).',
          '4) Une verification concrete a faire maintenant.'
        ].join('\n')
        : [
          'Format obligatoire pour ta TOUTE PREMIERE reponse:',
          '## Explication Detaillee',
          '## Solution Recommandee',
          '## Exemple de Code a Copier (OBLIGATOIRE IMMÉDIATEMENT)',
          '## Comment Tester',
          '## Erreurs a Eviter'
        ].join('\n');

      const r = await this.generateWithFallback(model => ({
        model,
        contents: `Tu es expert cybersecurite OWASP ASVS. Fournis des explications tres claires, detaillees et orientees vers la pratique en francais.
${responseShape}
Regles d'or absolues:
- Commence directement par la reponse utile, sans salutation.
- N'ecris jamais "En tant qu'expert" ou une formule similaire.
- Reponds strictement a la derniere question utilisateur.
- N'utilise l'historique que s'il est pertinent a cette question.
- Reponse complete: ne laisse aucune phrase inachevee.
- FOURNIS SYSTEMATIQUEMENT DU CODE DANS TA TOUTE PREMIERE REPONSE. N'attends jamais qu'on te demande un exemple.
- Si l'utilisateur pose une question globale (ex: 'Comment implementer JWT...'), donne directement l'explication detaillee AVEC le code concret a copier.
- Ameliore la discussion en etant tres explicatif et pedagogique.
- Genere toujours du vrai code (pas de pseudo-code) facile a copier, dans un bloc markdown avec le langage precise (ex: \`\`\`javascript).
- Garde a l'esprit que l'utilisateur veut copier et utiliser ton code directement. Sois concis et rapide dans ton texte explicatif pour gagner du temps.
${hist ? `\nHistorique:\n${hist}\n` : ''}
User: ${message}`,
        config: {
          temperature: fastMode ? 0.2 : 0.25,
          maxOutputTokens: fastMode ? 2000 : 4000
        }
      }));
      const text = this.getText(r);
      if (!text && r?.promptFeedback?.blockReason) {
        return `Erreur: Reponse bloquee (${r.promptFeedback.blockReason}). Reformulez la question.`;
      }
      const base = text || this.buildLocalChatFallback(message, fastMode);
      return await this.ensureCompleteWithCode(base, message);
    } catch (e: any) {
      if (this.isQuotaError(e)) {
        return this.buildLocalChatFallback(message, fastMode);
      }
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
          if (this.isUsableResult(d?.result)) {
            return await this.ensureCompleteWithCode(d.result, `scan code ${language}`);
          }
        }
      } catch { }
    }

    try {
      const r = await this.generateWithFallback(model => ({
        model,
        contents: `Analyse avec expertise ce code ${language} pour identifier les vulnerabilites OWASP ASVS. Reponds en francais et sois tres pedagogique.
Regles obligatoires:
- Commence directement par l'analyse, sans salutation.
- N'ecris jamais "En tant qu'expert" ou une formule similaire.
- Fournis une reponse complete sans phrase inachevee.
\`\`\`${language}
${code}
\`\`\`

Format de reponse attendu :
## Analyse des Vulnerabilites (severite, CWE, description, explication claire du risque)
## Points positifs (ce qui est bien fait)
## Code Corrige et Fixes (Obligatoire : fournis le code corrige et securise dans un bloc markdown pret a etre copie avec \`\`\`${language})
## Score /10
## Top 3 recommandations`
      }));
      const text = this.getText(r);
      const base = text || this.buildLocalScanFallback(code, language);
      return await this.ensureCompleteWithCode(base, `scan code ${language}`);
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
      const res = await fetch(`${BACKEND_URL}/api/mcp/tools`, {
        headers: { 'Authorization': `Bearer ${this.auth.getToken()}` }
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data?.tools) ? data.tools : [];
    } catch {
      return [];
    }
  }

  async executeMcpTool(tool: string, args: Record<string, any>): Promise<string> {
    if (!this.isBrowser) {
      return 'Erreur: MCP indisponible en mode SSR.';
    }

    await this.auth.refreshBackendAvailability();
    if (!this.auth.isBackendMode()) {
      if (tool === 'scan_repository') {
        try {
          const res = await fetch(`${BACKEND_URL}/api/mcp/public/scan-repository`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              repoUrl: String(args?.['repoUrl'] || '').trim(),
              branch: String(args?.['branch'] || '')
            })
          });
          const raw = await res.text();
          let data: any = {};
          try { data = raw ? JSON.parse(raw) : {}; } catch { }

          if (!res.ok) {
            const err = this.stripHtmlError(String(data?.error || raw || `HTTP ${res.status}`));
            return `Erreur: MCP backend (${err || `HTTP ${res.status}`}).`;
          }

          const result = typeof data?.result === 'string' ? data.result : '';
          if (this.isUsableResult(result)) {
            return result;
          }
        } catch { }
      }
      try {
        return await this.executeMcpToolLocal(tool, args);
      } catch (e: any) {
        return this.formatAiError(e);
      }
    }

    // Prefer legacy MCP endpoints when available to avoid /api/mcp/execute 404 on older backends.
    try {
      const legacy = await this.executeMcpToolBackendLegacy(tool, args);
      if (legacy !== null) {
        return legacy;
      }
    } catch { }

    try {
      const res = await fetch(`${BACKEND_URL}/api/mcp/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.auth.getToken()}`
        },
        body: JSON.stringify({ tool, args })
      });

      const rawText = await res.text();
      let data: any = {};
      try { data = rawText ? JSON.parse(rawText) : {}; } catch { }
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          return 'Erreur: Session expiree. Reconnectez-vous.';
        }
        const backendError = this.stripHtmlError(
          String(data?.error || (rawText || '').trim() || `HTTP ${res.status}`)
        ) || `HTTP ${res.status}`;

        const routeMissing = res.status === 404
          || String(backendError).toLowerCase().includes('cannot post /api/mcp/execute')
          || String(backendError).toLowerCase().includes('cannot get /api/mcp/execute');
        if (routeMissing) {
          try {
            const legacy = await this.executeMcpToolBackendLegacy(tool, args);
            if (legacy && !legacy.startsWith('Erreur:')) return legacy;
            if (legacy) return legacy;
          } catch { }
        }

        if (this.isUnknownToolError(backendError, tool)) {
          if (tool === 'scan_repository') {
            return 'Erreur: le backend actif ne supporte pas encore scan_repository. Redemarrez le serveur backend (cd backend && npm start) puis reconnectez-vous.';
          }
          return `Erreur: outil MCP indisponible sur ce backend (${tool}).`;
        }

        try {
          const localResult = await this.executeMcpToolLocal(tool, args);
          if (!localResult.startsWith('Erreur:')) {
            return `Info: MCP backend indisponible (${backendError}). Execution locale:\n\n${localResult}`;
          }
        } catch { }
        return `Erreur: MCP backend (${backendError}).`;
      }
      const result = typeof data?.result === 'string' ? data.result : '';
      if (!this.isUsableResult(result) || this.looksLikeQuotaText(result)) {
        return this.buildMcpFallback(tool, args);
      }
      return result;
    } catch (e: any) {
      try {
        const localResult = await this.executeMcpToolLocal(tool, args);
        if (!localResult.startsWith('Erreur:')) {
          return `Info: MCP backend indisponible. Execution locale:\n\n${localResult}`;
        }
      } catch { }
      return `Erreur: ${e?.message || 'Erreur reseau MCP.'}`;
    }
  }
}
