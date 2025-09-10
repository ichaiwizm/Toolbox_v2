import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SSHConnection, STORAGE_KEYS } from '@/types/global';

interface SSHContextType {
  connections: SSHConnection[];
  saveConnection: (connection: SSHConnection, isEditing?: boolean) => void;
  deleteConnection: (id: string) => void;
  getConnection: (id: string) => SSHConnection | undefined;
}

const SSHContext = createContext<SSHContextType | undefined>(undefined);

interface SSHProviderProps {
  children: ReactNode;
}

export function SSHProvider({ children }: SSHProviderProps) {
  const [connections, setConnections] = useState<SSHConnection[]>([]);

  // Charger connexions depuis localStorage au démarrage
  useEffect(() => {
    loadConnections();
  }, []);

  // Fonction pour charger les connexions depuis le localStorage
  const loadConnections = () => {
    // Essayer d'abord la nouvelle clé globale
    let saved = localStorage.getItem(STORAGE_KEYS.GLOBAL_SSH_CONNECTIONS);
    
    // Si pas trouvé, essayer l'ancienne clé pour migration
    if (!saved) {
      saved = localStorage.getItem(STORAGE_KEYS.LEGACY_COPY_TOOL_SSH);
      if (saved) {
        // Migration : sauvegarder avec la nouvelle clé et supprimer l'ancienne
        localStorage.setItem(STORAGE_KEYS.GLOBAL_SSH_CONNECTIONS, saved);
        localStorage.removeItem(STORAGE_KEYS.LEGACY_COPY_TOOL_SSH);
      }
    }
    
    if (saved) {
      try {
        const loadedConnections = JSON.parse(saved);
        setConnections(Array.isArray(loadedConnections) ? loadedConnections : []);
      } catch (e) {
        console.error("Erreur chargement connexions SSH:", e);
        setConnections([]);
      }
    }
  };

  // Sauvegarder connexions dans localStorage
  const saveConnections = (conns: SSHConnection[]) => {
    localStorage.setItem(STORAGE_KEYS.GLOBAL_SSH_CONNECTIONS, JSON.stringify(conns));
    setConnections(conns);
  };

  // Ajouter ou modifier une connexion
  const saveConnection = (connection: SSHConnection, isEditing: boolean = false) => {
    const connData = {
      ...connection,
      name: connection.name.trim(),
      host: connection.host.trim(),
      username: connection.username.trim(),
      password: connection.savePassword ? connection.password : undefined,
      timestamp: Date.now()
    };

    if (isEditing) {
      saveConnections(connections.map(c => c.id === connection.id ? connData : c));
    } else {
      saveConnections([...connections, connData]);
    }
  };

  // Supprimer connexion
  const deleteConnection = (id: string) => {
    saveConnections(connections.filter(c => c.id !== id));
  };

  // Récupérer une connexion par ID
  const getConnection = (id: string) => {
    return connections.find(c => c.id === id);
  };

  const value: SSHContextType = {
    connections,
    saveConnection,
    deleteConnection,
    getConnection
  };

  return (
    <SSHContext.Provider value={value}>
      {children}
    </SSHContext.Provider>
  );
}

// Hook pour utiliser le contexte SSH
export function useSSH() {
  const context = useContext(SSHContext);
  if (context === undefined) {
    throw new Error('useSSH must be used within a SSHProvider');
  }
  return context;
}