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
  // Ajouter un ou plusieurs répertoires à la configuration
  const addDirectory = () => {
    if (!inputs.directoryInput.trim()) return;
    
    // Supporter plusieurs chemins séparés par des virgules, points-virgules ou nouvelles lignes
    const paths = inputs.directoryInput
      .split(/[,;\n]+/)
      .map(path => path.trim())
      .filter(path => path.length > 0)
      .map(path => normalizePath(path));
    
    // Filtrer les chemins qui ne sont pas déjà dans la liste
    const newPaths = paths.filter(path => !config.directories.includes(path));
    
    if (newPaths.length > 0) {
      setConfig({
        ...config,
        directories: [...config.directories, ...newPaths]
      });
    }
    
    inputs.setDirectoryInput("");
  };

  // Ajouter un ou plusieurs fichiers à la configuration
  const addFile = () => {
    if (!inputs.fileInput.trim()) return;
    
    // Supporter plusieurs chemins séparés par des virgules, points-virgules ou nouvelles lignes
    const paths = inputs.fileInput
      .split(/[,;\n]+/)
      .map(path => path.trim())
      .filter(path => path.length > 0)
      .map(path => normalizePath(path));
    
    // Filtrer les chemins qui ne sont pas déjà dans la liste
    const newPaths = paths.filter(path => !config.files.includes(path));
    
    if (newPaths.length > 0) {
      setConfig({
        ...config,
        files: [...config.files, ...newPaths]
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