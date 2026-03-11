export const environment = {
  production: true,
  googleAiApiKey: (typeof window !== 'undefined' && localStorage.getItem('gemini_api_key')) || ''
};