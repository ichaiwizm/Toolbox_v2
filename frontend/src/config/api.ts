// Configuration de l'API
const API_CONFIG = {
  // En développement, utiliser le port backend direct
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:9000',
  
  // Préfixe des routes API
  API_PREFIX: '/api/v1',
  
  // Timeout par défaut
  TIMEOUT: 30000,
  
  // Headers par défaut
  DEFAULT_HEADERS: {
    'Content-Type': 'application/json'
  }
} as const;

// Construction des URLs complètes
export const API_URLS = {
  // Routes copy existantes
  COPY: {
    SCAN: `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/copy/advanced/scan`,
    FORMAT_CONTENT: `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/copy/advanced/format-content`,
    HEALTH: `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/copy/health`
  }
} as const;

// Helper pour les appels API avec configuration commune
export const apiRequest = async (url: string, options: RequestInit = {}) => {
  const config: RequestInit = {
    ...options,
    headers: {
      ...API_CONFIG.DEFAULT_HEADERS,
      ...options.headers
    }
  };

  // Ajouter timeout si AbortController n'est pas déjà utilisé
  if (!options.signal) {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);
    config.signal = controller.signal;
  }

  const response = await fetch(url, config);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Erreur inconnue' }));
    
    // Créer une erreur avec plus d'informations
    const error = new Error(errorData.message || `HTTP ${response.status}`) as any;
    (error as any).status = response.status;
    throw error;
  }

  return response.json();
};

export { API_CONFIG };