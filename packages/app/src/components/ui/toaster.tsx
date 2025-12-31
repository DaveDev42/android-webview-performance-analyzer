import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      theme="dark"
      toastOptions={{
        style: {
          background: "#1f2937",
          border: "1px solid #374151",
          color: "#fff",
        },
        className: "text-sm",
      }}
      richColors
      closeButton
    />
  );
}

// Re-export toast function for convenience
export { toast } from "sonner";
