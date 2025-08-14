import { useState, useEffect } from "react";

/**
 * Hook pour gérer l'état de copie avec auto-reset
 */
export function useCopiedState() {
  const [copied, setCopied] = useState(false);

  // Réinitialiser le statut de copie après un délai
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  return {
    copied,
    setCopied
  };
}