import { CopyConfig, createEmptyConfig } from "../types";
import { normalizePath } from "../utils";

/**
 * Hook pour les actions de modification de la configuration
 */
export function useConfigActions(
  config: CopyConfig,
  setConfig: (config: CopyConfig) => void,
  inputs: {
    directoryInput: string;
    fileInput: string;
    extensionInput: string;
    patternInput: string;
    excludeDirectoryInput: string;
    setDirectoryInput: (value: string) => void;
    setFileInput: (value: string) => void;
    setExtensionInput: (value: string) => void;
    setPatternInput: (value: string) => void;
    setExcludeDirectoryInput: (value: string) => void;
  }
) {
  // Ajouter un répertoire à la configuration
  const addDirectory = () => {
    if (!inputs.directoryInput.trim()) return;
    
    const normalizedPath = normalizePath(inputs.directoryInput.trim());
    
    if (!config.directories.includes(normalizedPath)) {
      setConfig({
        ...config,
        directories: [...config.directories, normalizedPath]
      });
    }
    
    inputs.setDirectoryInput("");
  };

  // Ajouter un fichier à la configuration
  const addFile = () => {
    if (!inputs.fileInput.trim()) return;
    
    const normalizedPath = normalizePath(inputs.fileInput.trim());
    
    if (!config.files.includes(normalizedPath)) {
      setConfig({
        ...config,
        files: [...config.files, normalizedPath]
      });
    }
    
    inputs.setFileInput("");
  };

  // Ajouter une extension à exclure
  const addExcludeExtension = () => {
    if (!inputs.extensionInput.trim()) return;
    
    // Nettoyer l'extension (enlever le . au début si présent)
    const extension = inputs.extensionInput.trim().startsWith(".") 
      ? inputs.extensionInput.trim().substring(1) 
      : inputs.extensionInput.trim();
      
    if (!config.excludeExtensions.includes(extension)) {
      setConfig({
        ...config,
        excludeExtensions: [...config.excludeExtensions, extension]
      });
    }
    
    inputs.setExtensionInput("");
  };

  // Ajouter un motif à exclure
  const addExcludePattern = () => {
    if (!inputs.patternInput.trim()) return;
    
    if (!config.excludePatterns.includes(inputs.patternInput)) {
      setConfig({
        ...config,
        excludePatterns: [...config.excludePatterns, inputs.patternInput]
      });
    }
    
    inputs.setPatternInput("");
  };

  // Ajouter un dossier à exclure
  const addExcludeDirectory = () => {
    if (!inputs.excludeDirectoryInput.trim()) return;
    
    if (!config.excludeDirectories.includes(inputs.excludeDirectoryInput)) {
      setConfig({
        ...config,
        excludeDirectories: [...config.excludeDirectories, inputs.excludeDirectoryInput]
      });
    }
    
    inputs.setExcludeDirectoryInput("");
  };

  // Supprimer un élément d'une liste
  const removeItem = (list: keyof CopyConfig, index: number) => {
    if (Array.isArray(config[list])) {
      const newList = [...(config[list] as string[])];
      newList.splice(index, 1);
      setConfig({
        ...config,
        [list]: newList
      });
    }
  };

  // Éditer un élément dans une liste
  const editItem = (list: keyof CopyConfig, index: number, newValue: string) => {
    if (Array.isArray(config[list]) && newValue.trim()) {
      const newList = [...(config[list] as string[])];
      
      // Normaliser les chemins pour les listes de répertoires et fichiers
      if (list === 'directories' || list === 'files') {
        newList[index] = normalizePath(newValue.trim());
      } else {
        newList[index] = newValue.trim();
      }
      
      setConfig({
        ...config,
        [list]: newList
      });
    }
  };

  // Mettre à jour la valeur du champ récursif
  const toggleRecursive = (checked: boolean) => {
    setConfig({
      ...config,
      recursive: checked
    });
  };

  // Réinitialiser la configuration
  const resetConfig = () => {
    return createEmptyConfig();
  };

  return {
    addDirectory,
    addFile,
    addExcludeExtension,
    addExcludePattern,
    addExcludeDirectory,
    removeItem,
    editItem,
    toggleRecursive,
    resetConfig
  };
}