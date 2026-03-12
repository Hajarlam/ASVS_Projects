// ✅ Ce fichier est utilisé en production (ng build --configuration production).
// Identique à environment.ts — la clé vient toujours de localStorage.
export const environment = {
  production: true,
  googleAiApiKey: (typeof window !== 'undefined' ? localStorage.getItem('gemini_api_key') ?? '' : '')
};