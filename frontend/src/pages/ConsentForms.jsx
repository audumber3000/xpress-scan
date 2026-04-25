import React, { useState, useEffect } from "react";
import { api, getPermissionAwareErrorMessage } from "../utils/api";
import { useHeader } from "../contexts/HeaderContext";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "react-toastify";
import Card from "../components/Card";
import axios from "axios";
import { FileText, Layout } from 'lucide-react';
import ConsentRecentLinks from "../components/consents/ConsentRecentLinks";
import FeatureLock from "../components/FeatureLock";

const ConsentForms = () => {
    const { setTitle } = useHeader();
    const { user } = useAuth();
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('templates');
    const [showModal, setShowModal] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [formData, setFormData] = useState({
        name: "",
        content: "",
        is_active: true
    });
    
    const [showSendModal, setShowSendModal] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [patients, setPatients] = useState([]);
    const [patientSearch, setPatientSearch] = useState("");
    const [sending, setSending] = useState(false);
    const [generatedLink, setGeneratedLink] = useState("");
    const [generatedToken, setGeneratedToken] = useState("");
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [messageSent, setMessageSent] = useState(false);
    const [linksRefreshKey, setLinksRefreshKey] = useState(0);

    const NEXUS_API_URL = import.meta.env.VITE_NEXUS_API_URL || `http://${window.location.hostname}:8001/api/v1`;

    useEffect(() => {
        setTitle("Consent Forms");
        fetchTemplates();
        fetchPatients();
    }, []);

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const data = await api.get("/consents/templates");
            setTemplates(data);
        } catch (error) {
            toast.error(getPermissionAwareErrorMessage(
                error,
                "Failed to fetch consent templates",
                "You don't have permission to view consent templates."
            ));
        } finally {
            setLoading(false);
        }
    };

    const fetchPatients = async () => {
        try {
            const data = await api.get("/patients/");
            setPatients(data);
        } catch (error) {
            console.error("Failed to fetch patients");
        }
    };

    const handleGenerateLink = async (patient) => {
        if (!selectedTemplate) return;
        
        setSending(true);
        try {
            if (!user) {
                toast.error("User session not found");
                return;
            }
            
            const res = await axios.post(`${NEXUS_API_URL}/consent/generate`, {
                patientId: patient.id,
                patientName: patient.name,
                phone: patient.phone,
                templateId: selectedTemplate.id,
                templateName: selectedTemplate.name,
                content: selectedTemplate.content,
                clinicId: user.clinic_id,
            });

            setGeneratedLink(res.data.signUrl);
            setGeneratedToken(res.data.token);
            setSelectedPatient(patient);
            setLinksRefreshKey(k => k + 1); // Trigger sidebar refresh
            toast.success("Link generated successfully");
        } catch (error) {
            toast.error(error.response?.data?.error || "Failed to generate link");
        } finally {
            setSending(false);
        }
    };

    const handleSendWhatsApp = async () => {
        if (!selectedPatient || !generatedToken) return;

        setSending(true);
        try {
            const fullLink = `${window.location.origin}${generatedLink}`;
            await axios.post(`${NEXUS_API_URL}/consent/send-whatsapp/${generatedToken}`, {
                consentLink: fullLink,
            });

            setMessageSent(true);
            toast.success(`Consent link sent to ${selectedPatient.name} via WhatsApp`);
        } catch (error) {
            toast.error(error.response?.data?.detail || error.response?.data?.error || "Failed to send WhatsApp message");
        } finally {
            setSending(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingTemplate) {
                await api.put(`/consents/templates/${editingTemplate.id}`, formData);
                toast.success("Template updated successfully");
            } else {
                await api.post("/consents/templates", { ...formData });
                toast.success("Template created successfully");
            }
            setShowModal(false);
            setEditingTemplate(null);
            setFormData({ name: "", content: "", is_active: true });
            fetchTemplates();
        } catch (error) {
            toast.error(getPermissionAwareErrorMessage(
                error,
                "Failed to save template",
                "You don't have permission to manage consent templates."
            ));
        }
    };

    const filteredPatients = patients.filter(p => 
        p.name.toLowerCase().includes(patientSearch.toLowerCase()) ||
        p.phone.includes(patientSearch)
    ).slice(0, 5);

    return (
        <div className="p-8 max-w-[1600px] mx-auto min-h-screen bg-gray-50/50">
            <FeatureLock featureName="Digital Consent Forms">
                {/* Header matching Inventory & Vendors */}
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900">Consent Forms</h2>
                        <p className="text-sm text-gray-500 mt-1">Manage digital consent templates and signature tracking</p>
                    </div>
                    <div className="flex gap-4">
                        <button className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 flex items-center gap-2 transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Export
                        </button>
                        <button
                            onClick={() => { setEditingTemplate(null); setShowModal(true); }}
                            className="bg-[#2a276e] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#1a1548] transition-colors shadow-sm flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                            </svg>
                            {activeTab === 'templates' ? 'Add New Template' : 'Add Custom Form'}
                        </button>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="flex gap-10 border-b border-gray-200 mb-6">
                    {[
                        { id: 'templates', label: 'Templates', icon: Layout },
                        { id: 'custom', label: 'Custom Forms', icon: FileText }
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

                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2a276e]"></div>
                    </div>
                ) : activeTab === 'templates' ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {/* Main Templates Area - Table Format */}
                        <div className="lg:col-span-2 xl:col-span-3">
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Template Name</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Content Preview</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {templates.map((template) => (
                                            <tr key={template.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-lg bg-[#2a276e]/5 text-[#2a276e] flex items-center justify-center flex-shrink-0">
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                            </svg>
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-900">{template.name}</p>
                                                            <p className="text-xs text-gray-500">Consent Form</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-sm text-gray-500 line-clamp-2 max-w-md">
                                                        {template.content || "Standard consent document..."}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${template.is_active ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-gray-100 text-gray-700 border border-gray-200'}`}>
                                                        {template.is_active ? 'Active' : 'Draft'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button 
                                                            onClick={() => {
                                                                setSelectedTemplate(template);
                                                                setShowSendModal(true);
                                                            }}
                                                            className="px-3 py-1.5 text-xs font-semibold text-[#2a276e] bg-[#2a276e]/5 rounded-lg hover:bg-[#2a276e]/10 transition-colors"
                                                        >
                                                            Send Link
                                                        </button>
                                                        <button 
                                                            onClick={() => {
                                                                setEditingTemplate(template);
                                                                setFormData({
                                                                    name: template.name,
                                                                    content: template.content,
                                                                    is_active: template.is_active
                                                                });
                                                                setShowModal(true);
                                                            }}
                                                            className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                                        >
                                                            Edit
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {templates.length === 0 && (
                                    <tr>
                                        <td colSpan="4" className="px-6 py-12">
                                            <div className="flex flex-col items-center justify-center text-center">
                                                <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                                <p className="text-sm font-bold text-gray-900">No Templates Found</p>
                                                <p className="text-sm text-gray-500 mt-1">Create your first consent template to get started</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </div>
                        </div>

                        {/* Sidebar: Recent Links matching "Inventory Alerts" */}
                        <div className="lg:col-span-1 xl:col-span-1 h-full">
                            <ConsentRecentLinks clinicId={user?.clinic_id} refreshKey={linksRefreshKey} />
                        </div>
                    </div>
                ) : (
                    /* Custom Forms Tab */
                    <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        <div className="lg:col-span-2 xl:col-span-3">
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Form Name</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created Date</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        <tr>
                                            <td colSpan="5" className="px-6 py-12">
                                                <div className="flex flex-col items-center justify-center text-center">
                                                    <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                    <p className="text-sm font-bold text-gray-900">No Custom Forms</p>
                                                    <p className="text-sm text-gray-500 mt-1">Custom forms for specific patients will appear here</p>
                                                </div>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="lg:col-span-1 xl:col-span-1 h-full">
                            <ConsentRecentLinks clinicId={user?.clinic_id} refreshKey={linksRefreshKey} />
                        </div>
                    </div>
                )}
            </FeatureLock>

            {showSendModal && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div 
                        className="fixed inset-0 bg-[#1F1c4f]/20 backdrop-blur-sm transition-opacity" 
                        onClick={() => { setShowSendModal(false); setGeneratedLink(""); setGeneratedToken(""); setPatientSearch(""); setSelectedPatient(null); setMessageSent(false); }}
                    ></div>
                    <div className="bg-white w-full max-w-md relative z-10 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                        
                        {/* Drawer Header */}
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white shrink-0">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Send Consent</h3>
                                <p className="text-sm text-gray-500 mt-1">Select patient and generate link</p>
                            </div>
                            <button 
                                onClick={() => { setShowSendModal(false); setGeneratedLink(""); setGeneratedToken(""); setPatientSearch(""); setSelectedPatient(null); setMessageSent(false); }} 
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Selected Template Badge */}
                        <div className="px-6 py-4 bg-[#2a276e]/5 border-b border-gray-200 flex items-start gap-3 shrink-0">
                            <div className="p-2 bg-white rounded-lg text-[#2a276e] shadow-sm border border-gray-200">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-gray-500 mb-0.5">Selected Document</p>
                                <h4 className="font-semibold text-gray-900">{selectedTemplate?.name}</h4>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 py-8">
                            {generatedLink ? (
                                <div className="text-center space-y-6">
                                    <div className={`w-16 h-16 ${messageSent ? 'bg-green-50 text-green-500' : 'bg-[#2a276e]/5 text-[#2a276e]'} rounded-lg flex items-center justify-center mx-auto transition-colors`}>
                                        {messageSent ? (
                                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                            </svg>
                                        ) : (
                                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                            </svg>
                                        )}
                                    </div>
                                    
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900">{messageSent ? 'Sent Successfully!' : 'Link Ready'}</h3>
                                        <p className="text-gray-500 text-sm mt-2 leading-relaxed">
                                            {messageSent 
                                                ? `The digital consent link has been dispatched to ${selectedPatient?.name}'s WhatsApp.` 
                                                : `A secure, one-time link has been generated to collect ${selectedPatient?.name}'s signature.`}
                                        </p>
                                    </div>

                                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex flex-col gap-2 mt-8 text-left">
                                        <p className="text-xs font-medium text-gray-600">Shareable Link (Valid for 5 mins)</p>
                                        <div className="flex gap-2">
                                            <input 
                                                readOnly 
                                                value={generatedLink}
                                                className="flex-1 bg-white border border-gray-200 rounded-lg px-4 py-2 text-xs truncate outline-none font-mono text-gray-600"
                                            />
                                            <button 
                                                onClick={() => {
                                                    navigator.clipboard.writeText(generatedLink);
                                                    toast.success("Link copied to clipboard!");
                                                }}
                                                className="bg-[#2a276e] text-white p-2.5 rounded-lg hover:bg-[#1a1548] transition-colors"
                                                title="Copy Link"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>

                                    {!messageSent && (
                                        <button
                                            onClick={handleSendWhatsApp}
                                            disabled={sending}
                                            className="w-full py-3 mt-6 bg-[#25D366] text-white rounded-lg font-semibold hover:bg-[#20bd5a] transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                                        >
                                            {sending ? (
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            ) : (
                                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .018 5.396.015 12.03c0 2.12.554 4.189 1.605 6.006L0 24l6.142-1.611a11.81 11.81 0 005.904 1.576h.005c6.632 0 12.032-5.396 12.035-12.031a11.772 11.772 0 00-3.417-8.529" />
                                                </svg>
                                            )}
                                            {sending ? 'Dispatching...' : 'Dispatch via WhatsApp'}
                                        </button>
                                    )}

                                    <div className="pt-4">
                                        <button
                                            onClick={() => { setShowSendModal(false); setGeneratedLink(""); setGeneratedToken(""); setPatientSearch(""); setSelectedPatient(null); setMessageSent(false); }}
                                            className="text-gray-500 font-semibold text-sm hover:text-gray-700 transition-colors"
                                        >
                                            {messageSent ? 'Finish & Close' : 'Close without sending'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="Search patient by name or phone..."
                                            className="w-full pl-12 pr-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] outline-none transition-all"
                                            value={patientSearch}
                                            onChange={(e) => setPatientSearch(e.target.value)}
                                            autoFocus
                                        />
                                        <svg className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                    </div>

                                    <div>
                                        <p className="text-xs font-medium text-gray-500 mb-4">
                                            {patientSearch ? "Search Results" : "Recent Patients"}
                                        </p>
                                        <div className="flex flex-col gap-3 min-h-[300px]">
                                            {filteredPatients.map(patient => (
                                                <button
                                                    key={patient.id}
                                                    onClick={() => handleGenerateLink(patient)}
                                                    disabled={sending}
                                                    className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-slate-50 transition-all text-left group bg-white shadow-sm"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center shrink-0">
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                            </svg>
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-[#1F1c4f] group-hover:text-indigo-600 transition-colors">{patient.name}</p>
                                                            <p className="text-xs text-gray-500 font-medium">{patient.phone}</p>
                                                        </div>
                                                    </div>
                                                    <div className="p-2 text-gray-300 group-hover:text-indigo-600 transition-colors">
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                                        </svg>
                                                    </div>
                                                </button>
                                            ))}
                                            {patientSearch && filteredPatients.length === 0 && (
                                                <div className="py-12 flex flex-col items-center justify-center text-center">
                                                    <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-3">
                                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                        </svg>
                                                    </div>
                                                    <p className="text-gray-500 font-medium">No matches for "{patientSearch}"</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Template Add/Edit Drawer */}
            <div className={`fixed inset-0 z-50 flex justify-end ${showModal ? 'visible' : 'invisible'}`}>
                <div
                    className={`fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${showModal ? 'opacity-100' : 'opacity-0'}`}
                    onClick={() => setShowModal(false)}
                />
                <div className={`relative z-10 w-full max-w-xl bg-white h-full shadow-2xl flex flex-col transition-transform duration-300 ${showModal ? 'translate-x-0' : 'translate-x-full'}`}>
                    {/* Drawer Header */}
                    <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-[#2a276e]/5 rounded-lg flex items-center justify-center text-[#2a276e]">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">{editingTemplate ? 'Edit Template' : 'New Consent Template'}</h2>
                                <p className="text-xs text-gray-500">Fill in the template details below</p>
                            </div>
                        </div>
                        <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Drawer Form */}
                    <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Template Name</label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. General Dental Treatment Consent"
                                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] outline-none transition-all text-sm"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div className="flex-1 flex flex-col">
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Form Content</label>
                            <textarea
                                required
                                rows={16}
                                placeholder="Write the full legal text of the consent form here..."
                                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] outline-none transition-all resize-none text-sm leading-relaxed bg-gray-50/50"
                                value={formData.content}
                                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                            />
                        </div>
                        <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <input
                                type="checkbox"
                                id="is_active"
                                className="w-4 h-4 accent-[#2a276e]"
                                checked={formData.is_active}
                                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                            />
                            <label htmlFor="is_active" className="text-sm font-semibold text-gray-700">Make this template active immediately</label>
                        </div>
                    </form>

                    {/* Drawer Footer */}
                    <div className="px-6 py-5 border-t border-gray-100 bg-white shrink-0 flex gap-3">
                        <button
                            type="button"
                            onClick={() => setShowModal(false)}
                            className="flex-1 py-2.5 text-gray-600 font-semibold border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            className="flex-[2] py-2.5 bg-[#2a276e] text-white rounded-lg font-semibold hover:bg-[#1a1548] transition-colors shadow-sm text-sm"
                        >
                            {editingTemplate ? 'Update Template' : 'Create Template'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConsentForms;
