import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { SSHConnection } from "../../types";
import { TestResult } from "./services/sshTestService";

interface SSHConnectionFormProps {
  form: SSHConnection;
  isEditing: boolean;
  testing: boolean;
  testResult: TestResult | null;
  onFormChange: (field: keyof SSHConnection, value: any) => void;
  onTestConnection: () => void;
  onSaveConnection: () => void;
  onCancelEdit: () => void;
  canTestConnection: boolean;
  isFormValid: boolean;
}

export function SSHConnectionForm({
  form,
  isEditing,
  testing,
  testResult,
  onFormChange,
  onTestConnection,
  onSaveConnection,
  onCancelEdit,
  canTestConnection,
  isFormValid
}: SSHConnectionFormProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ssh-name" className="text-sm font-medium">
            Nom de la connexion <span className="text-red-500">*</span>
          </Label>
          <Input
            id="ssh-name"
            value={form.name}
            onChange={(e) => onFormChange('name', e.target.value)}
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
            onChange={(e) => onFormChange('port', parseInt(e.target.value) || 22)}
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
          onChange={(e) => onFormChange('host', e.target.value)}
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
          onChange={(e) => onFormChange('username', e.target.value)}
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
          onChange={(e) => onFormChange('password', e.target.value)}
          placeholder="••••••••••••"
          className="h-10"
        />
        <div className="flex items-center space-x-2 pt-1">
          <Checkbox
            id="save-password"
            checked={form.savePassword}
            onCheckedChange={(checked) => onFormChange('savePassword', checked as boolean)}
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
          onClick={onTestConnection}
          disabled={!canTestConnection || testing}
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
          onClick={onSaveConnection}
          disabled={!isFormValid}
          className="flex-1 h-10"
        >
          {isEditing ? "Modifier" : "Enregistrer"}
        </Button>
        {isEditing && (
          <Button
            variant="outline"
            onClick={onCancelEdit}
            className="h-10"
          >
            Annuler
          </Button>
        )}
      </div>
    </div>
  );
}