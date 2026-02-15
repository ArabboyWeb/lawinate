import React, { useState } from 'react';
import { FlagBanner, PushPin, Trash, WarningCircle } from '@phosphor-icons/react';
import adminApi from '../adminApi';
import { useToast } from '../components/ToastContext';

const AdminCommunityPage = () => {
  const { pushToast } = useToast();
  const [posts, setPosts] = useState([]);
  const [comments, setComments] = useState([]);
  const [reports, setReports] = useState([]);
  const [search, setSearch] = useState('');

  const loadData = async () => {
    try {
      const [p, c, r] = await Promise.all([
        adminApi.get('/api/admin/community/posts', { params: { search } }),
        adminApi.get('/api/admin/community/comments', { params: { search } }),
        adminApi.get('/api/admin/community/reports'),
      ]);
      setPosts(p.data.posts || []);
      setComments(c.data.comments || []);
      setReports(r.data.reports || []);
    } catch (err) {
      pushToast(err.response?.data?.error || 'Community ma\'lumotlari yuklanmadi', 'error');
    }
  };

  React.useEffect(() => {
    loadData();
  }, []);

  const postAction = async (id, action) => {
    try {
      await adminApi.patch(`/api/admin/community/posts/${id}/action`, { action });
      pushToast(`Post action: ${action}`, 'success');
      loadData();
    } catch (err) {
      pushToast(err.response?.data?.error || 'Post action bajarilmadi', 'error');
    }
  };

  const commentAction = async (id, action) => {
    try {
      await adminApi.patch(`/api/admin/community/comments/${id}/action`, { action });
      pushToast(`Comment action: ${action}`, 'success');
      loadData();
    } catch (err) {
      pushToast(err.response?.data?.error || 'Comment action bajarilmadi', 'error');
    }
  };

  const warnUser = async (userId) => {
    const message = window.prompt('Warning matni:');
    if (!message) return;

    try {
      await adminApi.post('/api/admin/community/warn', {
        user_id: userId,
        message,
      });
      pushToast('Foydalanuvchiga ogohlantirish yuborildi', 'success');
    } catch (err) {
      pushToast(err.response?.data?.error || 'Warning yuborilmadi', 'error');
    }
  };

  const changeReportStatus = async (id, status) => {
    try {
      await adminApi.patch(`/api/admin/community/reports/${id}/status`, { status });
      pushToast('Report status yangilandi', 'success');
      loadData();
    } catch (err) {
      pushToast(err.response?.data?.error || 'Report status yangilanmadi', 'error');
    }
  };

  return (
    <div className="grid gap-6">
      <section className="admin-glass p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold">Community Moderation</h3>
          <div className="flex gap-2">
            <input className="admin-input" placeholder="Search posts/comments" value={search} onChange={(e) => setSearch(e.target.value)} />
            <button type="button" className="admin-btn-primary" onClick={loadData}>Search</button>
          </div>
        </div>
      </section>

      <section className="admin-glass p-4">
        <h4 className="text-sm font-semibold">Posts</h4>
        <div className="mt-3 grid gap-3">
          {posts.slice(0, 20).map((post) => (
            <article key={post.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-100">{post.title || 'No title'}</p>
                  <p className="text-xs text-slate-400">by {post.user_name} | {new Date(post.created_at).toLocaleString()}</p>
                  <p className="mt-2 text-sm text-slate-300">{post.content}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <button type="button" className="admin-btn-soft" onClick={() => postAction(post.id, post.is_pinned ? 'unpin' : 'pin')}><PushPin size={14} /> {post.is_pinned ? 'Unpin' : 'Pin'}</button>
                  <button type="button" className="admin-btn-soft" onClick={() => postAction(post.id, 'hide')}><FlagBanner size={14} /> Hide</button>
                  <button type="button" className="admin-btn-soft" onClick={() => postAction(post.id, 'delete')}><Trash size={14} /> Delete</button>
                  <button type="button" className="admin-btn-soft" onClick={() => warnUser(post.user_id)}><WarningCircle size={14} /> Warn</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-glass p-4">
        <h4 className="text-sm font-semibold">Comments</h4>
        <div className="mt-3 grid gap-3">
          {comments.slice(0, 20).map((comment) => (
            <article key={comment.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-sm text-slate-200">{comment.content}</p>
              <p className="mt-1 text-xs text-slate-400">{comment.user_name} | post: {comment.post_title || '-'} | {new Date(comment.created_at).toLocaleString()}</p>
              <div className="mt-2 flex gap-2">
                <button type="button" className="admin-btn-soft" onClick={() => commentAction(comment.id, 'hide')}>Hide</button>
                <button type="button" className="admin-btn-soft" onClick={() => commentAction(comment.id, 'unhide')}>Unhide</button>
                <button type="button" className="admin-btn-soft" onClick={() => commentAction(comment.id, 'delete')}>Delete</button>
                <button type="button" className="admin-btn-soft" onClick={() => warnUser(comment.user_id)}>Warn user</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-glass p-4">
        <h4 className="text-sm font-semibold">Reports queue</h4>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="px-2 py-2 text-left">Type</th>
                <th className="px-2 py-2 text-left">Reason</th>
                <th className="px-2 py-2 text-left">Reporter</th>
                <th className="px-2 py-2 text-left">Status</th>
                <th className="px-2 py-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id} className="border-t border-white/10">
                  <td className="px-2 py-2">{report.item_type} #{report.item_id}</td>
                  <td className="px-2 py-2">{report.reason}</td>
                  <td className="px-2 py-2">{report.reporter_name || '-'}</td>
                  <td className="px-2 py-2">{report.status}</td>
                  <td className="px-2 py-2">
                    <div className="flex gap-2">
                      <button type="button" className="admin-btn-soft" onClick={() => changeReportStatus(report.id, 'in_review')}>In review</button>
                      <button type="button" className="admin-btn-soft" onClick={() => changeReportStatus(report.id, 'resolved')}>Resolve</button>
                      <button type="button" className="admin-btn-soft" onClick={() => changeReportStatus(report.id, 'dismissed')}>Dismiss</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default AdminCommunityPage;
