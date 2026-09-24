import React, { useState, useEffect, useMemo } from "react";
import { api, getPermissionAwareErrorMessage } from "../../utils/api";
import { useHeader } from "../../contexts/HeaderContext";
import { useAuth } from "../../contexts/AuthContext";
import { notify } from '../../utils/notify';
import Card from "../../components/Card";
import axios from "axios";
import { Layout, Share2, CheckCircle, Clock, XCircle, Printer, ExternalLink, Search, FileCheck, HeartPulse, Plus, Languages, Star } from 'lucide-react';
import ConsentRecentLinks from "../../components/consents/ConsentRecentLinks";
import Pagination from "../../components/Pagination";
import FilterDropdown from "../../components/FilterDropdown";
import SignedConsents from '../../components/consents/SignedConsents';
import MedicalFormTab from './MedicalFormTab';
import ConsentTemplatesTable from './ConsentTemplatesTable';
import ConsentLibraryDrawer from './ConsentLibraryDrawer';
import SendConsentDrawer from './SendConsentDrawer';
import { HeaderButton } from './PaperworkTable';
import ConsentEditor from '../../components/consents/editor/ConsentEditor';
import { CONSENT_LANGUAGES } from '../../components/consents/consentContent';
import { generatePatientPersona, generateInitialsAvatar } from "../../utils/avatar";
import EmptyState from "../../components/common/EmptyState";
import { noData } from "../../assets/illustrations";

const CONSENT_PAGE_SIZE = 10;

/**
 * Paperwork: everything the clinic sends a patient to read, sign and send back.
 *
 * Was "Consent Forms". The medical history lived in the Control Center, which
 * is where you go to configure something rather than where you go to send it,
 * so it sat unused beside the consent flow it duplicates. Both documents are
 * now tabs of one section and share the same letterhead.
 *
 * New work belongs in its own file under this folder, not in here — this file
 * is already long enough that adding to it is how it becomes unmaintainable.
 */
const Paperwork = () => {
    const { setTitle } = useHeader();
    const { user } = useAuth();
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('templates');
    const [showModal, setShowModal] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [showLibrary, setShowLibrary] = useState(false);
    const [favoriteBusy, setFavoriteBusy] = useState(null);
    // The medical tab portals its own header buttons into this slot, so both
    // tabs keep their actions in the same place without lifting its state.
    const [medicalActionsEl, setMedicalActionsEl] = useState(null);
    
    // The form being sent; the drawer owns everything else about sending.
    const [sendingTemplate, setSendingTemplate] = useState(null);
    const [linksRefreshKey, setLinksRefreshKey] = useState(0);

    // Sent Links tab — full history of consent links generated for this clinic
    const [sentLinks, setSentLinks] = useState([]);
    const [linksLoading, setLinksLoading] = useState(false);
    const [templatesPage, setTemplatesPage] = useState(1);
    const [linksPage, setLinksPage] = useState(1);

    // Search & filter states
    const [tableSearch, setTableSearch] = useState('');
    const [filterLinkStatus, setFilterLinkStatus] = useState('');
    const [filterTemplateStatus, setFilterTemplateStatus] = useState('');
    const [filterLanguage, setFilterLanguage] = useState('');
    const [favoritesOnly, setFavoritesOnly] = useState(false);

    const NEXUS_API_URL = import.meta.env.VITE_NEXUS_API_URL || `http://${window.location.hostname}:8001/api/v1`;

    useEffect(() => {
        setTitle("Paperwork");
        fetchTemplates();
        // Patients are loaded by the debounced effect below, which also fires
        // once on mount — calling it here too would double the request.
    }, []);

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const data = await api.get("/consents/templates");
            setTemplates(data);
        } catch (error) {
            notify.problem(getPermissionAwareErrorMessage(
                error,
                "Failed to fetch consent templates",
                "You don't have permission to view consent templates."
            ));
        } finally {
            setLoading(false);
        }
    };

    const fetchSentLinks = async () => {
        if (!user?.clinic_id) return;
        setLinksLoading(true);
        try {
            const res = await axios.get(`${NEXUS_API_URL}/consent/list/${user.clinic_id}`);
            setSentLinks(res.data || []);
        } catch (error) {
            console.error("Failed to fetch sent consent links:", error);
            setSentLinks([]);
        } finally {
            setLinksLoading(false);
        }
    };

    // Refresh sent-links list when the tab is opened or after a new link is generated.
    useEffect(() => {
        if (activeTab === 'links') fetchSentLinks();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, linksRefreshKey, user?.clinic_id]);

    const getLinkStatus = (link) => {
        if (link.used) return { label: 'Signed', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', icon: CheckCircle };
        if (link.timeLeft <= 0) return { label: 'Expired', color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200', icon: XCircle };
        return { label: 'Sent', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: Clock };
    };

    // Helper to get link status as a string for filtering
    const getLinkStatusLabel = (link) => {
        if (link.used) return 'Signed';
        if (link.timeLeft <= 0) return 'Expired';
        return 'Sent';
    };

    // Filtered data
    const filteredLinks = useMemo(() => {
        return sentLinks.filter(link => {
            const term = tableSearch.toLowerCase();
            if (term && !link.patientName?.toLowerCase().includes(term) && !link.templateName?.toLowerCase().includes(term)) return false;
            if (filterLinkStatus && getLinkStatusLabel(link) !== filterLinkStatus) return false;
            return true;
        });
    }, [sentLinks, tableSearch, filterLinkStatus]);

    const filteredTemplates = useMemo(() => {
        const langCode = CONSENT_LANGUAGES.find(l => l.native === filterLanguage)?.code;
        return templates.filter(t => {
            const term = tableSearch.toLowerCase();
            if (term && !t.name?.toLowerCase().includes(term) && !t.content?.toLowerCase().includes(term)) return false;
            if (filterTemplateStatus === 'Active' && !t.is_active) return false;
            if (filterTemplateStatus === 'Draft' && t.is_active) return false;
            if (langCode && (t.language || 'en') !== langCode) return false;
            if (favoritesOnly && !t.is_favorite) return false;
            return true;
        // Starred first; otherwise the order the server gave, which is creation order.
        }).sort((a, b) => Number(!!b.is_favorite) - Number(!!a.is_favorite));
    }, [templates, tableSearch, filterTemplateStatus, filterLanguage, favoritesOnly]);

    const toggleFavorite = async (template) => {
        const next = !template.is_favorite;
        setFavoriteBusy(template.id);
        setTemplates(prev => prev.map(t => (t.id === template.id ? { ...t, is_favorite: next } : t)));
        try {
            await api.patch(`/consents/templates/${template.id}/favorite`, { is_favorite: next });
        } catch (error) {
            setTemplates(prev => prev.map(t => (t.id === template.id ? { ...t, is_favorite: !next } : t)));
            notify.problem(getPermissionAwareErrorMessage(
                error,
                "Couldn't update the star",
                "You don't have permission to manage consent templates."
            ));
        } finally {
            setFavoriteBusy(null);
        }
    };

    const openSignedConsent = (token) => {
        window.open(`${window.location.origin}/consent/sign/${token}`, '_blank', 'noopener,noreferrer');
    };

    const printSignedConsent = (token) => {
        // Opens the signed consent in a new tab and triggers the browser's print
        // dialog, which lets the user "Save as PDF" via the native print sheet.
        const w = window.open(`${window.location.origin}/consent/sign/${token}?print=1`, '_blank');
        if (!w) {
            notify.problem("Pop-up blocked — please allow pop-ups to print the consent.");
        }
    };

    // Called by the full-screen editor. Throws so the editor stays open and
    // shows the reason inline.
    const saveTemplate = async (data) => {
        try {
            if (editingTemplate) {
                await api.put(`/consents/templates/${editingTemplate.id}`, data);
            } else {
                await api.post("/consents/templates", data);
            }
        } catch (error) {
            throw new Error(getPermissionAwareErrorMessage(
                error,
                "Couldn't save the form",
                "You don't have permission to manage consent templates."
            ));
        }
        setShowModal(false);
        setEditingTemplate(null);
        notify.done(editingTemplate ? 'Form saved' : 'Form created');
        fetchTemplates();
    };

    return (
        <div className="flex flex-col h-screen p-8 max-w-[1600px] mx-auto bg-gray-50/50 overflow-hidden">
            <>
                {/* Tabs row with action buttons on the right — page title is in the global header */}
                <div className="flex justify-between items-end border-b border-gray-200 mb-6">
                    <div className="flex gap-10">
                        {[
                            { id: 'templates', label: 'Consent forms', icon: Layout },
                            { id: 'medical', label: 'Medical form', icon: HeartPulse },
                            { id: 'signed', label: 'Signed', icon: FileCheck },
                            { id: 'links', label: 'Sent links', icon: Share2 }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`pb-4 flex items-center gap-2 text-sm font-semibold transition-all whitespace-nowrap border-b-2 relative top-[1px] ${
                                    activeTab === tab.id
                                        ? 'border-[#2a276e] text-[#2a276e]'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <tab.icon size={18} />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    <div className="pb-3 flex gap-3">
                        {activeTab === 'links' && (
                            <HeaderButton onClick={fetchSentLinks}>
                                <svg className={`w-4 h-4 ${linksLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Refresh
                            </HeaderButton>
                        )}
                        {activeTab === 'templates' && (
                            <>
                                <HeaderButton onClick={() => setShowLibrary(true)}>
                                    <Languages size={16} /> Browse library
                                </HeaderButton>
                                <HeaderButton primary onClick={() => { setEditingTemplate(null); setShowModal(true); }}>
                                    <Plus size={16} strokeWidth={2.5} /> New consent form
                                </HeaderButton>
                            </>
                        )}
                        {/* MedicalFormTab fills this slot with its own buttons. */}
                        <div ref={setMedicalActionsEl} className={activeTab === 'medical' ? 'flex gap-3' : 'hidden'} />
                    </div>
                </div>

                {/* Search & Filters toolbar. Hidden on Signed, which carries
                    its own search: a filter bar that does nothing is worse
                    than no filter bar. */}
                <div className={`items-center gap-3 mb-4 ${activeTab === 'signed' || activeTab === 'medical' ? 'hidden' : 'flex'}`}>
                    <div className="w-full max-w-sm relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder={activeTab === 'links' ? 'Search links...' : 'Search consent forms...'}
                            value={tableSearch}
                            onChange={(e) => { setTableSearch(e.target.value); setLinksPage(1); setTemplatesPage(1); }}
                            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] transition-all"
                        />
                    </div>
                    {activeTab === 'links' ? (
                        <FilterDropdown
                            label="Status"
                            value={filterLinkStatus}
                            onChange={(v) => { setFilterLinkStatus(v); setLinksPage(1); }}
                            options={['Signed', 'Sent', 'Expired']}
                        />
                    ) : activeTab === 'templates' ? (
                        <>
                            <FilterDropdown
                                label="Status"
                                value={filterTemplateStatus}
                                onChange={(v) => { setFilterTemplateStatus(v); setTemplatesPage(1); }}
                                options={['Active', 'Draft']}
                            />
                            <FilterDropdown
                                label="Language"
                                value={filterLanguage}
                                onChange={(v) => { setFilterLanguage(v); setTemplatesPage(1); }}
                                options={CONSENT_LANGUAGES.map(l => l.native)}
                            />
                            <button
                                type="button"
                                onClick={() => { setFavoritesOnly(v => !v); setTemplatesPage(1); }}
                                aria-pressed={favoritesOnly}
                                className={`px-3.5 py-2 rounded-lg border text-sm font-medium inline-flex items-center gap-1.5 transition-colors ${
                                    favoritesOnly
                                        ? 'border-[#2a276e] bg-[#2a276e]/5 text-[#2a276e]'
                                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                                }`}
                            >
                                <Star size={14} className={favoritesOnly ? 'fill-amber-400 text-amber-500' : ''} /> Favourites
                            </button>
                        </>
                    ) : null}
                </div>

                {activeTab === 'medical' ? (
                    <MedicalFormTab actionsEl={medicalActionsEl} />
                ) : loading ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2a276e]"></div>
                    </div>
                ) : activeTab === 'signed' ? (
                    <SignedConsents />
                ) : activeTab === 'links' ? (
                    /* Sent Links tab — full history of consent links with Status + Print PDF */
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col flex-1 min-h-0">
                        <div className="flex-1 overflow-x-auto overflow-y-auto">
                        <table className="w-full divide-y divide-gray-200">
                            <thead className="bg-[#f8fafc] sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Patient</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Template</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Time</th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {linksLoading ? (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-12 text-center">
                                            <div className="inline-flex items-center gap-2 text-sm text-gray-400">
                                                <div className="w-4 h-4 border-2 border-[#2a276e]/20 border-t-[#2a276e] rounded-full animate-spin" />
                                                Loading sent links...
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredLinks.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-8">
                                            <EmptyState
                                                image={noData}
                                                title="No consent links yet"
                                                subtitle="Send a template to a patient from the Templates tab to track it here."
                                            />
                                        </td>
                                    </tr>
                                ) : filteredLinks.slice((linksPage - 1) * CONSENT_PAGE_SIZE, linksPage * CONSENT_PAGE_SIZE).map(link => {
                                    const status = getLinkStatus(link);
                                    const StatusIcon = status.icon;
                                    return (
                                        <tr key={link.token} className="hover:bg-indigo-50/30 transition-colors duration-150 group">
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-3">
                                                    <img 
                                                        src={generatePatientPersona({ name: link.patientName }, 80)} 
                                                        onError={(e) => { e.target.onerror = null; e.target.src = generateInitialsAvatar(link.patientName || 'Patient'); }}
                                                        alt={link.patientName || 'Patient'} 
                                                        className="w-9 h-9 rounded-full flex-shrink-0 object-cover border border-gray-100"
                                                    />
                                                    <div>
                                                        <p className="text-sm font-semibold text-gray-900">{link.patientName || 'Unknown patient'}</p>
                                                        <p className="text-xs text-gray-400">Patient</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-sm text-gray-700">{link.templateName || '—'}</p>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2.5 py-1 inline-flex items-center gap-1.5 text-xs font-semibold rounded-full border ${status.bg} ${status.color} ${status.border}`}>
                                                    <StatusIcon size={12} strokeWidth={2.5} />
                                                    {status.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {link.used
                                                    ? 'Signed'
                                                    : link.timeLeft > 0
                                                        ? `${Math.floor(link.timeLeft / 60)}m ${link.timeLeft % 60}s left`
                                                        : 'Expired'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => openSignedConsent(link.token)}
                                                        className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-1.5"
                                                        title="Open consent in new tab"
                                                    >
                                                        <ExternalLink size={12} />
                                                        Open
                                                    </button>
                                                    {link.used && (
                                                        <button
                                                            onClick={() => printSignedConsent(link.token)}
                                                            className="px-3 py-1.5 text-xs font-semibold text-[#2a276e] bg-[#2a276e]/5 rounded-lg hover:bg-[#2a276e]/10 transition-colors flex items-center gap-1.5"
                                                            title="Open signed consent — use the browser print dialog to save as PDF"
                                                        >
                                                            <Printer size={12} />
                                                            Print / PDF
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        </div>
                        <Pagination
                            page={linksPage}
                            pageSize={CONSENT_PAGE_SIZE}
                            totalItems={filteredLinks.length}
                            onPageChange={setLinksPage}
                        />
                    </div>
                ) : activeTab === 'templates' ? (
                    <div className="grid grid-cols-1 2xl:grid-cols-4 gap-6 flex-1 min-h-0">
                        <div className="2xl:col-span-3 flex flex-col min-h-0">
                            <ConsentTemplatesTable
                                templates={filteredTemplates}
                                totalCount={templates.length}
                                page={templatesPage}
                                pageSize={CONSENT_PAGE_SIZE}
                                onPageChange={setTemplatesPage}
                                onToggleFavorite={toggleFavorite}
                                favoriteBusy={favoriteBusy}
                                onSend={setSendingTemplate}
                                onEdit={(template) => { setEditingTemplate(template); setShowModal(true); }}
                            />
                        </div>

                        {/* Live links, beside the table on wide screens only. Below
                            that it squeezed the actions off the table, and the
                            same links are one tab away under Sent links. */}
                        <div className="hidden 2xl:block h-full">
                            <ConsentRecentLinks clinicId={user?.clinic_id} refreshKey={linksRefreshKey} />
                        </div>
                    </div>
                ) : null}
            </>

            <SendConsentDrawer
                template={sendingTemplate}
                onClose={() => setSendingTemplate(null)}
                onLinkCreated={() => setLinksRefreshKey(k => k + 1)}
            />

            <ConsentEditor
                open={showModal}
                template={editingTemplate}
                onClose={() => { setShowModal(false); setEditingTemplate(null); }}
                onSave={saveTemplate}
            />

            <ConsentLibraryDrawer
                open={showLibrary}
                onClose={() => setShowLibrary(false)}
                onAdded={fetchTemplates}
            />
        </div>
    );
};

export default Paperwork;
