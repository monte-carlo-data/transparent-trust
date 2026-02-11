/**
 * Field Renderers
 *
 * Standard renderers for different metadata field types.
 */

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { MetadataFieldRenderProps } from './types';

/**
 * Text field renderer - displays a single text value
 */
export const textFieldRenderer = ({ value, field }: MetadataFieldRenderProps) => {
  const displayValue = value ? String(value) : 'N/A';

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <span className="text-sm font-medium text-gray-700">{field.label}</span>
      <div className="text-2xl font-bold text-gray-900 truncate capitalize">
        {displayValue}
      </div>
      <p className="text-xs text-gray-500 mt-1">{field.description}</p>
    </div>
  );
};

/**
 * Icon + text renderer - displays value with an icon
 */
export const iconTextRenderer = ({ value, field }: MetadataFieldRenderProps) => {
  const displayValue = value ? String(value) : 'N/A';
  const Icon = field.icon;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        {Icon && <Icon className="w-5 h-5 text-gray-600" />}
        <span className="text-sm font-medium text-gray-700">{field.label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900 truncate">{displayValue}</div>
      <p className="text-xs text-gray-500 mt-1">{field.description}</p>
    </div>
  );
};

/**
 * Health score renderer - displays numeric value with color-coded icon
 */
export const healthScoreRenderer = ({ value, field }: MetadataFieldRenderProps) => {
  const score = typeof value === 'number' ? value : undefined;

  if (score === undefined) return null;

  const getHealthIcon = () => {
    if (score >= 70) return <TrendingUp className="w-5 h-5 text-green-500" />;
    if (score >= 40) return <Minus className="w-5 h-5 text-yellow-500" />;
    return <TrendingDown className="w-5 h-5 text-red-500" />;
  };

  const getHealthColor = () => {
    if (score >= 70) return 'text-green-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        {getHealthIcon()}
        <span className="text-sm font-medium text-gray-700">{field.label}</span>
      </div>
      <div className={`text-2xl font-bold ${getHealthColor()}`}>{score}</div>
      <p className="text-xs text-gray-500 mt-1">{field.description}</p>
    </div>
  );
};

/**
 * Array field renderer - displays array values as pills/tags
 */
export const arrayFieldRenderer = ({ value, field }: MetadataFieldRenderProps) => {
  if (!Array.isArray(value) || value.length === 0) return null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <span className="text-sm font-medium text-gray-700">{field.label}</span>
      <div className="flex flex-wrap gap-2 mt-2">
        {value.map((item, idx) => (
          <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
            {String(item)}
          </span>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-1">{field.description}</p>
    </div>
  );
};
