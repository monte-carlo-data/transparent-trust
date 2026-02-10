'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Edit, Save, X, Plus } from 'lucide-react';
import type { CustomerProfileAttributes } from '@/types/v2';

interface Contact {
  name: string;
  role: string;
  email?: string;
}

interface Customer {
  id: string;
  title: string;
  status: string;
  summary: string | null;
}

interface ProfileTabProps {
  customer: Customer;
  attributes: CustomerProfileAttributes;
}

export function ProfileTab({ customer, attributes }: ProfileTabProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    company: attributes?.company || customer.title || '',
    industry: attributes?.industry || '',
    tier: attributes?.tier || undefined as 'enterprise' | 'mid-market' | 'smb' | undefined,
    healthScore: attributes?.healthScore,
    crmId: attributes?.crmId || '',
    products: attributes?.products || [],
    contacts: attributes?.contacts || [],
    summary: customer.summary || '',
  });

  const [newProduct, setNewProduct] = useState('');
  const [newContact, setNewContact] = useState<Contact>({ name: '', role: '', email: '' });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.currentTarget;
    if (type === 'number') {
      setFormData({
        ...formData,
        [name]: value ? parseInt(value, 10) : undefined,
      });
    } else {
      setFormData({
        ...formData,
        [name]: value || undefined,
      });
    }
  };

  const addProduct = () => {
    if (newProduct.trim() && !formData.products.includes(newProduct.trim())) {
      setFormData({
        ...formData,
        products: [...formData.products, newProduct.trim()],
      });
      setNewProduct('');
    }
  };

  const removeProduct = (product: string) => {
    setFormData({
      ...formData,
      products: formData.products.filter((p) => p !== product),
    });
  };

  const addContact = () => {
    if (newContact.name.trim() && newContact.role.trim()) {
      setFormData({
        ...formData,
        contacts: [...formData.contacts, { ...newContact }],
      });
      setNewContact({ name: '', role: '', email: '' });
    }
  };

  const removeContact = (index: number) => {
    setFormData({
      ...formData,
      contacts: formData.contacts.filter((_, i) => i !== index),
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/v2/customers/${customer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: formData.company,
          industry: formData.industry || undefined,
          tier: formData.tier,
          healthScore: formData.healthScore,
          crmId: formData.crmId || undefined,
          products: formData.products,
          contacts: formData.contacts,
          summary: formData.summary || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update customer');
      }

      setIsEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset form to original values
    setFormData({
      company: attributes?.company || customer.title || '',
      industry: attributes?.industry || '',
      tier: attributes?.tier || undefined,
      healthScore: attributes?.healthScore,
      crmId: attributes?.crmId || '',
      products: attributes?.products || [],
      contacts: attributes?.contacts || [],
      summary: customer.summary || '',
    });
    setError(null);
    setIsEditing(false);
  };

  // View mode
  if (!isEditing) {
    const healthScore = attributes?.healthScore;
    const contacts = attributes?.contacts || [];
    const products = attributes?.products || [];
    const industry = attributes?.industry;
    const summary = customer.summary;

    return (
      <div>
        {/* Edit Button */}
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Edit className="w-4 h-4" />
            Edit Profile
          </button>
        </div>

        {/* Summary */}
        {summary && (
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">Summary</h3>
            <p className="text-gray-600 text-sm">{summary}</p>
          </div>
        )}

        {/* Health Score & Industry Row */}
        <div className="flex gap-4 mb-6">
          {healthScore !== undefined && (
            <div className="bg-white rounded-lg border border-gray-200 p-4 inline-flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700">Health Score</span>
              <div
                className={`text-2xl font-bold ${
                  healthScore >= 70
                    ? 'text-green-600'
                    : healthScore >= 40
                      ? 'text-yellow-600'
                      : 'text-red-600'
                }`}
              >
                {healthScore}
              </div>
            </div>
          )}
          {industry && (
            <div className="bg-white rounded-lg border border-gray-200 p-4 inline-flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700">Industry</span>
              <span className="text-gray-900">{industry}</span>
            </div>
          )}
        </div>

        {/* Company Details Grid */}
        {(contacts.length > 0 || products.length > 0) && (
          <div className="grid grid-cols-2 gap-6">
            {contacts.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Key Contacts</h3>
                <div className="space-y-2">
                  {contacts.map((contact, index) => (
                    <div key={index} className="text-sm">
                      <p className="font-medium text-gray-900">{contact.name}</p>
                      <p className="text-gray-600">{contact.role}</p>
                      {contact.email && <p className="text-gray-500 text-xs">{contact.email}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {products.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Products</h3>
                <div className="flex flex-wrap gap-2">
                  {products.map((product) => (
                    <span
                      key={product}
                      className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-sm font-medium"
                    >
                      {product}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!summary && healthScore === undefined && contacts.length === 0 && products.length === 0 && !industry && (
          <div className="text-center py-12 text-gray-500">
            <p>No profile information yet.</p>
            <button
              onClick={() => setIsEditing(true)}
              className="mt-2 text-amber-600 hover:text-amber-700 font-medium"
            >
              Add profile details
            </button>
          </div>
        )}
      </div>
    );
  }

  // Edit mode
  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">Edit Profile</h2>
        <div className="flex gap-2">
          <button
            onClick={handleCancel}
            disabled={saving}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Company Information */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        <h3 className="font-semibold text-gray-900">Company Information</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
            <input
              type="text"
              name="company"
              value={formData.company}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
            <input
              type="text"
              name="industry"
              value={formData.industry}
              onChange={handleInputChange}
              placeholder="e.g., Financial Services"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tier</label>
            <select
              name="tier"
              value={formData.tier || ''}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
            >
              <option value="">Select tier...</option>
              <option value="enterprise">Enterprise</option>
              <option value="mid-market">Mid-Market</option>
              <option value="smb">SMB</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Health Score</label>
            <input
              type="number"
              name="healthScore"
              min="0"
              max="100"
              value={formData.healthScore ?? ''}
              onChange={handleInputChange}
              placeholder="0-100"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Salesforce ID</label>
            <input
              type="text"
              name="crmId"
              value={formData.crmId}
              onChange={handleInputChange}
              placeholder="00101000001S25S"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Summary</label>
          <textarea
            name="summary"
            value={formData.summary}
            onChange={handleInputChange}
            rows={3}
            placeholder="Brief description of this customer..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
          />
        </div>
      </div>

      {/* Products */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <h3 className="font-semibold text-gray-900">Products</h3>

        <div className="flex gap-2">
          <input
            type="text"
            value={newProduct}
            onChange={(e) => setNewProduct(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addProduct())}
            placeholder="Add a product..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
          />
          <button
            type="button"
            onClick={addProduct}
            className="px-3 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {formData.products.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {formData.products.map((product) => (
              <div
                key={product}
                className="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm"
              >
                {product}
                <button
                  type="button"
                  onClick={() => removeProduct(product)}
                  className="hover:text-amber-900"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Contacts */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <h3 className="font-semibold text-gray-900">Key Contacts</h3>

        <div className="grid grid-cols-4 gap-2">
          <input
            type="text"
            value={newContact.name}
            onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
            placeholder="Name"
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
          />
          <input
            type="text"
            value={newContact.role}
            onChange={(e) => setNewContact({ ...newContact, role: e.target.value })}
            placeholder="Role"
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
          />
          <input
            type="email"
            value={newContact.email || ''}
            onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
            placeholder="Email"
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
          />
          <button
            type="button"
            onClick={addContact}
            className="px-3 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {formData.contacts.length > 0 && (
          <div className="space-y-2">
            {formData.contacts.map((contact, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="text-sm">
                  <p className="font-medium text-gray-900">{contact.name}</p>
                  <p className="text-gray-600">
                    {contact.role}
                    {contact.email && ` • ${contact.email}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeContact(index)}
                  className="text-gray-400 hover:text-red-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
