# ASVS Security by Design

Application Angular 17 pour tracker les exigences de sécurité OWASP ASVS avec assistance IA via Google Gemini.

## 🚀 Démarrage rapide

### Prérequis
- Node.js 18+
- Angular CLI 17

### Installation

```bash
npm install
```

### Configuration de l'IA (Gemini)

Ouvrez `src/app/services/ai.service.ts` et remplacez la valeur de `apiKey` par votre clé API Google Gemini :

```typescript
private apiKey = 'VOTRE_CLE_API_ICI';
```

Obtenez une clé gratuite sur : https://aistudio.google.com

### Lancement

```bash
npm start
# ou
ng serve
```

L'application sera disponible sur `http://localhost:4200`

## 📁 Structure du projet

```
src/
├── app/
│   ├── components/
│   │   ├── header/          # Header avec recherche et navigation
│   │   └── loading-spinner/ # Composant spinner
│   ├── models/
│   │   └── asvs.models.ts   # Interfaces TypeScript
│   ├── pages/
│   │   ├── dashboard/       # Page principale
│   │   ├── category-view/   # Vue par catégorie
│   │   ├── requirement-view/ # Détail d'une exigence
│   │   ├── search-results/  # Résultats de recherche
│   │   └── about/           # Page à propos
│   ├── services/
│   │   ├── asvs.service.ts  # Service données ASVS
│   │   └── ai.service.ts    # Service Gemini AI
│   ├── app.component.*      # Composant racine
│   ├── app.config.ts        # Configuration Angular
│   └── app.routes.ts        # Routes
├── assets/
│   └── asvs-data.json       # Données ASVS
├── index.html
├── main.ts
└── styles.css
```

## ✨ Fonctionnalités

- 📊 **Dashboard** avec statistiques globales et progression par catégorie
- 🔐 **14 catégories** OWASP ASVS (Authentication, Cryptography, API Security, etc.)
- ✅ **Suivi de progression** — marquer les exigences comme complétées
- 📝 **Notes personnelles** persistées en localStorage
- 🤖 **Assistance Gemini AI** — explication, code, outils recommandés
- 🔍 **Recherche** full-text dans les exigences
- 🎨 **Design dark mode** avec animations fluides

## 🏗️ Build Production

```bash
ng build --configuration production
```

Le build sera dans `dist/asvs-security-app/`
