/**
 * New Team Page
 *
 * Create a new team.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const libraries = [
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'it', label: 'IT' },
  { id: 'gtm', label: 'GTM / Customers' },
  { id: 'prompts', label: 'Prompts' },
  { id: 'personas', label: 'Personas' },
  { id: 'templates', label: 'Templates' },
];

export default function NewTeamPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedLibraries, setSelectedLibraries] = useState<string[]>(['knowledge']);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggleLibrary = (libraryId: string) => {
    setSelectedLibraries((prev) =>
      prev.includes(libraryId)
        ? prev.filter((id) => id !== libraryId)
        : [...prev, libraryId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Team name is required');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/v2/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          libraries: selectedLibraries,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create team');
      }

      const data = await response.json();
      toast.success('Team created successfully');
      router.push(`/v2/teams/${data.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create team';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <Link
        href="/v2/admin?tab=teams"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Teams
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Create Team</h1>
        <p className="mt-1 text-sm text-gray-500">
          Set up a new team and configure library access.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        {/* Team Name */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            Team Name
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Engineering, Sales, Marketing"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
          <p className="mt-1 text-xs text-gray-500">
            Unique name for this team
          </p>
        </div>

        {/* Description */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description of the team's purpose..."
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
          <p className="mt-1 text-xs text-gray-500">
            Optional context about this team
          </p>
        </div>

        {/* Library Access */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Library Access</h3>
          <p className="text-sm text-gray-500 mb-4">
            Select which libraries this team can access
          </p>
          <div className="space-y-3">
            {libraries.map((lib) => (
              <label key={lib.id} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedLibraries.includes(lib.id)}
                  onChange={() => handleToggleLibrary(lib.id)}
                  disabled={isLoading}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">{lib.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Team
          </button>
          <Link
            href="/v2/admin?tab=teams"
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
