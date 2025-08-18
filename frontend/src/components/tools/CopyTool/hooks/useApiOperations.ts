import { useState, useEffect } from "react";
import { CopyConfig, CopyResult, SSHConnection } from "../types";
import { copyToolApi } from "../api";
import { createApiPayload } from "../utils";

/**
 * Hook pour gérer les opérations API (scan et copy)
 */
export function useApiOperations() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);


  // Scanner les fichiers selon la configuration
  const scanFiles = async (
    config: CopyConfig,
    isRemoteMode: boolean,
    selectedSSHConnection: SSHConnection | null
  ): Promise<CopyResult> => {
    setIsLoading(true);
    setError(null);

    try {
      let result: CopyResult;
      
      if (isRemoteMode && selectedSSHConnection) {
        // Mode distant : synchroniser puis scanner
        if (config.directories.length === 0) {
          throw new Error("Veuillez spécifier au moins un chemin distant");
        }
        
        // Utiliser le premier répertoire comme chemin distant
        const remotePath = config.directories[0];
        
        // Créer les options de sync à partir de la config
        const syncOptions = {
          recursive: config.recursive,
          excludeExtensions: config.excludeExtensions,
          excludePatterns: config.excludePatterns,
          excludeDirectories: config.excludeDirectories
        };
        
        // Synchroniser d'abord
        await copyToolApi.syncRemote(selectedSSHConnection, remotePath, syncOptions);
        
        // Puis scanner et formater
        const [scanResult, formattedContent] = await Promise.all([
          copyToolApi.scanRemoteFiles(selectedSSHConnection, remotePath, syncOptions),
          copyToolApi.formatRemoteContent(selectedSSHConnection, remotePath, syncOptions)
        ]);
        
        // Calculer les stats
        const textStats = {
          lines: formattedContent.split('\n').length,
          words: formattedContent.split(/\s+/).filter(Boolean).length,
          chars: formattedContent.length
        };
        
        const extensionCount: { [key: string]: number } = {};
        let totalSize = 0;
        
        scanResult.matches.forEach(file => {
          const ext = file.extension || 'sans extension';
          extensionCount[ext] = (extensionCount[ext] || 0) + 1;
          totalSize += file.size || 0;
        });
        
        result = {
          matches: scanResult.matches,
          totalMatches: scanResult.totalMatches,
          formattedContent,
          stats: {
            totalLines: textStats.lines,
            totalWords: textStats.words,
            totalChars: textStats.chars,
            fileCount: scanResult.matches.length,
            folderCount: 0,
            totalSubdirectories: scanResult.totalSubdirectories,
            totalSize,
            totalSizeFormatted: `${(totalSize / 1024 / 1024).toFixed(2)} Mo`,
            byExtension: extensionCount
          }
        };
      } else {
        // Mode local : utiliser l'API normale
        const payload = createApiPayload(config);
        result = await copyToolApi.analyzeFiles(payload);
      }
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erreur inconnue";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Copier le contenu formaté dans le presse-papier
  const copyToClipboard = async (
    config: CopyConfig,
    currentResults: CopyResult | null
  ): Promise<{ results: CopyResult; formattedContent: string }> => {
    if (currentResults?.formattedContent) {
      try {
        await navigator.clipboard.writeText(currentResults.formattedContent);
        setCopied(() => true);
        
        // Auto-reset après 2 secondes
        setTimeout(() => {
          setCopied(() => false);
        }, 2000);
        
        return { results: currentResults, formattedContent: currentResults.formattedContent };
      } catch (err) {
        setError("Impossible de copier dans le presse-papier");
        throw err;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      const payload = createApiPayload(config);
      const formattedContent = await copyToolApi.formatContent(payload);

      const results: CopyResult = currentResults ? 
        { ...currentResults, formattedContent } :
        {
          matches: [],
          totalMatches: 0,
          formattedContent,
          stats: {
            totalLines: 0,
            totalWords: 0,
            totalChars: 0,
            fileCount: 0,
            folderCount: 0,
            totalSubdirectories: 0,
            totalSize: 0,
            totalSizeFormatted: "0 octets",
            byExtension: {}
          }
        };

      await navigator.clipboard.writeText(formattedContent);
      setCopied(() => true);
      
      // Auto-reset après 2 secondes
      setTimeout(() => {
        setCopied(() => false);
      }, 2000);
      
      return { results, formattedContent };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erreur inconnue";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    error,
    copied,
    setError,
    setCopied,
    scanFiles,
    copyToClipboard
  };
}