// Types pour les connexions SSH
export interface SSHConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  savePassword: boolean;
  timestamp: number;
}

// Types pour la configuration globale de l'application
export interface GlobalConfig {
  ssh: {
    connections: SSHConnection[];
  };
  // Espace pour d'autres configurations globales à l'avenir
  // ui?: any;
  // api?: any;
}

// Fonction pour créer une connexion SSH vide
export const createEmptySSHConnection = (): SSHConnection => ({
  id: crypto.randomUUID(),
  name: '',
  host: '',
  port: 22,
  username: '',
  password: '',
  savePassword: false,
  timestamp: Date.now()
});

// Clés de stockage pour la configuration globale
export const STORAGE_KEYS = {
  GLOBAL_SSH_CONNECTIONS: "toolbox-ssh-connections",
  // Migration depuis l'ancienne clé
  LEGACY_COPY_TOOL_SSH: "copy-tool-ssh-connections"
} as const;