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
  const [isRemoteMode, setIsRemoteMode] = useState(false);
  const [selectedSSHConnection, setSelectedSSHConnection] = useState<SSHConnection | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [existingTabs, setExistingTabs] = useState<string[]>([]);

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