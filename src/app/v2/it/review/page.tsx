/**
 * V2 IT Skills Review Inbox
 *
 * Shows pending IT skills awaiting review/approval.
 */

import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, Wrench, CheckCircle } from 'lucide-react';
import type { ITSkillAttributes } from '@/types/v2';

export default async function ITSkillsReviewPage() {

  const pendingSkills = await prisma.buildingBlock.findMany({
    where: {
      libraryId: 'it',
      status: 'DRAFT',
          },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      slug: true,
      summary: true,
      content: true,
      attributes: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return (
    <div className="p-8">
      {/* Back link */}
      <Link
        href="/v2/it"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to IT Skills
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">IT Skills Review Inbox</h1>
        <p className="mt-1 text-sm text-gray-500">
          {pendingSkills.length} skill{pendingSkills.length !== 1 ? 's' : ''} awaiting review
        </p>
      </div>

      {pendingSkills.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">All caught up!</h3>
          <p className="text-gray-500">No IT skills pending review right now.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingSkills.map((skill) => {
            const attrs = skill.attributes as ITSkillAttributes;
            const application = attrs?.application;
            const department = attrs?.department;
            const errorCodes = attrs?.errorCodes || [];

            return (
              <div
                key={skill.id}
                className="bg-white rounded-lg border border-yellow-200 bg-yellow-50 p-6 hover:border-yellow-300 transition-colors"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="p-2 bg-orange-500 rounded-lg shrink-0">
                      <Wrench className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-lg">{skill.title}</h3>
                      {skill.summary && (
                        <p className="text-sm text-gray-600 mt-1">{skill.summary}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-yellow-100 text-yellow-700">
                      <AlertTriangle className="w-3 h-3" />
                      Pending Review
                    </span>
                  </div>
                </div>

                {/* Metadata */}
                <div className="flex items-center gap-4 mb-4 text-sm flex-wrap">
                  {department && (
                    <div className="bg-purple-100 text-purple-700 px-2 py-1 rounded">
                      <span className="font-medium">Department:</span> {department}
                    </div>
                  )}
                  {application && (
                    <div className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                      <span className="font-medium">Application:</span> {application}
                    </div>
                  )}
                  {errorCodes.length > 0 && (
                    <div className="bg-red-100 text-red-700 px-2 py-1 rounded">
                      <span className="font-medium">{errorCodes.length}</span> error{' '}
                      {errorCodes.length !== 1 ? 'codes' : 'code'}
                    </div>
                  )}
                </div>

                {/* Content Preview */}
                {skill.content && (
                  <div className="mb-4 p-3 bg-gray-100 rounded-lg">
                    <p className="text-xs font-medium text-gray-600 mb-2">Content Preview</p>
                    <pre className="text-xs text-gray-700 overflow-auto max-h-32 whitespace-pre-wrap">
                      {skill.content.substring(0, 300)}
                      {skill.content.length > 300 ? '...' : ''}
                    </pre>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Link
                    href={`/v2/it/${skill.slug || skill.id}`}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
                  >
                    Review
                  </Link>
                  <Link
                    href={`/v2/it/${skill.slug || skill.id}`}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                  >
                    Edit & Approve
                  </Link>
                  <span className="text-xs text-gray-500 ml-auto">
                    Created {new Date(skill.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Guidelines */}
      <div className="mt-8 bg-blue-50 rounded-lg border border-blue-200 p-6">
        <h3 className="font-semibold text-blue-900 mb-3">Review Guidelines</h3>
        <ul className="text-sm text-blue-800 space-y-2">
          <li>
            <strong>Completeness:</strong> Ensure title, summary, and content are filled out
          </li>
          <li>
            <strong>Accuracy:</strong> Verify error codes and resolution steps are correct
          </li>
          <li>
            <strong>Clarity:</strong> Check that resolution steps are clear and actionable
          </li>
          <li>
            <strong>Metadata:</strong> Confirm department and application are relevant
          </li>
        </ul>
      </div>
    </div>
  );
}
