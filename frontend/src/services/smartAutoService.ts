import { API_CONFIG } from '@/config/api';

export interface SmartAutoAnalyzeGitRequest {
  projectPath: string;
  depth: number; // 1, 2, 3
  includeTests?: boolean;
  includeStyles?: boolean;
}

export interface SmartAutoAnalyzeFilesRequest {
  projectPath: string;
  files: string[];
  depth: number; // 1, 2, 3
  includeTests?: boolean;
  includeStyles?: boolean;
}

export interface SmartAutoDetectGitRootRequest {
  startPath: string;
}

export interface SmartAutoFile {
  path: string;
  absolutePath: string;
  size: number;
  name: string;
  extension: string;
}

export interface SmartAutoStats {
  totalFiles: number;
  totalSize: number;
  limitExceeded: boolean;
  filesFromGit?: number;
  filesFromDeps?: number;
  filesFromBase?: number;
  excludedCount?: number;
}

export interface SmartAutoMetadata {
  source: 'git' | 'files';
  depth: number;
  projectRoot: string;
}

export interface SmartAutoAnalyzeResponse {
  success: boolean;
  data?: {
    gitFiles?: string[];
    baseFiles?: string[];
    linkedFiles: string[];
    allFiles: SmartAutoFile[];
    stats: SmartAutoStats;
    metadata: SmartAutoMetadata;
    excluded?: Array<{
      path: string;
      reason: string;
      error?: string;
    }>;
  };
  error?: string;
  message?: string;
}

export interface SmartAutoDetectGitRootResponse {
  success: boolean;
  data?: {
    gitRoot: string | null;
    isGitRepository: boolean;
  };
  error?: string;
}

/**
 * Service pour l'analyse SmartAuto
 */
class SmartAutoService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/smartauto`;
  }

  /**
   * Analyse depuis les fichiers Git modifiés
   */
  async analyzeFromGit(request: SmartAutoAnalyzeGitRequest): Promise<SmartAutoAnalyzeResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/analyze-git`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('SmartAuto analyzeFromGit error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Analyse depuis une liste de fichiers
   */
  async analyzeFromFiles(request: SmartAutoAnalyzeFilesRequest): Promise<SmartAutoAnalyzeResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/analyze-files`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('SmartAuto analyzeFromFiles error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Détecte la racine Git d'un projet
   */
  async detectGitRoot(request: SmartAutoDetectGitRootRequest): Promise<SmartAutoDetectGitRootResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/detect-git-root`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('SmartAuto detectGitRoot error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Health check du service SmartAuto
   */
  async healthCheck(): Promise<{ status: string; service: string; version: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return await response.json();
    } catch (error) {
      console.error('SmartAuto health check error:', error);
      return {
        status: 'error',
        service: 'smartauto',
        version: 'unknown',
      };
    }
  }
}

// Export singleton instance
export const smartAutoService = new SmartAutoService();
