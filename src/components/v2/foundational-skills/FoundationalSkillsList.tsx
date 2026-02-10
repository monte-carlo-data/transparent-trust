'use client';

/**
 * FoundationalSkillsList
 *
 * Displays all foundational skills with ability to clone them to customers.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ApplyFoundationalModal } from './ApplyFoundationalModal';

interface FoundationalSkill {
  id: string;
  title: string;
  slug: string;
  libraryId: string;
  scopeDefinition: {
    covers: string;
    futureAdditions: string[];
    notIncluded?: string[];
  };
  createdAt: string;
}

export function FoundationalSkillsList() {
  const [skills, setSkills] = useState<FoundationalSkill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<FoundationalSkill | null>(null);
  const [showApplyModal, setShowApplyModal] = useState(false);

  useEffect(() => {
    loadFoundationalSkills();
  }, []);

  async function loadFoundationalSkills() {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/v2/foundational-skills');
      if (!response.ok) {
        throw new Error('Failed to load foundational skills');
      }

      const result = await response.json();
      setSkills(result.data || []);
    } catch (err) {
      console.error('Error loading foundational skills:', err);
      setError(err instanceof Error ? err.message : 'Failed to load skills');
    } finally {
      setIsLoading(false);
    }
  }

  function handleApplyClick(skill: FoundationalSkill) {
    setSelectedSkill(skill);
    setShowApplyModal(true);
  }

  function handleApplySuccess() {
    setShowApplyModal(false);
    setSelectedSkill(null);
    // Optionally reload skills or show success message
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading foundational skills...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (skills.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Foundational Skills</h3>
        <p className="text-gray-600 mb-4">
          Create foundational skills that can be applied to multiple customers.
        </p>
        <p className="text-sm text-gray-500">
          Foundational skills define a title and scope that can be cloned to customers.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {skills.map((skill) => (
          <div
            key={skill.id}
            className="border rounded-lg p-4 hover:border-blue-500 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <Link
                  href={`/v2/customers/foundational/${skill.slug || skill.id}`}
                  className="block"
                >
                  <h3 className="text-lg font-medium text-gray-900 mb-1 hover:text-blue-600 transition-colors">
                    {skill.title}
                  </h3>
                </Link>
                <p className="text-sm text-gray-600 mb-3">
                  {skill.scopeDefinition.covers}
                </p>

                {skill.scopeDefinition.futureAdditions.length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-xs font-medium text-gray-700 mb-1">Future Additions:</h4>
                    <ul className="text-xs text-gray-600 list-disc list-inside">
                      {skill.scopeDefinition.futureAdditions.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {skill.scopeDefinition.notIncluded && skill.scopeDefinition.notIncluded.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-700 mb-1">Not Included:</h4>
                    <ul className="text-xs text-gray-600 list-disc list-inside">
                      {skill.scopeDefinition.notIncluded.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <button
                onClick={() => handleApplyClick(skill)}
                className="ml-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Apply to Customers
              </button>
            </div>

            <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-gray-500">
              <span>Library: {skill.libraryId}</span>
              <span>Created: {new Date(skill.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>

      {selectedSkill && (
        <ApplyFoundationalModal
          isOpen={showApplyModal}
          skillId={selectedSkill.id}
          skillTitle={selectedSkill.title}
          onClose={() => {
            setShowApplyModal(false);
            setSelectedSkill(null);
          }}
          onSuccess={handleApplySuccess}
        />
      )}
    </>
  );
}
