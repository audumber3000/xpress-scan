import Link from 'next/link';

export function TOC({ headings }: { headings: { id: string; text: string; level: number }[] }) {
  if (headings.length === 0) return null;

  return (
    <nav className="mb-12 p-6 bg-gray-50 rounded-3xl border border-gray-100">
      <h4 className="text-lg font-black text-gray-900 mb-4 tracking-tight uppercase text-sm">Table of Contents</h4>
      <ul className="space-y-2">
        {headings.map((heading) => (
          <li 
            key={heading.id} 
            style={{ paddingLeft: `${(heading.level - 2) * 1}rem` }}
          >
            <Link 
              href={`#${heading.id}`}
              className="text-gray-600 hover:text-blue-600 font-bold transition-colors text-sm"
            >
              {heading.text}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
