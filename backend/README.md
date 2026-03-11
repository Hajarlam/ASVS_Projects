# ASVS Backend — MCP + JWT Security Server

## 🚀 Démarrage rapide

```bash
cd backend
npm install
npm start
# → http://localhost:3000
```

## 🔐 Authentification JWT

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/auth/login` | POST | Connexion → retourne JWT |
| `/api/auth/logout` | POST | Déconnexion (révoque token) |
| `/api/auth/me` | GET | Profil utilisateur connecté |
| `/api/auth/refresh` | POST | Renouveler le token |

**Headers requis :**
```
Authorization: Bearer <token>
```

## 👥 Gestion Utilisateurs (Admin)

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/users` | GET | Liste des utilisateurs |
| `/api/users` | POST | Créer un utilisateur |
| `/api/users/:id` | DELETE | Supprimer un utilisateur |
| `/api/users/:id/role` | PUT | Changer le rôle |

## 🤖 MCP Tools via API

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/mcp/analyze` | POST | Analyser une exigence ASVS |
| `/api/mcp/chat` | POST | Chat IA contextuel |
| `/api/mcp/scan-code` | POST | Scanner du code pour vulnérabilités |
| `/api/mcp/status` | GET | Statut des outils MCP |

## 🛡️ Sécurité implémentée

- ✅ **bcrypt** — hachage des mots de passe (salt rounds: 12)
- ✅ **JWT** — tokens signés avec expiration 24h
- ✅ **Rate limiting** — 5 tentatives login / 15 min
- ✅ **Account lockout** — blocage après 5 échecs
- ✅ **Helmet** — headers HTTP sécurisés
- ✅ **Token blacklist** — révocation à la déconnexion
- ✅ **CORS** — origines autorisées configurées
- ✅ **Timing-safe** — délai constant pour éviter énumération users

## 🔧 Variables d'environnement

```env
JWT_SECRET=votre-secret-super-long-et-aleatoire
GEMINI_API_KEY=votre-cle-api-gemini
PORT=3000
```
