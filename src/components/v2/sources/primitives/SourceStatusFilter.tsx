'use client';

import React from 'react';

type SourceStatus = 'NEW' | 'REVIEWED' | 'IGNORED';

interface SourceStatusFilterProps {
  selectedStatus: SourceStatus | null;
  onStatusChange: (status: SourceStatus | null) => void;
  statusCounts?: Record<SourceStatus, number>;
}

export function SourceStatusFilter({
  selectedStatus,
  onStatusChange,
  statusCounts,
}: SourceStatusFilterProps) {
  const statuses: SourceStatus[] = ['NEW', 'REVIEWED', 'IGNORED'];

  return (
    <div className="flex gap-2 flex-wrap mb-4">
      <button
        onClick={() => onStatusChange(null)}
        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
          selectedStatus === null
            ? 'bg-gray-900 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        All
      </button>
      {statuses.map((status) => (
        <button
          key={status}
          onClick={() => onStatusChange(status)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            selectedStatus === status
              ? getStatusColor(status).selected
              : getStatusColor(status).default
          }`}
        >
          {status}
          {statusCounts && statusCounts[status] > 0 && (
            <span className="ml-1">({statusCounts[status]})</span>
          )}
        </button>
      ))}
    </div>
  );
}

function getStatusColor(status: SourceStatus) {
  switch (status) {
    case 'NEW':
      return {
        selected: 'bg-blue-600 text-white',
        default: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
      };
    case 'REVIEWED':
      return {
        selected: 'bg-green-600 text-white',
        default: 'bg-green-50 text-green-700 hover:bg-green-100',
      };
    case 'IGNORED':
      return {
        selected: 'bg-gray-600 text-white',
        default: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
      };
  }
}
