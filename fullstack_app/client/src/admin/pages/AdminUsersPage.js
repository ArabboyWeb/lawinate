import React, { useContext, useState } from 'react';
import { Eye, Shield, UserSwitch } from '@phosphor-icons/react';
import adminApi from '../adminApi';
import { useToast } from '../components/ToastContext';
import { AdminAuthContext } from '../AdminAuthContext';

const AdminUsersPage = () => {
  const { admin } = useContext(AdminAuthContext);
  const { pushToast } = useToast();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [details, setDetails] = useState(null);

  const loadUsers = async () => {
    try {
      const res = await adminApi.get('/api/admin/users', { params: { search } });
      setUsers(res.data.users || []);
    } catch (err) {
      pushToast(err.response?.data?.error || 'Users yuklanmadi', 'error');
    }
  };

  React.useEffect(() => {
    loadUsers();
  }, []);

  const viewDetails = async (user) => {
    try {
      const res = await adminApi.get(`/api/admin/users/${user.id}`);
      setSelected(user);
      setDetails(res.data);
    } catch (err) {
      pushToast(err.response?.data?.error || 'Profil ochilmadi', 'error');
    }
  };

  const toggleBan = async (user) => {
    try {
      await adminApi.patch(`/api/admin/users/${user.id}/ban`, { banned: !user.is_banned });
      pushToast(user.is_banned ? 'User unblock qilindi' : 'User block qilindi', 'success');
      loadUsers();
      if (selected?.id === user.id) viewDetails(user);
    } catch (err) {
      pushToast(err.response?.data?.error || 'Ban status ozgarmadi', 'error');
    }
  };

  const changeRole = async (user, role) => {
    try {
      await adminApi.patch(`/api/admin/users/${user.id}/role`, { role });
      pushToast('Rol yangilandi', 'success');
      loadUsers();
      if (selected?.id === user.id) viewDetails(user);
    } catch (err) {
      pushToast(err.response?.data?.error || 'Rol yangilanmadi', 'error');
    }
  };

  return (
    <div className="grid gap-6">
      <section className="admin-glass p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold">Users Management</h3>
          <div className="flex gap-2">
            <input className="admin-input" placeholder="Name/email/university" value={search} onChange={(e) => setSearch(e.target.value)} />
            <button type="button" className="admin-btn-primary" onClick={loadUsers}>Search</button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="px-2 py-2 text-left">Ism</th>
                <th className="px-2 py-2 text-left">Email</th>
                <th className="px-2 py-2 text-left">University</th>
                <th className="px-2 py-2 text-left">Role</th>
                <th className="px-2 py-2 text-left">Ball</th>
                <th className="px-2 py-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-white/10">
                  <td className="px-2 py-2">{user.full_name}</td>
                  <td className="px-2 py-2">{user.email}</td>
                  <td className="px-2 py-2">{user.university || '-'}</td>
                  <td className="px-2 py-2">{user.role}</td>
                  <td className="px-2 py-2">{user.points}</td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-1">
                      <button type="button" className="admin-btn-soft" onClick={() => viewDetails(user)}><Eye size={14} /> Profile</button>
                      <button type="button" className="admin-btn-soft" onClick={() => toggleBan(user)}><Shield size={14} /> {user.is_banned ? 'Unban' : 'Ban'}</button>
                      {admin?.role === 'admin' && (
                        <select className="admin-input !w-auto" value={user.role} onChange={(e) => changeRole(user, e.target.value)}>
                          <option value="student">student</option>
                          <option value="moderator">moderator</option>
                          <option value="admin">admin</option>
                        </select>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {details && (
        <section className="admin-glass p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold">User profile: {details.user.full_name}</h4>
            <button type="button" className="admin-btn-soft" onClick={() => { setSelected(null); setDetails(null); }}>Yopish</button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
              <p><b>Email:</b> {details.user.email}</p>
              <p><b>Role:</b> {details.user.role}</p>
              <p><b>Ball:</b> {details.user.points}</p>
              <p><b>Testlar:</b> {details.user.total_tests}</p>
              <p><b>Aniqlik:</b> {details.user.accuracy}%</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
              <p className="mb-2 font-semibold">So'nggi natijalar</p>
              <div className="max-h-52 overflow-y-auto">
                {(details.history || []).slice(0, 8).map((item) => (
                  <div key={`${item.id}-${item.date}`} className="mb-2 rounded-xl border border-white/10 px-3 py-2">
                    <div className="text-slate-200">{item.test_title || item.category}</div>
                    <div className="text-xs text-slate-400">{item.correct}/{item.total} | {item.score}% | {new Date(item.date).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="mb-2 text-sm font-semibold">Ogohlantirishlar</p>
            {(details.warnings || []).length === 0 ? (
              <p className="text-sm text-slate-400">Warning yo'q</p>
            ) : (
              <div className="grid gap-2">
                {details.warnings.map((w) => (
                  <div key={w.id} className="rounded-xl border border-white/10 px-3 py-2 text-sm">
                    <p>{w.message}</p>
                    <p className="text-xs text-slate-400">{w.admin_name} | {new Date(w.created_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};

export default AdminUsersPage;
