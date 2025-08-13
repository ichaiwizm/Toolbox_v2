export interface CopyConfig {
  id: string;
  directories: string[];
  files: string[];
  excludeExtensions: string[];
  excludePatterns: string[];
  excludeDirectories: string[];
  recursive: boolean;
  timestamp: number;
  name?: string;
  isFavorite?: boolean;
  // Informations mode distant
  isRemoteMode?: boolean;
  sshConnection?: SSHConnection;
}

export interface FileMatch {
  path: string;
  name: string;
  size: number;
  extension: string;
}

export interface PathError {
  original_path: string;
  clean_path: string;
  error_type: string;
  message: string;
}

export interface FileStats {
  totalLines: number;
  totalWords: number;
  totalChars: number;
  fileCount: number;
  folderCount: number;
  totalSubdirectories: number;
  totalSize: number;
  totalSizeFormatted: string;
  byExtension: Record<string, number>;
}

export interface CopyResult {
  matches: FileMatch[];
  totalMatches: number;
  formattedContent: string;
  stats: FileStats;
  invalid_paths?: PathError[];
}

// API payload types
export interface ScanRequestPayload {
  directories: string[];
  files: string[];
  rules: {
    include_extensions: string[];
    exclude_extensions: string[];
    include_patterns: string[];
    exclude_patterns: string[];
    exclude_directories: string[];
  };
  recursive: boolean;
}

// Constants
export const MAX_HISTORY_ITEMS = 20;
export const STORAGE_KEY = "copy-tool-history";

// Dossiers communs à exclure par défaut
export const DEFAULT_EXCLUDED_DIRECTORIES = [
  "node_modules",
  "__pycache__",
  ".git",
  ".venv",
  "venv",
  "env",
  "dist",
  "build",
  ".cache",
  ".idea",
  ".vs",
  ".vscode",
  "coverage",
  "tmp",
  "temp",
  ".vite",
  "vendor"
];

// Motifs communs à exclure par défaut
export const DEFAULT_EXCLUDED_PATTERNS = [
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  ".DS_Store",
  "Thumbs.db",
  ".pyc$",
  ".pyo$",
  ".log$",
  ".bak$",
  ".swp$",
  "~$",
  ".tmp$",
  ".gitignore",
  "components.json",
  "eslint.config.js",
  "vite-env.d.ts",
  ".last_sync.json"
];

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

// Fonction pour créer une configuration vide
export const createEmptyConfig = (): CopyConfig => ({
  id: crypto.randomUUID(),
  directories: [],
  files: [],
  excludeExtensions: [],
  excludePatterns: [...DEFAULT_EXCLUDED_PATTERNS],
  excludeDirectories: [...DEFAULT_EXCLUDED_DIRECTORIES],
  recursive: true,
  timestamp: Date.now(),
  isFavorite: false
});

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