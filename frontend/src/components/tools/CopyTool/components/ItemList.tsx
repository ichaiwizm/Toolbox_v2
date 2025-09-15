import { X, Edit, Check, Folder, File } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Input } from "@/components/ui/input";

interface ItemListProps {
  items: string[];
  onRemove: (index: number) => void;
  emptyMessage?: string;
  maxHeight?: string;
  onEdit?: (index: number, newValue: string) => void;
  title?: string;
  type?: 'folders' | 'files';
  onClearAll?: () => void;
}

/**
 * Composant pour afficher une liste d'éléments avec possibilité de les supprimer et éditer
 */
export function ItemList({ 
  items, 
  onRemove, 
  emptyMessage = "Aucun élément", 
  maxHeight = "128px",
  onEdit,
  title,
  type = 'folders',
  onClearAll
}: ItemListProps) {
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<string>("");

  const handleEditClick = (index: number, value: string) => {
    setEditIndex(index);
    setEditValue(value);
  };

  const handleSaveEdit = (index: number) => {
    if (onEdit && editValue.trim()) {
      onEdit(index, editValue.trim());
    }
    setEditIndex(null);
    setEditValue("");
  };

  const handleCancelEdit = () => {
    setEditIndex(null);
    setEditValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter') {
      handleSaveEdit(index);
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const IconComponent = type === 'folders' ? Folder : File;
  const iconColor = type === 'folders' ? 'text-blue-500' : 'text-green-500';

  // Fonction pour raccourcir les chemins longs
  const shortenPath = (path: string): string => {
    // Si le chemin est court, on le garde tel quel
    if (path.length <= 60) return path;
    
    // Séparer le chemin en parties
    const parts = path.replace(/\\/g, '/').split('/');
    
    // Si c'est un chemin Windows absolu (C:/)
    if (parts.length > 5 && parts[0].includes(':')) {
      // Garder les 4 dernières parties
      const lastFour = parts.slice(-4);
      return `.../${lastFour.join('/')}`;
    }
    
    // Pour les autres chemins, garder les 4 dernières parties
    if (parts.length > 4) {
      const lastFour = parts.slice(-4);
      return `.../${lastFour.join('/')}`;
    }
    
    return path;
  };

  if (items.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-8 border rounded-md bg-muted/20">
        <IconComponent className={`h-8 w-8 mx-auto mb-2 opacity-50 ${iconColor}`} />
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <Card className="w-full">
      {title && (
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium flex items-center gap-2">
              <IconComponent className={`h-4 w-4 ${iconColor}`} />
              {title} ({items.length})
            </span>
            {onClearAll && items.length > 0 && (
              <Button size="sm" variant="outline" onClick={onClearAll}>
                Tout effacer
              </Button>
            )}
          </div>
        </CardHeader>
      )}
      <CardContent className={title ? "pt-0" : "p-3"}>
        <ScrollArea className="w-full" style={{ height: maxHeight }}>
          <div className="space-y-0.5">
            {items.map((item, index) => (
              <div key={index} className="group flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/50 transition-colors">
                <IconComponent className={`h-4 w-4 ${iconColor} shrink-0`} />
                
                {editIndex === index ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, index)}
                      className="h-8 text-sm flex-1"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 w-6 p-0 bg-green-50 border-green-200 hover:bg-green-100"
                      onClick={() => handleSaveEdit(index)}
                    >
                      <Check className="h-3 w-3 text-green-600" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 w-6 p-0"
                      onClick={handleCancelEdit}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 text-sm truncate font-mono" title={item}>
                      {shortenPath(item)}
                    </span>
                    <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                      {onEdit && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={() => handleEditClick(index, item)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                        onClick={() => onRemove(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
} 