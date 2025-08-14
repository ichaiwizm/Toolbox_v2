import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Server, Trash2, Edit2, Loader2, CheckCircle, XCircle } from "lucide-react";
import { SSHConnection, createEmptySSHConnection } from "../../types";
import { TestResult } from "./services/sshTestService";

interface SSHConnectionListProps {
  connections: SSHConnection[];
  selectedConnection: SSHConnection | null;
  testing: boolean;
  testResult: TestResult | null;
  onSelectConnection: (conn: SSHConnection) => void;
  onTestConnection: (conn: SSHConnection) => void;
  onEditConnection: (conn: SSHConnection) => void;
  onDeleteConnection: (id: string) => void;
  onCreateNew: () => void;
}

export function SSHConnectionList({
  connections,
  selectedConnection,
  testing,
  testResult,
  onSelectConnection,
  onTestConnection,
  onEditConnection,
  onDeleteConnection,
  onCreateNew
}: SSHConnectionListProps) {
  if (connections.length === 0) {
    return (
      <div className="text-center py-12 px-4 border-2 border-dashed border-muted rounded-lg">
        <Server className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">Aucune connexion enregistrée</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Créez votre première connexion SSH pour commencer
        </p>
        <Button onClick={onCreateNew}>
          Créer une connexion
        </Button>
      </div>
    );
  }

  return (
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
                      onClick={() => onSelectConnection(conn)}
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
                        onClick={() => onTestConnection(conn)}
                        disabled={testing}
                        className="flex-1 h-10"
                      >
                        Tester
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onEditConnection(conn)}
                        className="flex-1 h-10"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onDeleteConnection(conn.id)}
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
  );
}