'use client';

import { useState } from 'react';
import { X, Plus, Save, Trash2 } from 'lucide-react';

interface SkillOwner {
  userId?: string;
  name: string;
  email?: string;
  image?: string;
}

interface OwnerManagementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (owners: SkillOwner[]) => Promise<void>;
  currentOwners: SkillOwner[];
  isSaving?: boolean;
}

export default function OwnerManagementDialog({
  isOpen,
  onClose,
  onSave,
  currentOwners,
  isSaving = false,
}: OwnerManagementDialogProps) {
  const [owners, setOwners] = useState(currentOwners);
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newOwnerEmail, setNewOwnerEmail] = useState('');

  const handleAddOwner = () => {
    const name = newOwnerName.trim();
    const email = newOwnerEmail.trim();

    if (!name) return;

    const newOwner: SkillOwner = {
      name,
      email: email || undefined,
    };

    setOwners([...owners, newOwner]);
    setNewOwnerName('');
    setNewOwnerEmail('');
  };

  const handleRemoveOwner = (index: number) => {
    setOwners(owners.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    await onSave(owners);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold">Manage Owners</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Current Owners */}
          {owners.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Current Owners</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {owners.map((owner, index) => (
                  <div
                    key={`${owner.userId || owner.email || owner.name}-${index}`}
                    className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {owner.name}
                      </p>
                      {owner.email && (
                        <p className="text-xs text-gray-600">{owner.email}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveOwner(index)}
                      className="text-red-600 hover:text-red-700 transition-colors p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add New Owner */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold mb-3">Add Owner</h3>
            <div className="space-y-3">
              <input
                type="text"
                value={newOwnerName}
                onChange={(e) => setNewOwnerName(e.target.value)}
                placeholder="Owner name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="email"
                value={newOwnerEmail}
                onChange={(e) => setNewOwnerEmail(e.target.value)}
                placeholder="Email (optional)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAddOwner}
                disabled={!newOwnerName.trim()}
                className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Add Owner
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
