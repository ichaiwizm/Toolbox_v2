import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Server } from "lucide-react";
import { SSHConnection, createEmptySSHConnection } from "../types";
import { 
  useSSHConnections, 
  useSSHConnectionForm, 
  useSSHTest,
  SSHConnectionForm,
  SSHConnectionList
} from "./SSHConfigModal/index";

interface SSHConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedConnection: SSHConnection | null;
  onSelectConnection: (connection: SSHConnection) => void;
}

export function SSHConfigModal({ isOpen, onClose, selectedConnection, onSelectConnection }: SSHConfigModalProps) {
  const [activeTab, setActiveTab] = useState("create");
  
  // Hooks personnalisés
  const { connections, saveConnection, deleteConnection } = useSSHConnections();
  const { 
    form, 
    isEditing, 
    editConnection, 
    resetForm, 
    updateFormField, 
    isFormValid, 
    canTestConnection 
  } = useSSHConnectionForm();
  const { testing, testResult, testConnection, selectConnection, resetTestResult } = useSSHTest();

  // Gestionnaires d'événements

  const handleSaveConnection = () => {
    if (!isFormValid()) return;
    
    saveConnection(form, isEditing);
    resetForm();
    resetTestResult();
    setActiveTab("saved");
  };

  const handleDeleteConnection = (id: string) => {
    deleteConnection(id);
    if (selectedConnection?.id === id) {
      onSelectConnection(createEmptySSHConnection());
    }
  };

  const handleEditConnection = (conn: SSHConnection) => {
    editConnection(conn);
    resetTestResult();
    setActiveTab("create");
  };

  const handleTestConnection = (conn?: SSHConnection) => {
    testConnection(conn || form);
  };

  const handleSelectConnection = (conn: SSHConnection) => {
    selectConnection(conn, onSelectConnection, onClose);
  };

  const handleCancelEdit = () => {
    resetForm();
    resetTestResult();
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
            <SSHConnectionForm
              form={form}
              isEditing={isEditing}
              testing={testing}
              testResult={testResult}
              onFormChange={updateFormField}
              onTestConnection={() => handleTestConnection()}
              onSaveConnection={handleSaveConnection}
              onCancelEdit={handleCancelEdit}
              canTestConnection={canTestConnection()}
              isFormValid={isFormValid()}
            />
          </TabsContent>

          {/* Onglet Connexions sauvegardées */}
          <TabsContent value="saved" className="space-y-4 mt-6">
            <SSHConnectionList
              connections={connections}
              selectedConnection={selectedConnection}
              testing={testing}
              testResult={testResult}
              onSelectConnection={handleSelectConnection}
              onTestConnection={handleTestConnection}
              onEditConnection={handleEditConnection}
              onDeleteConnection={handleDeleteConnection}
              onCreateNew={() => setActiveTab("create")}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}