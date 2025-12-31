import { useConnectionStore, type AutoConnectStep } from "@/stores";
import { Spinner } from "./ui/spinner";
import { Button } from "./ui/button";

const steps: { id: AutoConnectStep; label: string }[] = [
  { id: "forwarding_port", label: "Port Forward" },
  { id: "loading_targets", label: "Load Targets" },
  { id: "connecting_cdp", label: "Connect CDP" },
];

function getStepStatus(
  stepId: AutoConnectStep,
  currentStep: AutoConnectStep
): "pending" | "in_progress" | "completed" | "error" {
  const stepOrder: AutoConnectStep[] = [
    "idle",
    "forwarding_port",
    "loading_targets",
    "connecting_cdp",
    "connected",
  ];

  const currentIndex = stepOrder.indexOf(currentStep);
  const stepIndex = stepOrder.indexOf(stepId);

  if (currentStep === "error") {
    // Find the step that was in progress when error occurred
    return stepIndex < currentIndex ? "completed" : stepIndex === currentIndex ? "error" : "pending";
  }

  if (currentStep === "connected") {
    return "completed";
  }

  if (stepIndex < currentIndex) {
    return "completed";
  } else if (stepIndex === currentIndex) {
    return "in_progress";
  }
  return "pending";
}

interface AutoConnectProgressProps {
  onCancel?: () => void;
  onRetry?: () => void;
}

export function AutoConnectProgress({ onCancel, onRetry }: AutoConnectProgressProps) {
  const { autoConnectStep, autoConnectError, isAutoConnecting } = useConnectionStore();

  if (autoConnectStep === "idle") {
    return null;
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-4">
      {/* Step indicators */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const status = getStepStatus(step.id, autoConnectStep);
          return (
            <div key={step.id} className="flex items-center flex-1">
              {/* Step circle */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    status === "completed"
                      ? "bg-green-600 text-white"
                      : status === "in_progress"
                      ? "bg-blue-600 text-white"
                      : status === "error"
                      ? "bg-red-600 text-white"
                      : "bg-gray-700 text-gray-400"
                  }`}
                >
                  {status === "completed" ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : status === "in_progress" ? (
                    <Spinner size="sm" />
                  ) : status === "error" ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                <span
                  className={`text-xs mt-1 ${
                    status === "completed" || status === "in_progress"
                      ? "text-white"
                      : status === "error"
                      ? "text-red-400"
                      : "text-gray-500"
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 ${
                    getStepStatus(steps[index + 1].id, autoConnectStep) !== "pending"
                      ? "bg-green-600"
                      : "bg-gray-700"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Error message */}
      {autoConnectError && (
        <div className="bg-red-900/50 border border-red-700 rounded p-3">
          <p className="text-sm text-red-300">{autoConnectError}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        {isAutoConnecting && onCancel && (
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        {autoConnectStep === "error" && onRetry && (
          <Button variant="default" size="sm" onClick={onRetry}>
            Retry
          </Button>
        )}
        {autoConnectStep === "connected" && (
          <span className="text-sm text-green-400 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Connected
          </span>
        )}
      </div>
    </div>
  );
}
