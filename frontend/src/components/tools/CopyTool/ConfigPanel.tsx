import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useContext, useState, useRef, useEffect } from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { Sparkles, CheckCircle, AlertCircle, FolderOpen, X, Undo2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

import { useCopyTool, CopyToolProvider, CopyToolContext } from "./CopyToolContext";
import {
  CollapsibleSection,
  HistoryDialog,
  InputWithButton,
  ItemList
} from "./components";
import { useSSH } from "@/contexts/SSHContext";
import type { CopyConfig } from "./types";

/**
 * Panneau de configuration pour l'outil de copie
 */
export function ConfigPanel() {
  // Vérifier si nous sommes déjà dans un contexte CopyTool
  const contextExists = useContext(CopyToolContext) !== undefined;

  // Si le contexte existe déjà, on utilise directement le contenu
  // Sinon, on encapsule le contenu dans un CopyToolProvider
  if (contextExists) {
    return <ConfigPanelContent />;
  } else {
    return (
      <CopyToolProvider>
        <ConfigPanelContent />
      </CopyToolProvider>
    );
  }
}

/**
 * Contenu du panneau de configuration
 * Ce composant interne utilise le hook useCopyTool
 */
function ConfigPanelContent() {
  const {
    config,
    history,
    isRemoteMode,
    selectedSSHConnection,
    smartAutoDepth,
    smartAutoProjectPath,
    isGitRepo,
    isSmartAutoLoading,
    setSmartAutoDepth,
    setSmartAutoProjectPath,
    applySmartAuto,
    directoryInput,
    fileInput,
    extensionInput,
    patternInput,
    excludeDirectoryInput,
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
    setConfig,
    loadFromHistory,
    clearHistory,
    toggleFavorite
  } = useCopyTool();
  
  // Utiliser le contexte SSH global
  const { connections } = useSSH();

  // State local pour le changement de chemin projet
  const [showProjectPathInput, setShowProjectPathInput] = useState(false);
  const [tempProjectPath, setTempProjectPath] = useState("");

  // Sauvegarder la config précédente pour pouvoir annuler SmartAuto
  const [configBeforeSmartAuto, setConfigBeforeSmartAuto] = useState<{ directories: string[]; files: string[] } | null>(null);

  // Reset le bouton "Annuler" quand l'utilisateur change de niveau
  useEffect(() => {
    if (configBeforeSmartAuto !== null) {
      console.log('🔄 [SmartAuto] Depth changed, resetting Annuler button');
      setConfigBeforeSmartAuto(null);
    }
  }, [smartAutoDepth]);

  // Fonction pour appliquer SmartAuto en sauvegardant d'abord la config actuelle
  const handleApplySmartAuto = async () => {
    console.log('✅ [SmartAuto] Applying SmartAuto...');
    console.log('🔍 [SmartAuto] smartAutoDepth:', smartAutoDepth);
    console.log('🔍 [SmartAuto] Before - configBeforeSmartAuto:', configBeforeSmartAuto);

    if (!smartAutoDepth) {
      console.warn('⚠️ [SmartAuto] No depth selected, aborting');
      return;
    }

    // Sauvegarder la config actuelle avant d'appliquer SmartAuto
    setConfigBeforeSmartAuto({
      directories: [...config.directories],
      files: [...config.files]
    });

    console.log('🔍 [SmartAuto] Current config - directories:', config.directories);
    console.log('🔍 [SmartAuto] Current config - files:', config.files);

    // Appliquer SmartAuto
    await applySmartAuto(smartAutoDepth);
    console.log('✅ [SmartAuto] SmartAuto applied successfully');
  };

  // Fonction pour annuler SmartAuto et revenir à l'état précédent
  const handleCancelSmartAuto = () => {
    console.log('❌ [SmartAuto] Canceling SmartAuto...');
    console.log('🔍 [SmartAuto] configBeforeSmartAuto:', configBeforeSmartAuto);

    if (!configBeforeSmartAuto) {
      console.warn('⚠️ [SmartAuto] No previous config to restore');
      return;
    }

    // Restaurer la config précédente
    const newConfig = {
      ...config,
      directories: configBeforeSmartAuto.directories,
      files: configBeforeSmartAuto.files,
      smartAuto: undefined // Supprimer les métadonnées SmartAuto
    };

    console.log('🔍 [SmartAuto] Restoring - directories:', configBeforeSmartAuto.directories);
    console.log('🔍 [SmartAuto] Restoring - files:', configBeforeSmartAuto.files);

    setConfig(newConfig);
    setSmartAutoDepth(null);
    setConfigBeforeSmartAuto(null);
    console.log('✅ [SmartAuto] SmartAuto canceled, config restored');
  };

  // Le mode distant est maintenant géré par le contexte
  const handleRemoteModeChange = (checked: boolean) => {
    setIsRemoteMode(checked);
    
    // Si on active le mode distant et qu'aucune connexion n'est sélectionnée,
    // sélectionner automatiquement la première connexion disponible
    if (checked && !selectedSSHConnection && connections.length > 0) {
      setSelectedSSHConnection(connections[0]);
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <h3 className="text-lg font-medium">Configuration</h3>
          <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-2">
            <Label htmlFor="remote-mode" className={`text-sm font-medium transition-colors ${!isRemoteMode ? 'text-primary' : 'text-muted-foreground'}`}>
              Local
            </Label>
            <Switch 
              id="remote-mode"
              checked={isRemoteMode}
              onCheckedChange={handleRemoteModeChange}
            />
            <Label htmlFor="remote-mode" className={`text-sm font-medium transition-colors ${isRemoteMode ? 'text-primary' : 'text-muted-foreground'}`}>
              Distant
            </Label>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={resetConfig}>
            Réinitialiser
          </Button>
          
          <HistoryDialog 
            history={history} 
            onApplyConfig={loadFromHistory} 
            onClearHistory={clearHistory}
            onToggleFavorite={toggleFavorite} 
          />
        </div>
      </div>
      
      {/* Afficher la connexion SSH sélectionnée en mode distant */}
      {isRemoteMode && (
        <div className="bg-accent/50 rounded-md p-3">
          {selectedSSHConnection?.name ? (
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <span className="text-muted-foreground">Connexion active:</span>{" "}
                <span className="font-medium">{selectedSSHConnection.name}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  ({selectedSSHConnection.username}@{selectedSSHConnection.host})
                </span>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  const sshButton = document.querySelector('[title*="Configuration SSH"]') as HTMLElement;
                  sshButton?.click();
                }}
                className="h-7 text-xs"
              >
                Changer
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <span className="text-muted-foreground">Aucune connexion sélectionnée</span>
              </div>
              <Button 
                variant="default" 
                size="sm" 
                onClick={() => {
                  const sshButton = document.querySelector('[title*="Configuration SSH"]') as HTMLElement;
                  sshButton?.click();
                }}
                className="h-7 text-xs"
              >
                Configurer
              </Button>
            </div>
          )}
        </div>
      )}

      {/* SmartAuto - Sélection intelligente */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-lg border border-primary/20 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold flex items-center gap-2">
                SmartAuto
                {smartAutoDepth && (
                  <span className="text-xs bg-primary/20 px-2 py-0.5 rounded-full">
                    Niveau {smartAutoDepth}
                  </span>
                )}
              </h4>
              <p className="text-sm text-muted-foreground">
                Sélection intelligente basée sur Git et les dépendances
              </p>
            </div>
          </div>
        </div>

        {/* Project Path Display */}
        <div className="mb-3">
          {smartAutoProjectPath && !showProjectPathInput ? (
            <div className="flex items-center gap-2 bg-background/50 rounded p-2 text-xs">
              {isGitRepo ? (
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-orange-500 flex-shrink-0" />
              )}
              <FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">Projet:</span>
              <code className="flex-1 text-foreground font-mono overflow-hidden text-ellipsis whitespace-nowrap">
                {smartAutoProjectPath}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTempProjectPath(smartAutoProjectPath);
                  setShowProjectPathInput(true);
                }}
                className="h-6 text-xs flex-shrink-0"
              >
                Changer
              </Button>
            </div>
          ) : !showProjectPathInput ? (
            <div className="mb-3 space-y-2 p-3 bg-background rounded border">
              <Label className="text-xs">Chemin du projet</Label>
              <div className="flex gap-2">
                <Input
                  value={tempProjectPath}
                  onChange={(e) => setTempProjectPath(e.target.value)}
                  placeholder="C:\Users\...\MonProjet ou /chemin/vers/projet"
                  className="text-xs"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    if (tempProjectPath) {
                      setSmartAutoProjectPath(tempProjectPath);
                    }
                  }}
                  className="flex-shrink-0"
                >
                  Définir
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Project Path Input (when changing) */}
        {showProjectPathInput && (
          <div className="mb-3 space-y-2 p-3 bg-background rounded border">
            <Label className="text-xs">Chemin du projet</Label>
            <div className="flex gap-2">
              <Input
                value={tempProjectPath}
                onChange={(e) => setTempProjectPath(e.target.value)}
                placeholder="/chemin/vers/projet"
                className="text-xs"
              />
              <Button
                size="sm"
                onClick={() => {
                  if (tempProjectPath) {
                    setSmartAutoProjectPath(tempProjectPath);
                    setShowProjectPathInput(false);
                  }
                }}
                className="flex-shrink-0"
              >
                Définir
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowProjectPathInput(false)}
                className="flex-shrink-0"
              >
                Annuler
              </Button>
            </div>
          </div>
        )}

        {/* Level Selection and Apply */}
        <div className="space-y-2">
          <Label className="text-sm">Sélectionnez un niveau d'analyse</Label>
          <div className="flex items-center gap-2">
            <Button
              variant={smartAutoDepth === 1 ? "default" : "outline"}
              size="sm"
              onClick={() => setSmartAutoDepth(1)}
              disabled={!smartAutoProjectPath}
              className="h-8"
              title={!smartAutoProjectPath ? "Ajoutez un répertoire pour activer SmartAuto" : "Fichiers modifiés uniquement"}
            >
              Niveau 1
            </Button>
            <Button
              variant={smartAutoDepth === 2 ? "default" : "outline"}
              size="sm"
              onClick={() => setSmartAutoDepth(2)}
              disabled={!smartAutoProjectPath}
              className="h-8"
              title={!smartAutoProjectPath ? "Ajoutez un répertoire pour activer SmartAuto" : "Fichiers modifiés + dépendances directes"}
            >
              Niveau 2
            </Button>
            <Button
              variant={smartAutoDepth === 3 ? "default" : "outline"}
              size="sm"
              onClick={() => setSmartAutoDepth(3)}
              disabled={!smartAutoProjectPath}
              className="h-8"
              title={!smartAutoProjectPath ? "Ajoutez un répertoire pour activer SmartAuto" : "Analyse complète du graphe de dépendances"}
            >
              Niveau 3
            </Button>
            <div className="flex-1" />
            {configBeforeSmartAuto !== null ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelSmartAuto}
                className="h-8 gap-2 text-orange-600 border-orange-300 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-700 dark:hover:bg-orange-950"
                title="Annuler SmartAuto et revenir à la sélection précédente"
              >
                <Undo2 className="h-4 w-4" />
                Annuler
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={handleApplySmartAuto}
                disabled={!smartAutoProjectPath || !smartAutoDepth || isSmartAutoLoading}
                className="h-8 gap-2"
                title={!smartAutoProjectPath ? "Ajoutez un répertoire pour activer SmartAuto" : !smartAutoDepth ? "Sélectionnez un niveau d'analyse" : "Appliquer l'analyse SmartAuto"}
              >
                {isSmartAutoLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyse...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Appliquer
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Status Info */}
        {configBeforeSmartAuto !== null && config.smartAuto && (
          <div className="mt-3 text-xs text-muted-foreground bg-background/50 rounded p-2">
            {config.smartAuto.source === 'git' ? (
              <span>✓ Analyse appliquée depuis Git (profondeur {config.smartAuto.depth}) - {config.files.length} fichiers sélectionnés</span>
            ) : (
              <span>✓ Analyse appliquée depuis fichiers (profondeur {config.smartAuto.depth}) - {config.files.length} fichiers sélectionnés</span>
            )}
          </div>
        )}
      </div>

      {/* Section des répertoires */}
      <CollapsibleSection
        title="Répertoires"
        description="Dossiers à inclure dans la recherche"
        isOpen={true}
      >
        <div className="space-y-4">
          <InputWithButton 
            value={directoryInput}
            onChange={setDirectoryInput}
            onAdd={addDirectory}
            placeholder="Chemin du dossier (séparez par , ou ; pour plusieurs)"
            buttonLabel="Ajouter"
          />
          
          <div>
            <ItemList 
              items={config.directories} 
              onRemove={(index) => removeItem("directories", index)} 
              emptyMessage="Aucun dossier sélectionné"
              onEdit={(index, newValue) => editItem("directories", index, newValue)}
              title="Dossiers sélectionnés"
              type="folders"
              onClearAll={() => {
                config.directories.forEach(() => removeItem("directories", 0));
              }}
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="recursive" 
              checked={config.recursive} 
              onCheckedChange={toggleRecursive}
            />
            <Label htmlFor="recursive" className="text-sm">
              Inclure les sous-dossiers
            </Label>
          </div>
        </div>
      </CollapsibleSection>
      
      {/* Section des fichiers */}
      <CollapsibleSection 
        title="Fichiers spécifiques" 
        description="Fichiers individuels à copier"
      >
        <div className="space-y-4">
          <InputWithButton 
            value={fileInput}
            onChange={setFileInput}
            onAdd={addFile}
            placeholder="Chemin du fichier"
            buttonLabel="Ajouter"
          />
          
          <div>
            <ItemList 
              items={config.files} 
              onRemove={(index) => removeItem("files", index)} 
              emptyMessage="Aucun fichier sélectionné"
              onEdit={(index, newValue) => editItem("files", index, newValue)}
              title="Fichiers sélectionnés"
              type="files"
              onClearAll={() => {
                config.files.forEach(() => removeItem("files", 0));
              }}
            />
          </div>
        </div>
      </CollapsibleSection>
      
      {/* Section des exclusions */}
      <CollapsibleSection 
        title="Exclusions" 
        description="Éléments à exclure de la recherche"
        isOpen={false}
      >
        <div className="space-y-4">
          {/* Extensions à exclure */}
          <div>
            <Label htmlFor="extension-input" className="text-sm mb-1 block">Extensions à exclure</Label>
            <InputWithButton 
              value={extensionInput}
              onChange={setExtensionInput}
              onAdd={addExcludeExtension}
              placeholder="Ex: log, tmp, cache"
              buttonLabel="Exclure"
            />
            
            <Accordion type="single" collapsible className="mt-2" defaultValue="">
              <AccordionItem value="excludeExtensions">
                <AccordionTrigger className="py-2 text-xs">
                  Voir les extensions ({config.excludeExtensions.length})
                </AccordionTrigger>
                <AccordionContent>
                  <ItemList 
                    items={config.excludeExtensions} 
                    onRemove={(index) => removeItem("excludeExtensions", index)} 
                    maxHeight="100px"
                    onEdit={(index, newValue) => editItem("excludeExtensions", index, newValue)}
                    emptyMessage="Aucune extension exclue"
                    type="files"
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
          
          {/* Motifs à exclure */}
          <div>
            <Label htmlFor="pattern-input" className="text-sm mb-1 block">Motifs à exclure</Label>
            <InputWithButton 
              value={patternInput}
              onChange={setPatternInput}
              onAdd={addExcludePattern}
              placeholder="Ex: .env, package-lock.json"
              buttonLabel="Exclure"
            />
            
            <Accordion type="single" collapsible className="mt-2" defaultValue="">
              <AccordionItem value="excludePatterns">
                <AccordionTrigger className="py-2 text-xs">
                  Voir les motifs ({config.excludePatterns.length})
                </AccordionTrigger>
                <AccordionContent>
                  <ItemList 
                    items={config.excludePatterns} 
                    onRemove={(index) => removeItem("excludePatterns", index)} 
                    maxHeight="100px"
                    onEdit={(index, newValue) => editItem("excludePatterns", index, newValue)}
                    emptyMessage="Aucun motif exclu"
                    type="files"
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
          
          {/* Dossiers à exclure */}
          <div>
            <Label htmlFor="exclude-directory-input" className="text-sm mb-1 block">Dossiers à exclure</Label>
            <InputWithButton 
              value={excludeDirectoryInput}
              onChange={setExcludeDirectoryInput}
              onAdd={addExcludeDirectory}
              placeholder="Ex: node_modules, .git"
              buttonLabel="Exclure"
            />
            
            <Accordion type="single" collapsible className="mt-2" defaultValue="">
              <AccordionItem value="excludeDirectories">
                <AccordionTrigger className="py-2 text-xs">
                  Voir les dossiers ({config.excludeDirectories.length})
                </AccordionTrigger>
                <AccordionContent>
                  <ItemList 
                    items={config.excludeDirectories} 
                    onRemove={(index) => removeItem("excludeDirectories", index)} 
                    maxHeight="100px"
                    onEdit={(index, newValue) => editItem("excludeDirectories", index, newValue)}
                    emptyMessage="Aucun dossier exclu"
                    type="folders"
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
} 