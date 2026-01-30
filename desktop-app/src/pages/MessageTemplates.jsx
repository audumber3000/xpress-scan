import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHeader } from '../contexts/HeaderContext';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { toast } from 'react-toastify';
import { ChevronLeft } from 'lucide-react';
import GearLoader from '../components/GearLoader';

const MessageTemplates = () => {
  const { setTitle } = useHeader();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messageTemplates, setMessageTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateFormData, setTemplateFormData] = useState({
    name: '',
    title: '',
    content: '',
    is_active: true
  });
  const [savingTemplate, setSavingTemplate] = useState(false);

  useEffect(() => {
    setTitle(
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center gap-1 text-gray-600 hover:text-gray-900 transition"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Admin Hub</span>
        </button>
      </div>
    );
    fetchMessageTemplates();
  }, [setTitle, navigate]);

  const fetchMessageTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const data = await api.get('/message-templates');
      setMessageTemplates(data);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Failed to load templates');
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleEditTemplate = (template) => {
    setEditingTemplate(template);
    setTemplateFormData({
      name: template.name,
      title: template.title,
      content: template.content,
      is_active: template.is_active
    });
    setShowEditModal(true);
  };

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    try {
      setSavingTemplate(true);
      if (editingTemplate) {
        // Update existing template
        await api.put(`/message-templates/${editingTemplate.id}`, templateFormData);
        toast.success('Template updated successfully');
      } else {
        // Create new template
        await api.post('/message-templates', templateFormData);
        toast.success('Template created successfully');
      }
      setShowEditModal(false);
      setEditingTemplate(null);
      setTemplateFormData({ name: '', title: '', content: '', is_active: true });
      fetchMessageTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error(editingTemplate ? 'Failed to update template' : 'Failed to create template');
    } finally {
      setSavingTemplate(false);
    }
  };

  if (loadingTemplates) {
    return (
      <div className="flex items-center justify-center h-screen">
        <GearLoader />
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Header with teal theme */}
        <div className="bg-gradient-to-r from-[#2D9596] to-[#1F6B72] rounded-lg p-6 mb-6 text-white">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold mb-2">Message Templates</h2>
              <p className="text-white/90">Customize automated messages sent to patients via WhatsApp and SMS</p>
            </div>
            <button
              onClick={() => {
                setTemplateFormData({ name: '', title: '', content: '', is_active: true });
                setEditingTemplate(null);
                setShowEditModal(true);
              }}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition font-medium"
            >
              + Add Template
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {messageTemplates.map((template) => (
            <div key={template.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h4 className="text-lg font-semibold text-gray-900">{template.title}</h4>
                  <p className="text-sm text-gray-500 mt-1">
                    Template: <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{template.name}</span>
                  </p>
                  {template.variables && template.variables.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-gray-600 mb-2">Available variables:</p>
                      <div className="flex flex-wrap gap-2">
                        {template.variables.map((varName, idx) => (
                          <span key={idx} className="text-xs bg-[#E0F2F2] text-[#2D9596] px-2 py-1 rounded font-mono">
                            {"{"}{varName}{"}"}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${
                    template.is_active 
                      ? "bg-green-100 text-green-700" 
                      : "bg-gray-100 text-gray-600"
                  }`}>
                    {template.is_active ? "Active" : "Inactive"}
                  </span>
                  <button
                    onClick={() => handleEditTemplate(template)}
                    className="px-4 py-2 bg-[#2D9596] text-white rounded-lg hover:bg-[#1F6B72] text-sm font-medium transition"
                  >
                    Edit
                  </button>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{template.content}</p>
              </div>
            </div>
          ))}
          
          {messageTemplates.length === 0 && (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <p className="text-gray-500">No templates found. Default templates will be used.</p>
            </div>
          )}
        </div>

        {/* Edit Modal */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">{editingTemplate ? 'Edit Template' : 'Add Template'}</h3>
                <form onSubmit={handleSaveTemplate} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Template Name (ID)</label>
                    <input
                      type="text"
                      value={templateFormData.name}
                      onChange={(e) => setTemplateFormData({ ...templateFormData, name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                      placeholder="e.g., welcome, appointment_reminder"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9596] focus:border-transparent"
                      disabled={!!editingTemplate}
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Unique identifier for this template (cannot be changed after creation)</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Display Title</label>
                    <input
                      type="text"
                      value={templateFormData.title}
                      onChange={(e) => setTemplateFormData({ ...templateFormData, title: e.target.value })}
                      placeholder="e.g., Welcome Message"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9596] focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Content</label>
                    <textarea
                      value={templateFormData.content}
                      onChange={(e) => setTemplateFormData({ ...templateFormData, content: e.target.value })}
                      rows={8}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9596] focus:border-transparent"
                      required
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={templateFormData.is_active}
                      onChange={(e) => setTemplateFormData({ ...templateFormData, is_active: e.target.checked })}
                      className="w-4 h-4 text-[#2D9596] border-gray-300 rounded focus:ring-[#2D9596]"
                    />
                    <label className="text-sm font-medium text-gray-700">Active</label>
                  </div>
                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <button
                      type="button"
                      onClick={() => {
                        setShowEditModal(false);
                        setEditingTemplate(null);
                        setTemplateFormData({ name: '', title: '', content: '', is_active: true });
                      }}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingTemplate}
                      className="px-6 py-2 bg-[#2D9596] text-white rounded-lg hover:bg-[#1F6B72] disabled:opacity-50"
                    >
                      {savingTemplate ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageTemplates;
