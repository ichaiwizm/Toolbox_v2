import { useState } from "react";

/**
 * Hook pour gérer les champs d'entrée du formulaire
 */
export function useFormInputs() {
  const [directoryInput, setDirectoryInput] = useState("");
  const [fileInput, setFileInput] = useState("");
  const [extensionInput, setExtensionInput] = useState("");
  const [patternInput, setPatternInput] = useState("");
  const [excludeDirectoryInput, setExcludeDirectoryInput] = useState("");

  const clearInputs = () => {
    setDirectoryInput("");
    setFileInput("");
    setExtensionInput("");
    setPatternInput("");
    setExcludeDirectoryInput("");
  };

  return {
    directoryInput,
    fileInput,
    extensionInput,
    patternInput,
    excludeDirectoryInput,
    setDirectoryInput,
    setFileInput,
    setExtensionInput,
    setPatternInput,
    setExcludeDirectoryInput,
    clearInputs
  };
}