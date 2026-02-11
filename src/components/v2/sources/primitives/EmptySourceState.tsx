'use client';

import React from 'react';

interface EmptySourceStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actionButton?: {
    label: string;
    onClick: () => void;
    icon?: React.ComponentType<{ className?: string }>;
  };
}

export function EmptySourceState({
  icon: Icon,
  title,
  description,
  actionButton,
}: EmptySourceStateProps) {
  return (
    <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
      <Icon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 mb-6">{description}</p>
      {actionButton && (
        <button
          onClick={actionButton.onClick}
          className="inline-flex items-center gap-2 px-4 py-2 text-white rounded-lg bg-blue-600 hover:bg-blue-700"
        >
          {actionButton.icon && <actionButton.icon className="w-4 h-4" />}
          {actionButton.label}
        </button>
      )}
    </div>
  );
}
