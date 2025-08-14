import { useState, useEffect } from "react";
import { SSHConnection, createEmptySSHConnection } from "../../../types";

const STORAGE_KEY = "copy-tool-ssh-connections";

/**
 * Hook pour gérer les connexions SSH
 */
export function useSSHConnections() {
  const [connections, setConnections] = useState<SSHConnection[]>([]);

  // Charger connexions depuis localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setConnections(JSON.parse(saved));
      } catch (e) {
        console.error("Erreur chargement connexions SSH:", e);
      }
    }
  }, []);

  // Sauvegarder connexions
  const saveConnections = (conns: SSHConnection[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conns));
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

  return {
    connections,
    saveConnection,
    deleteConnection
  };
}