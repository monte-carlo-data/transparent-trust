'use client';

/**
 * Template Detail/Edit Page
 *
 * View and edit a single template. Features:
 * - View template content with markdown preview
 * - Edit title, summary, content
 * - View and edit template attributes (format, sections)
 * - Delete template
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  FileText,
  Edit3,
  Save,
  Trash2,
  Eye,
  Code,
  Loader2,
  X,
  AlertTriangle,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
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

const OUTPUT_FORMATS = [
  { value: 'markdown', label: 'Markdown' },
  { value: 'docx', label: 'Word Document (.docx)' },
  { value: 'pdf', label: 'PDF' },
] as const;

export default function TemplateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const templateId = params.id as string;

  // State
  const [template, setTemplate] = useState<Template | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editFormat, setEditFormat] = useState<string>('markdown');
  const [isSaving, setIsSaving] = useState(false);

  // Preview mode
  const [showPreview, setShowPreview] = useState(false);

  // Delete confirmation
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
        // Initialize edit form with current values
        setEditTitle(data.title);
        setEditSummary(data.summary || '');
        setEditContent(data.content);
        setEditFormat(data.attributes?.format || 'markdown');
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

  // Handle save
  const handleSave = async () => {
    if (!template) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/v2/blocks/${templateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          summary: editSummary || null,
          content: editContent,
          attributes: {
            ...template.attributes,
            format: editFormat,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save template');
      }

      const updated = await response.json();
      setTemplate(updated);
      setIsEditing(false);
      toast.success('Template saved successfully');
    } catch (err) {
      console.error('Error saving template:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/v2/blocks/${templateId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete template');
      }

      toast.success('Template deleted');
      router.push('/v2/content/templates');
    } catch (err) {
      console.error('Error deleting template:', err);
      toast.error('Failed to delete template');
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  // Cancel editing
  const handleCancelEdit = () => {
    if (template) {
      setEditTitle(template.title);
      setEditSummary(template.summary || '');
      setEditContent(template.content);
      setEditFormat(template.attributes?.format || 'markdown');
    }
    setIsEditing(false);
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
          href="/v2/content/templates"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Templates
        </Link>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-green-100">
              <FileText className="w-6 h-6 text-green-700" />
            </div>
            <div>
              {isEditing ? (
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-2xl font-bold h-auto py-1 px-2 -ml-2"
                  placeholder="Template title"
                />
              ) : (
                <h1 className="text-2xl font-bold text-slate-900">{template.title}</h1>
              )}
              <div className="flex items-center gap-2 mt-2">
                <Badge
                  variant="outline"
                  className={
                    template.status === 'ACTIVE'
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : template.status === 'DRAFT'
                      ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                      : 'bg-gray-50 text-gray-700 border-gray-200'
                  }
                >
                  {template.status}
                </Badge>
                <Badge variant="outline" className="bg-slate-50">
                  {template.attributes?.format || 'markdown'}
                </Badge>
                <span className="text-sm text-slate-500">
                  Updated {new Date(template.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button
                  variant="outline"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving || !editTitle || !editContent}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
                <Link href={`/v2/content/templates/${templateId}/configure`}>
                  <Button variant="outline">
                    <Settings className="w-4 h-4 mr-2" />
                    Configure
                  </Button>
                </Link>
                <Button onClick={() => setIsEditing(true)}>
                  <Edit3 className="w-4 h-4 mr-2" />
                  Edit Template
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Summary */}
            <div className="bg-white rounded-lg border p-6">
              <h2 className="font-semibold text-slate-900 mb-3">Summary</h2>
              {isEditing ? (
                <Input
                  value={editSummary}
                  onChange={(e) => setEditSummary(e.target.value)}
                  placeholder="Brief description of this template's purpose"
                />
              ) : (
                <p className="text-slate-600">
                  {template.summary || <span className="italic text-slate-400">No summary provided</span>}
                </p>
              )}
            </div>

            {/* Template Content */}
            <div className="bg-white rounded-lg border">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h2 className="font-semibold text-slate-900">Template Content</h2>
                {!isEditing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPreview(!showPreview)}
                  >
                    {showPreview ? (
                      <>
                        <Code className="w-4 h-4 mr-2" />
                        View Source
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4 mr-2" />
                        Preview
                      </>
                    )}
                  </Button>
                )}
              </div>
              <div className="p-6">
                {isEditing ? (
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="min-h-[400px] font-mono text-sm"
                    placeholder="Enter template content with placeholders like {{customer.name}}"
                  />
                ) : showPreview ? (
                  <div className="prose prose-slate max-w-none">
                    <ReactMarkdown>{template.content}</ReactMarkdown>
                  </div>
                ) : (
                  <pre className="text-sm text-slate-700 font-mono whitespace-pre-wrap bg-slate-50 p-4 rounded-lg overflow-auto max-h-[500px]">
                    {template.content}
                  </pre>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Settings */}
            <div className="bg-white rounded-lg border p-6">
              <h2 className="font-semibold text-slate-900 mb-4">Settings</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Output Format
                  </label>
                  {isEditing ? (
                    <Select value={editFormat} onValueChange={setEditFormat}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select format" />
                      </SelectTrigger>
                      <SelectContent>
                        {OUTPUT_FORMATS.map((format) => (
                          <SelectItem key={format.value} value={format.value}>
                            {format.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-slate-600 capitalize">
                      {template.attributes?.format || 'Markdown'}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Status
                  </label>
                  <p className="text-slate-600">{template.status}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Created
                  </label>
                  <p className="text-slate-600">
                    {new Date(template.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Placeholder Help */}
            <div className="bg-white rounded-lg border p-6">
              <h2 className="font-semibold text-slate-900 mb-3">Placeholder Syntax</h2>
              <div className="text-sm text-slate-600 space-y-2">
                <p>Use placeholders in your template:</p>
                <ul className="space-y-1 font-mono text-xs bg-slate-50 p-3 rounded">
                  <li>{'{{customer.name}}'}</li>
                  <li>{'{{customer.industry}}'}</li>
                  <li>{'{{skill.all}}'}</li>
                  <li>{'{{skill.titles}}'}</li>
                  <li>{'{{date.today}}'}</li>
                  <li>{'{{llm:write summary}}'}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Delete Template
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{template.title}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
