import React, { useState } from 'react';
import { FloppyDisk, Plus, Trash } from '@phosphor-icons/react';
import adminApi from '../adminApi';
import { useToast } from '../components/ToastContext';

const emptyFaq = {
  title: '',
  question_template: '',
  answer_template: '',
  is_active: true,
};

const AdminAiPage = () => {
  const { pushToast } = useToast();
  const [logs, setLogs] = useState([]);
  const [settings, setSettings] = useState({ rate_limit_per_minute: 30, safe_mode_enabled: true });
  const [faqs, setFaqs] = useState([]);
  const [search, setSearch] = useState('');
  const [faqForm, setFaqForm] = useState(emptyFaq);

  const loadData = async () => {
    try {
      const [logsRes, settingsRes, faqRes] = await Promise.all([
        adminApi.get('/api/admin/ai/logs', { params: { search } }),
        adminApi.get('/api/admin/ai/settings'),
        adminApi.get('/api/admin/ai/faqs'),
      ]);
      setLogs(logsRes.data.logs || []);
      setSettings(settingsRes.data.settings || { rate_limit_per_minute: 30, safe_mode_enabled: true });
      setFaqs(faqRes.data.faqs || []);
    } catch (err) {
      pushToast(err.response?.data?.error || 'AI sahifa malumotlari yuklanmadi', 'error');
    }
  };

  React.useEffect(() => {
    loadData();
  }, []);

  const saveSettings = async () => {
    try {
      await adminApi.put('/api/admin/ai/settings', settings);
      pushToast('AI settings saqlandi', 'success');
      loadData();
    } catch (err) {
      pushToast(err.response?.data?.error || 'Settings saqlanmadi', 'error');
    }
  };

  const addFaq = async (event) => {
    event.preventDefault();
    try {
      await adminApi.post('/api/admin/ai/faqs', faqForm);
      setFaqForm(emptyFaq);
      pushToast('FAQ template qoshildi', 'success');
      loadData();
    } catch (err) {
      pushToast(err.response?.data?.error || 'FAQ qoshilmadi', 'error');
    }
  };

  const toggleFaq = async (faq) => {
    try {
      await adminApi.put(`/api/admin/ai/faqs/${faq.id}`, {
        ...faq,
        is_active: !faq.is_active,
      });
      pushToast('FAQ holati yangilandi', 'success');
      loadData();
    } catch (err) {
      pushToast(err.response?.data?.error || 'FAQ yangilanmadi', 'error');
    }
  };

  const deleteFaq = async (id) => {
    try {
      await adminApi.delete(`/api/admin/ai/faqs/${id}`);
      pushToast('FAQ ochirildi', 'success');
      loadData();
    } catch (err) {
      pushToast(err.response?.data?.error || 'FAQ ochirilmadi', 'error');
    }
  };

  return (
    <div className="grid gap-6">
      <section className="admin-glass p-4">
        <h3 className="text-base font-semibold">AI Assistant Monitoring</h3>
        <p className="mt-1 text-sm text-slate-400">Prompt logs, safe mode va rate limit sozlamalari</p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Rate limit (minut)</label>
            <input
              className="admin-input"
              type="number"
              min={1}
              value={settings.rate_limit_per_minute}
              onChange={(e) => setSettings((p) => ({ ...p, rate_limit_per_minute: Number(e.target.value) }))}
            />
          </div>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={!!settings.safe_mode_enabled}
                onChange={(e) => setSettings((p) => ({ ...p, safe_mode_enabled: e.target.checked }))}
              />
              Safe mode enabled
            </label>
          </div>
          <div className="flex items-end justify-end">
            <button type="button" className="admin-btn-primary" onClick={saveSettings}><FloppyDisk size={16} /> Save settings</button>
          </div>
        </div>
      </section>

      <section className="admin-glass p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold">Prompt logs</h4>
          <div className="flex gap-2">
            <input className="admin-input" placeholder="Search logs" value={search} onChange={(e) => setSearch(e.target.value)} />
            <button type="button" className="admin-btn-primary" onClick={loadData}>Search</button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="px-2 py-2 text-left">User</th>
                <th className="px-2 py-2 text-left">Model</th>
                <th className="px-2 py-2 text-left">Prompt</th>
                <th className="px-2 py-2 text-left">Tokens</th>
                <th className="px-2 py-2 text-left">Safe</th>
                <th className="px-2 py-2 text-left">Date</th>
              </tr>
            </thead>
            <tbody>
              {logs.slice(0, 100).map((log) => (
                <tr key={log.id} className="border-t border-white/10">
                  <td className="px-2 py-2">{log.user_name || log.user_email || '-'}</td>
                  <td className="px-2 py-2">{log.model_name || '-'}</td>
                  <td className="px-2 py-2">{log.prompt}</td>
                  <td className="px-2 py-2">{log.tokens_used}</td>
                  <td className="px-2 py-2">{log.safe_flag ? 'yes' : 'no'}</td>
                  <td className="px-2 py-2">{new Date(log.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-glass p-4">
        <h4 className="text-sm font-semibold">FAQ templates</h4>

        <form onSubmit={addFaq} className="mt-3 grid gap-2 md:grid-cols-2">
          <input className="admin-input" placeholder="Title" value={faqForm.title} onChange={(e) => setFaqForm((p) => ({ ...p, title: e.target.value }))} required />
          <label className="inline-flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={faqForm.is_active} onChange={(e) => setFaqForm((p) => ({ ...p, is_active: e.target.checked }))} />
            Active
          </label>
          <textarea className="admin-input md:col-span-2" rows={2} placeholder="Question template" value={faqForm.question_template} onChange={(e) => setFaqForm((p) => ({ ...p, question_template: e.target.value }))} required />
          <textarea className="admin-input md:col-span-2" rows={3} placeholder="Answer template" value={faqForm.answer_template} onChange={(e) => setFaqForm((p) => ({ ...p, answer_template: e.target.value }))} required />
          <button type="submit" className="admin-btn-primary md:col-span-2"><Plus size={16} /> Add template</button>
        </form>

        <div className="mt-4 grid gap-3">
          {faqs.map((faq) => (
            <article key={faq.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-100">{faq.title}</p>
                  <p className="text-xs text-slate-400">{faq.is_active ? 'active' : 'inactive'}</p>
                  <p className="mt-2 text-sm text-slate-300"><b>Q:</b> {faq.question_template}</p>
                  <p className="text-sm text-slate-300"><b>A:</b> {faq.answer_template}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="admin-btn-soft" onClick={() => toggleFaq(faq)}>{faq.is_active ? 'Deactivate' : 'Activate'}</button>
                  <button type="button" className="admin-btn-soft" onClick={() => deleteFaq(faq.id)}><Trash size={14} /> Delete</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};

export default AdminAiPage;
