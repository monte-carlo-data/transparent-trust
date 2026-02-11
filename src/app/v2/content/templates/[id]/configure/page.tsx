'use client';

/**
 * Template Configure Page
 *
 * Configure output type, placeholders, and default persona for a template.
 * This page focuses on the structured output configuration for collateral generation.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Settings, Save, Loader2, AlertTriangle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { PlaceholderTable, type PlaceholderEntry } from '@/components/v2/templates/PlaceholderTable';
import { BulkImportModal } from '@/components/v2/templates/BulkImportModal';
import type { TemplateAttributes } from '@/types/v2';

interface Template {
  id: string;
  title: string;
  slug: string | null;
  content: string;
  summary: string | null;
  status: string;
  attributes: TemplateAttributes | null;
  createdAt: string;
  updatedAt: string;
}

interface Persona {
  id: string;
  title: string;
}

const OUTPUT_TYPES: Array<{ value: string; label: string; disabled?: boolean }> = [
  { value: 'text', label: 'Text (No structured output)' },
  { value: 'google-slides', label: 'Google Slides' },
  { value: 'word', label: 'Word Document (Coming soon)', disabled: true },
  { value: 'pdf', label: 'PDF (Coming soon)', disabled: true },
];

export default function TemplateConfigurePage() {
  const params = useParams();
  const templateId = params.id as string;

  // Template state
  const [template, setTemplate] = useState<Template | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [outputType, setOutputType] = useState<string>('text');
  const [googleSlidesId, setGoogleSlidesId] = useState('');
  const [placeholders, setPlaceholders] = useState<PlaceholderEntry[]>([]);
  const [defaultPersonaId, setDefaultPersonaId] = useState<string>('');

  // Personas list
  const [personas, setPersonas] = useState<Persona[]>([]);

  // Auto-detect state
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);

  // Bulk import modal
  const [showBulkImport, setShowBulkImport] = useState(false);

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load template
  useEffect(() => {
    const fetchTemplate = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/v2/blocks/${templateId}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError('Template not found');
          } else {
            setError('Failed to load template');
          }
          return;
        }

        const data = await response.json();

        // Verify it's a template
        if (data.libraryId !== 'templates') {
          setError('This block is not a template');
          return;
        }

        setTemplate(data);

        // Initialize form state
        setTitle(data.title);
        setContent(data.content);
        setOutputType(data.attributes?.outputType || 'text');

        // Get Google Slides ID from either new or legacy location
        const slidesId =
          data.attributes?.outputConfig?.['google-slides']?.templateId ||
          data.attributes?.googleSlidesTemplateId ||
          '';
        setGoogleSlidesId(slidesId);

        // Convert placeholderGuide to array format
        const guide = data.attributes?.placeholderGuide || {};
        const placeholderArray = Object.entries(guide).map(([name, description]) => ({
          name,
          description: description as string,
        }));
        setPlaceholders(placeholderArray);

        setDefaultPersonaId(data.attributes?.defaultPersonaId || '');
      } catch (err) {
        console.error('Error fetching template:', err);
        setError('Failed to load template');
      } finally {
        setIsLoading(false);
      }
    };

    if (templateId) {
      fetchTemplate();
    }
  }, [templateId]);

  // Load personas
  useEffect(() => {
    const fetchPersonas = async () => {
      try {
        const response = await fetch('/api/v2/blocks?libraryId=personas&limit=100');
        if (response.ok) {
          const data = await response.json();
          setPersonas(data.blocks || []);
        } else {
          console.error('Failed to fetch personas:', response.status);
          toast.error('Failed to load personas');
        }
      } catch (err) {
        console.error('Error fetching personas:', err);
        toast.error('Failed to load personas');
      }
    };

    fetchPersonas();
  }, []);

  // Track unsaved changes
  useEffect(() => {
    if (!template) return;

    const originalSlidesId =
      template.attributes?.outputConfig?.['google-slides']?.templateId ||
      template.attributes?.googleSlidesTemplateId ||
      '';
    const originalGuide = template.attributes?.placeholderGuide || {};
    const originalPlaceholders = Object.entries(originalGuide).map(([name, description]) => ({
      name,
      description: description as string,
    }));

    const hasChanges =
      title !== template.title ||
      content !== template.content ||
      outputType !== (template.attributes?.outputType || 'text') ||
      googleSlidesId !== originalSlidesId ||
      defaultPersonaId !== (template.attributes?.defaultPersonaId || '') ||
      JSON.stringify(placeholders) !== JSON.stringify(originalPlaceholders);

    setHasUnsavedChanges(hasChanges);
  }, [template, title, content, outputType, googleSlidesId, placeholders, defaultPersonaId]);

  // Parse Google Slides URL to extract ID
  const parseGoogleSlidesId = (input: string): string => {
    // If it's already just an ID (no slashes), return as-is
    if (!input.includes('/')) {
      return input.trim();
    }

    // Try to extract ID from URL patterns:
    // https://docs.google.com/presentation/d/PRESENTATION_ID/edit
    // https://docs.google.com/presentation/d/PRESENTATION_ID
    const match = input.match(/\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : input.trim();
  };

  const handleGoogleSlidesIdChange = (value: string) => {
    setGoogleSlidesId(parseGoogleSlidesId(value));
  };

  // Auto-detect placeholders from Google Slides
  const handleAutoDetect = useCallback(async () => {
    if (!googleSlidesId) {
      toast.error('Please enter a Google Slides template ID first');
      return;
    }

    setIsAutoDetecting(true);
    try {
      const response = await fetch(
        `/api/v2/collateral/slides-placeholders?presentationId=${encodeURIComponent(googleSlidesId)}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to detect placeholders');
      }

      const detectedPlaceholders: string[] = data.placeholders || [];

      if (detectedPlaceholders.length === 0) {
        toast.warning('No {{...}} placeholders found in the presentation');
        return;
      }

      // Merge with existing placeholders
      const existingNames = new Set(placeholders.map((p) => p.name));
      const newPlaceholders: PlaceholderEntry[] = detectedPlaceholders
        .filter((name) => !existingNames.has(name))
        .map((name) => ({ name, description: '' }));

      if (newPlaceholders.length === 0) {
        toast.info('All detected placeholders already exist');
        return;
      }

      setPlaceholders([...placeholders, ...newPlaceholders]);
      toast.success(`Added ${newPlaceholders.length} placeholder${newPlaceholders.length !== 1 ? 's' : ''}`);
    } catch (err) {
      console.error('Error auto-detecting placeholders:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to detect placeholders');
    } finally {
      setIsAutoDetecting(false);
    }
  }, [googleSlidesId, placeholders]);

  // Handle bulk import
  const handleBulkImport = (imported: PlaceholderEntry[]) => {
    // Merge with existing, avoiding duplicates by name
    const existingNames = new Set(placeholders.map((p) => p.name));
    const newPlaceholders = imported.filter((p) => !existingNames.has(p.name));

    // Update existing placeholders with new descriptions if names match
    const updatedExisting = placeholders.map((p) => {
      const importedMatch = imported.find((i) => i.name === p.name);
      if (importedMatch && importedMatch.description) {
        return { ...p, description: importedMatch.description };
      }
      return p;
    });

    setPlaceholders([...updatedExisting, ...newPlaceholders]);

    const addedCount = newPlaceholders.length;
    const updatedCount = imported.length - newPlaceholders.length;

    if (addedCount > 0 && updatedCount > 0) {
      toast.success(`Added ${addedCount} new, updated ${updatedCount} existing`);
    } else if (addedCount > 0) {
      toast.success(`Added ${addedCount} placeholder${addedCount !== 1 ? 's' : ''}`);
    } else if (updatedCount > 0) {
      toast.success(`Updated ${updatedCount} placeholder${updatedCount !== 1 ? 's' : ''}`);
    }
  };

  // Save template
  const handleSave = async () => {
    if (!template) return;

    setIsSaving(true);
    try {
      // Convert placeholders array back to guide object
      const placeholderGuide: Record<string, string> = {};
      placeholders.forEach((p) => {
        if (p.name.trim()) {
          placeholderGuide[p.name.trim()] = p.description;
        }
      });

      // Build outputConfig based on output type
      const outputConfig: TemplateAttributes['outputConfig'] = {};
      if (outputType === 'google-slides' && googleSlidesId) {
        outputConfig['google-slides'] = { templateId: googleSlidesId };
      }

      const response = await fetch(`/api/v2/blocks/${templateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          attributes: {
            ...template.attributes,
            outputType: outputType as TemplateAttributes['outputType'],
            outputConfig,
            placeholderGuide,
            detectedPlaceholders: placeholders.map((p) => p.name).filter(Boolean),
            defaultPersonaId: defaultPersonaId || undefined,
            // Keep legacy field for backward compatibility during transition
            googleSlidesTemplateId: outputType === 'google-slides' ? googleSlidesId : undefined,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save template');
      }

      const updated = await response.json();
      setTemplate(updated);
      // Note: hasUnsavedChanges will be recomputed by the useEffect when template updates
      toast.success('Template saved successfully');
    } catch (err) {
      console.error('Error saving template:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <Link
          href="/v2/content/templates"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Templates
        </Link>
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-red-600 mb-2">Error</h1>
          <p className="text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!template) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b px-8 py-6">
        <Link
          href={`/v2/content/templates/${templateId}`}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Template
        </Link>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-purple-100">
              <Settings className="w-6 h-6 text-purple-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Configure Template</h1>
              <p className="text-sm text-slate-500 mt-1">
                Configure output format, placeholders, and default persona
              </p>
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={isSaving || !hasUnsavedChanges}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-8 max-w-4xl mx-auto space-y-8">
        {/* Section 1: Basic Settings */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Basic Settings</h2>

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Template Name
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Template name"
              />
            </div>

            {/* Output Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Output Type
              </label>
              <Select value={outputType} onValueChange={setOutputType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select output type" />
                </SelectTrigger>
                <SelectContent>
                  {OUTPUT_TYPES.map((type) => (
                    <SelectItem
                      key={type.value}
                      value={type.value}
                      disabled={type.disabled}
                    >
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                Determines how the generated content is formatted and exported
              </p>
            </div>

            {/* Google Slides Template ID */}
            {outputType === 'google-slides' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Google Slides Template ID
                </label>
                <div className="flex gap-2">
                  <Input
                    value={googleSlidesId}
                    onChange={(e) => handleGoogleSlidesIdChange(e.target.value)}
                    placeholder="Paste URL or enter presentation ID"
                    className="flex-1"
                  />
                  {googleSlidesId && (
                    <Button
                      variant="outline"
                      size="icon"
                      asChild
                    >
                      <a
                        href={`https://docs.google.com/presentation/d/${encodeURIComponent(googleSlidesId)}/edit`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open in Google Slides"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Paste the full Google Slides URL or just the presentation ID
                </p>
              </div>
            )}

            {/* Default Persona */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Persona
              </label>
              <Select value={defaultPersonaId} onValueChange={setDefaultPersonaId}>
                <SelectTrigger>
                  <SelectValue placeholder="No default persona" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No default persona</SelectItem>
                  {personas.map((persona) => (
                    <SelectItem key={persona.id} value={persona.id}>
                      {persona.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                Pre-select a persona when using this template for generation
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: Template Instructions */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Template Instructions</h2>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter template instructions and guidelines..."
            rows={12}
            className="font-mono text-sm"
          />
          <p className="text-xs text-gray-500 mt-2">
            These instructions tell the AI how to analyze the source materials and generate content.
            Include purpose, extraction frameworks, and quality standards.
          </p>
        </div>

        {/* Section 3: Placeholders */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Placeholders</h2>
          <p className="text-sm text-gray-600 mb-4">
            Define the placeholders used in your template. Each placeholder should have a description
            explaining what content should be generated for it.
          </p>

          <PlaceholderTable
            placeholders={placeholders}
            onChange={setPlaceholders}
            onAutoDetect={outputType === 'google-slides' ? handleAutoDetect : undefined}
            onBulkImport={() => setShowBulkImport(true)}
            isAutoDetectLoading={isAutoDetecting}
            isAutoDetectDisabled={!googleSlidesId}
            autoDetectDisabledReason={
              !googleSlidesId ? 'Enter a Google Slides template ID first' : undefined
            }
          />
        </div>

        {/* Unsaved changes indicator */}
        {hasUnsavedChanges && (
          <div className="fixed bottom-4 right-4 bg-amber-100 text-amber-800 px-4 py-2 rounded-lg shadow-lg text-sm">
            You have unsaved changes
          </div>
        )}
      </div>

      {/* Bulk Import Modal */}
      <BulkImportModal
        isOpen={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        onImport={handleBulkImport}
      />
    </div>
  );
}
