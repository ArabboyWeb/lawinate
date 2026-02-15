import React, { useState } from 'react';
import { PencilSimple, Plus, Star, StarHalf } from '@phosphor-icons/react';
import adminApi from '../adminApi';
import { useToast } from '../components/ToastContext';

const emptyForm = {
  title: '',
  author: '',
  category: '',
  file_url: '',
  cover_url: '',
  status: 'published',
  featured: false,
};

const AdminLibraryPage = () => {
  const { pushToast } = useToast();
  const [books, setBooks] = useState([]);
  const [filters, setFilters] = useState({ search: '', category: '' });
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadBooks = async () => {
    try {
      const res = await adminApi.get('/api/admin/library/books', { params: filters });
      setBooks(res.data.books || []);
    } catch (err) {
      pushToast(err.response?.data?.error || 'Kitoblar yuklanmadi', 'error');
    }
  };

  React.useEffect(() => {
    loadBooks();
  }, []);

  const saveBook = async (event) => {
    event.preventDefault();
    try {
      if (editing) {
        await adminApi.put(`/api/admin/library/books/${editing.id}`, form);
        pushToast('Kitob yangilandi', 'success');
      } else {
        await adminApi.post('/api/admin/library/books', form);
        pushToast('Kitob yaratildi', 'success');
      }
      setShowModal(false);
      setEditing(null);
      setForm(emptyForm);
      loadBooks();
    } catch (err) {
      pushToast(err.response?.data?.error || 'Kitob saqlanmadi', 'error');
    }
  };

  const toggleFeatured = async (book) => {
    try {
      await adminApi.patch(`/api/admin/library/books/${book.id}/featured`, { featured: !book.featured });
      pushToast('Featured holati yangilandi', 'success');
      loadBooks();
    } catch (err) {
      pushToast(err.response?.data?.error || 'Featured yangilanmadi', 'error');
    }
  };

  return (
    <div className="grid gap-6">
      <section className="admin-glass p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold">Library Management</h3>
          <button type="button" className="admin-btn-primary" onClick={() => { setEditing(null); setForm(emptyForm); setShowModal(true); }}>
            <Plus size={16} /> Kitob qo'shish
          </button>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-3">
          <input className="admin-input" placeholder="Qidiruv" value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} />
          <input className="admin-input" placeholder="Kategoriya" value={filters.category} onChange={(e) => setFilters((p) => ({ ...p, category: e.target.value }))} />
          <button type="button" className="admin-btn-primary" onClick={loadBooks}>Apply</button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="px-2 py-2 text-left">Title</th>
                <th className="px-2 py-2 text-left">Author</th>
                <th className="px-2 py-2 text-left">Category</th>
                <th className="px-2 py-2 text-left">Downloads</th>
                <th className="px-2 py-2 text-left">Featured</th>
                <th className="px-2 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {books.map((book) => (
                <tr key={book.id} className="border-t border-white/10">
                  <td className="px-2 py-2">{book.title}</td>
                  <td className="px-2 py-2">{book.author}</td>
                  <td className="px-2 py-2">{book.category}</td>
                  <td className="px-2 py-2">{book.downloads}</td>
                  <td className="px-2 py-2">
                    <button type="button" className="admin-btn-soft" onClick={() => toggleFeatured(book)}>
                      {book.featured ? <Star size={14} /> : <StarHalf size={14} />}
                      {book.featured ? 'Yes' : 'No'}
                    </button>
                  </td>
                  <td className="px-2 py-2">
                    <button type="button" className="admin-btn-soft" onClick={() => { setEditing(book); setForm({ title: book.title, author: book.author, category: book.category, file_url: book.file_url, cover_url: book.cover_url || '', status: book.status, featured: !!book.featured }); setShowModal(true); }}>
                      <PencilSimple size={14} /> Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4">
          <form onSubmit={saveBook} className="admin-glass w-full max-w-xl p-5">
            <h4 className="text-lg font-semibold">{editing ? 'Kitobni tahrirlash' : 'Yangi kitob'}</h4>
            <div className="mt-3 grid gap-3">
              <input className="admin-input" placeholder="Title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required />
              <input className="admin-input" placeholder="Author" value={form.author} onChange={(e) => setForm((p) => ({ ...p, author: e.target.value }))} required />
              <input className="admin-input" placeholder="Category" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} required />
              <input className="admin-input" placeholder="File/Link" value={form.file_url} onChange={(e) => setForm((p) => ({ ...p, file_url: e.target.value }))} required />
              <input className="admin-input" placeholder="Cover URL" value={form.cover_url} onChange={(e) => setForm((p) => ({ ...p, cover_url: e.target.value }))} />
              <select className="admin-input" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                <option value="published">published</option>
                <option value="draft">draft</option>
                <option value="archived">archived</option>
              </select>
              <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={form.featured} onChange={(e) => setForm((p) => ({ ...p, featured: e.target.checked }))} />
                Featured
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="admin-btn-soft" onClick={() => setShowModal(false)}>Bekor</button>
              <button type="submit" className="admin-btn-primary">Saqlash</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AdminLibraryPage;
