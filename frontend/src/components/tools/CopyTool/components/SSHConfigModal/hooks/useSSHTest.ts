import { useState } from "react";
import { SSHConnection } from "../../../types";
import { SSHTestService, TestResult } from "../services/sshTestService";

/**
 * Hook pour gérer les tests de connexion SSH
 */
export function useSSHTest() {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  // Tester une connexion (sans sélection)
  const testConnection = async (connection: SSHConnection) => {
    setTesting(true);
    setTestResult(null);
    
    const result = await SSHTestService.testConnection(connection);
    setTestResult(result);
    setTesting(false);
  };

  // Sélectionner une connexion (avec test puis fermeture si succès)
  const selectConnection = async (
    connection: SSHConnection,
    onSelectConnection: (conn: SSHConnection) => void,
    onClose: () => void
  ) => {
    setTesting(true);
    setTestResult(null);
    
    const result = await SSHTestService.testAndSelectConnection(
      connection, 
      onSelectConnection
    );
    
    setTestResult(result);
    setTesting(false);

    if (result.success) {
      setTimeout(() => {
        onClose();
        setTestResult(null);
      }, 1500);
    }
  };

  // Réinitialiser les résultats de test
  const resetTestResult = () => {
    setTestResult(null);
  };

  return {
    testing,
    testResult,
    testConnection,
    selectConnection,
    resetTestResult
  };
}