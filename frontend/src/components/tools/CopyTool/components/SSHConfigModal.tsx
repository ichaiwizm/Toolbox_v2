import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, Server, Trash2, CheckCircle, XCircle, Edit2 } from "lucide-react";
import { SSHConnection, createEmptySSHConnection } from "../types";

interface SSHConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedConnection: SSHConnection | null;
  onSelectConnection: (connection: SSHConnection) => void;
}

export function SSHConfigModal({ isOpen, onClose, selectedConnection, onSelectConnection }: SSHConfigModalProps) {
  const [connections, setConnections] = useState<SSHConnection[]>([]);
  const [form, setForm] = useState(createEmptySSHConnection());
  const [isEditing, setIsEditing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState("create");

  // Charger connexions
  useEffect(() => {
    const saved = localStorage.getItem("copy-tool-ssh-connections");
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
    localStorage.setItem("copy-tool-ssh-connections", JSON.stringify(conns));
    setConnections(conns);
  };

  // Tester connexion (sans sélection)
  const testConnection = async (conn: SSHConnection) => {
    setTesting(true);
    setTestResult(null);
    
    try {
      const res = await fetch('/api/v1/ssh/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: conn.host,
          port: conn.port,
          username: conn.username,
          password: conn.password || ''
        })
      });
      
      const result = await res.json();
      
      if (res.ok) {
        setTestResult({ success: true, message: "Test de connexion réussi" });
      } else {
        setTestResult({ success: false, message: result.error || "Échec du test de connexion" });
      }
    } catch {
      setTestResult({ success: false, message: "Erreur réseau lors du test" });
    }
    
    setTesting(false);
  };

  // Sélectionner connexion (avec test puis fermeture si succès)
  const selectConnection = async (conn: SSHConnection) => {
    setTesting(true);
    setTestResult(null);
    
    try {
      const res = await fetch('/api/v1/ssh/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: conn.host,
          port: conn.port,
          username: conn.username,
          password: conn.password || ''
        })
      });
      
      const result = await res.json();
      
      if (res.ok) {
        setTestResult({ success: true, message: "Connexion sélectionnée avec succès" });
        onSelectConnection(conn);
        setTimeout(() => {
          onClose();
          setTestResult(null);
        }, 1500);
      } else {
        setTestResult({ success: false, message: result.error || "Impossible de sélectionner cette connexion" });
      }
    } catch {
      setTestResult({ success: false, message: "Erreur réseau lors de la sélection" });
    }
    
    setTesting(false);
  };

  // Sauvegarder connexion
  const saveConnection = () => {
    if (!form.name.trim() || !form.host.trim() || !form.username.trim()) return;
    
    const connData = {
      ...form,
      name: form.name.trim(),
      host: form.host.trim(),
      username: form.username.trim(),
      password: form.savePassword ? form.password : undefined,
      timestamp: Date.now()
    };
    
    if (isEditing) {
      saveConnections(connections.map(c => c.id === form.id ? connData : c));
    } else {
      saveConnections([...connections, connData]);
    }
    
    resetForm();
    setActiveTab("saved");
  };

  // Supprimer connexion
  const deleteConnection = (id: string) => {
    saveConnections(connections.filter(c => c.id !== id));
    if (selectedConnection?.id === id) {
      onSelectConnection(createEmptySSHConnection());
    }
  };

  // Éditer connexion
  const editConnection = (conn: SSHConnection) => {
    setForm(conn);
    setIsEditing(true);
    setTestResult(null);
    setActiveTab("create");
  };

  // Reset formulaire
  const resetForm = () => {
    setForm(createEmptySSHConnection());
    setIsEditing(false);
    setTestResult(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            Configuration SSH
          </DialogTitle>
          <DialogDescription>
            Gérez vos connexions SSH pour accéder aux serveurs distants
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create">
              {isEditing ? "Modifier connexion" : "Nouvelle connexion"}
            </TabsTrigger>
            <TabsTrigger value="saved">
              Connexions sauvegardées {connections.length > 0 && `(${connections.length})`}
            </TabsTrigger>
          </TabsList>

          {/* Onglet Nouvelle/Modifier connexion */}
          <TabsContent value="create" className="space-y-6 mt-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ssh-name" className="text-sm font-medium">
                    Nom de la connexion <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="ssh-name"
                    value={form.name}
                    onChange={(e) => setForm({...form, name: e.target.value})}
                    placeholder="Serveur de production"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ssh-port" className="text-sm font-medium">Port</Label>
                  <Input
                    id="ssh-port"
                    type="number"
                    value={form.port}
                    onChange={(e) => setForm({...form, port: parseInt(e.target.value) || 22})}
                    placeholder="22"
                    className="h-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ssh-host" className="text-sm font-medium">
                  Adresse du serveur <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="ssh-host"
                  value={form.host}
                  onChange={(e) => setForm({...form, host: e.target.value})}
                  placeholder="192.168.1.100 ou server.example.com"
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ssh-username" className="text-sm font-medium">
                  Nom d'utilisateur <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="ssh-username"
                  value={form.username}
                  onChange={(e) => setForm({...form, username: e.target.value})}
                  placeholder="root, admin, utilisateur..."
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ssh-password" className="text-sm font-medium">Mot de passe</Label>
                <Input
                  id="ssh-password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({...form, password: e.target.value})}
                  placeholder="••••••••••••"
                  className="h-10"
                />
                <div className="flex items-center space-x-2 pt-1">
                  <Checkbox
                    id="save-password"
                    checked={form.savePassword}
                    onCheckedChange={(checked) => setForm({...form, savePassword: checked as boolean})}
                  />
                  <Label htmlFor="save-password" className="text-sm text-muted-foreground">
                    Enregistrer le mot de passe
                  </Label>
                </div>
              </div>

              {/* Résultat du test */}
              {testResult && (
                <div className={`flex items-center gap-3 p-4 rounded-lg border ${
                  testResult.success 
                    ? 'bg-green-50 border-green-200 text-green-800' 
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  {testResult.success ? (
                    <CheckCircle className="w-5 h-5 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 flex-shrink-0" />
                  )}
                  <span className="text-sm font-medium">{testResult.message}</span>
                </div>
              )}

              {/* Boutons d'action */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => testConnection(form)}
                  disabled={!form.host.trim() || !form.username.trim() || testing}
                  className="flex-1 h-10"
                >
                  {testing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Test en cours...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Tester
                    </>
                  )}
                </Button>
                <Button
                  onClick={saveConnection}
                  disabled={!form.name.trim() || !form.host.trim() || !form.username.trim()}
                  className="flex-1 h-10"
                >
                  {isEditing ? "Modifier" : "Enregistrer"}
                </Button>
                {isEditing && (
                  <Button
                    variant="outline"
                    onClick={resetForm}
                    className="h-10"
                  >
                    Annuler
                  </Button>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Onglet Connexions sauvegardées */}
          <TabsContent value="saved" className="space-y-4 mt-6">
            {connections.length === 0 ? (
              <div className="text-center py-12 px-4 border-2 border-dashed border-muted rounded-lg">
                <Server className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Aucune connexion enregistrée</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Créez votre première connexion SSH pour commencer
                </p>
                <Button onClick={() => setActiveTab("create")}>
                  Créer une connexion
                </Button>
              </div>
            ) : (
              <>
                {/* Message de test global */}
                {testResult && (
                  <div className={`flex items-center gap-3 p-4 rounded-lg border ${
                    testResult.success 
                      ? 'bg-green-50 border-green-200 text-green-800' 
                      : 'bg-red-50 border-red-200 text-red-800'
                  }`}>
                    {testResult.success ? (
                      <CheckCircle className="w-5 h-5 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 flex-shrink-0" />
                    )}
                    <span className="text-sm font-medium">{testResult.message}</span>
                  </div>
                )}

                <ScrollArea className="h-[400px] pr-2">
                  <div className="space-y-3">
                    {connections.map((conn) => (
                      <Card key={conn.id} className={`transition-all hover:shadow-md ${
                        selectedConnection?.id === conn.id 
                          ? 'ring-2 ring-primary bg-primary/5' 
                          : ''
                      }`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-3">
                                <h4 className="font-semibold text-base truncate">{conn.name}</h4>
                                {selectedConnection?.id === conn.id && (
                                  <Badge variant="default" className="text-xs px-2 py-1">
                                    Active
                                  </Badge>
                                )}
                              </div>
                              <div className="space-y-2 text-sm text-muted-foreground">
                                <div className="flex items-center gap-4">
                                  <span className="font-medium min-w-[80px]">Serveur:</span>
                                  <span className="truncate">{conn.host}:{conn.port}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                  <span className="font-medium min-w-[80px]">Utilisateur:</span>
                                  <span className="truncate">{conn.username}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                  <span className="font-medium min-w-[80px]">Mot de passe:</span>
                                  <span>{conn.password ? "Enregistré" : "Non enregistré"}</span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex flex-col gap-2 ml-4">
                              <Button
                                size="sm"
                                onClick={() => selectConnection(conn)}
                                disabled={testing}
                                className="w-28 h-10"
                              >
                                {testing ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Test...
                                  </>
                                ) : (
                                  "Sélectionner"
                                )}
                              </Button>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => testConnection(conn)}
                                  disabled={testing}
                                  className="flex-1 h-10"
                                >
                                  Tester
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => editConnection(conn)}
                                  className="flex-1 h-10"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => deleteConnection(conn.id)}
                                  className="flex-1 h-10 text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}