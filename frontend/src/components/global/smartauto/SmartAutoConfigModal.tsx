import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Sparkles, GitBranch, Layers, HelpCircle, Info } from "lucide-react";

interface SmartAutoConfigModalProps {
  open: boolean;
  onClose: () => void;
}

export function SmartAutoConfigModal({ open, onClose }: SmartAutoConfigModalProps) {
  const [gitFiles, setGitFiles] = useState(true);
  const [linkedFiles, setLinkedFiles] = useState(true);

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
        <div className="flex-1 px-6 min-h-0 overflow-y-auto pr-2 pb-8">
          <div className="space-y-6">
            {/* Introduction */}
            <div className="text-center py-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Sélection intelligente de fichiers</h3>
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
                    id="git-files"
                    checked={gitFiles}
                    onCheckedChange={(checked) => setGitFiles(checked as boolean)}
                  />
                  <GitBranch className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label htmlFor="git-files" className="font-medium">
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
                    id="linked-files"
                    checked={linkedFiles}
                    onCheckedChange={(checked) => setLinkedFiles(checked as boolean)}
                  />
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label htmlFor="linked-files" className="font-medium">
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
