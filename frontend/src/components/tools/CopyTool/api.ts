import { CopyResult, FileMatch, FileStats, ScanRequestPayload } from './types';
import { API_URLS, apiRequest } from '@/config/api';

/**
 * Formater la taille des fichiers en unités lisibles
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} octets`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} Ko`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  }
};

/**
 * Calculer les statistiques textuelles d'un contenu formaté
 */
export const calculateTextStats = (formattedContent: string): { lines: number; words: number; chars: number } => {
  const lines = formattedContent.split('\n').length;
  const words = formattedContent.split(/\s+/).filter(Boolean).length;
  const chars = formattedContent.length;
  
  return { lines, words, chars };
};

/**
 * Activer les logs détaillés pour le débogage
 */
const ENABLE_DEBUG_LOGGING = import.meta.env.VITE_DEBUG_MODE === 'true';

/**
 * Logger personnalisé pour l'API
 */
const apiLogger = {
  info: (message: string) => {
    if (ENABLE_DEBUG_LOGGING) {
      console.info(`[CopyTool API] ${message}`);
    }
  },
  error: (message: string, error?: any) => {
    console.error(`[CopyTool API ERROR] ${message}`, error || '');
  },
  warn: (message: string) => {
    if (ENABLE_DEBUG_LOGGING) {
      console.warn(`[CopyTool API] ${message}`);
    }
  },
  debug: (message: string, data?: any) => {
    if (ENABLE_DEBUG_LOGGING) {
      console.debug(`[CopyTool API] ${message}`, data || '');
    }
  }
};

/**
 * Service API pour interagir avec le backend
 */
export const copyToolApi = {
  /**
   * Scanner les fichiers selon les critères spécifiés
   */
  async scanFiles(payload: ScanRequestPayload): Promise<{ matches: FileMatch[]; totalMatches: number; totalSubdirectories: number }> {
    apiLogger.info(`Début du scan des fichiers: ${payload.directories.length} dossiers, ${payload.files.length} fichiers`);
    apiLogger.debug('Payload de requête:', payload);
    
    const startTime = performance.now();
    
    try {
      const data = await apiRequest(API_URLS.COPY.SCAN, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      
      const endTime = performance.now();
      
      apiLogger.info(`Scan terminé en ${(endTime - startTime).toFixed(2)}ms: ${data.total_matches || 0} fichiers trouvés`);
      
      if (data.invalid_paths && data.invalid_paths.length > 0) {
        apiLogger.warn(`${data.invalid_paths.length} chemins avec des erreurs d'accès`);
      }
      
      return {
        matches: data.matches || [],
        totalMatches: data.total_matches || 0,
        totalSubdirectories: data.total_subdirectories || 0
      };
    } catch (error) {
      const endTime = performance.now();
      apiLogger.error(`Échec du scan après ${(endTime - startTime).toFixed(2)}ms`, error);
      throw error;
    }
  },
  
  /**
   * Récupérer et formater le contenu des fichiers
   */
  async formatContent(payload: ScanRequestPayload): Promise<string> {
    apiLogger.info(`Début du formatage du contenu: ${payload.directories.length} dossiers, ${payload.files.length} fichiers`);
    
    const startTime = performance.now();
    
    try {
      const data = await apiRequest(API_URLS.COPY.FORMAT_CONTENT, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      
      const endTime = performance.now();
      apiLogger.info(`Formatage terminé en ${(endTime - startTime).toFixed(2)}ms`);
      
      return data.formatted_content || '';
    } catch (error) {
      const endTime = performance.now();
      apiLogger.error(`Échec du formatage après ${(endTime - startTime).toFixed(2)}ms`, error);
      throw error;
    }
  },

  /**
   * Analyser les fichiers (scan + format en une seule requête)
   */
  async analyzeFiles(payload: ScanRequestPayload): Promise<CopyResult> {
    apiLogger.info(`Début de l'analyse complète: ${payload.directories.length} dossiers, ${payload.files.length} fichiers`);
    apiLogger.debug('Payload d\'analyse:', payload);
    
    const startTime = performance.now();
    
    try {
      const data = await apiRequest(API_URLS.COPY.FORMAT_CONTENT, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      
      const endTime = performance.now();
      apiLogger.info(`Analyse complète terminée en ${(endTime - startTime).toFixed(2)}ms`);
      
      // Calculer les statistiques détaillées
      const matches = data.matches || [];
      const formattedContent = data.formatted_content || '';
      const textStats = calculateTextStats(formattedContent);
      
      // Analyser les extensions
      const extensionCount: { [key: string]: number } = {};
      let totalSize = 0;
      
      matches.forEach((file: FileMatch) => {
        const ext = file.extension || 'sans extension';
        extensionCount[ext] = (extensionCount[ext] || 0) + 1;
        totalSize += file.size || 0;
      });
      
      const stats: FileStats = {
        totalLines: textStats.lines,
        totalWords: textStats.words,
        totalChars: textStats.chars,
        fileCount: matches.length,
        folderCount: data.total_subdirectories || 0,
        totalSubdirectories: data.total_subdirectories || 0,
        totalSize,
        totalSizeFormatted: formatFileSize(totalSize),
        byExtension: extensionCount
      };
      
      const result: CopyResult = {
        matches,
        totalMatches: data.total_matches || matches.length,
        formattedContent,
        stats,
        invalid_paths: data.invalid_paths
      };
      
      if (data.invalid_paths && data.invalid_paths.length > 0) {
        apiLogger.warn(`${data.invalid_paths.length} chemins avec des erreurs d'accès`);
      }
      
      return result;
    } catch (error) {
      const endTime = performance.now();
      apiLogger.error(`Échec de l'analyse après ${(endTime - startTime).toFixed(2)}ms`, error);
      throw error;
    }
  }
};