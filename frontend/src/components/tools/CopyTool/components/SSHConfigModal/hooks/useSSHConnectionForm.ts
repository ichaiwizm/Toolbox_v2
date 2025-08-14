import { useState } from "react";
import { SSHConnection, createEmptySSHConnection } from "../../../types";

/**
 * Hook pour gérer le formulaire de connexion SSH
 */
export function useSSHConnectionForm() {
  const [form, setForm] = useState(createEmptySSHConnection());
  const [isEditing, setIsEditing] = useState(false);

  // Éditer une connexion existante
  const editConnection = (connection: SSHConnection) => {
    setForm(connection);
    setIsEditing(true);
  };

  // Réinitialiser le formulaire
  const resetForm = () => {
    setForm(createEmptySSHConnection());
    setIsEditing(false);
  };

  // Mettre à jour un champ du formulaire
  const updateFormField = (field: keyof SSHConnection, value: any) => {
    setForm((prev: SSHConnection) => ({ ...prev, [field]: value }));
  };

  // Valider le formulaire
  const isFormValid = () => {
    return form.name.trim() && form.host.trim() && form.username.trim();
  };

  // Vérifier si le formulaire peut être testé
  const canTestConnection = () => {
    return form.host.trim() && form.username.trim();
  };

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