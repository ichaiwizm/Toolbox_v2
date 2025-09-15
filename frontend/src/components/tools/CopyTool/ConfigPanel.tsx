import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useContext } from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";

import { useCopyTool, CopyToolProvider, CopyToolContext } from "./CopyToolContext";
import { 
  CollapsibleSection, 
  HistoryDialog, 
  InputWithButton, 
  ItemList
} from "./components";
import { useSSH } from "@/contexts/SSHContext";

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
    loadFromHistory,
    clearHistory,
    toggleFavorite
  } = useCopyTool();
  
  // Utiliser le contexte SSH global
  const { connections } = useSSH();

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