import { useEffect } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { TabsProvider } from './contexts/TabsContext';
import { SSHProvider } from './contexts/SSHContext';
import { Layout } from './components/layout/Layout';
import { StorageManager } from './components/tools/CopyTool/hooks/useStorageManager';

function App() {
  // Initialisation et nettoyage au démarrage de l'application
  useEffect(() => {
    try {
      // Nettoyer les anciens onglets (30 jours par défaut)
      StorageManager.cleanupOldTabs(30);
      
      // Optionnel : programmer un nettoyage périodique
      const cleanupInterval = setInterval(() => {
        StorageManager.cleanupOldTabs(30);
      }, 24 * 60 * 60 * 1000); // Une fois par jour
      
      return () => {
        clearInterval(cleanupInterval);
      };
    } catch (error) {
      console.error("Erreur lors de l'initialisation de l'application:", error);
    }
  }, []);

  return (
    <ThemeProvider>
      <SSHProvider>
        <TabsProvider>
          <Layout />
        </TabsProvider>
      </SSHProvider>
    </ThemeProvider>
  );
}

export default App;
