import React from 'react';
import { Eye, Download, Star, Pencil, Send } from 'lucide-react';
import Pagination from '../../components/Pagination';
import EmptyState from '../../components/common/EmptyState';
import { medicalCare, noData } from '../../assets/illustrations';
import {
  PaperworkTable, Thead, Th, Tbody, Tr, Td, NameCell, FullRow, StatusPill, RowButton, IconButton,
} from './PaperworkTable';
import { previewText, languageLabel, categoryLabel } from '../../components/consents/consentContent';

/**
 * The clinic's consent forms. Starred forms sort to the top; the star is a
 * single click in the row, the same place you would look for it.
 */
const ConsentTemplatesTable = ({
  templates,           // already filtered and sorted
  totalCount,          // before filtering, to tell "none yet" from "none match"
  page,
  pageSize,
  onPageChange,
  onToggleFavorite,
  onSend,
  onEdit,
  favoriteBusy,
}) => {
  const rows = templates.slice((page - 1) * pageSize, page * pageSize);

  return (
    <PaperworkTable
      className="flex-1"
      footer={
        <Pagination page={page} pageSize={pageSize} totalItems={templates.length} onPageChange={onPageChange} />
      }
    >
      <Thead>
        <Th className="w-12"><span className="sr-only">Favourite</span></Th>
        <Th>Form</Th>
        <Th>Language</Th>
        {/* Wide screens only: beside the links sidebar they pushed the
            actions off the edge. */}
        <Th className="hidden 2xl:table-cell">Preview</Th>
        <Th className="hidden 2xl:table-cell">Used</Th>
        <Th>Status</Th>
        <Th align="right">Actions</Th>
      </Thead>
      <Tbody>
        {totalCount === 0 ? (
          <FullRow cols={7}>
            <EmptyState
              image={medicalCare}
              title="No consent forms yet"
              subtitle="Write your own, or add ready ones from the library in any of seven languages. Then you can send any of them to a patient in two taps."
            />
          </FullRow>
        ) : rows.length === 0 ? (
          <FullRow cols={7}>
            <EmptyState image={noData} title="No forms match" subtitle="Try another search, or clear the filters." />
          </FullRow>
        ) : rows.map((t) => (
          <Tr key={t.id}>
            <Td className="w-12 !pr-0">
              <button
                type="button"
                onClick={() => onToggleFavorite(t)}
                disabled={favoriteBusy === t.id}
                aria-pressed={!!t.is_favorite}
                aria-label={t.is_favorite ? `Unstar ${t.name}` : `Star ${t.name}`}
                title={t.is_favorite ? 'Starred: shows first here and on the patient file' : 'Star to keep it at the top'}
                className="p-1 rounded-md hover:bg-amber-50 disabled:opacity-50"
              >
                <Star
                  size={17}
                  className={t.is_favorite ? 'text-amber-500 fill-amber-400' : 'text-gray-300 hover:text-amber-400'}
                />
              </button>
            </Td>
            <NameCell title={t.name} sub={categoryLabel(t.category)} />
            <Td>
              <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-[#2a276e]/5 text-[#2a276e] whitespace-nowrap">
                {languageLabel(t.language)}
              </span>
            </Td>
            <Td className="hidden 2xl:table-cell">
              <p className="text-sm text-gray-500 line-clamp-2 max-w-sm">{previewText(t.content)}</p>
            </Td>
            <Td className="hidden 2xl:table-cell whitespace-nowrap tabular-nums">{t.usage_count ? `${t.usage_count}×` : '—'}</Td>
            <Td className="whitespace-nowrap"><StatusPill active={t.is_active} /></Td>
            <Td align="right" className="whitespace-nowrap">
              <div className="flex items-center justify-end gap-1.5">
                <IconButton label="Preview on a printable page" onClick={() => window.open(`/consent/preview/${t.id}`, '_blank')}>
                  <Eye size={16} />
                </IconButton>
                <IconButton label="Download or print (blank form)" onClick={() => window.open(`/consent/preview/${t.id}?print=1`, '_blank')}>
                  <Download size={16} />
                </IconButton>
                <RowButton tone="brand" onClick={() => onSend(t)}><Send size={12} /> Send link</RowButton>
                <RowButton onClick={() => onEdit(t)}><Pencil size={12} /> Edit</RowButton>
              </div>
            </Td>
          </Tr>
        ))}
      </Tbody>
    </PaperworkTable>
  );
};

export default ConsentTemplatesTable;
