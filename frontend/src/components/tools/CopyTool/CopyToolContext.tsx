import { createContext, useState, useEffect, useContext, ReactNode } from "react";
import { CopyConfig, CopyResult, createEmptyConfig, FormInputs } from "./types";
import { SSHConnection } from "@/types/global";
import { useHistoryManager } from "./useHistoryManager";
import { useTabs } from "@/contexts/TabsContext";
import {
  StorageManager,
  useFormInputs,
  useConfigActions,
  useApiOperations
} from "./hooks";
import { smartAutoService } from "@/services/smartAutoService";

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

  // SmartAuto
  smartAutoDepth: number | null;
  smartAutoProjectPath: string | null;
  isGitRepo: boolean;
  isSmartAutoLoading: boolean;
  setSmartAutoDepth: (depth: number | null) => void;
  setSmartAutoProjectPath: (path: string | null) => void;
  applySmartAuto: (depth: number) => Promise<void>;

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
  const [isRemoteMode, setIsRemoteMode] = useState(false);
  const [selectedSSHConnection, setSelectedSSHConnection] = useState<SSHConnection | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [existingTabs, setExistingTabs] = useState<string[]>([]);

  // SmartAuto state
  const [smartAutoDepth, setSmartAutoDepth] = useState<number | null>(null);
  const [smartAutoProjectPath, setSmartAutoProjectPath] = useState<string | null>(null);
  const [isGitRepo, setIsGitRepo] = useState<boolean>(false);
  const [isSmartAutoLoading, setIsSmartAutoLoading] = useState<boolean>(false);

  // Hooks personnalisés
  const formInputs = useFormInputs();
  const { isLoading, error, copied, setError, scanFiles: apiScanFiles, copyToClipboard: apiCopyToClipboard } = useApiOperations();
  const configActions = useConfigActions(config, setConfig, formInputs);
  const { history, saveToHistory, clearHistory, toggleFavorite } = useHistoryManager();

  // Charger la liste des onglets existants
  useEffect(() => {
    try {
      const tabs = StorageManager.loadExistingTabs();
      setExistingTabs(tabs);
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
      const isNewTab = StorageManager.isNewTab(activeTab);
      
      if (isNewTab) {
        // Configuration vide pour nouvel onglet
        const emptyConfig = createEmptyConfig();
        setConfig(emptyConfig);
        setResults(null);
        setIsRemoteMode(false);
        setSelectedSSHConnection(null);
        
        // Marquer l'onglet comme existant
        StorageManager.markTabAsExisting(activeTab);
        setExistingTabs(StorageManager.loadExistingTabs());
        
        // Sauvegarder la config vide
        StorageManager.saveTabConfig(activeTab, emptyConfig);
      } else {
        // Charger la config existante
        const savedConfig = StorageManager.loadTabConfig(activeTab) || createEmptyConfig();
        setConfig(savedConfig);
        
        // Charger les résultats
        const savedResults = StorageManager.loadTabResults(activeTab);
        setResults(savedResults);
        
        // Charger le mode distant
        const remoteMode = StorageManager.loadTabRemoteMode(activeTab);
        setIsRemoteMode(remoteMode);
        
        // Charger la connexion SSH
        const sshConnection = StorageManager.loadTabSSHConnection(activeTab);
        setSelectedSSHConnection(sshConnection);
        
        // S'assurer que existingTabs est à jour
        if (!existingTabs.includes(activeTab)) {
          setExistingTabs(StorageManager.loadExistingTabs());
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
    StorageManager.saveTabResults(activeTab, results);
  }, [results, activeTab, initialized]);
  
  // Sauvegarder la configuration dans le stockage local quand elle change
  useEffect(() => {
    if (!initialized || !activeTab) return;
    StorageManager.saveTabConfig(activeTab, config);
  }, [config, activeTab, initialized]);

  // Sauvegarder le mode distant et la connexion SSH par onglet
  useEffect(() => {
    if (!initialized || !activeTab) return;
    StorageManager.saveTabRemoteMode(activeTab, isRemoteMode);
    StorageManager.saveTabSSHConnection(activeTab, selectedSSHConnection);
  }, [isRemoteMode, selectedSSHConnection, activeTab, initialized]);

  // Charger les inputs de formulaire lors du changement d'onglet
  useEffect(() => {
    if (!initialized || !activeTab) return;
    
    try {
      const savedInputs = StorageManager.loadFormInputs(activeTab);
      if (savedInputs) {
        formInputs.setDirectoryInput(savedInputs.directoryInput);
        formInputs.setFileInput(savedInputs.fileInput);
        formInputs.setExtensionInput(savedInputs.extensionInput);
        formInputs.setPatternInput(savedInputs.patternInput);
        formInputs.setExcludeDirectoryInput(savedInputs.excludeDirectoryInput);
      } else {
        // Onglet nouveau ou sans données sauvegardées - réinitialiser les inputs
        formInputs.setDirectoryInput("");
        formInputs.setFileInput("");
        formInputs.setExtensionInput("");
        formInputs.setPatternInput("");
        formInputs.setExcludeDirectoryInput("");
      }
    } catch (error) {
      console.error("Erreur lors du chargement des inputs de formulaire:", error);
    }
  }, [activeTab, initialized]);

  // Sauvegarder les inputs de formulaire quand ils changent
  useEffect(() => {
    if (!initialized || !activeTab) return;
    
    const currentInputs: FormInputs = {
      directoryInput: formInputs.directoryInput,
      fileInput: formInputs.fileInput,
      extensionInput: formInputs.extensionInput,
      patternInput: formInputs.patternInput,
      excludeDirectoryInput: formInputs.excludeDirectoryInput
    };
    
    StorageManager.saveFormInputs(activeTab, currentInputs);
  }, [
    formInputs.directoryInput,
    formInputs.fileInput,
    formInputs.extensionInput,
    formInputs.patternInput,
    formInputs.excludeDirectoryInput,
    activeTab,
    initialized
  ]);

  // Auto-détection du chemin projet SmartAuto avec recherche Git automatique
  useEffect(() => {
    if (!initialized || !activeTab) return;

    const detectProjectPath = async () => {
      // Priority 1: Existing smartAuto config
      if (config.smartAuto?.projectRoot) {
        return config.smartAuto.projectRoot;
      }

      // Priority 2: First directory in config - with Git root detection
      if (config.directories.length > 0) {
        const firstDir = config.directories[0];

        // NOUVEAU: Try to find Git root from this directory
        try {
          const gitRootResponse = await smartAutoService.detectGitRoot({
            startPath: firstDir
          });

          if (gitRootResponse.success && gitRootResponse.data?.gitRoot) {
            // Found Git root - use it as project path
            const gitRoot = gitRootResponse.data.gitRoot;

            // Save it for future use
            localStorage.setItem(`smartauto-project-path-${activeTab}`, gitRoot);

            return gitRoot;
          }
        } catch (error) {
          console.warn('Error detecting Git root:', error);
        }

        // Fallback to the directory itself if no Git root found
        return firstDir;
      }

      // Priority 3: localStorage
      const saved = localStorage.getItem(`smartauto-project-path-${activeTab}`);
      if (saved) {
        return saved;
      }

      return null;
    };

    detectProjectPath().then(detectedPath => {
      setSmartAutoProjectPath(detectedPath);

      // Validate if it's a Git repo
      if (detectedPath) {
        smartAutoService.detectGitRoot({ startPath: detectedPath })
          .then(res => {
            setIsGitRepo(res.data?.isGitRepository ?? false);
          })
          .catch(() => setIsGitRepo(false));
      } else {
        setIsGitRepo(false);
      }
    });
  }, [config.directories, config.smartAuto, activeTab, initialized]);

  // L'effet de réinitialisation de copie est géré dans useCopiedState

  // Les actions de configuration sont déléguées au hook useConfigActions

  // Réinitialiser la configuration
  const resetConfig = () => {
    const newConfig = configActions.resetConfig();
    setConfig(newConfig);
    setResults(null);
    setError(null);
    
    // Mettre à jour la configuration pour l'onglet actuel dans le stockage local
    if (activeTab) {
      StorageManager.saveTabConfig(activeTab, newConfig);
      StorageManager.saveTabResults(activeTab, null);
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
      StorageManager.saveTabConfig(activeTab, completeConfig);
    }
  };

  // Scanner les fichiers selon la configuration
  const scanFiles = async () => {
    setResults(null);
    
    try {
      const result = await apiScanFiles(config, isRemoteMode, selectedSSHConnection);
      setResults(result);
      
      // Créer une config complète avec le mode distant pour l'historique
      const configWithRemoteInfo = {
        ...config,
        isRemoteMode,
        sshConnection: selectedSSHConnection || undefined
      };
      
      saveToHistory(configWithRemoteInfo);
    } catch (err) {
      // L'erreur est déjà gérée dans le hook useApiOperations
      console.error('Erreur lors du scan:', err);
    }
  };

  // Appliquer SmartAuto avec un niveau de profondeur
  // Cette fonction ne fait QUE peupler les listes directories et files
  // L'utilisateur doit cliquer sur "Rechercher" ensuite pour scanner
  const applySmartAuto = async (depth: number) => {
    console.log('🚀 [CopyToolContext] applySmartAuto called with depth:', depth);
    console.log('🔍 [CopyToolContext] smartAutoProjectPath:', smartAutoProjectPath);

    setError(null);
    setIsSmartAutoLoading(true);

    try {
      // Vérifier qu'on a un chemin projet
      if (!smartAutoProjectPath) {
        console.warn('⚠️ [CopyToolContext] No project path, aborting');
        setError('Veuillez ajouter un répertoire dans la section "Répertoires" ci-dessous pour utiliser SmartAuto');
        return;
      }

      // Déterminer le mode: Git ou Files
      const hasExistingFiles = config.directories.length > 0 || config.files.length > 0;

      let response;

      if (!hasExistingFiles) {
        // Mode Git: détecter la racine Git et analyser
        const gitRootResponse = await smartAutoService.detectGitRoot({
          startPath: smartAutoProjectPath
        });

        if (!gitRootResponse.success || !gitRootResponse.data?.gitRoot) {
          setError('Aucun repository Git trouvé. SmartAuto analysera les fichiers du répertoire.');
          // Continue avec le mode Files même sans Git
        }

        const gitRoot = gitRootResponse.data?.gitRoot || smartAutoProjectPath;

        // Analyser depuis Git
        response = await smartAutoService.analyzeFromGit({
          projectPath: gitRoot,
          depth,
          includeTests: true,
          includeStyles: true
        });
      } else {
        // Mode Files: analyser depuis les fichiers existants
        const projectPath = smartAutoProjectPath;

        // IMPORTANT: N'envoyer QUE les fichiers, pas les répertoires
        // Les répertoires ne peuvent pas être analysés pour les dépendances
        response = await smartAutoService.analyzeFromFiles({
          projectPath,
          files: config.files,  // Seulement les fichiers, pas config.directories
          depth,
          includeTests: true,
          includeStyles: true
        });
      }

      if (!response.success || !response.data) {
        setError(response.error || 'Erreur lors de l\'analyse SmartAuto');
        return;
      }

      // Extraire les fichiers avec chemins relatifs pour l'affichage
      const allFiles = response.data.allFiles.map(f => f.path);

      // NOUVEAU: Séparer les répertoires des fichiers individuels
      // Pour simplifier, on met tout dans files pour l'instant
      const directories: string[] = [];
      const files: string[] = [...allFiles];

      // Optionnel: Détecter les répertoires communs et les regrouper
      // Si un répertoire contient 5+ fichiers, on peut l'ajouter comme directory
      const pathGroups = new Map<string, string[]>();
      for (const file of allFiles) {
        const parts = file.split(/[/\\]/);
        if (parts.length > 1) {
          const dir = parts.slice(0, -1).join('/');
          if (!pathGroups.has(dir)) {
            pathGroups.set(dir, []);
          }
          pathGroups.get(dir)!.push(file);
        }
      }

      // Si un répertoire contient beaucoup de fichiers, l'ajouter comme directory
      for (const [dir, dirFiles] of pathGroups.entries()) {
        if (dirFiles.length >= 5) {
          directories.push(dir);
          // Retirer ces fichiers de la liste files
          dirFiles.forEach(f => {
            const index = files.indexOf(f);
            if (index > -1) files.splice(index, 1);
          });
        }
      }

      // Mettre à jour la configuration avec les nouveaux fichiers et répertoires
      const newConfig: CopyConfig = {
        ...config,
        directories, // Peupler les répertoires
        files,       // Peupler les fichiers
        smartAuto: {
          depth,
          source: hasExistingFiles ? 'files' : 'git',
          timestamp: Date.now(),
          projectRoot: response.data.metadata.projectRoot
        }
      };

      setConfig(newConfig);
      setSmartAutoDepth(depth);

      // Sauvegarder dans le storage
      if (activeTab) {
        StorageManager.saveTabConfig(activeTab, newConfig);
        // Sauvegarder aussi le chemin projet pour la prochaine fois
        localStorage.setItem(`smartauto-project-path-${activeTab}`, smartAutoProjectPath);
      }

      console.log(`✅ [CopyToolContext] SmartAuto appliqué: ${directories.length} répertoires, ${files.length} fichiers sélectionnés (niveau ${depth})`);
      console.log('🔍 [CopyToolContext] New config.smartAuto:', newConfig.smartAuto);
      console.log('🔍 [CopyToolContext] New directories:', directories);
      console.log('🔍 [CopyToolContext] New files:', files.slice(0, 10), '... (showing first 10)');

      // Message de succès pour l'utilisateur
      // Note: L'utilisateur doit maintenant cliquer sur "Rechercher" pour scanner les fichiers

    } catch (err) {
      console.error('❌ [CopyToolContext] Erreur SmartAuto:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setIsSmartAutoLoading(false);
    }
  };

  // Copier le contenu formaté dans le presse-papier
  const copyToClipboard = async () => {
    try {
      const { results: updatedResults } = await apiCopyToClipboard(config, results);
      setResults(updatedResults);
    } catch (err) {
      // L'erreur est déjà gérée dans le hook useApiOperations
      console.error('Erreur lors de la copie:', err);
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
        smartAutoDepth,
        smartAutoProjectPath,
        isGitRepo,
        isSmartAutoLoading,
        setSmartAutoDepth,
        setSmartAutoProjectPath,
        applySmartAuto,
        directoryInput: formInputs.directoryInput,
        fileInput: formInputs.fileInput,
        extensionInput: formInputs.extensionInput,
        patternInput: formInputs.patternInput,
        excludeDirectoryInput: formInputs.excludeDirectoryInput,
        setConfig,
        setDirectoryInput: formInputs.setDirectoryInput,
        setFileInput: formInputs.setFileInput,
        setExtensionInput: formInputs.setExtensionInput,
        setPatternInput: formInputs.setPatternInput,
        setExcludeDirectoryInput: formInputs.setExcludeDirectoryInput,
        setIsRemoteMode,
        setSelectedSSHConnection,
        addDirectory: configActions.addDirectory,
        addFile: configActions.addFile,
        addExcludeExtension: configActions.addExcludeExtension,
        addExcludePattern: configActions.addExcludePattern,
        addExcludeDirectory: configActions.addExcludeDirectory,
        removeItem: configActions.removeItem,
        editItem: configActions.editItem,
        toggleRecursive: configActions.toggleRecursive,
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