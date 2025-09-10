import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle } from "lucide-react";
import { useSSH } from "@/contexts/SSHContext";
import { SSHConnection } from "@/types/global";
import { SSHConnectionForm } from "./SSHConnectionForm";
import { SSHConnectionList } from "./SSHConnectionList";
import { useSSHConnectionForm } from "./hooks/useSSHConnectionForm";
import { useSSHTest } from "./hooks/useSSHTest";

interface SSHConfigModalProps {
  open: boolean;
  onClose: () => void;
  // Mode sélection pour les outils qui ont besoin de sélectionner une connexion
  selectionMode?: boolean;
  selectedConnection?: SSHConnection | null;
  onSelectConnection?: (conn: SSHConnection) => void;
}

export function SSHConfigModal({
  open,
  onClose,
  selectionMode = false,
  selectedConnection,
  onSelectConnection
}: SSHConfigModalProps) {
  const { connections, saveConnection, deleteConnection } = useSSH();
  const [activeTab, setActiveTab] = useState<"list" | "form">("list");

  const {
    form,
    isEditing,
    editConnection,
    resetForm,
    updateFormField,
    isFormValid,
    canTestConnection
  } = useSSHConnectionForm();

  const {
    testing,
    testResult,
    testConnection,
    selectConnection,
    resetTestResult
  } = useSSHTest();

  // Réinitialiser le formulaire quand le modal se ferme
  useEffect(() => {
    if (!open) {
      resetForm();
      resetTestResult();
      setActiveTab("list");
    }
  }, [open, resetForm, resetTestResult]);

  // Gérer la création d'une nouvelle connexion
  const handleCreateNew = () => {
    resetForm();
    setActiveTab("form");
  };

  // Gérer l'édition d'une connexion
  const handleEditConnection = (connection: SSHConnection) => {
    editConnection(connection);
    setActiveTab("form");
  };

  // Gérer l'annulation de l'édition
  const handleCancelEdit = () => {
    resetForm();
    setActiveTab("list");
  };

  // Gérer le test de connexion depuis le formulaire
  const handleTestConnection = async () => {
    await testConnection(form);
  };

  // Gérer le test depuis la liste
  const handleTestFromList = async (connection: SSHConnection) => {
    await testConnection(connection);
  };

  // Gérer la sélection depuis la liste (mode sélection seulement)
  const handleSelectFromList = async (connection: SSHConnection) => {
    if (selectionMode && onSelectConnection) {
      await selectConnection(connection, onSelectConnection, onClose);
    }
  };

  // Gérer la sauvegarde de la connexion
  const handleSaveConnection = async () => {
    if (isFormValid) {
      saveConnection(form, isEditing);
      resetForm();
      setActiveTab("list");
    }
  };

  const totalConnections = connections.length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DialogTitle>
                {selectionMode ? "Sélectionner une connexion SSH" : "Configuration SSH"}
              </DialogTitle>
              <div className="flex items-center gap-2">
                {selectionMode && (
                  <Badge variant="default" className="text-xs">
                    Mode sélection
                  </Badge>
                )}
                <Badge variant="secondary" className="text-xs">
                  {totalConnections} connexion{totalConnections > 1 ? "s" : ""}
                </Badge>
              </div>
            </div>
            {selectionMode && selectedConnection && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span>Actuelle: {selectedConnection.name}</span>
              </div>
            )}
          </div>
        </DialogHeader>

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

        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "list" | "form")}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="list">
                Liste des connexions ({totalConnections})
              </TabsTrigger>
              <TabsTrigger value="form">
                {isEditing ? "Modifier" : "Nouvelle"} connexion
              </TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="h-full mt-0 overflow-hidden">
              <SSHConnectionList
                connections={connections}
                selectedConnection={selectionMode ? selectedConnection : undefined}
                testing={testing}
                testResult={testResult}
                onSelectConnection={selectionMode ? handleSelectFromList : undefined}
                onTestConnection={handleTestFromList}
                onEditConnection={handleEditConnection}
                onDeleteConnection={deleteConnection}
                onCreateNew={handleCreateNew}
                globalMode={!selectionMode}
              />
            </TabsContent>

            <TabsContent value="form" className="h-full mt-0 overflow-auto">
              <SSHConnectionForm
                form={form}
                isEditing={isEditing}
                testing={testing}
                testResult={testResult}
                onFormChange={updateFormField}
                onTestConnection={handleTestConnection}
                onSaveConnection={handleSaveConnection}
                onCancelEdit={handleCancelEdit}
                canTestConnection={canTestConnection}
                isFormValid={isFormValid}
              />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}