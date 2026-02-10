/**
 * V2 Skills Review Inbox
 *
 * Shows draft skills pending review/approval.
 */

import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { ArrowLeft, BookOpen, AlertTriangle, CheckCircle } from 'lucide-react';

function calculateHoursSinceCreated(createdAt: Date): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60));
}

export default async function SkillsReviewPage() {

  // Get all draft skills
  const pendingSkills = await prisma.buildingBlock.findMany({
    where: {
            libraryId: 'knowledge',
      status: 'DRAFT',
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      slug: true,
      summary: true,
      attributes: true,
      content: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return (
    <div className="p-8">
      {/* Back link */}
      <Link
        href="/v2/knowledge"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Skills
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-blue-500 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Review Inbox</h1>
          <p className="text-sm text-gray-600 mt-1">
            {pendingSkills.length} skill{pendingSkills.length !== 1 ? 's' : ''} awaiting approval
          </p>
        </div>
      </div>

      {/* Skills to Review */}
      {pendingSkills.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border-l-4 border-l-blue-500 border-t border-r border-b border-gray-200 shadow-sm">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">All caught up!</h3>
          <p className="text-gray-600">No skills pending review. Great work!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingSkills.map((skill) => {
            return (
              <div
                key={skill.id}
                className="bg-white rounded-lg border-l-4 border-l-blue-500 border-t border-r border-b border-gray-200 p-6 hover:shadow-md hover:-translate-y-1 transition-all duration-200"
              >
                {/* Header Row */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 bg-blue-500 rounded-lg">
                        <BookOpen className="w-4 h-4 text-white" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">{skill.title}</h3>
                      <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded font-medium">
                        Pending Review
                      </span>
                    </div>
                    {skill.summary && <p className="text-gray-600 mb-3">{skill.summary}</p>}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(skill.createdAt).toLocaleDateString()}
                  </div>
                </div>


                {/* Content Preview */}
                <div className="mb-4">
                  <span className="text-xs text-gray-500 block mb-2">Content Preview</span>
                  <div className="bg-gray-50 rounded-lg p-3 max-h-32 overflow-hidden">
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap line-clamp-4">
                      {skill.content}
                    </pre>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Link
                    href={`/v2/knowledge/${skill.slug || skill.id}`}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                  >
                    View Full
                  </Link>
                  <Link
                    href={`/v2/knowledge/${skill.slug || skill.id}`}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    Edit & Approve
                  </Link>
                  <p className="text-xs text-gray-500 ml-auto">
                    Created {calculateHoursSinceCreated(skill.createdAt)} hours ago
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review Guidelines */}
      <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-3">Review Guidelines</h3>
        <ul className="text-sm text-blue-800 space-y-2">
          <li>
            <strong>Content Quality:</strong> Is the skill content accurate, well-organized, and easy to understand?
          </li>
          <li>
            <strong>Completeness:</strong> Are all required fields filled (title, summary, content)?
          </li>
          <li>
            <strong>Sources:</strong> Are source URLs provided and valid?
          </li>
          <li>
            <strong>No Duplicates:</strong> Does this skill duplicate existing skills in the library?
          </li>
        </ul>
      </div>
    </div>
  );
}
