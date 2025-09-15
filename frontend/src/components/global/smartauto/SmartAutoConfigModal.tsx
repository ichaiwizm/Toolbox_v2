import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Zap, Settings2, GitBranch, FileCode, Layers, HelpCircle, Info } from "lucide-react";

interface SmartAutoConfigModalProps {
  open: boolean;
  onClose: () => void;
}

export function SmartAutoConfigModal({ open, onClose }: SmartAutoConfigModalProps) {
  const [currentMode, setCurrentMode] = useState<"simple" | "advanced">("simple");
  
  // Mode Simple
  const [simpleGitFiles, setSimpleGitFiles] = useState(true);
  const [simpleLinkedFiles, setSimpleLinkedFiles] = useState(true);
  
  // Mode Avancé
  const [gitDiff, setGitDiff] = useState(true);
  const [dependencies, setDependencies] = useState(true);
  const [proximity, setProximity] = useState(true);
  const [includeTests, setIncludeTests] = useState(true);
  const [includeStyles, setIncludeStyles] = useState(true);
  const [includeTypes, setIncludeTypes] = useState(true);
  const [maxFiles, setMaxFiles] = useState("50");
  const [maxTotalSize, setMaxTotalSize] = useState("10MB");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl h-[85vh] min-h-0 !flex !flex-col !gap-0 p-0">
        {/* Header */}
        <DialogHeader className="p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-xl font-semibold">Smart Auto</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Sélection intelligente de fichiers
              </p>
            </div>
            <Badge variant="secondary" className="text-xs">
              Bêta
            </Badge>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 px-6 min-h-0">
          <Tabs
            className="h-full"
            value={currentMode}
            onValueChange={(value) => setCurrentMode(value as "simple" | "advanced")}
          >
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="simple">
                <Zap className="h-4 w-4 mr-2" />
                Simple
              </TabsTrigger>
              <TabsTrigger value="advanced">
                <Settings2 className="h-4 w-4 mr-2" />
                Avancé
              </TabsTrigger>
            </TabsList>

            <TabsContent value="simple" className="mt-0 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto pr-2 pb-8">
                <div className="space-y-6">
                  {/* Introduction */}
                  <div className="text-center py-4">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Zap className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">Configuration rapide</h3>
                    </div>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      Sélection automatique basée sur les pratiques courantes de développement
                    </p>
                  </div>

                  {/* Options */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-3 flex-1">
                        <Checkbox
                          id="simple-git"
                          checked={simpleGitFiles}
                          onCheckedChange={(checked) => setSimpleGitFiles(checked as boolean)}
                        />
                        <GitBranch className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <Label htmlFor="simple-git" className="font-medium">
                            Fichiers modifiés (Git)
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Inclure les fichiers avec des changements non commitées
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-3 flex-1">
                        <Checkbox
                          id="simple-linked"
                          checked={simpleLinkedFiles}
                          onCheckedChange={(checked) => setSimpleLinkedFiles(checked as boolean)}
                        />
                        <Layers className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <Label htmlFor="simple-linked" className="font-medium">
                            Fichiers liés
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Tests, styles et dépendances associés automatiquement
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>

                  {/* Limites */}
                  <div className="p-4 bg-muted/30 rounded-lg border">
                    <div className="flex items-center gap-2 mb-2">
                      <Info className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Limites automatiques</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <strong>50 fichiers maximum</strong> • <strong>10 MB total</strong>
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="advanced" className="mt-0 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto pr-2 pb-8">
                <div className="space-y-6">
                  {/* Sources d'analyse */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <FileCode className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">Sources d'analyse</h3>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer">
                        <Checkbox checked={gitDiff} onCheckedChange={(c) => setGitDiff(c as boolean)} />
                        <div className="flex-1">
                          <span className="font-medium">Fichiers modifiés (Git)</span>
                          <p className="text-xs text-muted-foreground mt-1">
                            Analyse des changements dans le repository
                          </p>
                        </div>
                      </Label>
                      <Label className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer">
                        <Checkbox checked={dependencies} onCheckedChange={(c) => setDependencies(c as boolean)} />
                        <div className="flex-1">
                          <span className="font-medium">Analyse des dépendances</span>
                          <p className="text-xs text-muted-foreground mt-1">
                            Suit les imports et références entre fichiers
                          </p>
                        </div>
                      </Label>
                      <Label className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer">
                        <Checkbox checked={proximity} onCheckedChange={(c) => setProximity(c as boolean)} />
                        <div className="flex-1">
                          <span className="font-medium">Proximité de fichiers</span>
                          <p className="text-xs text-muted-foreground mt-1">
                            Inclut les fichiers dans les mêmes dossiers
                          </p>
                        </div>
                      </Label>
                    </div>
                  </div>

                  {/* Enrichissement */}
                  <div>
                    <h3 className="font-semibold mb-4">Enrichissement automatique</h3>
                    <div className="grid grid-cols-1 gap-2">
                      <Label className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer">
                        <Checkbox checked={includeTests} onCheckedChange={(c) => setIncludeTests(c as boolean)} />
                        <div className="flex-1">
                          <span className="font-medium">Fichiers de test</span>
                          <p className="text-xs text-muted-foreground mt-1">
                            *.test.*, *.spec.*, __tests__/*
                          </p>
                        </div>
                      </Label>
                      <Label className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer">
                        <Checkbox checked={includeStyles} onCheckedChange={(c) => setIncludeStyles(c as boolean)} />
                        <div className="flex-1">
                          <span className="font-medium">Fichiers de style</span>
                          <p className="text-xs text-muted-foreground mt-1">
                            *.css, *.scss, *.sass, *.less
                          </p>
                        </div>
                      </Label>
                      <Label className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer">
                        <Checkbox checked={includeTypes} onCheckedChange={(c) => setIncludeTypes(c as boolean)} />
                        <div className="flex-1">
                          <span className="font-medium">Définitions de types</span>
                          <p className="text-xs text-muted-foreground mt-1">
                            *.d.ts, types.ts
                          </p>
                        </div>
                      </Label>
                    </div>
                  </div>

                  {/* Limites */}
                  <div>
                    <h3 className="font-semibold mb-4">Limites de sélection</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="font-medium mb-2 block">Nombre max de fichiers</Label>
                        <Input
                          value={maxFiles}
                          onChange={(e) => setMaxFiles(e.target.value)}
                          placeholder="50"
                          type="number"
                        />
                      </div>
                      <div>
                        <Label className="font-medium mb-2 block">Taille totale max</Label>
                        <Select value={maxTotalSize} onValueChange={setMaxTotalSize}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5MB">5 MB</SelectItem>
                            <SelectItem value="10MB">10 MB</SelectItem>
                            <SelectItem value="25MB">25 MB</SelectItem>
                            <SelectItem value="50MB">50 MB</SelectItem>
                            <SelectItem value="100MB">100 MB</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Résumé supprimé */}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 pt-4 border-t">
          <Button variant="ghost">
            Réinitialiser
          </Button>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button>
              <Sparkles className="h-4 w-4 mr-2" />
              Enregistrer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
