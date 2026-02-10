'use client';

/**
 * CreatePersonaModal - Type-specific modal for creating personas
 *
 * Handles creation of personas for the personas library.
 * Personas define communication style (tone, voice, audience).
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { handleModalResponse, getNetworkErrorMessage } from '@/lib/modal-error-handler';

export interface CreatePersonaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (personaId: string) => void;
}

export function CreatePersonaModal({
  isOpen,
  onClose,
  onSuccess,
}: CreatePersonaModalProps) {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [tone, setTone] = useState('');
  const [audience, setAudience] = useState('');
  const [voice, setVoice] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      let response: Response;
      try {
        response = await fetch('/api/v2/personas/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            content,
            summary: summary || undefined,
            attributes: {
              tone: tone || undefined,
              audience: audience || undefined,
              voice: voice || undefined,
              isDefault: false,
              shareStatus: 'PRIVATE',
            },
          }),
        });
      } catch (networkError) {
        console.error('[CreatePersonaModal] Network error:', networkError);
        setError(getNetworkErrorMessage());
        return;
      }

      const result = await handleModalResponse<{ id: string }>({
        response,
        errorMessage: 'Failed to create persona',
      });

      // Wrap onSuccess callback in try-catch to prevent silent failures
      try {
        onSuccess?.(result.id);
      } catch (callbackError) {
        console.error('[CreatePersonaModal] Error in onSuccess callback:', callbackError);
        setError('Error completing creation. Please try navigating manually.');
        return;
      }

      // Reset form and close
      setTitle('');
      setSummary('');
      setContent('');
      setTone('');
      setAudience('');
      setVoice('');
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      console.error('[CreatePersonaModal] Error creating persona:', err);
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Persona</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Persona Name *
            </label>
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., 'Professional Consultant', 'Friendly Expert'"
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
              placeholder="Brief description of this persona"
              disabled={isLoading}
            />
          </div>

          {/* Persona Attributes */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tone
              </label>
              <Input
                type="text"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                placeholder="e.g., 'Professional', 'Casual'"
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Voice
              </label>
              <Input
                type="text"
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                placeholder="e.g., 'Authoritative', 'Conversational'"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Audience */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Audience
            </label>
            <Input
              type="text"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="e.g., 'Business leaders', 'Technical teams'"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Persona Definition *
            </label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Describe this persona's characteristics, values, and communication style..."
              rows={8}
              disabled={isLoading}
              required
            />
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
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isLoading ? 'Creating...' : 'Create Persona'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
