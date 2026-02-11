/**
 * IT Library Metadata Bar
 *
 * Displays Department and Application metadata.
 */

interface ITMetadataBarProps {
  department?: string;
  application?: string;
}

export function ITMetadataBar({
  department,
  application,
}: ITMetadataBarProps) {
  return (
    <>
      {/* Department */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <span className="text-sm font-medium text-gray-700">Department</span>
        <div className="text-2xl font-bold text-gray-900 truncate">{department || 'N/A'}</div>
        <p className="text-xs text-gray-500 mt-1">Responsible team</p>
      </div>

      {/* Application */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <span className="text-sm font-medium text-gray-700">Application</span>
        <div className="text-2xl font-bold text-gray-900 truncate">{application || 'N/A'}</div>
        <p className="text-xs text-gray-500 mt-1">System/software</p>
      </div>
    </>
  );
}
