import { CopyConfig, CopyResult, SSHConnection, FormInputs } from "../types";
import { PersistedTab, TabMetadata } from "@/contexts/TabsContext";

// Clés de stockage local pour l'état de l'outil
export const STORAGE_KEYS = {
  CONFIG: "copy-tool-current-config",
  RESULTS: "copy-tool-current-results",
  TAB_CONFIG: "copy-tool-tab-configs",
  TAB_RESULTS: "copy-tool-tab-results",
  EXISTING_TABS: "copy-tool-existing-tabs",
  TAB_REMOTE_MODE: "copy-tool-tab-remote-modes",
  TAB_SSH_CONNECTION: "copy-tool-tab-ssh-connections",
  // Nouvelles clés pour la persistance des onglets
  PERSISTENT_TABS: "app-persistent-tabs",
  TAB_METADATA: "app-tab-metadata", 
  TAB_FORM_INPUTS: "copy-tool-tab-form-inputs"
} as const;

/**
 * Utilitaires de gestion du stockage local pour l'outil de copie
 */
export class StorageManager {
  /**
   * Charge la configuration d'un onglet
   */
  static loadTabConfig(tabId: string): CopyConfig | null {
    try {
      const tabConfigs = JSON.parse(localStorage.getItem(STORAGE_KEYS.TAB_CONFIG) || '{}');
      return tabConfigs[tabId] || null;
    } catch (error) {
      console.error("Erreur lors du chargement de la configuration de l'onglet:", error);
      return null;
    }
  }

  /**
   * Sauvegarde la configuration d'un onglet
   */
  static saveTabConfig(tabId: string, config: CopyConfig): void {
    try {
      // Sauvegarde globale pour compatibilité
      localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
      
      // Sauvegarde spécifique à l'onglet
      const tabConfigs = JSON.parse(localStorage.getItem(STORAGE_KEYS.TAB_CONFIG) || '{}');
      tabConfigs[tabId] = config;
      localStorage.setItem(STORAGE_KEYS.TAB_CONFIG, JSON.stringify(tabConfigs));
    } catch (error) {
      console.error("Erreur lors de la sauvegarde de la configuration:", error);
    }
  }

  /**
   * Charge les résultats d'un onglet
   */
  static loadTabResults(tabId: string): CopyResult | null {
    try {
      const tabResults = JSON.parse(localStorage.getItem(STORAGE_KEYS.TAB_RESULTS) || '{}');
      return tabResults[tabId] || null;
    } catch (error) {
      console.error("Erreur lors du chargement des résultats de l'onglet:", error);
      return null;
    }
  }

  /**
   * Sauvegarde les résultats d'un onglet
   */
  static saveTabResults(tabId: string, results: CopyResult | null): void {
    try {
      // Sauvegarde globale pour compatibilité
      if (results) {
        localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(results));
      } else {
        localStorage.removeItem(STORAGE_KEYS.RESULTS);
      }
      
      // Sauvegarde spécifique à l'onglet
      const tabResults = JSON.parse(localStorage.getItem(STORAGE_KEYS.TAB_RESULTS) || '{}');
      if (results) {
        tabResults[tabId] = results;
      } else {
        delete tabResults[tabId];
      }
      localStorage.setItem(STORAGE_KEYS.TAB_RESULTS, JSON.stringify(tabResults));
    } catch (error) {
      console.error("Erreur lors de la sauvegarde des résultats:", error);
    }
  }

  /**
   * Charge le mode distant d'un onglet
   */
  static loadTabRemoteMode(tabId: string): boolean {
    try {
      const tabRemoteModes = JSON.parse(localStorage.getItem(STORAGE_KEYS.TAB_REMOTE_MODE) || '{}');
      return tabRemoteModes[tabId] || false;
    } catch (error) {
      console.error("Erreur lors du chargement du mode distant:", error);
      return false;
    }
  }

  /**
   * Sauvegarde le mode distant d'un onglet
   */
  static saveTabRemoteMode(tabId: string, isRemoteMode: boolean): void {
    try {
      const tabRemoteModes = JSON.parse(localStorage.getItem(STORAGE_KEYS.TAB_REMOTE_MODE) || '{}');
      tabRemoteModes[tabId] = isRemoteMode;
      localStorage.setItem(STORAGE_KEYS.TAB_REMOTE_MODE, JSON.stringify(tabRemoteModes));
    } catch (error) {
      console.error("Erreur lors de la sauvegarde du mode distant:", error);
    }
  }

  /**
   * Charge la connexion SSH d'un onglet
   */
  static loadTabSSHConnection(tabId: string): SSHConnection | null {
    try {
      const tabSSHConnections = JSON.parse(localStorage.getItem(STORAGE_KEYS.TAB_SSH_CONNECTION) || '{}');
      return tabSSHConnections[tabId] || null;
    } catch (error) {
      console.error("Erreur lors du chargement de la connexion SSH:", error);
      return null;
    }
  }

  /**
   * Sauvegarde la connexion SSH d'un onglet
   */
  static saveTabSSHConnection(tabId: string, connection: SSHConnection | null): void {
    try {
      const tabSSHConnections = JSON.parse(localStorage.getItem(STORAGE_KEYS.TAB_SSH_CONNECTION) || '{}');
      if (connection) {
        tabSSHConnections[tabId] = connection;
      } else {
        delete tabSSHConnections[tabId];
      }
      localStorage.setItem(STORAGE_KEYS.TAB_SSH_CONNECTION, JSON.stringify(tabSSHConnections));
    } catch (error) {
      console.error("Erreur lors de la sauvegarde de la connexion SSH:", error);
    }
  }

  /**
   * Charge la liste des onglets existants
   */
  static loadExistingTabs(): string[] {
    try {
      const savedTabs = localStorage.getItem(STORAGE_KEYS.EXISTING_TABS);
      return savedTabs ? JSON.parse(savedTabs) : [];
    } catch (error) {
      console.error("Erreur lors du chargement des onglets existants:", error);
      return [];
    }
  }

  /**
   * Sauvegarde la liste des onglets existants
   */
  static saveExistingTabs(tabs: string[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.EXISTING_TABS, JSON.stringify(tabs));
    } catch (error) {
      console.error("Erreur lors de la sauvegarde des onglets existants:", error);
    }
  }

  /**
   * Vérifie si un onglet est nouveau
   */
  static isNewTab(tabId: string): boolean {
    const existingTabs = this.loadExistingTabs();
    const tabConfig = this.loadTabConfig(tabId);
    return !existingTabs.includes(tabId) && !tabConfig;
  }

  /**
   * Marque un onglet comme existant
   */
  static markTabAsExisting(tabId: string): void {
    const existingTabs = this.loadExistingTabs();
    if (!existingTabs.includes(tabId)) {
      const updatedTabs = [...existingTabs, tabId];
      this.saveExistingTabs(updatedTabs);
    }
  }

  /**
   * Supprime les données d'un onglet
   */
  static clearTabData(tabId: string): void {
    try {
      // Supprimer la configuration
      const tabConfigs = JSON.parse(localStorage.getItem(STORAGE_KEYS.TAB_CONFIG) || '{}');
      delete tabConfigs[tabId];
      localStorage.setItem(STORAGE_KEYS.TAB_CONFIG, JSON.stringify(tabConfigs));

      // Supprimer les résultats
      const tabResults = JSON.parse(localStorage.getItem(STORAGE_KEYS.TAB_RESULTS) || '{}');
      delete tabResults[tabId];
      localStorage.setItem(STORAGE_KEYS.TAB_RESULTS, JSON.stringify(tabResults));

      // Supprimer le mode distant
      const tabRemoteModes = JSON.parse(localStorage.getItem(STORAGE_KEYS.TAB_REMOTE_MODE) || '{}');
      delete tabRemoteModes[tabId];
      localStorage.setItem(STORAGE_KEYS.TAB_REMOTE_MODE, JSON.stringify(tabRemoteModes));

      // Supprimer la connexion SSH
      const tabSSHConnections = JSON.parse(localStorage.getItem(STORAGE_KEYS.TAB_SSH_CONNECTION) || '{}');
      delete tabSSHConnections[tabId];
      localStorage.setItem(STORAGE_KEYS.TAB_SSH_CONNECTION, JSON.stringify(tabSSHConnections));

      // Supprimer les inputs de formulaire
      const tabFormInputs = JSON.parse(localStorage.getItem(STORAGE_KEYS.TAB_FORM_INPUTS) || '{}');
      delete tabFormInputs[tabId];
      localStorage.setItem(STORAGE_KEYS.TAB_FORM_INPUTS, JSON.stringify(tabFormInputs));
    } catch (error) {
      console.error("Erreur lors de la suppression des données de l'onglet:", error);
    }
  }

  // ========================================
  // NOUVELLES MÉTHODES POUR LA PERSISTANCE DES ONGLETS
  // ========================================

  /**
   * Sauvegarde les onglets persistés
   */
  static savePersistedTabs(tabs: PersistedTab[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PERSISTENT_TABS, JSON.stringify(tabs));
    } catch (error) {
      console.error("Erreur lors de la sauvegarde des onglets persistés:", error);
    }
  }

  /**
   * Charge les onglets persistés
   */
  static loadPersistedTabs(): PersistedTab[] {
    try {
      const savedTabs = localStorage.getItem(STORAGE_KEYS.PERSISTENT_TABS);
      return savedTabs ? JSON.parse(savedTabs) : [];
    } catch (error) {
      console.error("Erreur lors du chargement des onglets persistés:", error);
      return [];
    }
  }

  /**
   * Sauvegarde les métadonnées des onglets
   */
  static saveTabMetadata(metadata: TabMetadata): void {
    try {
      localStorage.setItem(STORAGE_KEYS.TAB_METADATA, JSON.stringify(metadata));
    } catch (error) {
      console.error("Erreur lors de la sauvegarde des métadonnées d'onglets:", error);
    }
  }

  /**
   * Charge les métadonnées des onglets
   */
  static loadTabMetadata(): TabMetadata {
    try {
      const savedMetadata = localStorage.getItem(STORAGE_KEYS.TAB_METADATA);
      return savedMetadata ? JSON.parse(savedMetadata) : {
        lastActiveTab: null,
        tabOrder: []
      };
    } catch (error) {
      console.error("Erreur lors du chargement des métadonnées d'onglets:", error);
      return {
        lastActiveTab: null,
        tabOrder: []
      };
    }
  }

  /**
   * Sauvegarde les inputs de formulaire d'un onglet
   */
  static saveFormInputs(tabId: string, inputs: FormInputs): void {
    try {
      const tabFormInputs = JSON.parse(localStorage.getItem(STORAGE_KEYS.TAB_FORM_INPUTS) || '{}');
      tabFormInputs[tabId] = inputs;
      localStorage.setItem(STORAGE_KEYS.TAB_FORM_INPUTS, JSON.stringify(tabFormInputs));
    } catch (error) {
      console.error("Erreur lors de la sauvegarde des inputs de formulaire:", error);
    }
  }

  /**
   * Charge les inputs de formulaire d'un onglet
   */
  static loadFormInputs(tabId: string): FormInputs | null {
    try {
      const tabFormInputs = JSON.parse(localStorage.getItem(STORAGE_KEYS.TAB_FORM_INPUTS) || '{}');
      return tabFormInputs[tabId] || null;
    } catch (error) {
      console.error("Erreur lors du chargement des inputs de formulaire:", error);
      return null;
    }
  }

  /**
   * Supprime un onglet des données persistées
   */
  static removePersistedTab(tabId: string): void {
    try {
      // Supprimer de la liste des onglets persistés
      const persistedTabs = this.loadPersistedTabs();
      const updatedTabs = persistedTabs.filter(tab => tab.id !== tabId);
      this.savePersistedTabs(updatedTabs);

      // Mettre à jour les métadonnées
      const metadata = this.loadTabMetadata();
      metadata.tabOrder = metadata.tabOrder.filter(id => id !== tabId);
      if (metadata.lastActiveTab === tabId) {
        metadata.lastActiveTab = null;
      }
      this.saveTabMetadata(metadata);

      // Supprimer toutes les données associées à l'onglet
      this.clearTabData(tabId);
    } catch (error) {
      console.error("Erreur lors de la suppression de l'onglet persisté:", error);
    }
  }

  /**
   * Nettoie les onglets anciens (plus de X jours)
   */
  static cleanupOldTabs(maxAgeInDays: number = 30): void {
    try {
      const persistedTabs = this.loadPersistedTabs();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - maxAgeInDays);

      const validTabs = persistedTabs.filter(tab => {
        // Ne jamais supprimer le Dashboard
        if (tab.type === 'Dashboard') return true;
        
        const createdAt = new Date(tab.createdAt);
        return createdAt > cutoffDate;
      });

      // Nettoyer les onglets supprimés
      const removedTabIds = persistedTabs
        .filter(tab => !validTabs.includes(tab))
        .map(tab => tab.id);

      removedTabIds.forEach(tabId => {
        this.clearTabData(tabId);
      });

      // Sauvegarder les onglets valides
      this.savePersistedTabs(validTabs);

      // Mettre à jour les métadonnées
      const metadata = this.loadTabMetadata();
      metadata.tabOrder = metadata.tabOrder.filter(id => 
        validTabs.some(tab => tab.id === id)
      );
      if (metadata.lastActiveTab && removedTabIds.includes(metadata.lastActiveTab)) {
        metadata.lastActiveTab = null;
      }
      this.saveTabMetadata(metadata);

    } catch (error) {
      console.error("Erreur lors du nettoyage des anciens onglets:", error);
    }
  }
}