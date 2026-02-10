'use client';

import { Check, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WizardStep {
  key: string;
  label: string;
}

interface WizardStepperProps {
  steps: WizardStep[];
  currentStep: string;
  completedSteps: Set<string>;
  className?: string;
}

/**
 * Reusable wizard step indicator with numbered circles and check marks.
 * Pattern from CreateWizard.tsx - can be used across different wizard flows.
 */
export function WizardStepper({
  steps,
  currentStep,
  completedSteps,
  className,
}: WizardStepperProps) {
  const currentStepIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {steps.map((step, idx) => {
        const isActive = step.key === currentStep;
        const isCompleted = completedSteps.has(step.key);
        const isPast = idx < currentStepIndex || isCompleted;

        return (
          <div key={step.key} className="flex items-center gap-2">
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-all',
                isActive
                  ? 'bg-blue-600 text-white'
                  : isPast
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-300 text-gray-700'
              )}
            >
              {isPast && !isActive ? <Check className="w-5 h-5" /> : idx + 1}
            </div>
            <span
              className={cn(
                'text-sm font-medium transition-colors',
                isActive ? 'text-blue-600' : isPast ? 'text-green-600' : 'text-gray-700'
              )}
            >
              {step.label}
            </span>
            {idx < steps.length - 1 && (
              <ChevronRight className="w-4 h-4 text-gray-400 mx-2" />
            )}
          </div>
        );
      })}
    </div>
  );
}
