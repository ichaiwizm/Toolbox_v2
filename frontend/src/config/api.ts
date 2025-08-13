// Configuration de l'API
const API_CONFIG = {
  // En développement, utiliser le port backend direct
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:9000',
  
  // Préfixe des routes API
  API_PREFIX: '/api/v1',
  
  // Timeout par défaut (30 secondes)
  TIMEOUT: 30000,
  
  // Timeout pour les opérations SSH/rsync (10 minutes)
  REMOTE_TIMEOUT: 10 * 60 * 1000,
  
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
  },
  // Routes remote SSH
  REMOTE: {
    SYNC: `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/remote/sync`,
    SCAN: `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/remote/scan`,
    FORMAT_CONTENT: `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/remote/format-content`,
    CACHE_STATUS: `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/remote/cache-status`,
    CLEANUP: `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/remote/cleanup`,
    UNLOCK: `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/remote/unlock`
  },
  SSH: {
    TEST_CONNECTION: `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/ssh/test-connection`
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
    
    // Utiliser un timeout plus long pour les opérations SSH/rsync
    const timeout = url.includes('/remote/') ? API_CONFIG.REMOTE_TIMEOUT : API_CONFIG.TIMEOUT;
    setTimeout(() => controller.abort(), timeout);
    
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