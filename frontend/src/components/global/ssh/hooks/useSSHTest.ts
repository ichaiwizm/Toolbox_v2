import { useState, useCallback } from "react";
import { SSHConnection } from "@/types/global";
import { SSHTestService, TestResult } from "../services/sshTestService";

/**
 * Hook pour gérer les tests de connexion SSH
 */
export function useSSHTest() {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  // Tester une connexion (sans sélection)
  const testConnection = useCallback(async (connection: SSHConnection) => {
    setTesting(true);
    setTestResult(null);
    
    const result = await SSHTestService.testConnection(connection);
    setTestResult(result);
    setTesting(false);
  }, []);

  // Sélectionner une connexion (avec test puis fermeture si succès)
  const selectConnection = useCallback(async (
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
      // Laisser le temps à l'utilisateur de voir le succès avant fermeture
      setTimeout(() => {
        onClose();
        setTestResult(null);
      }, 2000);
    }
  }, []);

  // Réinitialiser les résultats de test
  const resetTestResult = useCallback(() => {
    setTestResult(null);
  }, []);

  return {
    testing,
    testResult,
    testConnection,
    selectConnection,
    resetTestResult
  };
}