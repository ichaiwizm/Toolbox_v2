import { createContext, useState, useEffect, useContext, ReactNode } from "react";
import { CopyConfig, CopyResult, createEmptyConfig, SSHConnection } from "./types";
import { useHistoryManager } from "./useHistoryManager";
import { copyToolApi } from "./api";
import { createApiPayload } from "./utils";
import { useTabs } from "@/contexts/TabsContext";
import { normalizePath } from './utils';

// Clés de stockage local pour l'état de l'outil
const STORAGE_KEY_CONFIG = "copy-tool-current-config";
const STORAGE_KEY_RESULTS = "copy-tool-current-results";
const STORAGE_KEY_TAB_CONFIG = "copy-tool-tab-configs"; // Pour stocker les configs par onglet
const STORAGE_KEY_TAB_RESULTS = "copy-tool-tab-results"; // Pour stocker les résultats par onglet
const STORAGE_KEY_EXISTING_TABS = "copy-tool-existing-tabs"; // Pour suivre les onglets qui existent déjà
const STORAGE_KEY_TAB_REMOTE_MODE = "copy-tool-tab-remote-modes"; // Pour stocker le mode distant par onglet
const STORAGE_KEY_TAB_SSH_CONNECTION = "copy-tool-tab-ssh-connections"; // Pour stocker la connexion SSH par onglet

interface CopyToolContextType {
  // État
  config: CopyConfig;
  history: CopyConfig[];
  results: CopyResult | null;
  isLoading: boolean;
  error: string | null;
  copied: boolean;
  isRemoteMode: boolean;
  selectedSSHConnection: SSHConnection | null;
  
  // Entrées de formulaire
  directoryInput: string;
  fileInput: string;
  extensionInput: string;
  patternInput: string;
  excludeDirectoryInput: string;
  
  // Setters
  setConfig: (config: CopyConfig) => void;
  setDirectoryInput: (value: string) => void;
  setFileInput: (value: string) => void;
  setExtensionInput: (value: string) => void;
  setPatternInput: (value: string) => void;
  setExcludeDirectoryInput: (value: string) => void;
  setIsRemoteMode: (value: boolean) => void;
  setSelectedSSHConnection: (connection: SSHConnection | null) => void;
  
  // Actions
  addDirectory: () => void;
  addFile: () => void;
  addExcludeExtension: () => void;
  addExcludePattern: () => void;
  addExcludeDirectory: () => void;
  removeItem: (list: keyof CopyConfig, index: number) => void;
  editItem: (list: keyof CopyConfig, index: number, newValue: string) => void;
  toggleRecursive: (checked: boolean) => void;
  resetConfig: () => void;
  loadFromHistory: (config: CopyConfig) => void;
  clearHistory: () => void;
  toggleFavorite: (id: string) => void;
  scanFiles: () => Promise<void>;
  copyToClipboard: () => Promise<void>;
}

// Exporter le contexte pour qu'il puisse être vérifié dans d'autres composants
export const CopyToolContext = createContext<CopyToolContextType | undefined>(undefined);

export function useCopyTool() {
  const context = useContext(CopyToolContext);
  if (!context) {
    throw new Error("useCopyTool doit être utilisé dans un CopyToolProvider");
  }
  return context;
}

interface CopyToolProviderProps {
  children: ReactNode;
}

export function CopyToolProvider({ children }: CopyToolProviderProps) {
  // Obtenir l'onglet actif pour suivre les changements
  const { activeTab } = useTabs();
  

  // État local
  const [config, setConfig] = useState<CopyConfig>(createEmptyConfig());
  const [results, setResults] = useState<CopyResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isRemoteMode, setIsRemoteMode] = useState(false);
  const [selectedSSHConnection, setSelectedSSHConnection] = useState<SSHConnection | null>(null);
  const [initialized, setInitialized] = useState(false); // État pour suivre l'initialisation
  const [existingTabs, setExistingTabs] = useState<string[]>([]);

  // Entrées de formulaire
  const [directoryInput, setDirectoryInput] = useState("");
  const [fileInput, setFileInput] = useState("");
  const [extensionInput, setExtensionInput] = useState("");
  const [patternInput, setPatternInput] = useState("");
  const [excludeDirectoryInput, setExcludeDirectoryInput] = useState("");

  // Utiliser le hook de gestion d'historique
  const { history, saveToHistory, clearHistory, toggleFavorite } = useHistoryManager();

  // Charger la liste des onglets existants
  useEffect(() => {
    try {
      const savedExistingTabs = localStorage.getItem(STORAGE_KEY_EXISTING_TABS);
      if (savedExistingTabs) {
        const tabs = JSON.parse(savedExistingTabs);
        setExistingTabs(tabs);
      }
      setInitialized(true);
    } catch (error) {
      console.error("Erreur lors du chargement des onglets existants:", error);
      setInitialized(true);
    }
  }, []);

  // Charger la configuration depuis le stockage local ou utiliser une configuration vide
  useEffect(() => {
    if (!initialized || !activeTab) return;
    
    try {
      // Charger TOUTES les configs depuis localStorage pour éviter les problèmes de synchronisation
      const tabConfigs = JSON.parse(localStorage.getItem(STORAGE_KEY_TAB_CONFIG) || '{}');
      const tabResults = JSON.parse(localStorage.getItem(STORAGE_KEY_TAB_RESULTS) || '{}');
      const tabRemoteModes = JSON.parse(localStorage.getItem(STORAGE_KEY_TAB_REMOTE_MODE) || '{}');
      const tabSSHConnections = JSON.parse(localStorage.getItem(STORAGE_KEY_TAB_SSH_CONNECTION) || '{}');
      const savedExistingTabs = JSON.parse(localStorage.getItem(STORAGE_KEY_EXISTING_TABS) || '[]');
      
      // Vérifier si c'est un nouvel onglet basé sur localStorage, pas sur l'état local
      const isNewTab = !savedExistingTabs.includes(activeTab) && !tabConfigs[activeTab];
      
      if (isNewTab) {
        // Configuration vide pour nouvel onglet
        const emptyConfig = createEmptyConfig();
        setConfig(emptyConfig);
        setResults(null);
        setIsRemoteMode(false);
        setSelectedSSHConnection(null);
        
        // Mettre à jour la liste des onglets existants
        const updatedTabs = [...savedExistingTabs, activeTab];
        setExistingTabs(updatedTabs);
        localStorage.setItem(STORAGE_KEY_EXISTING_TABS, JSON.stringify(updatedTabs));
        
        // Sauvegarder immédiatement la config vide pour cet onglet
        tabConfigs[activeTab] = emptyConfig;
        localStorage.setItem(STORAGE_KEY_TAB_CONFIG, JSON.stringify(tabConfigs));
      } else {
        // Charger la config existante ou utiliser une config vide
        const savedConfig = tabConfigs[activeTab] || createEmptyConfig();
        setConfig(savedConfig);
        
        // Charger les résultats
        if (tabResults[activeTab]) {
          setResults(tabResults[activeTab]);
        } else {
          setResults(null);
        }
        
        // Charger le mode distant
        const remoteMode = tabRemoteModes[activeTab] || false;
        setIsRemoteMode(remoteMode);
        
        // Charger la connexion SSH
        if (tabSSHConnections[activeTab]) {
          setSelectedSSHConnection(tabSSHConnections[activeTab]);
        } else {
          setSelectedSSHConnection(null);
        }
        
        // S'assurer que existingTabs est à jour
        if (!existingTabs.includes(activeTab)) {
          setExistingTabs(savedExistingTabs);
        }
      }
    } catch (error) {
      console.error("Erreur lors du chargement de la configuration:", error);
      // En cas d'erreur, initialiser avec des valeurs par défaut
      setConfig(createEmptyConfig());
      setResults(null);
      setIsRemoteMode(false);
      setSelectedSSHConnection(null);
    }
  }, [activeTab, initialized]);

  // Sauvegarder les résultats dans le stockage local quand ils changent
  useEffect(() => {
    if (!initialized || !activeTab) return;
    
    try {
      // Sauvegarder les résultats globalement (pour compatibilité)
      if (results) {
        localStorage.setItem(STORAGE_KEY_RESULTS, JSON.stringify(results));
      } else {
        localStorage.removeItem(STORAGE_KEY_RESULTS);
      }
      
      // Sauvegarder les résultats spécifiques à l'onglet
      const tabResults = JSON.parse(localStorage.getItem(STORAGE_KEY_TAB_RESULTS) || '{}');
      if (results) {
        tabResults[activeTab] = results;
      } else {
        delete tabResults[activeTab];
      }
      localStorage.setItem(STORAGE_KEY_TAB_RESULTS, JSON.stringify(tabResults));
    } catch (error) {
      console.error("Erreur lors de la sauvegarde des résultats:", error);
    }
  }, [results, activeTab, initialized]);
  
  // Sauvegarder la configuration dans le stockage local quand elle change
  useEffect(() => {
    if (!initialized || !activeTab) return;
    
    try {
      // Sauvegarder comme configuration globale
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
      
      // Sauvegarder aussi comme configuration spécifique à l'onglet
      const tabConfigs = JSON.parse(localStorage.getItem(STORAGE_KEY_TAB_CONFIG) || '{}');
      tabConfigs[activeTab] = config;
      localStorage.setItem(STORAGE_KEY_TAB_CONFIG, JSON.stringify(tabConfigs));
    } catch (error) {
      console.error("Erreur lors de la sauvegarde de la configuration:", error);
    }
  }, [config, activeTab, initialized]);

  // Sauvegarder le mode distant et la connexion SSH par onglet
  useEffect(() => {
    if (!initialized || !activeTab) return;
    
    try {
      // Sauvegarder le mode distant
      const tabRemoteModes = JSON.parse(localStorage.getItem(STORAGE_KEY_TAB_REMOTE_MODE) || '{}');
      tabRemoteModes[activeTab] = isRemoteMode;
      localStorage.setItem(STORAGE_KEY_TAB_REMOTE_MODE, JSON.stringify(tabRemoteModes));
      
      // Sauvegarder la connexion SSH
      const tabSSHConnections = JSON.parse(localStorage.getItem(STORAGE_KEY_TAB_SSH_CONNECTION) || '{}');
      if (selectedSSHConnection) {
        tabSSHConnections[activeTab] = selectedSSHConnection;
      } else {
        delete tabSSHConnections[activeTab];
      }
      localStorage.setItem(STORAGE_KEY_TAB_SSH_CONNECTION, JSON.stringify(tabSSHConnections));
    } catch (error) {
      console.error("Erreur lors de la sauvegarde du mode distant:", error);
    }
  }, [isRemoteMode, selectedSSHConnection, activeTab, initialized]);

  // Réinitialiser le statut de copie après un délai
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  // Ajouter un répertoire à la configuration
  const addDirectory = () => {
    if (!directoryInput.trim()) return;
    
    // Normaliser le chemin pour éviter les problèmes avec les backslashes sous Windows
    const normalizedPath = normalizePath(directoryInput.trim());
    
    if (!config.directories.includes(normalizedPath)) {
      setConfig({
        ...config,
        directories: [...config.directories, normalizedPath]
      });
    }
    
    setDirectoryInput("");
  };

  // Ajouter un fichier à la configuration
  const addFile = () => {
    if (!fileInput.trim()) return;
    
    // Normaliser le chemin pour éviter les problèmes avec les backslashes sous Windows
    const normalizedPath = normalizePath(fileInput.trim());
    
    if (!config.files.includes(normalizedPath)) {
      setConfig({
        ...config,
        files: [...config.files, normalizedPath]
      });
    }
    
    setFileInput("");
  };

  // Ajouter une extension à exclure
  const addExcludeExtension = () => {
    if (!extensionInput.trim()) return;
    
    // Nettoyer l'extension (enlever le . au début si présent)
    const extension = extensionInput.trim().startsWith(".") 
      ? extensionInput.trim().substring(1) 
      : extensionInput.trim();
      
    if (!config.excludeExtensions.includes(extension)) {
      setConfig({
        ...config,
        excludeExtensions: [...config.excludeExtensions, extension]
      });
    }
    
    setExtensionInput("");
  };

  // Ajouter un motif à exclure
  const addExcludePattern = () => {
    if (!patternInput.trim()) return;
    
    if (!config.excludePatterns.includes(patternInput)) {
      setConfig({
        ...config,
        excludePatterns: [...config.excludePatterns, patternInput]
      });
    }
    
    setPatternInput("");
  };

  // Ajouter un dossier à exclure
  const addExcludeDirectory = () => {
    if (!excludeDirectoryInput.trim()) return;
    
    if (!config.excludeDirectories.includes(excludeDirectoryInput)) {
      setConfig({
        ...config,
        excludeDirectories: [...config.excludeDirectories, excludeDirectoryInput]
      });
    }
    
    setExcludeDirectoryInput("");
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
    const newConfig = createEmptyConfig();
    setConfig(newConfig);
    setResults(null);
    setError(null);
    
    // Mettre à jour la configuration pour l'onglet actuel dans le stockage local
    if (activeTab) {
      try {
        // Mettre à jour la configuration
        const tabConfigs = JSON.parse(localStorage.getItem(STORAGE_KEY_TAB_CONFIG) || '{}');
        tabConfigs[activeTab] = newConfig;
        localStorage.setItem(STORAGE_KEY_TAB_CONFIG, JSON.stringify(tabConfigs));
        
        // Supprimer les résultats
        const tabResults = JSON.parse(localStorage.getItem(STORAGE_KEY_TAB_RESULTS) || '{}');
        delete tabResults[activeTab];
        localStorage.setItem(STORAGE_KEY_TAB_RESULTS, JSON.stringify(tabResults));
      } catch (error) {
        console.error("Erreur lors de la mise à jour de la configuration pour l'onglet:", error);
      }
    }
  };

  // Charger une configuration depuis l'historique
  const loadFromHistory = (historicConfig: CopyConfig) => {
    // S'assurer que tous les champs sont présents, même les nouveaux champs
    const completeConfig = {
      ...createEmptyConfig(), // Commence avec une configuration complète
      ...historicConfig,      // Écrase avec les valeurs historiques
      // S'assurer que le champ excludeDirectories existe
      excludeDirectories: historicConfig.excludeDirectories || []
    };
    
    setConfig(completeConfig);
    
    // Restaurer le mode distant et la connexion SSH si présents dans l'historique
    if (typeof historicConfig.isRemoteMode === 'boolean') {
      setIsRemoteMode(historicConfig.isRemoteMode);
    }
    
    if (historicConfig.sshConnection) {
      setSelectedSSHConnection(historicConfig.sshConnection);
    } else if (historicConfig.isRemoteMode === false) {
      // Si le mode était local, effacer la connexion SSH
      setSelectedSSHConnection(null);
    }
    
    // Sauvegarder explicitement pour l'onglet actuel
    if (activeTab) {
      try {
        const tabConfigs = JSON.parse(localStorage.getItem(STORAGE_KEY_TAB_CONFIG) || '{}');
        tabConfigs[activeTab] = completeConfig;
        localStorage.setItem(STORAGE_KEY_TAB_CONFIG, JSON.stringify(tabConfigs));
      } catch (error) {
        console.error("Erreur lors de la sauvegarde de la configuration pour l'onglet:", error);
      }
    }
  };

  // Scanner les fichiers selon la configuration
  const scanFiles = async () => {
    setIsLoading(true);
    setError(null);
    setResults(null);

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
      
      setResults(result);
      
      // Créer une config complète avec le mode distant pour l'historique
      const configWithRemoteInfo = {
        ...config,
        isRemoteMode,
        sshConnection: selectedSSHConnection
      };
      
      saveToHistory(configWithRemoteInfo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setIsLoading(false);
    }
  };

  // Copier le contenu formaté dans le presse-papier (mode local uniquement)
  const copyToClipboard = async () => {
    if (results?.formattedContent) {
      try {
        await navigator.clipboard.writeText(results.formattedContent);
        setCopied(true);
        return;
      } catch (err) {
        setError("Impossible de copier dans le presse-papier");
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      const payload = createApiPayload(config);
      const formattedContent = await copyToolApi.formatContent(payload);

      if (results) {
        const updatedResults = { ...results, formattedContent };
        setResults(updatedResults);
      } else {
        setResults({
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
        });
      }

      await navigator.clipboard.writeText(formattedContent);
      setCopied(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <CopyToolContext.Provider 
      value={{ 
        config, 
        history, 
        results, 
        isLoading, 
        error, 
        copied,
        isRemoteMode,
        selectedSSHConnection,
        directoryInput,
        fileInput,
        extensionInput,
        patternInput,
        excludeDirectoryInput,
        setConfig,
        setDirectoryInput,
        setFileInput,
        setExtensionInput,
        setPatternInput,
        setExcludeDirectoryInput,
        setIsRemoteMode,
        setSelectedSSHConnection,
        addDirectory,
        addFile,
        addExcludeExtension,
        addExcludePattern,
        addExcludeDirectory,
        removeItem,
        editItem,
        toggleRecursive,
        resetConfig,
        loadFromHistory,
        clearHistory,
        toggleFavorite,
        scanFiles,
        copyToClipboard
      }}
    >
      {children}
    </CopyToolContext.Provider>
  );
} 