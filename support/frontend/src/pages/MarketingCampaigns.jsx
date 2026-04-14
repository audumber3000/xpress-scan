import React, { useState } from 'react';
import { Send, MessageSquare, Mail, RefreshCcw } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../utils/api';
import { PageHeader, Card } from '../components/ui';

export default function MarketingCampaigns() {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [formData, setFormData] = useState({
    channel: 'whatsapp',
    target_criteria: 'all',
    subject: '',
    template_name: 'molarplus_update',
    message_body: ''
  });
  
  const [result, setResult] = useState(null);

  React.useEffect(() => {
    async function loadTemplates() {
      try {
        const res = await api.get('/marketing/whatsapp-templates');
        if (Array.isArray(res)) setTemplates(res);
      } catch (err) {
        console.error('Failed to load whatsapp templates', err);
      }
    }
    loadTemplates();
  }, []);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (formData.channel === 'email' && !formData.message_body) {
      toast.error('Message body is required for email');
      return;
    }
    if (formData.channel === 'whatsapp' && !formData.template_name) {
      toast.error('Template selection is required for WhatsApp');
      return;
    }
    
    // Safety check prompt (in real app, use a nicer modal)
    if (!window.confirm(`Are you sure you want to broadcast this ${formData.channel} to ${formData.target_criteria} clinics?`)) return;

    setLoading(true);
    setResult(null);
    try {
      const res = await api.post('/marketing/bulk-message', formData);
      setResult(res);
      toast.success(`Successfully sent to ${res.sent_count} clinics!`);
    } catch (err) {
      toast.error('Failed to dispatch campaign');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-5 max-w-[800px]">
      <PageHeader
        title="Campaigns & Bulk Messages"
        subtitle="Dispatch bulk WhatsApp updates or Emails to clinics"
      />

      <Card>
        <form onSubmit={handleSend} className="space-y-6">
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Channel
              </label>
              <div className="flex gap-3">
                <label className={`flex-1 flex items-center justify-center gap-2 p-3 border rounded-xl cursor-pointer transition-all ${
                  formData.channel === 'whatsapp' ? 'bg-green-50 border-green-200 text-green-700 shadow-sm' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}>
                  <input type="radio" name="channel" value="whatsapp" checked={formData.channel === 'whatsapp'} onChange={handleChange} className="hidden" />
                  <MessageSquare size={18} /> WhatsApp
                </label>
                <label className={`flex-1 flex items-center justify-center gap-2 p-3 border rounded-xl cursor-pointer transition-all ${
                  formData.channel === 'email' ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}>
                  <input type="radio" name="channel" value="email" checked={formData.channel === 'email'} onChange={handleChange} className="hidden" />
                  <Mail size={18} /> Email
                </label>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Target Audience
              </label>
              <select name="target_criteria" value={formData.target_criteria} onChange={handleChange}
                className="w-full h-[50px] px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-400 transition-all">
                <option value="all">All Clinics</option>
                <option value="active">Active Subscription</option>
                <option value="trial">Free / Trial Version</option>
                <option value="suspended">Suspended Clinics</option>
              </select>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-100">
            {formData.channel === 'whatsapp' ? (
               <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Select Template
                  </label>
                  <select name="template_name" value={formData.template_name} onChange={handleChange}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-400">
                    {templates.map(t => (
                       <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
               </div>
            ) : (
               <>
                 <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      Email Subject
                    </label>
                    <input type="text" name="subject" value={formData.subject} onChange={handleChange} placeholder="Important update from MolarPlus"
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-400" />
                 </div>
                 <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      Email Body (HTML/Text)
                    </label>
                    <textarea name="message_body" value={formData.message_body} onChange={handleChange} rows={5} placeholder="Type your message here..."
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-400" />
                 </div>
               </>
            )}
          </div>

          <div className="pt-2 flex items-center justify-between">
            <div className="text-xs text-slate-500 font-medium">
               Make sure your template matches the MSG91 configuration.
            </div>
            <button type="submit" disabled={loading}
              className="h-10 px-6 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-60">
              {loading ? <RefreshCcw size={16} className="animate-spin" /> : <Send size={16} />}
              {loading ? 'Dispatching...' : 'Dispatch Campaign'}
            </button>
          </div>
        </form>

        {result && (
          <div className="mt-6 p-4 bg-slate-50 border border-slate-100 rounded-xl">
             <h4 className="text-sm font-semibold text-slate-800 mb-2">Dispatch Results</h4>
             <ul className="text-xs text-slate-600 space-y-1">
                <li>Total Targets: <strong>{result.total_attempted}</strong></li>
                <li>Successfully Sent: <strong>{result.sent_count}</strong></li>
                <li>Failed: <strong>{result.errors?.length || 0}</strong></li>
             </ul>
             {result.errors?.length > 0 && (
               <div className="mt-3 p-3 bg-red-50 text-red-600 rounded border border-red-100 max-h-32 overflow-y-auto text-xs font-mono">
                 {result.errors.map((e, i) => <div key={i}>{e}</div>)}
               </div>
             )}
          </div>
        )}
      </Card>
    </div>
  );
}
