'use client';

/**
 * CreateTemplateModal - Type-specific modal for creating templates
 *
 * Handles creation of document and content templates for the templates library.
 * Supports output type selection (text, google-slides) and optional redirect to configure page.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { handleModalResponse, getNetworkErrorMessage } from '@/lib/modal-error-handler';

const OUTPUT_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'google-slides', label: 'Google Slides' },
] as const;

export interface CreateTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (templateId: string) => void;
}

export function CreateTemplateModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateTemplateModalProps) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [outputType, setOutputType] = useState<string>('text');
  const [googleSlidesId, setGoogleSlidesId] = useState('');
  const [openConfigureAfter, setOpenConfigureAfter] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parse Google Slides URL to extract ID
  const parseGoogleSlidesId = (input: string): string => {
    if (!input.includes('/')) {
      return input.trim();
    }
    const match = input.match(/\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : input.trim();
  };

  const handleGoogleSlidesIdChange = (value: string) => {
    setGoogleSlidesId(parseGoogleSlidesId(value));
  };

  const resetForm = () => {
    setTitle('');
    setSummary('');
    setContent('');
    setOutputType('text');
    setGoogleSlidesId('');
    setOpenConfigureAfter(true);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      let response: Response;
      try {
        // Build attributes with output configuration
        const attributes: Record<string, unknown> = {
          outputType,
        };

        if (outputType === 'google-slides' && googleSlidesId) {
          attributes.outputConfig = {
            'google-slides': { templateId: googleSlidesId },
          };
          // Keep legacy field for backward compatibility
          attributes.googleSlidesTemplateId = googleSlidesId;
        }

        response = await fetch('/api/v2/templates/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            content,
            summary: summary || undefined,
            attributes,
          }),
        });
      } catch (networkError) {
        console.error('[CreateTemplateModal] Network error:', networkError);
        setError(getNetworkErrorMessage());
        return;
      }

      const result = await handleModalResponse<{ id: string }>({
        response,
        errorMessage: 'Failed to create template',
      });

      // Reset form
      resetForm();

      // Close modal first
      onClose();

      // Handle navigation based on openConfigureAfter setting
      if (openConfigureAfter) {
        router.push(`/v2/content/templates/${result.id}/configure`);
      } else {
        // Call onSuccess callback if not navigating to configure
        try {
          onSuccess?.(result.id);
        } catch (callbackError) {
          console.error('[CreateTemplateModal] Error in onSuccess callback:', callbackError);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      console.error('[CreateTemplateModal] Error creating template:', err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Template</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Template Name *
            </label>
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., 'Sales Proposal', 'RFP Response Template'"
              disabled={isLoading}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Summary
            </label>
            <Input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Brief description of template purpose"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Output Type
            </label>
            <Select value={outputType} onValueChange={setOutputType} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue placeholder="Select output type" />
              </SelectTrigger>
              <SelectContent>
                {OUTPUT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-1">
              {outputType === 'google-slides'
                ? 'Template will generate placeholder values for a Google Slides presentation'
                : 'Template will generate text content'}
            </p>
          </div>

          {outputType === 'google-slides' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Google Slides Template ID
              </label>
              <Input
                type="text"
                value={googleSlidesId}
                onChange={(e) => handleGoogleSlidesIdChange(e.target.value)}
                placeholder="Paste URL or enter presentation ID"
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500 mt-1">
                Optional: You can add this later in the configure page
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Template Content *
            </label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter the template instructions and guidelines..."
              rows={8}
              disabled={isLoading}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Instructions for the AI on how to analyze source materials and generate content
            </p>
          </div>

          {/* Configure after checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="openConfigureAfter"
              checked={openConfigureAfter}
              onCheckedChange={(checked) => setOpenConfigureAfter(checked === true)}
              disabled={isLoading}
            />
            <Label
              htmlFor="openConfigureAfter"
              className="text-sm font-normal text-gray-600 cursor-pointer"
            >
              Open configuration page after creating
            </Label>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !title || !content}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading ? 'Creating...' : 'Create Template'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
