'use client';

/**
 * UserPicker Component
 *
 * Searchable dropdown for selecting users to add to a team.
 */

import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import { Search, X, User, Check } from 'lucide-react';

interface UserOption {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

interface UserPickerProps {
  excludeTeamId?: string;
  onSelect: (user: UserOption) => void;
  onCancel: () => void;
  placeholder?: string;
}

export function UserPicker({
  excludeTeamId,
  onSelect,
  onCancel,
  placeholder = 'Search users by name or email...',
}: UserPickerProps) {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Search users when query changes
  useEffect(() => {
    const fetchUsers = async () => {
      if (search.length < 2) {
        setUsers([]);
        return;
      }

      setLoading(true);
      try {
        const params = new URLSearchParams({
          search,
          limit: '10',
        });
        if (excludeTeamId) {
          params.set('excludeTeamId', excludeTeamId);
        }

        const response = await fetch(`/api/v2/users?${params}`);
        if (response.ok) {
          const data = await response.json();
          setUsers(data.users);
        }
      } catch (error) {
        console.error('Failed to search users:', error);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchUsers, 300);
    return () => clearTimeout(debounce);
  }, [search, excludeTeamId]);

  const handleSelect = (user: UserOption) => {
    setSelectedUser(user);
    setSearch(user.name || user.email || '');
    setUsers([]);
  };

  const handleConfirm = () => {
    if (selectedUser) {
      onSelect(selectedUser);
    }
  };

  const handleClear = () => {
    setSearch('');
    setSelectedUser(null);
    setUsers([]);
    inputRef.current?.focus();
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900">Add Team Member</h3>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setSelectedUser(null);
          }}
          placeholder={placeholder}
          className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        {search && (
          <button
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
          >
            <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>

      {/* Results */}
      {loading && (
        <div className="mt-2 py-3 text-center text-sm text-gray-500">
          Searching...
        </div>
      )}

      {!loading && users.length > 0 && (
        <div className="mt-2 max-h-48 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100">
          {users.map((user) => (
            <button
              key={user.id}
              onClick={() => handleSelect(user)}
              className={`w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors ${
                selectedUser?.id === user.id ? 'bg-blue-50' : ''
              }`}
            >
              <div className="flex-shrink-0">
                {user.image ? (
                  <Image
                    src={user.image}
                    alt=""
                    width={32}
                    height={32}
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <User className="w-4 h-4 text-gray-500" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user.name || 'No name'}
                </p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
              {selectedUser?.id === user.id && (
                <Check className="w-4 h-4 text-blue-600" />
              )}
            </button>
          ))}
        </div>
      )}

      {!loading && search.length >= 2 && users.length === 0 && (
        <div className="mt-2 py-3 text-center text-sm text-gray-500">
          No users found
        </div>
      )}

      {search.length > 0 && search.length < 2 && (
        <div className="mt-2 py-3 text-center text-sm text-gray-500">
          Type at least 2 characters to search
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={!selectedUser}
          className="px-3 py-1.5 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add Member
        </button>
      </div>
    </div>
  );
}
