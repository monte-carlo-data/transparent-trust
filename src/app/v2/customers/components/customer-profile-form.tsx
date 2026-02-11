'use client';

/**
 * Customer Profile Form Component
 *
 * Form for creating customer profiles with:
 * - Company information (name, industry, tier)
 * - Health/CRM data (health score, CRM ID)
 * - Contacts (name, role, email)
 * - Products they use
 * - Summary/notes
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, AlertCircle, Plus, X } from 'lucide-react';

interface Contact {
  name: string;
  role: string;
  email?: string;
}

interface FormData {
  title: string; // Company name
  summary?: string;
  industry?: string;
  tier?: 'enterprise' | 'mid-market' | 'smb';
  healthScore?: number;
  crmId?: string;
  products?: string[];
  contacts?: Contact[];
}

export function CustomerProfileForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newProduct, setNewProduct] = useState('');
  const [newContact, setNewContact] = useState<Contact>({ name: '', role: '', email: '' });

  const [formData, setFormData] = useState<FormData>({
    title: '',
    summary: '',
    industry: '',
    tier: undefined,
    healthScore: undefined,
    crmId: '',
    products: [],
    contacts: [],
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.currentTarget;

    if (type === 'number') {
      setFormData({
        ...formData,
        [name]: value ? parseInt(value, 10) : undefined,
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  const addProduct = () => {
    if (newProduct.trim() && !formData.products?.includes(newProduct.trim())) {
      setFormData({
        ...formData,
        products: [...(formData.products || []), newProduct.trim()],
      });
      setNewProduct('');
    }
  };

  const removeProduct = (product: string) => {
    setFormData({
      ...formData,
      products: formData.products?.filter((p) => p !== product) || [],
    });
  };

  const addContact = () => {
    if (newContact.name.trim() && newContact.role.trim()) {
      setFormData({
        ...formData,
        contacts: [...(formData.contacts || []), { ...newContact }],
      });
      setNewContact({ name: '', role: '', email: '' });
    }
  };

  const removeContact = (index: number) => {
    setFormData({
      ...formData,
      contacts: formData.contacts?.filter((_, i) => i !== index) || [],
    });
  };

  const handleContactChange = (field: keyof Contact, value: string) => {
    setNewContact({
      ...newContact,
      [field]: value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.title.trim()) {
        throw new Error('Company name is required');
      }

      // Build payload for Customer API (not BuildingBlock)
      const payload = {
        company: formData.title,
        industry: formData.industry || undefined,
        tier: formData.tier,
        healthScore: formData.healthScore,
        crmId: formData.crmId || undefined,
        products: formData.products || [],
        contacts: formData.contacts || [],
        summary: formData.summary || '',
        status: 'ACTIVE',
      };

      const response = await fetch('/api/v2/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create customer profile');
      }

      const savedBlock = await response.json();
      router.push(`/v2/customers/${savedBlock.slug || savedBlock.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create customer profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {/* Company Information Section */}
      <div className="space-y-4 pb-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Company Information</h2>

        {/* Company Name */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Company Name *
          </label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            placeholder="Acme Corporation"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            required
          />
        </div>

        {/* Industry */}
        <div>
          <label htmlFor="industry" className="block text-sm font-medium text-gray-700 mb-1">
            Industry
          </label>
          <input
            type="text"
            id="industry"
            name="industry"
            value={formData.industry || ''}
            onChange={handleInputChange}
            placeholder="e.g., Financial Services, Healthcare, Retail"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
        </div>

        {/* Tier */}
        <div>
          <label htmlFor="tier" className="block text-sm font-medium text-gray-700 mb-1">
            Tier / Company Size
          </label>
          <select
            id="tier"
            name="tier"
            value={formData.tier || ''}
            onChange={handleInputChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          >
            <option value="">Select tier...</option>
            <option value="enterprise">Enterprise (1000+ employees)</option>
            <option value="mid-market">Mid-Market (100-1000 employees)</option>
            <option value="smb">SMB (&lt;100 employees)</option>
          </select>
        </div>

      </div>

      {/* Health & CRM Section */}
      <div className="space-y-4 pb-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Health & CRM</h2>

        <div className="grid grid-cols-2 gap-4">
          {/* Health Score */}
          <div>
            <label htmlFor="healthScore" className="block text-sm font-medium text-gray-700 mb-1">
              Health Score (0-100)
            </label>
            <input
              type="number"
              id="healthScore"
              name="healthScore"
              min="0"
              max="100"
              value={formData.healthScore || ''}
              onChange={handleInputChange}
              placeholder="75"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
          </div>

          {/* CRM ID */}
          <div>
            <label htmlFor="crmId" className="block text-sm font-medium text-gray-700 mb-1">
              Salesforce ID
            </label>
            <input
              type="text"
              id="crmId"
              name="crmId"
              value={formData.crmId || ''}
              onChange={handleInputChange}
              placeholder="00101000001S25S"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Products Section */}
      <div className="space-y-4 pb-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Products & Features</h2>
        <p className="text-sm text-gray-600">What products/features does this customer use?</p>

        <div className="flex gap-2">
          <input
            type="text"
            value={newProduct}
            onChange={(e) => setNewProduct(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addProduct())}
            placeholder="Add a product..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
          <button
            type="button"
            onClick={addProduct}
            className="px-4 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 font-medium"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {formData.products && formData.products.length > 0 && (
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

      {/* Contacts Section */}
      <div className="space-y-4 pb-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Contacts</h2>
        <p className="text-sm text-gray-600">Key contacts at this customer</p>

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              value={newContact.name}
              onChange={(e) => handleContactChange('name', e.target.value)}
              placeholder="Name"
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
            />
            <input
              type="text"
              value={newContact.role}
              onChange={(e) => handleContactChange('role', e.target.value)}
              placeholder="Role"
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
            />
            <div className="flex gap-2">
              <input
                type="email"
                value={newContact.email || ''}
                onChange={(e) => handleContactChange('email', e.target.value)}
                placeholder="Email"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
              />
              <button
                type="button"
                onClick={addContact}
                className="px-3 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {formData.contacts && formData.contacts.length > 0 && (
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

      {/* Summary / Notes */}
      <div>
        <label htmlFor="summary" className="block text-sm font-medium text-gray-700 mb-1">
          Summary / Notes
        </label>
        <textarea
          id="summary"
          name="summary"
          value={formData.summary || ''}
          onChange={handleInputChange}
          placeholder="Add any additional context or notes about this customer..."
          rows={4}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
        />
      </div>

      {/* Form Actions */}
      <div className="flex gap-3 pt-6 border-t border-gray-200">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Creating...' : 'Create Profile'}
        </button>
      </div>
    </form>
  );
}
