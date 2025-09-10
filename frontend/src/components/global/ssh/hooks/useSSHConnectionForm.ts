import { useState, useMemo, useCallback } from "react";
import { SSHConnection, createEmptySSHConnection } from "@/types/global";

/**
 * Hook pour gérer le formulaire de connexion SSH
 */
export function useSSHConnectionForm() {
  const [form, setForm] = useState(createEmptySSHConnection());
  const [isEditing, setIsEditing] = useState(false);

  // Éditer une connexion existante
  const editConnection = useCallback((connection: SSHConnection) => {
    setForm(connection);
    setIsEditing(true);
  }, []);

  // Réinitialiser le formulaire
  const resetForm = useCallback(() => {
    setForm(createEmptySSHConnection());
    setIsEditing(false);
  }, []);

  // Mettre à jour un champ du formulaire
  const updateFormField = useCallback((field: keyof SSHConnection, value: any) => {
    setForm((prev: SSHConnection) => ({ ...prev, [field]: value }));
  }, []);

  // Valider le formulaire
  const isFormValid = useMemo(
    () => Boolean(form.name.trim() && form.host.trim() && form.username.trim()),
    [form.name, form.host, form.username]
  );

  // Vérifier si le formulaire peut être testé
  const canTestConnection = useMemo(
    () => Boolean(form.host.trim() && form.username.trim()),
    [form.host, form.username]
  );

  return {
    form,
    isEditing,
    setForm,
    editConnection,
    resetForm,
    updateFormField,
    isFormValid,
    canTestConnection
  };
}