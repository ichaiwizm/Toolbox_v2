import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Info, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "info" | "warning";

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose?: () => void;
}

const toastIcons = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertCircle,
};

const toastStyles = {
  success: "bg-green-50 text-green-900 border-green-200",
  error: "bg-red-50 text-red-900 border-red-200",
  info: "bg-blue-50 text-blue-900 border-blue-200",
  warning: "bg-yellow-50 text-yellow-900 border-yellow-200",
};

export function Toast({ message, type = "info", duration = 3000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);

  const Icon = toastIcons[type];

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(() => {
        setIsVisible(false);
        onClose?.();
      }, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50",
        "flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg",
        "transition-all duration-300 transform",
        toastStyles[type],
        isLeaving ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
      )}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}

// Hook pour gérer les toasts
export function useToast() {
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const showToast = (message: string, type: ToastType = "info") => {
    setToast({ message, type });
  };

  const hideToast = () => {
    setToast(null);
  };

  return {
    toast,
    showToast,
    hideToast,
  };
}