// ⚠️ Ne jamais mettre de clé API ici en dur.
// La clé Gemini est lue depuis localStorage (clé: 'gemini_api_key').
// Pour définir ta clé : ouvre la console du navigateur et tape :
//   localStorage.setItem('gemini_api_key', 'AIzaSy...')
export const environment = {
  production: false,
  googleAiApiKey: (typeof window !== 'undefined' && localStorage.getItem('gemini_api_key')) || ''
};