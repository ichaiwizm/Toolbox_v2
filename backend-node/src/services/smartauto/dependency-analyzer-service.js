import { readFile, stat } from 'fs/promises';
import { resolve, dirname, extname, join, basename, relative } from 'path';
import { getLogger } from '../../utils/logger.js';

const logger = getLogger();

/**
 * Service pour analyser les dépendances entre fichiers
 */
export class DependencyAnalyzerService {
  constructor() {
    // Patterns regex pour détecter les imports
    this.patterns = {
      // ES6 imports: import X from 'Y' or import { A, B } from 'Y'
      es6Import: /import\s+(?:(?:\*\s+as\s+\w+)|(?:\w+)|(?:\{[^}]*\}))\s+from\s+['"]([^'"]+)['"]/g,

      // ES6 dynamic imports: import('module')
      dynamicImport: /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,

      // CommonJS: require('module')
      commonJs: /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,

      // CSS/SCSS imports
      cssImport: /@import\s+['"]([^'"]+)['"]/g
    };

    // Patterns de fichiers de test
    this.testPatterns = [
      '.test.js', '.test.jsx', '.test.ts', '.test.tsx',
      '.spec.js', '.spec.jsx', '.spec.ts', '.spec.tsx'
    ];

    // Extensions de fichiers de style
    this.styleExtensions = ['.css', '.scss', '.sass', '.less', '.module.css', '.module.scss'];

    // Extensions de fichiers analysables
    this.analyzableExtensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];
  }

  /**
   * Extrait tous les imports d'un fichier
   * @param {string} filePath - Chemin du fichier
   * @returns {Promise<string[]>} Liste des chemins importés
   */
  async extractImports(filePath) {
    try {
      const content = await readFile(filePath, 'utf-8');
      const imports = new Set();

      // Extraire les imports ES6
      let match;
      const patterns = Object.values(this.patterns);

      for (const pattern of patterns) {
        pattern.lastIndex = 0; // Reset regex
        while ((match = pattern.exec(content)) !== null) {
          imports.add(match[1]);
        }
      }

      logger.debug(`Extracted ${imports.size} imports from ${basename(filePath)}`);
      return Array.from(imports);

    } catch (error) {
      logger.warn(`Error extracting imports from ${filePath}:`, error.message);
      return [];
    }
  }

  /**
   * Résout un chemin d'import relatif vers un chemin absolu
   * @param {string} importPath - Chemin importé (ex: './utils/helper')
   * @param {string} sourceFilePath - Fichier source
   * @param {string} projectRoot - Racine du projet
   * @returns {Promise<string|null>} Chemin absolu ou null
   */
  async resolveImportPath(importPath, sourceFilePath, projectRoot) {
    // Ignorer les packages externes (pas de ./ ou ../)
    if (!importPath.startsWith('.')) {
      return null;
    }

    const sourceDir = dirname(sourceFilePath);
    let resolvedPath = resolve(sourceDir, importPath);

    // Si le chemin a déjà une extension, le retourner tel quel
    if (extname(resolvedPath)) {
      return resolvedPath;
    }

    // Pas d'extension: essayer différentes extensions de fichier
    for (const ext of this.analyzableExtensions) {
      const pathWithExt = resolvedPath + ext;
      try {
        const stats = await stat(pathWithExt);
        if (stats.isFile()) {
          return pathWithExt;
        }
      } catch {
        // File doesn't exist, try next
      }
    }

    // Essayer fichier index dans un répertoire
    for (const ext of this.analyzableExtensions) {
      const indexPath = join(resolvedPath, `index${ext}`);
      try {
        const stats = await stat(indexPath);
        if (stats.isFile()) {
          return indexPath;
        }
      } catch {
        // File doesn't exist, try next
      }
    }

    // Aucun fichier trouvé, retourner null au lieu du chemin du répertoire
    return null;
  }

  /**
   * Trouve les fichiers de test associés à un fichier source
   * @param {string} sourceFilePath - Chemin du fichier source
   * @returns {string[]} Liste des chemins de test possibles
   */
  findRelatedTestFiles(sourceFilePath) {
    const dir = dirname(sourceFilePath);
    const ext = extname(sourceFilePath);
    const baseName = basename(sourceFilePath, ext);

    const possibleTestFiles = [];

    // Pattern 1: Même répertoire avec suffix .test/.spec
    for (const pattern of this.testPatterns) {
      if (pattern.endsWith(ext)) {
        possibleTestFiles.push(join(dir, baseName + pattern));
      }
    }

    // Pattern 2: Répertoire __tests__
    const testDir = join(dir, '__tests__');
    for (const pattern of this.testPatterns) {
      if (pattern.endsWith(ext)) {
        possibleTestFiles.push(join(testDir, baseName + pattern));
      }
    }

    return possibleTestFiles;
  }

  /**
   * Trouve les fichiers de style associés à un composant
   * @param {string} sourceFilePath - Chemin du fichier source
   * @returns {string[]} Liste des chemins de style possibles
   */
  findRelatedStyleFiles(sourceFilePath) {
    const dir = dirname(sourceFilePath);
    const ext = extname(sourceFilePath);
    const baseName = basename(sourceFilePath, ext);

    return this.styleExtensions.map(styleExt =>
      join(dir, baseName + styleExt)
    );
  }

  /**
   * Vérifie si un fichier existe
   * @param {string} filePath - Chemin du fichier
   * @returns {Promise<boolean>}
   */
  async fileExists(filePath) {
    try {
      await stat(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Récupère tous les fichiers liés à un fichier source
   * @param {string} sourceFilePath - Chemin du fichier source
   * @param {string} projectRoot - Racine du projet
   * @returns {Promise<Object>} Objet avec imports, tests, styles
   */
  async getLinkedFiles(sourceFilePath, projectRoot) {
    const linkedFiles = {
      imports: [],
      tests: [],
      styles: [],
      all: []
    };

    try {
      // 1. Extraire les imports
      const imports = await this.extractImports(sourceFilePath);
      const resolvedImports = await Promise.all(
        imports.map(imp => this.resolveImportPath(imp, sourceFilePath, projectRoot))
      );
      const filteredImports = resolvedImports.filter(Boolean);

      // Vérifier l'existence des fichiers importés
      const existingImports = [];
      for (const importPath of filteredImports) {
        if (await this.fileExists(importPath)) {
          existingImports.push(importPath);
        }
      }
      linkedFiles.imports = existingImports;

      // 2. Trouver les fichiers de test
      const testFiles = this.findRelatedTestFiles(sourceFilePath);
      const existingTests = [];
      for (const testFile of testFiles) {
        if (await this.fileExists(testFile)) {
          existingTests.push(testFile);
        }
      }
      linkedFiles.tests = existingTests;

      // 3. Trouver les fichiers de style
      const styleFiles = this.findRelatedStyleFiles(sourceFilePath);
      const existingStyles = [];
      for (const styleFile of styleFiles) {
        if (await this.fileExists(styleFile)) {
          existingStyles.push(styleFile);
        }
      }
      linkedFiles.styles = existingStyles;

      // Combiner tous les fichiers uniques
      linkedFiles.all = [...new Set([
        ...linkedFiles.imports,
        ...linkedFiles.tests,
        ...linkedFiles.styles
      ])];

      logger.debug(`Linked files for ${basename(sourceFilePath)}: ${linkedFiles.all.length} total`);
      return linkedFiles;

    } catch (error) {
      logger.error(`Error getting linked files for ${sourceFilePath}:`, error);
      return linkedFiles;
    }
  }

  /**
   * Analyse récursive des dépendances avec profondeur limitée
   * @param {string} sourceFilePath - Fichier de départ
   * @param {string} projectRoot - Racine du projet
   * @param {number} maxDepth - Profondeur maximum (1, 2, 3)
   * @param {Set} visited - Fichiers déjà visités
   * @returns {Promise<string[]>} Liste de tous les fichiers dépendants
   */
  async getDeepDependencies(sourceFilePath, projectRoot, maxDepth = 1, visited = new Set()) {
    const indent = '  '.repeat(3 - maxDepth);
    logger.debug(`${indent}[Depth=${maxDepth}] Analyzing: ${relative(projectRoot, sourceFilePath)}`);

    if (visited.has(sourceFilePath)) {
      logger.debug(`${indent}  Already visited, skipping`);
      return [];
    }

    if (maxDepth <= 0) {
      logger.debug(`${indent}  Max depth reached, stopping`);
      return [];
    }

    visited.add(sourceFilePath);
    const allDeps = [];

    // Obtenir les fichiers liés directs
    const linked = await this.getLinkedFiles(sourceFilePath, projectRoot);
    logger.debug(`${indent}  Direct links: ${linked.all.length} files (${linked.imports.length} imports, ${linked.tests.length} tests, ${linked.styles.length} styles)`);
    allDeps.push(...linked.all);

    // Si on a encore de la profondeur, analyser récursivement les imports
    if (maxDepth > 1) {
      logger.debug(`${indent}  Recursing into ${linked.imports.length} imports (depth will be ${maxDepth - 1})`);
      for (const importPath of linked.imports) {
        if (!visited.has(importPath)) {
          const subDeps = await this.getDeepDependencies(
            importPath,
            projectRoot,
            maxDepth - 1,
            visited
          );
          allDeps.push(...subDeps);
        }
      }
    } else {
      logger.debug(`${indent}  Depth=1, not recursing further`);
    }

    const uniqueDeps = [...new Set(allDeps)];
    logger.debug(`${indent}  Total unique deps: ${uniqueDeps.length}`);
    return uniqueDeps;
  }

  /**
   * Vérifie si un fichier est un fichier de test
   * @param {string} filePath - Chemin du fichier
   * @returns {boolean}
   */
  isTestFile(filePath) {
    const fileName = basename(filePath);

    // Vérifier pattern .test. ou .spec.
    if (/\.(test|spec)\.(js|jsx|ts|tsx)$/.test(fileName)) {
      return true;
    }

    // Vérifier répertoire __tests__
    if (filePath.includes('/__tests__/') || filePath.includes('\\__tests__\\')) {
      return true;
    }

    return false;
  }

  /**
   * Vérifie si un fichier est un fichier de style
   * @param {string} filePath - Chemin du fichier
   * @returns {boolean}
   */
  isStyleFile(filePath) {
    const ext = extname(filePath);
    return this.styleExtensions.includes(ext);
  }
}
