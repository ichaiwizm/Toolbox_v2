import { GitDetectionService } from './git-detection-service.js';
import { DependencyAnalyzerService } from './dependency-analyzer-service.js';
import { stat } from 'fs/promises';
import { join, relative, resolve } from 'path';
import { getLogger } from '../../utils/logger.js';

const logger = getLogger();

/**
 * Service principal SmartAuto - Orchestration de l'analyse intelligente
 */
export class SmartAutoService {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.gitService = new GitDetectionService(projectRoot);
    this.depAnalyzer = new DependencyAnalyzerService();

    // Limites par défaut
    this.MAX_FILES = 50;
    this.MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
  }

  /**
   * Analyse un projet depuis les fichiers Git modifiés
   * @param {Object} options - Options d'analyse
   * @param {number} options.depth - Profondeur d'analyse des dépendances (1, 2, 3)
   * @param {boolean} options.includeTests - Inclure fichiers de test
   * @param {boolean} options.includeStyles - Inclure fichiers de style
   * @returns {Promise<Object>} Résultats de l'analyse
   */
  async analyzeFromGit(options = {}) {
    const {
      depth = 1,
      includeTests = true,
      includeStyles = true
    } = options;

    logger.info(`SmartAuto: Analyzing from Git (depth=${depth})`);

    const results = {
      gitFiles: [],
      linkedFiles: [],
      allFiles: [],
      stats: {
        totalFiles: 0,
        totalSize: 0,
        limitExceeded: false,
        filesFromGit: 0,
        filesFromDeps: 0
      },
      metadata: {
        source: 'git',
        depth,
        projectRoot: this.projectRoot
      }
    };

    try {
      // 1. Vérifier si c'est un repo Git
      const isGitRepo = await this.gitService.isGitRepository();
      if (!isGitRepo) {
        throw new Error('Not a Git repository');
      }

      // 2. Récupérer les fichiers Git modifiés
      const gitFiles = await this.gitService.getAllChangedFiles();
      logger.info(`Found ${gitFiles.length} Git-modified files`);

      if (gitFiles.length === 0) {
        logger.warn('No Git-modified files found');
        return results;
      }

      // Convertir en chemins absolus
      results.gitFiles = gitFiles.map(f => join(this.projectRoot, f));

      // 3. Analyser les dépendances pour chaque fichier Git
      const linkedFilesSet = new Set();

      // Niveau 1: Pas d'analyse de dépendances, juste les fichiers Git
      if (depth === 1) {
        logger.info('Depth=1: Only including Git files, no dependency analysis');
      } else {
        // Niveau 2 et 3: Analyser les dépendances
        // depth - 1 car: niveau 2 = 1 niveau d'imports, niveau 3 = 2 niveaux d'imports
        const depthForAnalysis = depth - 1;
        logger.info(`Depth=${depth}: Analyzing dependencies with depth ${depthForAnalysis}`);

        for (const gitFile of results.gitFiles) {
          try {
            // Analyse profonde selon le niveau
            const deps = await this.depAnalyzer.getDeepDependencies(
              gitFile,
              this.projectRoot,
              depthForAnalysis
            );

            // Filtrer selon les options
            for (const dep of deps) {
              if (!includeTests && this.depAnalyzer.isTestFile(dep)) {
                continue;
              }
              if (!includeStyles && this.depAnalyzer.isStyleFile(dep)) {
                continue;
              }
              linkedFilesSet.add(dep);
            }

          } catch (error) {
            logger.warn(`Error analyzing dependencies for ${gitFile}:`, error.message);
          }
        }
      }

      results.linkedFiles = Array.from(linkedFilesSet);
      logger.info(`Found ${results.linkedFiles.length} linked files`);

      // 4. Combiner et dédupliquer
      const allFilesSet = new Set([
        ...results.gitFiles,
        ...results.linkedFiles
      ]);
      results.allFiles = Array.from(allFilesSet);

      // 5. Appliquer les limites
      const filteredResults = await this.applyLimits(results.allFiles);

      results.allFiles = filteredResults.files;
      results.stats = {
        ...filteredResults.stats,
        filesFromGit: results.gitFiles.length,
        filesFromDeps: results.linkedFiles.length
      };

      logger.info(`SmartAuto completed: ${results.stats.totalFiles} files selected (${results.stats.totalSize} bytes)`);
      return results;

    } catch (error) {
      logger.error('SmartAuto analysis from Git failed:', error);
      throw error;
    }
  }

  /**
   * Analyse depuis une liste de fichiers fournie
   * @param {string[]} files - Liste des fichiers de base (can be absolute or relative)
   * @param {Object} options - Options d'analyse
   * @returns {Promise<Object>} Résultats de l'analyse
   */
  async analyzeFromFiles(files, options = {}) {
    const {
      depth = 1,
      includeTests = true,
      includeStyles = true
    } = options;

    logger.info(`SmartAuto: Analyzing from ${files.length} files (depth=${depth})`);

    const results = {
      baseFiles: files,
      linkedFiles: [],
      allFiles: [],
      stats: {
        totalFiles: 0,
        totalSize: 0,
        limitExceeded: false,
        filesFromBase: files.length,
        filesFromDeps: 0
      },
      metadata: {
        source: 'files',
        depth,
        projectRoot: this.projectRoot
      }
    };

    try {
      // Analyser les dépendances pour chaque fichier
      const linkedFilesSet = new Set();

      // Niveau 1: Pas d'analyse de dépendances, juste les fichiers de base
      if (depth === 1) {
        logger.info('Depth=1: Only including base files, no dependency analysis');
      } else {
        // Niveau 2 et 3: Analyser les dépendances
        // depth - 1 car: niveau 2 = 1 niveau d'imports, niveau 3 = 2 niveaux d'imports
        const depthForAnalysis = depth - 1;
        logger.info(`Depth=${depth}: Analyzing dependencies with depth ${depthForAnalysis}`);

        for (const file of files) {
          // FIXED: Handle both absolute and relative paths
          // Check if the path is already absolute
          const isAbsolute = resolve(file) === file;
          const absolutePath = isAbsolute ? file : join(this.projectRoot, file);

          try {
            const deps = await this.depAnalyzer.getDeepDependencies(
              absolutePath,
              this.projectRoot,
              depthForAnalysis
            );

            logger.debug(`[Depth=${depth}] File ${relative(this.projectRoot, absolutePath)}: found ${deps.length} dependencies`);

            // Filtrer selon les options
            for (const dep of deps) {
              if (!includeTests && this.depAnalyzer.isTestFile(dep)) {
                logger.debug(`  Excluding test file: ${relative(this.projectRoot, dep)}`);
                continue;
              }
              if (!includeStyles && this.depAnalyzer.isStyleFile(dep)) {
                logger.debug(`  Excluding style file: ${relative(this.projectRoot, dep)}`);
                continue;
              }
              linkedFilesSet.add(dep);
            }

          } catch (error) {
            logger.warn(`Error analyzing dependencies for ${file}:`, error.message);
          }
        }
      }

      results.linkedFiles = Array.from(linkedFilesSet);
      logger.info(`Found ${results.linkedFiles.length} linked files`);

      // FIXED: Handle both absolute and relative base files
      const absoluteBaseFiles = files.map(f => {
        const isAbsolute = resolve(f) === f;
        return isAbsolute ? f : join(this.projectRoot, f);
      });

      // Combiner
      const allFilesSet = new Set([
        ...absoluteBaseFiles,
        ...results.linkedFiles
      ]);
      results.allFiles = Array.from(allFilesSet);

      // Appliquer les limites
      const filteredResults = await this.applyLimits(results.allFiles);

      results.allFiles = filteredResults.files;
      results.stats = {
        ...filteredResults.stats,
        filesFromBase: files.length,
        filesFromDeps: results.linkedFiles.length
      };

      logger.info(`SmartAuto completed: ${results.stats.totalFiles} files selected`);
      return results;

    } catch (error) {
      logger.error('SmartAuto analysis from files failed:', error);
      throw error;
    }
  }

  /**
   * Applique les limites de nombre de fichiers et taille totale
   * @param {string[]} files - Liste des fichiers
   * @returns {Promise<Object>} Fichiers filtrés et statistiques
   */
  async applyLimits(files) {
    let totalSize = 0;
    const includedFiles = [];
    const excludedFiles = [];

    for (const file of files) {
      // Vérifier limite de nombre
      if (includedFiles.length >= this.MAX_FILES) {
        excludedFiles.push({ path: file, reason: 'max_files_reached' });
        continue;
      }

      try {
        const stats = await stat(file);

        // *** FIX: Skip directories ***
        if (stats.isDirectory()) {
          logger.debug(`Skipping directory: ${relative(this.projectRoot, file)}`);
          excludedFiles.push({ path: file, reason: 'is_directory' });
          continue;
        }

        // Vérifier limite de taille
        if (totalSize + stats.size > this.MAX_SIZE_BYTES) {
          excludedFiles.push({ path: file, reason: 'max_size_reached', size: stats.size });
          continue;
        }

        totalSize += stats.size;
        includedFiles.push({
          path: file,  // Use absolute path to prevent duplication
          relativePath: relative(this.projectRoot, file),
          size: stats.size,
          name: file.split('/').pop(),
          extension: file.split('.').pop()
        });

      } catch (error) {
        logger.warn(`Could not stat file ${file}:`, error.message);
        excludedFiles.push({ path: file, reason: 'stat_error', error: error.message });
      }
    }

    const limitExceeded = excludedFiles.length > 0;

    if (limitExceeded) {
      logger.warn(`Limits exceeded: ${excludedFiles.length} files excluded`);
    }

    return {
      files: includedFiles,
      stats: {
        totalFiles: includedFiles.length,
        totalSize,
        limitExceeded,
        excludedCount: excludedFiles.length
      },
      excluded: excludedFiles
    };
  }

  /**
   * Configure les limites
   * @param {number} maxFiles - Nombre maximum de fichiers
   * @param {number} maxSizeMB - Taille maximum en MB
   */
  setLimits(maxFiles, maxSizeMB) {
    this.MAX_FILES = maxFiles;
    this.MAX_SIZE_BYTES = maxSizeMB * 1024 * 1024;
    logger.info(`Limits updated: ${maxFiles} files, ${maxSizeMB} MB`);
  }
}
