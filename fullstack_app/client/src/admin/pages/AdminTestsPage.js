import React, { useMemo, useState } from 'react';
import { DownloadSimple, FileArrowUp, PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import adminApi from '../adminApi';
import { useToast } from '../components/ToastContext';

const defaultTestForm = { title: '', category: 'konstitutsiya', difficulty: 'medium', status: 'draft' };
const defaultQuestionForm = {
  test_id: '',
  question_text: '',
  option_a: '',
  option_b: '',
  option_c: '',
  option_d: '',
  correct_option: 'A',
  explanation: '',
  status: 'draft',
};

const AdminTestsPage = () => {
  const { pushToast } = useToast();

  const [tests, setTests] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [filters, setFilters] = useState({ search: '', category: '', difficulty: '', status: '' });
  const [loading, setLoading] = useState(false);

  const [showTestModal, setShowTestModal] = useState(false);
  const [editingTest, setEditingTest] = useState(null);
  const [testForm, setTestForm] = useState(defaultTestForm);

  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [questionForm, setQuestionForm] = useState(defaultQuestionForm);

  const categories = useMemo(() => {
    const values = tests.map((t) => t.category);
    return [...new Set(values.filter(Boolean))];
  }, [tests]);

  const upsertTestState = (incomingTest) => {
    if (!incomingTest) return;
    setTests((prev) => {
      const idx = prev.findIndex((item) => item.id === incomingTest.id);
      if (idx === -1) {
        return [{
          ...incomingTest,
          question_count: incomingTest.question_count ?? 0,
          created_by_name: incomingTest.created_by_name || 'Siz',
        }, ...prev];
      }
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        ...incomingTest,
      };
      return updated;
    });
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [testsRes, questionsRes] = await Promise.all([
        adminApi.get('/api/admin/tests', { params: filters }),
        adminApi.get('/api/admin/questions', { params: { status: '' } }),
      ]);
      setTests(testsRes.data.tests || []);
      setQuestions(questionsRes.data.questions || []);
    } catch (err) {
      pushToast(err.response?.data?.error || 'Testlar yuklanmadi', 'error');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchAll();
  }, []);

  const handleTestSave = async (event) => {
    event.preventDefault();
    try {
      if (editingTest) {
        const res = await adminApi.put(`/api/admin/tests/${editingTest.id}`, testForm);
        upsertTestState(res.data.test);
        pushToast('Test yangilandi', 'success');
      } else {
        const res = await adminApi.post('/api/admin/tests', testForm);
        upsertTestState(res.data.test);
        pushToast('Test yaratildi', 'success');
      }
      setShowTestModal(false);
      setEditingTest(null);
      setTestForm(defaultTestForm);
    } catch (err) {
      pushToast(err.response?.data?.error || 'Test saqlanmadi', 'error');
    }
  };

  const handleQuestionSave = async (event) => {
    event.preventDefault();
    if (!questionForm.test_id) {
      pushToast('Test tanlang', 'error');
      return;
    }
    try {
      if (editingQuestion) {
        await adminApi.put(`/api/admin/questions/${editingQuestion.id}`, questionForm);
        pushToast('Savol yangilandi', 'success');
      } else {
        await adminApi.post('/api/admin/questions', questionForm);
        pushToast('Savol yaratildi', 'success');
      }
      await fetchAll();
      setShowQuestionModal(false);
      setEditingQuestion(null);
      setQuestionForm(defaultQuestionForm);
    } catch (err) {
      pushToast(err.response?.data?.error || 'Savol saqlanmadi', 'error');
    }
  };

  const changeStatus = async (testId, status) => {
    try {
      const res = await adminApi.patch(`/api/admin/tests/${testId}/status`, { status });
      upsertTestState(res.data.test);
      setQuestions((prev) => prev.map((item) => (
        Number(item.test_id) === Number(testId)
          ? { ...item, status }
          : item
      )));
      pushToast(`Status -> ${status}`, 'success');
    } catch (err) {
      pushToast(err.response?.data?.error || 'Status ozgartirilmadi', 'error');
    }
  };

  const deleteQuestion = async (id) => {
    try {
      await adminApi.delete(`/api/admin/questions/${id}`);
      pushToast('Savol ochirildi', 'success');
      await fetchAll();
    } catch (err) {
      pushToast(err.response?.data?.error || 'Savol ochirilmadi', 'error');
    }
  };

  const exportData = async (format) => {
    try {
      const res = await adminApi.get('/api/admin/tests/export', {
        params: { format },
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: format === 'csv' ? 'text/csv' : 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `lawinate-tests.${format}`;
      link.click();
      URL.revokeObjectURL(link.href);
      pushToast(`Export ${format.toUpperCase()} tayyor`, 'success');
    } catch (err) {
      pushToast(err.response?.data?.error || 'Export ishlamadi', 'error');
    }
  };

  const importFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      if (file.name.toLowerCase().endsWith('.json')) {
        const payload = JSON.parse(text);
        await adminApi.post('/api/admin/tests/import', payload);
      } else {
        await adminApi.post('/api/admin/tests/import', { format: 'csv', csv: text });
      }
      pushToast('Import muvaffaqiyatli', 'success');
      fetchAll();
    } catch (err) {
      pushToast(err.response?.data?.error || 'Import ishlamadi', 'error');
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div className="grid gap-6">
      <section className="admin-glass p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold">Tests Management</h3>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="admin-btn-primary" onClick={() => { setEditingTest(null); setTestForm(defaultTestForm); setShowTestModal(true); }}>
              <Plus size={16} /> Test qo'shish
            </button>
            <button type="button" className="admin-btn-soft" onClick={() => { setEditingQuestion(null); setQuestionForm(defaultQuestionForm); setShowQuestionModal(true); }}>
              <Plus size={16} /> Savol qo'shish
            </button>
            <button type="button" className="admin-btn-soft" onClick={() => exportData('json')}>
              <DownloadSimple size={16} /> JSON export
            </button>
            <button type="button" className="admin-btn-soft" onClick={() => exportData('csv')}>
              <DownloadSimple size={16} /> CSV export
            </button>
            <label className="admin-btn-soft cursor-pointer">
              <FileArrowUp size={16} /> Import
              <input type="file" accept=".json,.csv" className="hidden" onChange={importFile} />
            </label>
          </div>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-4">
          <input className="admin-input" placeholder="Qidiruv" value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} />
          <select className="admin-input" value={filters.category} onChange={(e) => setFilters((p) => ({ ...p, category: e.target.value }))}>
            <option value="">Barcha kategoriya</option>
            {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          <select className="admin-input" value={filters.difficulty} onChange={(e) => setFilters((p) => ({ ...p, difficulty: e.target.value }))}>
            <option value="">Barcha qiyinlik</option>
            <option value="easy">easy</option>
            <option value="medium">medium</option>
            <option value="hard">hard</option>
          </select>
          <div className="flex gap-2">
            <select className="admin-input" value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
              <option value="">Barcha status</option>
              <option value="draft">draft</option>
              <option value="published">published</option>
              <option value="unpublished">unpublished</option>
            </select>
            <button type="button" className="admin-btn-primary" onClick={fetchAll} disabled={loading}>Apply</button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="px-2 py-2 text-left">Title</th>
                <th className="px-2 py-2 text-left">Category</th>
                <th className="px-2 py-2 text-left">Difficulty</th>
                <th className="px-2 py-2 text-left">Status</th>
                <th className="px-2 py-2 text-left">Savollar</th>
                <th className="px-2 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tests.map((test) => (
                <tr key={test.id} className="border-t border-white/10">
                  <td className="px-2 py-2">{test.title}</td>
                  <td className="px-2 py-2">{test.category}</td>
                  <td className="px-2 py-2">{test.difficulty}</td>
                  <td className="px-2 py-2"><span className="admin-badge border-sky-400/30 bg-sky-500/10 text-sky-200">{test.status}</span></td>
                  <td className="px-2 py-2">{test.question_count}</td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-1">
                      <button type="button" className="admin-btn-soft" onClick={() => { setEditingTest(test); setTestForm({ title: test.title, category: test.category, difficulty: test.difficulty, status: test.status }); setShowTestModal(true); }}><PencilSimple size={14} /> Edit</button>
                      <button type="button" className="admin-btn-soft" onClick={() => changeStatus(test.id, 'published')}>Publish</button>
                      <button type="button" className="admin-btn-soft" onClick={() => changeStatus(test.id, 'unpublished')}>Unpublish</button>
                      <button type="button" className="admin-btn-soft" onClick={() => changeStatus(test.id, 'draft')}>Draft</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-glass p-4">
        <h4 className="text-sm font-semibold">Questions (CRUD)</h4>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="px-2 py-2 text-left">Test</th>
                <th className="px-2 py-2 text-left">Savol</th>
                <th className="px-2 py-2 text-left">Correct</th>
                <th className="px-2 py-2 text-left">Status</th>
                <th className="px-2 py-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {questions.slice(0, 50).map((q) => (
                <tr key={q.id} className="border-t border-white/10">
                  <td className="px-2 py-2">{q.test_title}</td>
                  <td className="px-2 py-2">{q.question_text}</td>
                  <td className="px-2 py-2">{q.correct_option}</td>
                  <td className="px-2 py-2">{q.status}</td>
                  <td className="px-2 py-2">
                    <div className="flex gap-1">
                      <button type="button" className="admin-btn-soft" onClick={() => { setEditingQuestion(q); setQuestionForm({ test_id: String(q.test_id), question_text: q.question_text, option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d, correct_option: q.correct_option, explanation: q.explanation || '', status: q.status }); setShowQuestionModal(true); }}><PencilSimple size={14} /> Edit</button>
                      <button type="button" className="admin-btn-soft" onClick={() => deleteQuestion(q.id)}><Trash size={14} /> Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showTestModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4">
          <form onSubmit={handleTestSave} className="admin-glass w-full max-w-xl p-5">
            <h4 className="text-lg font-semibold">{editingTest ? 'Testni tahrirlash' : 'Yangi test'}</h4>
            <div className="mt-3 grid gap-3">
              <input className="admin-input" placeholder="Title" value={testForm.title} onChange={(e) => setTestForm((p) => ({ ...p, title: e.target.value }))} required />
              <input className="admin-input" placeholder="Category" value={testForm.category} onChange={(e) => setTestForm((p) => ({ ...p, category: e.target.value }))} required />
              <select className="admin-input" value={testForm.difficulty} onChange={(e) => setTestForm((p) => ({ ...p, difficulty: e.target.value }))}>
                <option value="easy">easy</option>
                <option value="medium">medium</option>
                <option value="hard">hard</option>
              </select>
              <select className="admin-input" value={testForm.status} onChange={(e) => setTestForm((p) => ({ ...p, status: e.target.value }))}>
                <option value="draft">draft</option>
                <option value="published">published</option>
                <option value="unpublished">unpublished</option>
              </select>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="admin-btn-soft" onClick={() => setShowTestModal(false)}>Bekor qilish</button>
              <button type="submit" className="admin-btn-primary">Saqlash</button>
            </div>
          </form>
        </div>
      )}

      {showQuestionModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4">
          <form onSubmit={handleQuestionSave} className="admin-glass w-full max-w-2xl p-5">
            <h4 className="text-lg font-semibold">{editingQuestion ? 'Savolni tahrirlash' : 'Yangi savol'}</h4>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <select className="admin-input md:col-span-2" value={questionForm.test_id} onChange={(e) => setQuestionForm((p) => ({ ...p, test_id: e.target.value }))} required>
                <option value="">Test tanlang</option>
                {tests.map((test) => <option key={test.id} value={test.id}>{test.title}</option>)}
              </select>
              <input className="admin-input md:col-span-2" placeholder="Savol matni" value={questionForm.question_text} onChange={(e) => setQuestionForm((p) => ({ ...p, question_text: e.target.value }))} required />
              <input className="admin-input" placeholder="Option A" value={questionForm.option_a} onChange={(e) => setQuestionForm((p) => ({ ...p, option_a: e.target.value }))} required />
              <input className="admin-input" placeholder="Option B" value={questionForm.option_b} onChange={(e) => setQuestionForm((p) => ({ ...p, option_b: e.target.value }))} required />
              <input className="admin-input" placeholder="Option C" value={questionForm.option_c} onChange={(e) => setQuestionForm((p) => ({ ...p, option_c: e.target.value }))} required />
              <input className="admin-input" placeholder="Option D" value={questionForm.option_d} onChange={(e) => setQuestionForm((p) => ({ ...p, option_d: e.target.value }))} required />
              <select className="admin-input" value={questionForm.correct_option} onChange={(e) => setQuestionForm((p) => ({ ...p, correct_option: e.target.value }))}>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
              </select>
              <select className="admin-input" value={questionForm.status} onChange={(e) => setQuestionForm((p) => ({ ...p, status: e.target.value }))}>
                <option value="draft">draft</option>
                <option value="published">published</option>
                <option value="unpublished">unpublished</option>
              </select>
              <textarea className="admin-input md:col-span-2" rows={3} placeholder="Explanation" value={questionForm.explanation} onChange={(e) => setQuestionForm((p) => ({ ...p, explanation: e.target.value }))} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="admin-btn-soft" onClick={() => setShowQuestionModal(false)}>Bekor qilish</button>
              <button type="submit" className="admin-btn-primary">Saqlash</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AdminTestsPage;
