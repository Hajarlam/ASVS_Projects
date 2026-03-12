// ✅ Ce fichier est utilisé en développement.
// La clé Gemini est lue dynamiquement depuis localStorage à chaque appel dans ai.service.ts.
// Pour définir votre clé, ouvrez la console du navigateur (F12) et tapez :
//   localStorage.setItem('gemini_api_key', 'AIzaSy...')
// Puis rechargez la page.

export const environment = {
  production: false,
  // Retourne la clé depuis localStorage au moment de la lecture du module.
  // ai.service.ts relit localStorage en direct à chaque appel (pas besoin de recharger la page).
  googleAiApiKey: (typeof window !== 'undefined' ? localStorage.getItem('gemini_api_key') ?? '' : '')
};