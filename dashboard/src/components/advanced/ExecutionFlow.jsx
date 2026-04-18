import { useEffect, useState } from "react";

export default function ExecutionFlow() {
  const steps = [
    "Analyzing Prompt...",
    "Planning Tasks...",
    "Generating Code...",
    "Designing UI...",
    "Debugging...",
    "Finalizing Output...",
  ];

  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) =>
        prev < steps.length - 1 ? prev + 1 : prev
      );
    }, 1200);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Execution Flow</h2>

      <div className="space-y-3">
        {steps.map((step, i) => (
          <div
            key={i}
            className={`p-3 rounded-lg border ${
              i === activeStep
                ? "border-green-500 bg-green-500/10"
                : "border-gray-700"
            } transition`}
          >
            {step}
          </div>
        ))}
      </div>
    </div>
  );
}