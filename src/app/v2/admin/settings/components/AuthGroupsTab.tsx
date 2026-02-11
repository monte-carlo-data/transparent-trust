"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Check, AlertCircle, Shield } from "lucide-react";
import { useConfirm } from "@/components/ConfirmModal";
import { InlineLoader } from "@/components/ui/loading";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";
import { useQueryClient } from "@tanstack/react-query";

type Capability = "ASK_QUESTIONS" | "CREATE_PROJECTS" | "REVIEW_ANSWERS" | "MANAGE_KNOWLEDGE" | "MANAGE_PROMPTS" | "VIEW_ORG_DATA" | "MANAGE_USERS" | "ADMIN";

interface AuthGroupMapping {
  id: string;
  provider: string;
  groupId: string;
  groupName: string | null;
  capabilities: Capability[];
  isActive: boolean;
}

const ALL_CAPABILITIES: { value: Capability; label: string; description: string }[] = [
  { value: "ASK_QUESTIONS", label: "Ask Questions", description: "Quick questions, chat, view own history" },
  { value: "CREATE_PROJECTS", label: "Create Projects", description: "Create/manage bulk projects, upload documents" },
  { value: "REVIEW_ANSWERS", label: "Review Answers", description: "Verify, correct, flag/resolve answers" },
  { value: "MANAGE_KNOWLEDGE", label: "Manage Knowledge", description: "Create/edit skills, documents, URLs" },
  { value: "MANAGE_PROMPTS", label: "Manage Prompts", description: "Edit system prompts (prompt builder)" },
  { value: "VIEW_ORG_DATA", label: "View Org Data", description: "See org-wide question log, accuracy metrics" },
  { value: "MANAGE_USERS", label: "Manage Users", description: "Assign capabilities, manage group mappings" },
  { value: "ADMIN", label: "Admin", description: "Full access, system settings, delete anything" },
];

export default function AuthGroupsTab() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm({
    title: "Delete Group Mapping",
    message: "Are you sure you want to delete this group mapping?",
    confirmLabel: "Delete",
    variant: "danger",
  });

  // Form state
  const [formProvider, setFormProvider] = useState("okta");
  const [formGroupId, setFormGroupId] = useState("");
  const [formGroupName, setFormGroupName] = useState("");
  const [formCapabilities, setFormCapabilities] = useState<Capability[]>([]);

  // Fetch mappings
  const {
    data: mappings = [],
    isLoading: loading,
  } = useApiQuery<AuthGroupMapping[]>({
    queryKey: ["auth-groups"],
    url: "/api/auth-groups",
    responseKey: "mappings",
    transform: (data) => (Array.isArray(data) ? data : []),
  });

  // Seed defaults mutation
  const seedMutation = useApiMutation<{ message: string }, void>({
    url: "/api/auth-groups/seed",
    method: "POST",
    invalidateKeys: [["auth-groups"]],
    onSuccess: (data) => {
      toast.success(data?.message || "Default groups seeded");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to seed defaults");
    },
  });

  // Delete mutation
  const deleteMutation = useApiMutation<void, string>({
    url: (id) => `/api/auth-groups?id=${id}`,
    method: "DELETE",
    invalidateKeys: [["auth-groups"]],
    onSuccess: () => {
      toast.success("Group deleted");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to delete");
    },
  });

  const saving = seedMutation.isPending || isSaving || deleteMutation.isPending;

  const handleSeedDefaults = () => {
    seedMutation.mutate();
  };

  const resetForm = () => {
    setFormProvider("okta");
    setFormGroupId("");
    setFormGroupName("");
    setFormCapabilities([]);
    setEditingId(null);
    setShowAddForm(false);
  };

  const handleEdit = (mapping: AuthGroupMapping) => {
    setFormProvider(mapping.provider);
    setFormGroupId(mapping.groupId);
    setFormGroupName(mapping.groupName || "");
    setFormCapabilities(mapping.capabilities);
    setEditingId(mapping.id);
    setShowAddForm(true);
  };

  const handleSave = async () => {
    if (!formGroupId.trim()) {
      toast.error("Group ID is required");
      return;
    }
    if (formCapabilities.length === 0) {
      toast.error("At least one capability is required");
      return;
    }

    setIsSaving(true);
    try {
      const body = {
        id: editingId,
        provider: formProvider,
        groupId: formGroupId.trim(),
        groupName: formGroupName.trim() || null,
        capabilities: formCapabilities,
      };

      const res = await fetch("/api/auth-groups", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error?.message || "Failed to save");
      }

      toast.success(editingId ? "Group updated" : "Group created");
      resetForm();
      await queryClient.invalidateQueries({ queryKey: ["auth-groups"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm();
    if (!confirmed) return;
    deleteMutation.mutate(id);
  };

  const toggleCapability = (cap: Capability) => {
    setFormCapabilities((prev) =>
      prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <InlineLoader size="md" className="mr-2" />
        <span className="text-gray-500">Loading auth groups...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">SSO Group Mappings</h2>
          <p className="text-sm text-gray-500 mt-1">
            Map SSO groups (from Okta, Azure AD, etc.) to capabilities. Users inherit capabilities from their SSO groups on login.
          </p>
        </div>
        <div className="flex gap-2">
          {mappings.length === 0 && (
            <button
              onClick={handleSeedDefaults}
              disabled={saving}
              className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Seed Defaults
            </button>
          )}
          <button
            onClick={() => setShowAddForm(true)}
            disabled={showAddForm}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Add Group
          </button>
        </div>
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-2">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">How it works</p>
            <ul className="mt-1 space-y-1 text-blue-700">
              <li>When users log in via SSO, their group memberships are read from the identity provider.</li>
              <li>Capabilities from all matching groups are combined.</li>
              <li>Users with no matching groups get the default capability: ASK_QUESTIONS.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900">
              {editingId ? "Edit Group Mapping" : "Add Group Mapping"}
            </h3>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
              <select
                value={formProvider}
                onChange={(e) => setFormProvider(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="okta">Okta</option>
                <option value="azure">Azure AD</option>
                <option value="google">Google</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Group ID *</label>
              <input
                type="text"
                value={formGroupId}
                onChange={(e) => setFormGroupId(e.target.value)}
                placeholder="e.g., tt-admins"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
              <input
                type="text"
                value={formGroupName}
                onChange={(e) => setFormGroupName(e.target.value)}
                placeholder="e.g., Administrators"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Capabilities *</label>
            <div className="grid grid-cols-2 gap-2">
              {ALL_CAPABILITIES.map((cap) => (
                <label
                  key={cap.value}
                  className={`flex items-start gap-2 p-2 rounded border cursor-pointer transition-colors ${
                    formCapabilities.includes(cap.value)
                      ? "bg-blue-50 border-blue-300"
                      : "bg-white border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formCapabilities.includes(cap.value)}
                    onChange={() => toggleCapability(cap.value)}
                    className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900">{cap.label}</div>
                    <div className="text-xs text-gray-500">{cap.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={resetForm}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
            >
              {saving ? <InlineLoader size="sm" /> : <Check className="w-4 h-4" />}
              {editingId ? "Update" : "Create"}
            </button>
          </div>
        </div>
      )}

      {/* Mappings Table */}
      {mappings.length === 0 && !showAddForm ? (
        <div className="text-center py-12 text-gray-500">
          <Shield className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No group mappings configured</p>
          <p className="text-sm mt-1">Click &quot;Seed Defaults&quot; to add standard tt-* groups, or add your own.</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Provider</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Group ID</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Display Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Capabilities</th>
                <th className="text-right px-4 py-3 font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {mappings.map((mapping) => (
                <tr key={mapping.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700 capitalize">
                      {mapping.provider}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-900">{mapping.groupId}</td>
                  <td className="px-4 py-3 text-gray-600">{mapping.groupName || "-"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {mapping.capabilities.map((cap) => (
                        <span
                          key={cap}
                          className={`px-1.5 py-0.5 text-xs rounded ${
                            cap === "ADMIN"
                              ? "bg-red-100 text-red-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {cap.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleEdit(mapping)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(mapping.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog />
    </div>
  );
}
