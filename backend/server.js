/**
 * ASVS Backend Server
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * â€¢ Express REST API  (port 3000)
 * â€¢ JWT Authentication (bcryptjs password hashing)
 * â€¢ MCP Server (Model Context Protocol) integration
 * â€¢ Rate limiting + Helmet security headers
 * â€¢ CORS configured for Angular dev server
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { execFile } from 'child_process';
import { mkdtemp, rm, readdir, stat, readFile, writeFile, mkdir } from 'fs/promises';

// â”€â”€â”€ CONFIG â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'asvs-super-secret-key-change-in-production';
const JWT_EXPIRES = '24h';
const SALT_ROUNDS = 12;
const execFileAsync = promisify(execFile);
const REPO_ALLOWED_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx',
  '.py', '.java', '.php', '.go', '.rb',
  '.c', '.cpp', '.cs', '.sql',
  '.json', '.yaml', '.yml', '.xml',
  '.sh', '.bash', '.ps1',
  '.html', '.css'
]);
const REPO_IGNORED_DIRS = new Set([
  '.git', 'node_modules', 'dist', 'build', 'coverage',
  '.next', '.nuxt', '.angular', '.cache', 'vendor', 'target', 'out'
]);

// â”€â”€â”€ IN-MEMORY STORE (remplacer par DB en production) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const users = [
  {
    id: 'admin-001',
    username: 'admin',
    email: 'admin@asvs.local',
    role: 'admin',
    // bcrypt hash de "admin123"
    passwordHash: await bcrypt.hash('admin123', SALT_ROUNDS),
    createdAt: new Date().toISOString(),
    loginAttempts: 0,
    lockedUntil: null
  },
  {
    id: 'user-001',
    username: 'utilisateur',
    email: 'user@asvs.local',
    role: 'user',
    // bcrypt hash de "user123"
    passwordHash: await bcrypt.hash('user123', SALT_ROUNDS),
    createdAt: new Date().toISOString(),
    loginAttempts: 0,
    lockedUntil: null
  }
];

const revokedTokens = new Set(); // blacklist JWT (logout)

// â”€â”€â”€ EXPRESS APP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const app = express();

// Security headers
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));

// CORS â€” Angular dev server
app.use(cors({
  origin: ['http://localhost:4200', 'http://localhost:4000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10kb' }));

// â”€â”€â”€ RATE LIMITERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: 'Trop de tentatives de connexion. RÃ©essayez dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: { error: 'Trop de requÃªtes. Ralentissez.' }
});

app.use('/api/', apiLimiter);

// â”€â”€â”€ MIDDLEWARE JWT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'Token manquant. Authentification requise.' });
  }

  if (revokedTokens.has(token)) {
    return res.status(401).json({ error: 'Token rÃ©voquÃ©. Reconnectez-vous.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirÃ©. Reconnectez-vous.' });
    }
    return res.status(403).json({ error: 'Token invalide.' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'AccÃ¨s refusÃ©. RÃ´le admin requis.' });
  }
  next();
}

// â”€â”€â”€ HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function sanitizeUser(user) {
  const { passwordHash, loginAttempts, lockedUntil, ...safe } = user;
  return safe;
}

function isAccountLocked(user) {
  if (!user.lockedUntil) return false;
  return new Date() < new Date(user.lockedUntil);
}

// â”€â”€â”€ AUTH ROUTES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// POST /api/auth/login
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis.' });
    }

    const user = users.find(u => u.username === username || u.email === username);

    if (!user) {
      // On simule un dÃ©lai pour Ã©viter l'Ã©numÃ©ration des utilisateurs
      await bcrypt.compare(password, '$2b$12$invalidhashtopreventtiming');
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }

    // VÃ©rifier si compte bloquÃ©
    if (isAccountLocked(user)) {
      const unlockTime = new Date(user.lockedUntil).toLocaleTimeString('fr-FR');
      return res.status(423).json({ error: `Compte bloquÃ©. RÃ©essayez aprÃ¨s ${unlockTime}.` });
    }

    // VÃ©rifier mot de passe avec bcrypt
    const passwordValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordValid) {
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      if (user.loginAttempts >= 5) {
        user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        user.loginAttempts = 0;
        return res.status(423).json({ error: 'Trop de tentatives. Compte bloquÃ© 15 min.' });
      }
      return res.status(401).json({
        error: `Identifiants incorrects. ${5 - user.loginAttempts} tentative(s) restante(s).`
      });
    }

    // SuccÃ¨s â€” reset tentatives
    user.loginAttempts = 0;
    user.lockedUntil = null;
    user.lastLogin = new Date().toISOString();

    // GÃ©nÃ©rer JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES, issuer: 'asvs-app', audience: 'asvs-users' }
    );

    return res.json({
      success: true,
      token,
      user: sanitizeUser(user),
      expiresIn: JWT_EXPIRES
    });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

// POST /api/auth/logout
app.post('/api/auth/logout', requireAuth, (req, res) => {
  const token = req.headers['authorization'].split(' ')[1];
  revokedTokens.add(token);
  res.json({ success: true, message: 'DÃ©connexion rÃ©ussie.' });
});

// GET /api/auth/me
app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });
  res.json(sanitizeUser(user));
});

// POST /api/auth/refresh
app.post('/api/auth/refresh', requireAuth, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });

  const token = jwt.sign(
    { id: user.id, username: user.username, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES, issuer: 'asvs-app', audience: 'asvs-users' }
  );

  res.json({ token, expiresIn: JWT_EXPIRES });
});

// â”€â”€â”€ USER MANAGEMENT ROUTES (Admin only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// GET /api/users
app.get('/api/users', requireAuth, requireAdmin, (req, res) => {
  res.json(users.map(sanitizeUser));
});

// POST /api/users
app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password || !role) {
      return res.status(400).json({ error: 'Tous les champs sont requis.' });
    }

    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: 'RÃ´le invalide.' });
    }

    if (users.find(u => u.username === username || u.email === email)) {
      return res.status(409).json({ error: 'Nom d\'utilisateur ou email dÃ©jÃ  utilisÃ©.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractÃ¨res.' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const newUser = {
      id: `user-${Date.now()}`,
      username, email, role, passwordHash,
      createdAt: new Date().toISOString(),
      loginAttempts: 0,
      lockedUntil: null
    };

    users.push(newUser);
    res.status(201).json(sanitizeUser(newUser));

  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// DELETE /api/users/:id
app.delete('/api/users/:id', requireAuth, requireAdmin, (req, res) => {
  const { id } = req.params;
  if (id === req.user.id) {
    return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte.' });
  }
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Utilisateur introuvable.' });
  users.splice(idx, 1);
  res.json({ success: true });
});

// PUT /api/users/:id/role
app.put('/api/users/:id/role', requireAuth, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  if (!['admin', 'user'].includes(role)) {
    return res.status(400).json({ error: 'RÃ´le invalide.' });
  }
  const user = users.find(u => u.id === id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });
  user.role = role;
  res.json(sanitizeUser(user));
});

const ANALYZE_REQUIREMENT_ARGS = {
  requirementId: z.string().describe('ID de l\'exigence ASVS ex: V2.1.1'),
  requirement: z.string().describe('Texte de l\'exigence'),
  context: z.string().optional().describe('CatÃ©gorie de sÃ©curitÃ©'),
  code: z.string().optional().describe('Code soumis Ã  analyser')
};

const SCAN_CODE_ARGS = {
  code: z.string().describe('Code Ã  analyser'),
  language: z.string().describe('Langage de programmation'),
  requirementId: z.string().optional().describe('ID ASVS optionnel pour contexte')
};

const CHAT_ARGS = {
  message: z.string().describe('Message utilisateur'),
  history: z.array(z.object({ role: z.string(), text: z.string() })).optional().describe('Historique de conversation'),
  fastMode: z.boolean().optional().describe('Active le mode reponse rapide')
};

const GET_SECURITY_INFO_ARGS = {
  cwe: z.string().optional().describe('Numero CWE optionnel (ex: 79)'),
  topic: z.string().optional().describe('Sujet securite libre (ex: SQL Injection)')
};


const SCAN_REPOSITORY_ARGS = {
  repoUrl: z.string().describe('Lien du repo GitHub public ou prive accessible'),
  branch: z.string().optional().describe('Branche optionnelle (ex: main)'),
  maxFiles: z.number().int().min(5).max(120).optional().describe('Nombre max de fichiers a analyser'),
  maxCharsPerFile: z.number().int().min(200).max(12000).optional().describe('Taille max de contenu par fichier')
};

const MCP_TOOL_DEFS = {
  analyze_requirement: {
    description: 'Analyse une exigence ASVS et fournit des conseils de sÃ©curitÃ© dÃ©taillÃ©s avec exemples de code.',
    inputSchema: ANALYZE_REQUIREMENT_ARGS,
    validator: z.object(ANALYZE_REQUIREMENT_ARGS),
    parameters: [
      { name: 'requirementId', type: 'string', required: false, description: 'ID ASVS (ex: V2.1.1)' },
      { name: 'requirement', type: 'string', required: true, description: 'Texte de l\'exigence Ã  analyser' },
      { name: 'context', type: 'string', required: false, description: 'Contexte/catÃ©gorie de sÃ©curitÃ©' },
      { name: 'code', type: 'string', required: false, description: 'Snippet de code optionnel' }
    ],
    exampleArgs: {
      requirementId: 'V2.1.1',
      requirement: 'Verify that user-set passwords are at least 12 characters in length.',
      context: 'Authentication',
      code: 'if (password.length < 8) throw new Error("Weak password");'
    }
  },
  scan_code: {
    description: 'Analyse un snippet de code pour dÃ©tecter des vulnÃ©rabilitÃ©s de sÃ©curitÃ© selon OWASP ASVS.',
    inputSchema: SCAN_CODE_ARGS,
    validator: z.object(SCAN_CODE_ARGS),
    parameters: [
      { name: 'code', type: 'string', required: true, description: 'Code source Ã  auditer' },
      { name: 'language', type: 'string', required: true, description: 'Langage du code' },
      { name: 'requirementId', type: 'string', required: false, description: 'ID ASVS optionnel' }
    ],
    exampleArgs: {
      code: "const query = \"SELECT * FROM users WHERE email = 'test@example.com'\";",
      language: 'javascript',
      requirementId: 'V5.3.2'
    }
  },
  chat: {
    description: 'Chat IA contextuel avec historique de conversation.',
    inputSchema: CHAT_ARGS,
    validator: z.object(CHAT_ARGS),
    parameters: [
      { name: 'message', type: 'string', required: true, description: 'Message utilisateur' },
      { name: 'history', type: 'array', required: false, description: 'Historique [{ role, text }]' },
      { name: 'fastMode', type: 'boolean', required: false, description: 'Mode reponse rapide' }
    ],
    exampleArgs: {
      message: 'Explique SQL Injection simplement.',
      history: [
        { role: 'user', text: 'Bonjour' },
        { role: 'model', text: 'Bonjour, comment puis-je aider ?' }
      ],
      fastMode: true
    }
  },
  get_security_info: {
    description: 'Obtient des informations de sÃ©curitÃ© sur un CWE ou un sujet donnÃ©.',
    inputSchema: GET_SECURITY_INFO_ARGS,
    validator: z.object(GET_SECURITY_INFO_ARGS).refine(
      d => !!(d.cwe || d.topic),
      { message: 'Au moins un des champs cwe ou topic est requis.' }
    ),
    parameters: [
      { name: 'cwe', type: 'string', required: false, description: 'NumÃ©ro CWE (ex: 79)' },
      { name: 'topic', type: 'string', required: false, description: 'Sujet libre (ex: CSRF)' }
    ],
    exampleArgs: { cwe: '79' }
  },
  scan_repository: {
    description: 'Scanne un repository GitHub complet pour detecter les vulnerabilites OWASP ASVS.',
    inputSchema: SCAN_REPOSITORY_ARGS,
    validator: z.object(SCAN_REPOSITORY_ARGS),
    parameters: [
      { name: 'repoUrl', type: 'string', required: true, description: 'Lien GitHub du repository a auditer' },
      { name: 'branch', type: 'string', required: false, description: 'Branche a scanner (defaut: branche par defaut)' },
      { name: 'maxFiles', type: 'number', required: false, description: 'Nombre max de fichiers analyses (5-120)' },
      { name: 'maxCharsPerFile', type: 'number', required: false, description: 'Taille max retenue par fichier (200-12000)' }
    ],
    exampleArgs: {
      repoUrl: 'https://github.com/OWASP/NodeGoat',
      branch: 'main',
      maxFiles: 40
    }
  }
};

function createHttpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function getMcpToolCatalog() {
  return Object.entries(MCP_TOOL_DEFS).map(([name, def]) => ({
    name,
    description: def.description,
    parameters: def.parameters,
    exampleArgs: def.exampleArgs
  }));
}

async function executeMcpTool(toolName, args = {}, user = null) {
  const canonicalToolName = toolName === 'scan-repository' ? 'scan_repository' : toolName;
  const def = MCP_TOOL_DEFS[canonicalToolName];
  if (!def) {
    throw createHttpError(404, `Outil MCP inconnu: ${toolName}`);
  }

  const parsed = def.validator.safeParse(args);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map(issue => `${issue.path.join('.') || 'root'}: ${issue.message}`)
      .join(' | ');
    throw createHttpError(400, `ParamÃ¨tres invalides: ${details}`);
  }

  if (canonicalToolName === 'analyze_requirement') {
    return await mcpAnalyzeRequirement(parsed.data);
  }

  if (canonicalToolName === 'scan_code') {
    return await mcpScanCode(parsed.data.code, parsed.data.language, parsed.data.requirementId);
  }

  if (canonicalToolName === 'chat') {
    const actor = user || { username: 'Utilisateur', role: 'user' };
    return await mcpChat(parsed.data.message, parsed.data.history || [], actor, { fastMode: !!parsed.data.fastMode });
  }

  if (canonicalToolName === 'get_security_info') {
    return await mcpGetSecurityInfo(parsed.data.cwe, parsed.data.topic);
  }

  if (canonicalToolName === 'scan_repository') {
    return await mcpScanRepository(parsed.data);
  }

  throw createHttpError(500, `Tool MCP non implÃ©mentÃ©: ${toolName}`);
}

// â”€â”€â”€ MCP TOOLS VIA REST API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Ces endpoints exposent les outils MCP via HTTP pour Angular

// POST /api/mcp/analyze
app.post('/api/mcp/analyze', requireAuth, async (req, res) => {
  try {
    const { requirementId, requirement, context, code } = req.body || {};
    const result = await executeMcpTool(
      'analyze_requirement',
      { requirementId, requirement, context, code },
      req.user
    );
    res.json({ result });

  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('MCP analyze error:', err);
    res.status(status).json({ error: err.message || 'Erreur lors de l\'analyse MCP.' });
  }
});

// POST /api/mcp/chat
app.post('/api/mcp/chat', requireAuth, async (req, res) => {
  try {
    const { message, history = [], fastMode = false } = req.body || {};
    const result = await executeMcpTool('chat', { message, history, fastMode }, req.user);
    res.json({ result });

  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Erreur chat MCP.' });
  }
});

// POST /api/mcp/scan-code
app.post('/api/mcp/scan-code', requireAuth, async (req, res) => {
  try {
    const { code, language, requirementId } = req.body || {};
    const result = await executeMcpTool('scan_code', { code, language, requirementId }, req.user);
    res.json({ result });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Erreur scan code MCP.' });
  }
});

// POST /api/mcp/scan-repository
app.post('/api/mcp/scan-repository', requireAuth, async (req, res) => {
  try {
    const { repoUrl, branch, maxFiles, maxCharsPerFile } = req.body || {};
    const result = await executeMcpTool(
      'scan_repository',
      { repoUrl, branch, maxFiles, maxCharsPerFile },
      req.user
    );
    res.json({ result });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Erreur scan repository MCP.' });
  }
});

// POST /api/mcp/public/scan-repository
// Public entrypoint for repository scan when frontend is in local session mode.
app.post('/api/mcp/public/scan-repository', async (req, res) => {
  try {
    const { repoUrl, branch, maxFiles, maxCharsPerFile } = req.body || {};
    const result = await executeMcpTool(
      'scan_repository',
      { repoUrl, branch, maxFiles, maxCharsPerFile },
      null
    );
    res.json({ result });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Erreur scan repository MCP (public).' });
  }
});

// GET /api/mcp/tools
app.get('/api/mcp/tools', requireAuth, (req, res) => {
  res.json({
    status: 'active',
    tools: getMcpToolCatalog()
  });
});

// POST /api/mcp/execute
app.post('/api/mcp/execute', requireAuth, async (req, res) => {
  try {
    const { tool, args = {} } = req.body || {};
    if (!tool || typeof tool !== 'string') {
      return res.status(400).json({ error: 'Champ tool requis.' });
    }
    const result = await executeMcpTool(tool, args, req.user);
    res.json({ tool, result, executedAt: new Date().toISOString() });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('MCP execute error:', err);
    res.status(status).json({ error: err.message || 'Erreur exÃ©cution MCP.' });
  }
});

// GET /api/mcp/execute
// Some clients or manual browser checks hit this endpoint with GET.
// Return a clear contract message instead of Express "Cannot GET".
app.get('/api/mcp/execute', requireAuth, (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Use POST /api/mcp/execute with JSON body: { "tool": "...", "args": { ... } }'
  });
});

// GET /api/mcp/status
app.get('/api/mcp/status', requireAuth, (req, res) => {
  res.json({
    status: 'active',
    tools: Object.keys(MCP_TOOL_DEFS),
    version: '1.0.0',
    model: 'gemini-2.5-flash'
  });
});

// â”€â”€â”€ HEALTH CHECK â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: { auth: 'active', mcp: 'active', rateLimit: 'active' }
  });
});

// â”€â”€â”€ MCP SERVER (Model Context Protocol) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const mcpServer = new McpServer({
  name: 'asvs-security-server',
  version: '1.0.0'
});

// Outil 1 : Analyser une exigence ASVS
mcpServer.tool(
  'analyze_requirement',
  MCP_TOOL_DEFS.analyze_requirement.description,
  ANALYZE_REQUIREMENT_ARGS,
  async ({ requirementId, requirement, context, code }) => {
    const result = await executeMcpTool('analyze_requirement', { requirementId, requirement, context, code });
    return { content: [{ type: 'text', text: result }] };
  }
);

// Outil 2 : Scan de code pour vulnÃ©rabilitÃ©s
mcpServer.tool(
  'scan_code',
  MCP_TOOL_DEFS.scan_code.description,
  SCAN_CODE_ARGS,
  async ({ code, language, requirementId }) => {
    const result = await executeMcpTool('scan_code', { code, language, requirementId });
    return { content: [{ type: 'text', text: result }] };
  }
);

// Outil 3 : Chat contextuel de sÃ©curitÃ©
mcpServer.tool(
  'chat',
  MCP_TOOL_DEFS.chat.description,
  CHAT_ARGS,
  async ({ message, history = [], fastMode = false }) => {
    const result = await executeMcpTool('chat', { message, history, fastMode });
    return { content: [{ type: 'text', text: result }] };
  }
);

// Outil 4 : Recherche CVE / CWE
mcpServer.tool(
  'get_security_info',
  MCP_TOOL_DEFS.get_security_info.description,
  GET_SECURITY_INFO_ARGS,
  async ({ cwe, topic }) => {
    const result = await executeMcpTool('get_security_info', { cwe, topic });
    return { content: [{ type: 'text', text: result }] };
  }
);

// Outil 5 : Scan d'un repository GitHub complet
mcpServer.tool(
  'scan_repository',
  MCP_TOOL_DEFS.scan_repository.description,
  SCAN_REPOSITORY_ARGS,
  async ({ repoUrl, branch, maxFiles, maxCharsPerFile }) => {
    const result = await executeMcpTool(
      'scan_repository',
      { repoUrl, branch, maxFiles, maxCharsPerFile }
    );
    return { content: [{ type: 'text', text: result }] };
  }
);

// â”€â”€â”€ MCP BUSINESS LOGIC â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function mcpAnalyzeRequirement({ requirementId, requirement, context, code }) {
  const codeSection = code
    ? `\n\n**Code soumis a analyser :**\n\`\`\`\n${code}\n\`\`\``
    : '';

  const prompt = `Tu es un expert en cybersecurite specialise OWASP ASVS. Reponds en francais.
Regles obligatoires:
- Commence directement par la reponse, sans salutation.
- N'ecris jamais "En tant qu'expert" ou une formule similaire.
- Ne melange pas avec d'autres exigences non mentionnees.
- Reponse complete: ne laisse pas de phrase inachevee.

**Exigence ASVS :** ${requirementId || 'N/A'}
**Categorie :** ${context || 'Securite generale'}
**Description :** ${requirement}
${codeSection}

Fournis une analyse complete :

## Explication Simple
Ce que signifie cette exigence en pratique.

## Risques de Securite
Vulnerabilites et attaques que cela previent (avec CWE/CVE si pertinent).

## Guide d'Implementation
Etapes concretes pour implementer cette exigence.

## Exemple de Code
Snippet JavaScript/TypeScript/Node.js pret a l'emploi.

## Comment Tester
Comment verifier que l'exigence est correctement implementee.

## Outils Recommandes
Bibliotheques et frameworks utiles.`;

  return await callGemini(prompt, {
    temperature: 0.25,
    maxOutputTokens: 4600,
    requireCode: true
  });
}

async function mcpScanCode(code, language, requirementId) {
  const prompt = `Tu es un auditeur de securite expert. Analyse ce code ${language} pour des vulnerabilites OWASP ASVS. Reponds en francais.
Regles obligatoires:
- Commence directement par l'analyse, sans salutation.
- N'ecris jamais "En tant qu'expert" ou une formule similaire.
- Reponse complete, avec code corrige exploitable.

\`\`\`${language}
${code}
\`\`\`

${requirementId ? `Contexte ASVS : ${requirementId}` : ''}

## Analyse de Vulnerabilites

Pour chaque probleme trouve :
- **Severite** : Critique / Haute / Moyenne / Faible
- **Type** : Nom CWE
- **Ligne** : Numero de ligne concernee
- **Description** : Ce qui est vulnerable et pourquoi
- **Correction** : Code corrige

## Points Positifs
Ce qui est bien fait.

## Score de Securite
Note globale /10 avec justification.`;

  return await callGemini(prompt, {
    temperature: 0.2,
    maxOutputTokens: 4600,
    requireCode: true
  });
}

async function mcpChat(message, history, user, options = {}) {
  const fastMode = !!options.fastMode;
  const systemPrompt = `Tu es un assistant IA expert en cybersecurite OWASP ASVS pour la plateforme ASVS Security.
Reponds toujours en francais.
Regles obligatoires:
- Commence directement par la reponse, sans "Bonjour" ni salutation nominative.
- N'ecris jamais "En tant qu'expert" ou "En tant qu'auditeur".
- Reponds strictement a la DERNIERE question utilisateur.
- N'utilise l'historique que s'il est explicitement pertinent.
- Ne laisse aucune phrase inachevee.
- Si la question est technique, donne au moins un exemple de code concret et copiable.
- Termine par "Verification rapide" avec 1 a 3 checks concrets.
${fastMode
      ? 'Mode rapide actif: reponse concise mais complete (8 a 14 lignes), avec points cles et action immediate.'
      : 'Mode detaille: structure markdown claire avec sections, exemples concrets et tests de verification.'}`;

  const historyText = history.slice(fastMode ? -4 : -6)
    .map(m => `${m.role === 'user' ? 'Utilisateur' : 'Assistant'}: ${m.text}`)
    .join('\n');

  const prompt = `${systemPrompt}\n\n${historyText ? `Historique:\n${historyText}\n\n` : ''}Utilisateur: ${message}`;

  return await callGemini(prompt, {
    temperature: fastMode ? 0.2 : 0.35,
    maxOutputTokens: fastMode ? 2000 : 4600,
    requireCode: true
  });
}
async function mcpGetSecurityInfo(cwe, topic) {
  const query = cwe ? `CWE-${cwe}` : topic;
  return await callGemini(
    `Fournis une analyse de securite complete sur ${query} :
    - Description de la vulnerabilite
    - Impact et severite CVSS
    - Exemples d'attaques reels (CVE connus)
    - Methodes de prevention avec code
    - Lien avec OWASP ASVS
    Reponds en francais.`,
    { temperature: 0.2, maxOutputTokens: 3200, requireCode: true }
  );
}

function normalizeGithubRepoUrl(input = '') {
  let raw = String(input || '').trim();
  if (!raw) {
    throw createHttpError(400, 'Champ repoUrl requis.');
  }

  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(raw)) {
    raw = `https://github.com/${raw}`;
  }
  if (raw.startsWith('git@github.com:')) {
    raw = `https://github.com/${raw.slice('git@github.com:'.length)}`;
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw createHttpError(400, 'URL GitHub invalide. Exemple: https://github.com/owner/repo');
  }

  const host = String(parsed.hostname || '').toLowerCase();
  if (host !== 'github.com' && host !== 'www.github.com') {
    throw createHttpError(400, 'Seuls les liens github.com sont supportes.');
  }

  const parts = parsed.pathname.replace(/^\/+|\/+$/g, '').split('/');
  if (parts.length < 2) {
    throw createHttpError(400, 'Lien GitHub invalide. Format attendu: github.com/owner/repo');
  }

  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, '');
  if (!owner || !repo) {
    throw createHttpError(400, 'Lien GitHub invalide. Owner/repo manquant.');
  }
  return `https://github.com/${owner}/${repo}.git`;
}

function normalizeBranch(branch) {
  const b = String(branch || '').trim();
  if (!b) return '';
  if (!/^[A-Za-z0-9._\/-]{1,120}$/.test(b)) {
    throw createHttpError(400, 'Nom de branche invalide.');
  }
  return b;
}

function shouldIncludeRepoFile(filePath) {
  const ext = path.extname(filePath || '').toLowerCase();
  return REPO_ALLOWED_EXTENSIONS.has(ext);
}

function extractGithubOwnerRepo(normalizedRepoUrl) {
  const match = String(normalizedRepoUrl || '').match(/^https:\/\/github\.com\/([^/]+)\/([^/.]+)(?:\.git)?$/i);
  if (!match?.[1] || !match?.[2]) {
    throw createHttpError(400, 'Lien GitHub invalide. Format attendu: github.com/owner/repo');
  }
  return {
    owner: match[1],
    repo: match[2]
  };
}

function shouldIgnoreRepoPath(filePath) {
  const segments = String(filePath || '').split('/');
  return segments.some(segment => REPO_IGNORED_DIRS.has(segment));
}

function getGithubApiHeaders() {
  const headers = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'asvs-security-mcp'
  };
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function detectDefaultBranchFromGithubPage(owner, repo) {
  const res = await fetch(`https://github.com/${owner}/${repo}`, {
    headers: { 'User-Agent': 'asvs-security-mcp' }
  });
  if (!res.ok) return '';
  const html = await res.text();
  const m1 = html.match(/"defaultBranch":"([^"]+)"/i);
  if (m1?.[1]) return m1[1].trim();
  const m2 = html.match(/"defaultBranchRef"\s*:\s*\{\s*"name"\s*:\s*"([^"]+)"/i);
  if (m2?.[1]) return m2[1].trim();
  return '';
}

async function githubApiGetJson(url) {
  const res = await fetch(url, { headers: getGithubApiHeaders() });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { }

  if (!res.ok) {
    const detail = String(data?.message || text || `HTTP ${res.status}`).trim();
    if (res.status === 403 && String(res.headers.get('x-ratelimit-remaining') || '') === '0') {
      throw createHttpError(429, 'GitHub API rate limit atteint. Reessayez plus tard ou configurez GITHUB_TOKEN.');
    }
    throw createHttpError(res.status, `GitHub API: ${detail}`);
  }

  return data;
}

async function collectRepositoryFilesViaGithubZip(
  normalizedRepoUrl,
  normalizedBranch,
  maxFiles = 40,
  maxCharsPerFile = 6000,
  tempRoot = ''
) {
  const { owner, repo } = extractGithubOwnerRepo(normalizedRepoUrl);
  const candidates = [];
  if (normalizedBranch) {
    candidates.push(normalizedBranch);
  } else {
    const detected = await detectDefaultBranchFromGithubPage(owner, repo).catch(() => '');
    if (detected) candidates.push(detected);
    candidates.push('main', 'master');
  }

  const uniqueCandidates = [];
  const seen = new Set();
  for (const c of candidates) {
    const branch = String(c || '').trim();
    if (!branch || seen.has(branch)) continue;
    seen.add(branch);
    uniqueCandidates.push(branch);
  }

  if (!uniqueCandidates.length) {
    return { files: [], effectiveBranch: normalizedBranch || '' };
  }

  const zipRoot = path.join(tempRoot || os.tmpdir(), 'zip-fallback');
  await rm(zipRoot, { recursive: true, force: true }).catch(() => { });
  await mkdir(zipRoot, { recursive: true });

  for (const candidateBranch of uniqueCandidates) {
    const zipUrl = `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${encodeURIComponent(candidateBranch)}`;
    let res;
    try {
      res = await fetch(zipUrl, { headers: { 'User-Agent': 'asvs-security-mcp' } });
    } catch {
      continue;
    }
    if (!res.ok) continue;

    let bytes;
    try {
      bytes = Buffer.from(await res.arrayBuffer());
    } catch {
      continue;
    }
    if (!bytes.length) continue;

    const zipPath = path.join(zipRoot, `${repo}-${candidateBranch}.zip`);
    const extractDir = path.join(zipRoot, `${repo}-${candidateBranch}-extract`);

    await rm(extractDir, { recursive: true, force: true }).catch(() => { });
    await writeFile(zipPath, bytes);

    const safeZipPath = zipPath.replace(/'/g, "''");
    const safeExtractPath = extractDir.replace(/'/g, "''");
    try {
      await execFileAsync(
        'powershell.exe',
        [
          '-NoProfile',
          '-Command',
          `Expand-Archive -LiteralPath '${safeZipPath}' -DestinationPath '${safeExtractPath}' -Force`
        ],
        { timeout: 240000, maxBuffer: 10 * 1024 * 1024 }
      );
    } catch {
      continue;
    }

    let extractedEntries = [];
    try {
      extractedEntries = await readdir(extractDir, { withFileTypes: true });
    } catch {
      continue;
    }
    const repoFolder = extractedEntries.find(entry => entry.isDirectory());
    if (!repoFolder) continue;

    const extractedRepoRoot = path.join(extractDir, repoFolder.name);
    const files = await collectRepositoryFiles(extractedRepoRoot, maxFiles, maxCharsPerFile);
    if (!files.length) continue;

    return {
      files,
      effectiveBranch: candidateBranch
    };
  }

  return { files: [], effectiveBranch: normalizedBranch || '' };
}

async function collectRepositoryFilesViaGithubApi(normalizedRepoUrl, normalizedBranch, maxFiles = 40, maxCharsPerFile = 6000) {
  const { owner, repo } = extractGithubOwnerRepo(normalizedRepoUrl);

  let repoInfo;
  try {
    repoInfo = await githubApiGetJson(`https://api.github.com/repos/${owner}/${repo}`);
  } catch (e) {
    const msg = String(e?.message || e || '').toLowerCase();
    if (msg.includes('404') || msg.includes('not found')) {
      throw createHttpError(400, 'Repository GitHub introuvable ou inaccessible.');
    }
    throw e;
  }

  const targetRef = normalizedBranch || String(repoInfo?.default_branch || '').trim();
  if (!targetRef) {
    throw createHttpError(400, 'Impossible de determiner la branche du repository.');
  }

  let treeData;
  try {
    treeData = await githubApiGetJson(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(targetRef)}?recursive=1`
    );
  } catch (e) {
    const msg = String(e?.message || e || '').toLowerCase();
    if (msg.includes('404') || msg.includes('not found')) {
      throw createHttpError(400, `Branche introuvable: ${targetRef}`);
    }
    throw e;
  }

  const tree = Array.isArray(treeData?.tree) ? treeData.tree : [];
  const candidates = tree
    .filter(item => item?.type === 'blob' && typeof item?.path === 'string')
    .map(item => ({ path: item.path, size: Number(item.size || 0) }))
    .filter(item => !shouldIgnoreRepoPath(item.path))
    .filter(item => shouldIncludeRepoFile(item.path))
    .filter(item => item.size > 0 && item.size <= 300000)
    .sort((a, b) => a.path.localeCompare(b.path))
    .slice(0, maxFiles);

  const files = [];
  for (const item of candidates) {
    const encodedPath = item.path.split('/').map(segment => encodeURIComponent(segment)).join('/');
    try {
      const fileData = await githubApiGetJson(
        `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(targetRef)}`
      );
      if (!fileData?.content || fileData?.encoding !== 'base64') continue;
      const decoded = Buffer.from(String(fileData.content).replace(/\n/g, ''), 'base64').toString('utf8');
      if (!decoded.trim()) continue;
      files.push({
        path: item.path,
        content: decoded.slice(0, maxCharsPerFile)
      });
    } catch {
      continue;
    }
    if (files.length >= maxFiles) break;
  }

  return {
    files,
    effectiveBranch: targetRef
  };
}

async function collectRepositoryFiles(rootDir, maxFiles = 40, maxCharsPerFile = 6000) {
  const files = [];
  const stack = [rootDir];

  while (stack.length > 0 && files.length < maxFiles) {
    const current = stack.pop();
    if (!current) continue;

    let entries = [];
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (files.length >= maxFiles) break;
      const full = path.join(current, entry.name);
      const relative = path.relative(rootDir, full).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        if (!REPO_IGNORED_DIRS.has(entry.name)) {
          stack.push(full);
        }
        continue;
      }

      if (!entry.isFile() || !shouldIncludeRepoFile(relative)) continue;

      let st;
      try {
        st = await stat(full);
      } catch {
        continue;
      }
      if (!st || st.size <= 0 || st.size > 300000) continue;

      let content = '';
      try {
        content = await readFile(full, 'utf8');
      } catch {
        continue;
      }
      if (!content.trim()) continue;

      files.push({
        path: relative,
        content: content.slice(0, maxCharsPerFile)
      });
    }
  }

  return files;
}

async function mcpScanRepository({ repoUrl, branch, maxFiles, maxCharsPerFile }) {
  const normalizedRepoUrl = normalizeGithubRepoUrl(repoUrl);
  let normalizedBranch = normalizeBranch(branch);
  const effectiveMaxFiles = Number.isInteger(maxFiles) ? maxFiles : 40;
  const effectiveMaxChars = Number.isInteger(maxCharsPerFile) ? maxCharsPerFile : 6000;

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'asvs-mcp-repo-'));
  const repoDir = path.join(tempRoot, 'repo');
  let files = [];
  let sourceMode = 'git clone';

  try {
    const cloneArgs = ['clone', '--depth', '1'];
    if (normalizedBranch) {
      cloneArgs.push('--branch', normalizedBranch, '--single-branch');
    }
    cloneArgs.push(normalizedRepoUrl, repoDir);

    try {
      await execFileAsync('git', cloneArgs, { timeout: 120000, maxBuffer: 10 * 1024 * 1024 });
    } catch (e) {
      const msg = String(e?.stderr || e?.message || e || '').trim();
      if (/repository not found|could not read from remote repository|authentication failed/i.test(msg)) {
        throw createHttpError(400, 'Impossible d acceder au repository. Verifiez le lien ou les droits.');
      }
      if (/not recognized|not found|enoent|spawn git/i.test(msg)) {
        try {
          const zipFallback = await collectRepositoryFilesViaGithubZip(
            normalizedRepoUrl,
            normalizedBranch,
            effectiveMaxFiles,
            effectiveMaxChars,
            tempRoot
          );
          files = zipFallback.files;
          normalizedBranch = zipFallback.effectiveBranch || normalizedBranch;
          if (files.length) {
            sourceMode = 'GitHub ZIP (fallback sans git)';
          }
        } catch { }

        if (files.length) {
          // Zip fallback succeeded, skip GitHub API path.
        } else {
          try {
            const apiFallback = await collectRepositoryFilesViaGithubApi(
              normalizedRepoUrl,
              normalizedBranch,
              effectiveMaxFiles,
              effectiveMaxChars
            );
            files = apiFallback.files;
            normalizedBranch = apiFallback.effectiveBranch;
            sourceMode = 'GitHub API (fallback sans git)';
          } catch (fallbackErr) {
            const fallbackMsg = String(fallbackErr?.message || fallbackErr || '');
            if (String(fallbackErr?.status || '').trim() === '429' || /rate limit/i.test(fallbackMsg)) {
              return [
                '## Scan Repository (Fallback infrastructure)',
                `- Lien: ${normalizedRepoUrl.replace(/\\.git$/i, '')}`,
                `- Branche demandee: ${normalizedBranch || 'default'}`,
                '- Statut: impossible de recuperer les fichiers (Git absent + GitHub API limitee).',
                '',
                '## Action pour debloquer',
                '1. Installez Git for Windows puis redemarrez le backend.',
                '2. Ou configurez GITHUB_TOKEN dans l environnement backend.',
                '',
                '## Controles manuels immediats',
                '1. Cherchez secrets/tokens dans le repository (fichiers .env, config, historiques).',
                '2. Verifiez les routes sensibles (authn/authz) et la validation d entrees.',
                '3. Verifiez les requetes SQL pour eviter la concatenation.',
                '4. Ajoutez des tests de securite negatifs dans CI.'
              ].join('\\n');
            }
            throw fallbackErr;
          }
        }
      } else {
        throw createHttpError(400, `Echec du clone GitHub: ${msg || 'erreur git.'}`);
      }
    }

    if (!files.length) {
      files = await collectRepositoryFiles(repoDir, effectiveMaxFiles, effectiveMaxChars);
    }
    if (!files.length) {
      return 'Aucun fichier scannable trouve dans ce repository (extensions non supportees ou contenu vide).';
    }

    const snippets = [];
    let totalChars = 0;
    for (const f of files) {
      const block = `### FILE: ${f.path}\n\`\`\`\n${f.content}\n\`\`\``;
      if (totalChars + block.length > 140000) break;
      snippets.push(block);
      totalChars += block.length;
    }

    const prompt = `Tu es auditeur senior OWASP ASVS. Analyse ce repository GitHub et reponds en francais.
Regles obligatoires:
- Reponse complete et exploitable.
- Pas de salutation.
- Inclure des correctifs avec code copiable.

Repository: ${normalizedRepoUrl.replace(/\.git$/i, '')}
Branche: ${normalizedBranch || 'default'}
Fichiers analyses: ${snippets.length}

Contenu du repository:
${snippets.join('\n\n')}

Format attendu:
## Resume Executif
## Vulnerabilites Critiques (avec chemins de fichiers)
## Correctifs Prioritaires
## Exemple de Patch/Code Corrige (copiable)
## Plan d Actions (48h / 7j / 30j)`;

    let aiResult = '';
    try {
      aiResult = await callGemini(prompt, {
        temperature: 0.2,
        maxOutputTokens: 4600,
        requireCode: true,
        contextHint: `repository scan ${normalizedRepoUrl}`
      });
    } catch (e) {
      const msg = String(e?.message || e || '').toLowerCase();
      if (msg.includes('quota gemini') || msg.includes('rate limit') || msg.includes('resource_exhausted')) {
        const listedFiles = files.slice(0, 20).map(f => `- ${f.path}`).join('\n');
        return [
          '## Scan Repository (Fallback sans IA)',
          `- Lien: ${normalizedRepoUrl.replace(/\.git$/i, '')}`,
          `- Branche: ${normalizedBranch || 'default'}`,
          `- Source: ${sourceMode}`,
          `- Fichiers analyses: ${snippets.length}`,
          '',
          'Gemini est temporairement indisponible (quota/rate limit). Voici un rapport de secours base sur les fichiers collectes.',
          '',
          '## Fichiers inspectes (extrait)',
          listedFiles || '- Aucun fichier',
          '',
          '## Verification manuelle prioritaire',
          '1. Recherche de concatenation SQL et remplacez par requetes parametrees.',
          '2. Verifiez authn/authz sur les routes API sensibles.',
          '3. Controlez validation stricte des entrees (taille, type, allowlist).',
          '4. Verifiez secrets/tokens dans le code et historiques Git.',
          '5. Ajoutez tests de securite automatiques sur les cas negatifs.'
        ].join('\n');
      }
      throw e;
    }

    return `## Scan Repository\n- Lien: ${normalizedRepoUrl.replace(/\.git$/i, '')}\n- Branche: ${normalizedBranch || 'default'}\n- Source: ${sourceMode}\n- Fichiers analyses: ${snippets.length}\n\n${aiResult}`;
  } finally {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => { });
  }
}

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];

function extractRetrySeconds(text = '') {
  const m1 = text.match(/retry in\s+([\d.]+)s/i);
  if (m1?.[1]) return Math.max(1, Math.ceil(Number(m1[1])));
  const m2 = text.match(/"retryDelay":"(\d+)s"/i);
  if (m2?.[1]) return Math.max(1, Number(m2[1]));
  return null;
}

function isQuotaLikeError(status, message = '') {
  const msg = String(message || '').toLowerCase();
  return status === 429
    || msg.includes('resource_exhausted')
    || msg.includes('quota exceeded')
    || msg.includes('rate limit');
}

function isDailyQuotaLikeError(message = '') {
  const msg = String(message || '').toLowerCase();
  return msg.includes('perday')
    || msg.includes('per day')
    || msg.includes('requestsperday')
    || msg.includes('requests per day');
}

function shouldTryNextGeminiModel(status, message = '') {
  const msg = String(message || '').toLowerCase();
  return isQuotaLikeError(status, msg)
    || status === 404
    || status === 400
    || status === 403
    || msg.includes('unsupported model')
    || msg.includes('not found')
    || msg.includes('invalid argument')
    || msg.includes('permission denied');
}

function formatGeminiError(status, details = '') {
  if (isQuotaLikeError(status, details)) {
    if (isDailyQuotaLikeError(details)) {
      return 'Quota Gemini atteint (limite journaliere). Ajoutez un plan payant/API key ou reessayez demain.';
    }
    const retry = extractRetrySeconds(details);
    if (retry) return `Quota Gemini atteint. Reessayez dans ${retry}s.`;
    return 'Quota Gemini atteint. Reessayez plus tard ou changez de modele/API key.';
  }
  return `Gemini API error: ${details || `HTTP ${status}`}`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function hasCodeBlock(text = '') {
  return /```[\s\S]*?```/.test(String(text || ''));
}

function closeOpenCodeFence(text = '') {
  const t = String(text || '').trim();
  if (!t) return '';
  const fences = (t.match(/```/g) || []).length;
  if (fences % 2 === 1) return `${t}\n\`\`\``;
  return t;
}

function looksLikeErrorText(text = '') {
  const t = String(text || '').toLowerCase().trim();
  return t.startsWith('quota gemini')
    || t.startsWith('gemini api error')
    || t.startsWith('reponse bloquee')
    || t.startsWith('aucune reponse recue');
}

function looksTruncatedResponse(text = '', finishReason = '') {
  const t = String(text || '').trim();
  if (!t) return true;
  if (String(finishReason || '').toUpperCase() === 'MAX_TOKENS') return true;
  if ((t.match(/```/g) || []).length % 2 === 1) return true;

  const tail = t.slice(-200);
  if (/[,:;\-\/]\s*$/.test(tail)) return true;
  if (/(?:\b(et|ou|mais|donc|car|de|du|des|la|le|les|dans|avec|pour|par|sur|a|au|aux|to|and|or|but|because|with|for|in)\s*)$/i.test(tail)) return true;

  const lastChar = t.slice(-1);
  if (!/[.!?`}>\]\)]/.test(lastChar) && t.length > 80) return true;

  return false;
}

function mergeContinuation(base = '', continuation = '') {
  const a = String(base || '').trim();
  const b = String(continuation || '').trim();
  if (!a) return b;
  if (!b) return a;

  if (a.endsWith(b)) return a;
  const aTail = a.slice(-120).replace(/\s+/g, ' ').trim();
  const bHead = b.slice(0, 120).replace(/\s+/g, ' ').trim();
  if (aTail && bHead && (aTail === bHead || b.startsWith(aTail))) {
    return `${a}\n${b.slice(Math.min(aTail.length, b.length)).trim()}`.trim();
  }

  return `${a}\n${b}`.trim();
}

function buildDefaultCodeSnippet(context = '') {
  const q = String(context || '').toLowerCase();

  if (q.includes('sql') || q.includes('injection')) {
    return [
      "import mysql from 'mysql2/promise';",
      '',
      'async function findUserByEmail(email) {',
      "  const db = await mysql.createConnection({ host: 'localhost', user: 'app', database: 'appdb' });",
      "  const [rows] = await db.execute('SELECT id, email FROM users WHERE email = ?', [email]);",
      '  return rows;',
      '}'
    ].join('\n');
  }

  if (q.includes('session') || q.includes('token')) {
    return [
      "import session from 'express-session';",
      '',
      'app.use(session({',
      "  name: 'sid',",
      "  secret: process.env.SESSION_SECRET || 'change-me',",
      '  resave: false,',
      '  saveUninitialized: false,',
      '  cookie: { httpOnly: true, secure: true, sameSite: "strict", maxAge: 15 * 60 * 1000 }',
      '}));'
    ].join('\n');
  }

  return [
    "import { z } from 'zod';",
    '',
    'const schema = z.object({',
    '  email: z.string().email(),',
    '  password: z.string().min(12)',
    '});',
    '',
    "app.post('/api/login', (req, res) => {",
    '  const parsed = schema.safeParse(req.body);',
    "  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });",
    '  return res.json({ ok: true });',
    '});'
  ].join('\n');
}

function extractGeminiTextAndReason(data) {
  const candidate = data?.candidates?.[0] || {};
  const parts = candidate?.content?.parts;
  const text = Array.isArray(parts)
    ? parts.map(p => p?.text || '').join('').trim()
    : '';
  const finishReason = candidate?.finishReason || '';
  const blockReason = data?.promptFeedback?.blockReason || '';
  return { text, finishReason, blockReason };
}

async function callGemini(prompt, options = {}) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyAjnc-XNbhl6J7CouhG0br9nwjNIfRduSs';
  const temperature = typeof options.temperature === 'number' ? options.temperature : 0.35;
  const maxOutputTokens = typeof options.maxOutputTokens === 'number' ? options.maxOutputTokens : 4096;
  const requireCode = !!options.requireCode;
  const autoContinue = options.autoContinue !== false;
  const contextHint = typeof options.contextHint === 'string'
    ? options.contextHint.slice(0, 800)
    : String(prompt || '').slice(0, 800);

  let lastStatus = 500;
  let lastDetails = 'Aucune reponse Gemini.';

  for (let attempt = 1; attempt <= 2; attempt++) {
    let quotaDetails = null;

    for (let i = 0; i < GEMINI_MODELS.length; i++) {
      const model = GEMINI_MODELS[i];
      const isLastModel = i === GEMINI_MODELS.length - 1;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature, maxOutputTokens }
          })
        }
      );

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        const { text: rawText, finishReason, blockReason } = extractGeminiTextAndReason(data);

        if (blockReason) return `Reponse bloquee (${blockReason}). Reformulez la question.`;

        let text = closeOpenCodeFence(rawText || '');
        if (!text) return 'Aucune reponse recue.';

        if (autoContinue && looksTruncatedResponse(text, finishReason)) {
          const continuationPrompt = `Complete STRICTEMENT la reponse suivante sans repetition.
Contexte: ${contextHint}

Reponse actuelle:
${text}

Regles:
- Continue a partir de la derniere idee.
- Termine proprement toutes les phrases.
- Si une section code est ouverte, ferme-la.
- N'ajoute pas de salutation.

Suite:`;

          const continuation = await callGemini(continuationPrompt, {
            temperature: 0.2,
            maxOutputTokens: Math.min(1800, maxOutputTokens),
            requireCode: false,
            autoContinue: false,
            contextHint
          });

          if (continuation && !looksLikeErrorText(continuation)) {
            text = closeOpenCodeFence(mergeContinuation(text, continuation));
          }
        }

        if (requireCode && !hasCodeBlock(text)) {
          const codePrompt = `Ajoute UNIQUEMENT une section finale markdown nommee "## Exemple de code a copier".
Contexte: ${contextHint}

Reponse actuelle:
${text}

Contraintes:
- Fournis un bloc de code complet entre \`\`\` et \`\`\`.
- Code concret, copiable, sans pseudo-code.
- Pas d'introduction ni de conclusion hors cette section.`;

          const codeAddon = await callGemini(codePrompt, {
            temperature: 0.2,
            maxOutputTokens: 1200,
            requireCode: false,
            autoContinue: false,
            contextHint
          });

          if (codeAddon && !looksLikeErrorText(codeAddon)) {
            text = closeOpenCodeFence(`${text}\n\n${codeAddon.trim()}`);
          }
        }

        if (requireCode && !hasCodeBlock(text)) {
          text = `${text}\n\n## Exemple de code a copier\n\`\`\`typescript\n${buildDefaultCodeSnippet(contextHint)}\n\`\`\``;
        }

        return closeOpenCodeFence(text);
      }

      const details = data?.error?.message || `HTTP ${response.status}`;
      lastStatus = response.status;
      lastDetails = details;
      if (!quotaDetails && isQuotaLikeError(response.status, details)) {
        quotaDetails = details;
      }

      if (!shouldTryNextGeminiModel(response.status, details) || isLastModel) {
        if (!quotaDetails) {
          throw new Error(formatGeminiError(response.status, details));
        }
        break;
      }
    }

    if (!quotaDetails) {
      throw new Error(formatGeminiError(lastStatus, lastDetails));
    }

    if (isDailyQuotaLikeError(quotaDetails)) {
      throw new Error(formatGeminiError(429, quotaDetails));
    }

    const retry = extractRetrySeconds(quotaDetails);
    if (attempt < 2 && retry && retry <= 20) {
      await sleep(retry * 1000);
      continue;
    }

    throw new Error(formatGeminiError(429, quotaDetails));
  }

  throw new Error(formatGeminiError(lastStatus, lastDetails));
}
// â”€â”€â”€ DÃ‰MARRER MCP (stdio transport pour outils CLI) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function startMcpServer() {
  try {
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
    console.log('âœ… MCP Server dÃ©marrÃ© (stdio transport)');
  } catch (err) {
    console.log('â„¹ï¸  MCP stdio non disponible (mode HTTP uniquement)');
  }
}

// â”€â”€â”€ START HTTP SERVER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const httpServer = app.listen(PORT, () => {
  console.log(`ASVS Backend Server active on http://localhost:${PORT}`);
});

httpServer.on('error', async (err) => {
  if (err?.code === 'EADDRINUSE') {
    const alreadyRunning = await fetch(`http://localhost:${PORT}/api/health`, {
      signal: AbortSignal.timeout(1500)
    })
      .then(res => res.ok)
      .catch(() => false);

    if (alreadyRunning) {
      console.log(`Backend already running on http://localhost:${PORT}. No restart needed.`);
      process.exit(0);
      return;
    }

    console.error(`Port ${PORT} is already in use by another process. Stop it then run npm start again.`);
    process.exit(1);
    return;
  }

  console.error('HTTP server error:', err);
  process.exit(1);
});

export default app;
