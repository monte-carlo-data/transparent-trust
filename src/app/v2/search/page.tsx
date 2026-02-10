/**
 * Global Search Page
 *
 * Search across all libraries (Skills, Customers, IT Skills, Prompts, Personas, Templates)
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, Loader2, AlertCircle, BookOpen, Users, Wrench, MessageSquare, Lightbulb, FileText } from 'lucide-react';

interface SearchResult {
  id: string;
  title: string;
  slug: string | null;
  libraryId: string;
  blockType: string;
  summary: string | null;
  status: string;
  updatedAt: Date;
}

interface SearchResponse {
  query: string;
  total: number;
  results: SearchResult[];
  groupedByLibrary: Record<string, SearchResult[]>;
}

const libraryIcons: Record<string, typeof BookOpen> = {
  knowledge: BookOpen,
  it: Wrench,
  gtm: Users,
  prompts: MessageSquare,
  personas: Lightbulb,
  templates: FileText,
};

const libraryLabels: Record<string, string> = {
  knowledge: 'Knowledge Dashboard',
  it: 'IT Dashboard',
  gtm: 'GTM Dashboard',
  prompts: 'Prompts',
  personas: 'Personas',
  templates: 'Templates',
};

const libraryPaths: Record<string, string> = {
  knowledge: '/v2/knowledge',
  it: '/v2/it',
  gtm: '/v2/gtm',
  prompts: '/v2/prompt-registry',
  personas: '/v2/content/personas',
  templates: '/v2/content/templates',
};

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults(null);
      setSearchError(null);
      return;
    }

    setIsLoading(true);
    setSearchError(null);

    try {
      const response = await fetch(`/api/v2/search?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Search failed');
      }

      const data = await response.json();
      setResults(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Search failed';
      setSearchError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    handleSearch(newQuery);
  };

  return (
    <div className="p-8">
      {/* Back Link */}
      <Link
        href="/v2/blocks"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Global Search</h1>
        <p className="text-gray-500">Search across all libraries: Skills, IT Skills, Customers, and more</p>
      </div>

      {/* Search Input */}
      <div className="mb-8">
        <div className="relative max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={handleQueryChange}
            placeholder="Search skills, customers, prompts... (min 2 characters)"
            className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
            autoFocus
          />
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
        </div>
      )}

      {/* Error */}
      {searchError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-red-900">Search Error</h3>
            <p className="text-sm text-red-700 mt-1">{searchError}</p>
          </div>
        </div>
      )}

      {/* No Query Message */}
      {!isLoading && !searchError && !query && (
        <div className="text-center py-12">
          <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Enter a search term to get started</p>
        </div>
      )}

      {/* No Results */}
      {!isLoading && !searchError && query && results && results.total === 0 && (
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No results found for &quot;{query}&quot;</p>
        </div>
      )}

      {/* Results */}
      {!isLoading && !searchError && results && results.total > 0 && (
        <div className="space-y-8">
          <div className="text-sm text-gray-500">
            Found <span className="font-semibold text-gray-900">{results.total}</span> result
            {results.total !== 1 ? 's' : ''}
          </div>

          {Object.entries(results.groupedByLibrary).map(([libraryId, libraryResults]) => {
            const Icon = libraryIcons[libraryId] || BookOpen;
            const label = libraryLabels[libraryId] || libraryId;
            const basePath = libraryPaths[libraryId] || '/v2/blocks';

            return (
              <div key={libraryId} className="space-y-3">
                <div className="flex items-center gap-2 mb-4">
                  <Icon className="w-5 h-5 text-gray-600" />
                  <h2 className="text-lg font-semibold text-gray-900">{label}</h2>
                  <span className="ml-auto text-sm text-gray-500">
                    {libraryResults.length} result{libraryResults.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="grid gap-3">
                  {libraryResults.map((result) => {
                    const href =
                      libraryId === 'prompts' || libraryId === 'personas' || libraryId === 'templates'
                        ? `${basePath}/${result.id}`
                        : `${basePath}/${result.slug || result.id}`;

                    return (
                      <Link
                        key={result.id}
                        href={href}
                        className="block p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-gray-900 truncate">{result.title}</h3>
                            {result.summary && (
                              <p className="text-sm text-gray-600 mt-1 line-clamp-2">{result.summary}</p>
                            )}
                            <div className="flex items-center gap-3 mt-2">
                              {result.status === 'DRAFT' && (
                                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                                  Pending Review
                                </span>
                              )}
                              {result.status === 'ACTIVE' && (
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                  Active
                                </span>
                              )}
                              <span className="text-xs text-gray-500">
                                Updated {new Date(result.updatedAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
