"use client";

interface StatusFilterFormProps {
  basePath: string;
  searchTerm?: string;
  currentStatus?: string;
}

export function StatusFilterForm({
  basePath,
  searchTerm,
  currentStatus,
}: StatusFilterFormProps) {
  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const form = e.target.form;
    if (form) {
      form.submit();
    }
  };

  return (
    <form action={basePath} method="GET">
      {searchTerm && <input type="hidden" name="search" value={searchTerm} />}
      <select
        name="status"
        defaultValue={currentStatus || ''}
        onChange={handleStatusChange}
        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All Status</option>
        <option value="ACTIVE">Active</option>
        <option value="DRAFT">Draft</option>
        <option value="ARCHIVED">Archived</option>
      </select>
    </form>
  );
}
