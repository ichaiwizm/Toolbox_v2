import { SSHConnection } from "../../../types";

export interface TestResult {
  success: boolean;
  message: string;
}

/**
 * Service pour tester les connexions SSH
 */
export class SSHTestService {
  /**
   * Teste une connexion SSH
   */
  static async testConnection(connection: SSHConnection): Promise<TestResult> {
    try {
      const res = await fetch('/api/v1/ssh/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: connection.host,
          port: connection.port,
          username: connection.username,
          password: connection.password || ''
        })
      });
      
      const result = await res.json();
      
      if (res.ok) {
        return { success: true, message: "Test de connexion réussi" };
      } else {
        return { success: false, message: result.error || "Échec du test de connexion" };
      }
    } catch {
      return { success: false, message: "Erreur réseau lors du test" };
    }
  }

  /**
   * Teste une connexion et la sélectionne si le test réussit
   */
  static async testAndSelectConnection(
    connection: SSHConnection, 
    onSuccess: (conn: SSHConnection) => void
  ): Promise<TestResult> {
    try {
      const res = await fetch('/api/v1/ssh/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: connection.host,
          port: connection.port,
          username: connection.username,
          password: connection.password || ''
        })
      });
      
      const result = await res.json();
      
      if (res.ok) {
        onSuccess(connection);
        return { success: true, message: "Connexion sélectionnée avec succès" };
      } else {
        return { success: false, message: result.error || "Impossible de sélectionner cette connexion" };
      }
    } catch {
      return { success: false, message: "Erreur réseau lors de la sélection" };
    }
  }
}