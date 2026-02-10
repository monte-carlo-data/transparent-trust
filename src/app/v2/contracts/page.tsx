'use client';

/**
 * V2 Contracts Page
 *
 * Lists contract review projects with upload capability.
 * Uses BulkProject model with projectType='contract-review'.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Plus,
  FileText,
  Loader2,
  Trash2,
  Upload,
  AlertTriangle,
  CheckCircle,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

type Contract = {
  id: string;
  name: string;
  description?: string;
  projectType: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  config?: {
    contractType?: string;
    counterparty?: string;
    fileName?: string;
  };
  rowCount: number;
  rowStats: {
    pending: number;
    processing: number;
    completed: number;
    error: number;
  };
};

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  ARCHIVED: 'bg-yellow-100 text-yellow-800',
};

const statusIcons: Record<string, typeof Clock> = {
  DRAFT: Clock,
  IN_PROGRESS: Loader2,
  COMPLETED: CheckCircle,
  ARCHIVED: AlertTriangle,
};

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [newContract, setNewContract] = useState({
    name: '',
    description: '',
    counterparty: '',
    contractType: 'service-agreement',
  });

  useEffect(() => {
    loadContracts();
  }, []);

  const loadContracts = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/v2/projects?projectType=contract-review');
      if (response.ok) {
        const data = await response.json();
        setContracts(data.data?.projects || []);
      }
    } catch (error) {
      console.error('Failed to load contracts:', error);
      toast.error('Failed to load contracts');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      // Auto-fill name from filename if empty
      if (!newContract.name) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        setNewContract((prev) => ({ ...prev, name: nameWithoutExt }));
      }
    }
  };

  const createContract = async () => {
    if (!newContract.name.trim()) {
      toast.error('Please enter a contract name');
      return;
    }

    setIsCreating(true);
    try {
      // Create the project first
      const response = await fetch('/api/v2/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newContract.name,
          description: newContract.description,
          projectType: 'contract-review',
          config: {
            contractType: newContract.contractType,
            counterparty: newContract.counterparty,
            fileName: uploadedFile?.name,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create contract project');
      }

      const data = await response.json();
      const projectId = data.data?.project?.id;

      // If file was uploaded, send it for analysis
      if (uploadedFile && projectId) {
        const formData = new FormData();
        formData.append('file', uploadedFile);
        formData.append('projectId', projectId);

        const uploadResponse = await fetch('/api/v2/contracts/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          console.error('File upload failed, but project was created');
          toast.warning('Contract created, but file upload failed. You can upload again later.');
        }
      }

      setShowCreateDialog(false);
      setNewContract({ name: '', description: '', counterparty: '', contractType: 'service-agreement' });
      setUploadedFile(null);
      loadContracts();
      toast.success('Contract created successfully');
    } catch (error) {
      console.error('Failed to create contract:', error);
      toast.error('Failed to create contract');
    } finally {
      setIsCreating(false);
    }
  };

  const deleteContract = async (id: string) => {
    if (!confirm('Delete this contract and all its analysis data?')) return;

    try {
      await fetch(`/api/v2/projects/${id}`, { method: 'DELETE' });
      setContracts(contracts.filter((c) => c.id !== id));
      toast.success('Contract deleted');
    } catch (error) {
      console.error('Failed to delete contract:', error);
      toast.error('Failed to delete contract');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/v2" className="hover:text-gray-700">
              Platform V2
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span>Contracts</span>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Contract Review</h1>
          <p className="text-sm text-gray-500 mt-1">
            Upload and analyze contracts for risks and obligations
          </p>
        </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Upload Contract
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Upload Contract for Review</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {/* File Upload */}
              <div>
                <label className="text-sm font-medium">Contract Document</label>
                <div className="mt-1">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      {uploadedFile ? (
                        <>
                          <FileText className="w-8 h-8 text-blue-500 mb-2" />
                          <p className="text-sm text-gray-700 font-medium">{uploadedFile.name}</p>
                          <p className="text-xs text-gray-500">
                            {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-gray-400 mb-2" />
                          <p className="text-sm text-gray-500">
                            <span className="font-medium text-blue-600">Click to upload</span> or
                            drag and drop
                          </p>
                          <p className="text-xs text-gray-400">PDF, DOCX up to 10MB</p>
                        </>
                      )}
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.docx,.doc"
                      onChange={handleFileChange}
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Contract Name</label>
                <Input
                  value={newContract.name}
                  onChange={(e) => setNewContract({ ...newContract, name: e.target.value })}
                  placeholder="e.g., Acme Corp Service Agreement"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Counterparty</label>
                <Input
                  value={newContract.counterparty}
                  onChange={(e) => setNewContract({ ...newContract, counterparty: e.target.value })}
                  placeholder="e.g., Acme Corporation"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Contract Type</label>
                <select
                  value={newContract.contractType}
                  onChange={(e) => setNewContract({ ...newContract, contractType: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="service-agreement">Service Agreement</option>
                  <option value="nda">NDA</option>
                  <option value="msa">Master Service Agreement</option>
                  <option value="sow">Statement of Work</option>
                  <option value="dpa">Data Processing Agreement</option>
                  <option value="employment">Employment Contract</option>
                  <option value="vendor">Vendor Agreement</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Description (optional)</label>
                <Input
                  value={newContract.description}
                  onChange={(e) => setNewContract({ ...newContract, description: e.target.value })}
                  placeholder="Brief description of the contract"
                />
              </div>

              <Button
                className="w-full"
                onClick={createContract}
                disabled={isCreating || !newContract.name.trim()}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Create & Analyze
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Contract List */}
      {contracts.length === 0 ? (
        <Card className="border-l-4 border-l-orange-500 shadow-sm">
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No contracts yet</h3>
            <p className="text-gray-500 mb-4">
              Upload a contract to analyze it for risks and obligations.
            </p>
            <Button onClick={() => setShowCreateDialog(true)} className="bg-orange-600 hover:bg-orange-700">
              <Plus className="h-4 w-4 mr-2" />
              Upload your first contract
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {contracts.map((contract) => {
            const StatusIcon = statusIcons[contract.status] || Clock;
            return (
              <Card key={contract.id} className="border-l-4 border-l-orange-500 hover:shadow-md hover:-translate-y-1 transition-all duration-200 hover:bg-orange-50/20">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-orange-100 rounded-lg">
                        <FileText className="w-6 h-6 text-orange-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Link
                            href={`/v2/contracts/${contract.id}`}
                            className="text-lg font-medium text-gray-900 hover:text-blue-600"
                          >
                            {contract.name}
                          </Link>
                          <Badge className={statusColors[contract.status]}>
                            <StatusIcon
                              className={`w-3 h-3 mr-1 ${
                                contract.status === 'IN_PROGRESS' ? 'animate-spin' : ''
                              }`}
                            />
                            {contract.status}
                          </Badge>
                        </div>
                        {contract.description && (
                          <p className="text-sm text-gray-500 mb-2">{contract.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          {contract.config?.counterparty && (
                            <span>Counterparty: {contract.config.counterparty}</span>
                          )}
                          {contract.config?.contractType && (
                            <span className="capitalize">
                              {contract.config.contractType.replace(/-/g, ' ')}
                            </span>
                          )}
                          <span>{new Date(contract.createdAt).toLocaleDateString()}</span>
                        </div>
                        {/* Analysis Stats */}
                        {contract.rowCount > 0 && (
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <span className="text-gray-600">{contract.rowCount} items found</span>
                            {contract.rowStats.completed > 0 && (
                              <span className="text-green-600">
                                {contract.rowStats.completed} reviewed
                              </span>
                            )}
                            {contract.rowStats.error > 0 && (
                              <span className="text-red-600">
                                {contract.rowStats.error} issues
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href={`/v2/contracts/${contract.id}`}>
                        <Button variant="outline" size="sm">
                          Review
                        </Button>
                      </Link>
                      <Button variant="ghost" size="sm" onClick={() => deleteContract(contract.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
