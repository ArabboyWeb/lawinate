import React, { useContext, useState } from 'react';
import { FloppyDisk, Plus } from '@phosphor-icons/react';
import adminApi from '../adminApi';
import { useToast } from '../components/ToastContext';
import { AdminAuthContext } from '../AdminAuthContext';

const emptyAdminForm = {
  full_name: '',
  email: '',
  password: '',
  role: 'moderator',
};

const AdminSettingsPage = () => {
  const { admin } = useContext(AdminAuthContext);
  const { pushToast } = useToast();

  const [settings, setSettings] = useState({
    site_name: 'Lawinate.uz',
    maintenance_mode: false,
    allow_registration: true,
  });
  const [admins, setAdmins] = useState([]);
  const [adminForm, setAdminForm] = useState(emptyAdminForm);

  const loadData = async () => {
    try {
      const [settingsRes, adminsRes] = await Promise.all([
        adminApi.get('/api/admin/settings'),
        adminApi.get('/api/admin/settings/admins'),
      ]);
      setSettings(settingsRes.data.settings || settings);
      setAdmins(adminsRes.data.admins || []);
    } catch (err) {
      pushToast(err.response?.data?.error || 'Settings yuklanmadi', 'error');
    }
  };

  React.useEffect(() => {
    loadData();
  }, []);

  const saveSettings = async () => {
    try {
      await adminApi.put('/api/admin/settings', settings);
      pushToast('Site settings saqlandi', 'success');
      loadData();
    } catch (err) {
      pushToast(err.response?.data?.error || 'Settings saqlanmadi', 'error');
    }
  };

  const addAdmin = async (event) => {
    event.preventDefault();
    try {
      await adminApi.post('/api/admin/settings/admins', adminForm);
      pushToast('Admin/moderator yaratildi', 'success');
      setAdminForm(emptyAdminForm);
      loadData();
    } catch (err) {
      pushToast(err.response?.data?.error || 'Admin yaratilmadi', 'error');
    }
  };

  const removeAdmin = async (id) => {
    try {
      await adminApi.delete(`/api/admin/settings/admins/${id}`);
      pushToast('Admin roli olib tashlandi', 'success');
      loadData();
    } catch (err) {
      pushToast(err.response?.data?.error || 'Admin olib tashlanmadi', 'error');
    }
  };

  return (
    <div className="grid gap-6">
      <section className="admin-glass p-4">
        <h3 className="text-base font-semibold">Site Settings</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Site name</label>
            <input className="admin-input" value={settings.site_name} onChange={(e) => setSettings((p) => ({ ...p, site_name: e.target.value }))} />
          </div>
          <div className="grid gap-2 pt-2 text-sm text-slate-300">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={!!settings.maintenance_mode} onChange={(e) => setSettings((p) => ({ ...p, maintenance_mode: e.target.checked }))} />
              Maintenance mode
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={!!settings.allow_registration} onChange={(e) => setSettings((p) => ({ ...p, allow_registration: e.target.checked }))} />
              Allow registration
            </label>
          </div>
        </div>
        <div className="mt-3">
          <button type="button" className="admin-btn-primary" onClick={saveSettings}><FloppyDisk size={16} /> Save settings</button>
        </div>
      </section>

      <section className="admin-glass p-4">
        <h3 className="text-base font-semibold">Admin List</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="px-2 py-2 text-left">Full name</th>
                <th className="px-2 py-2 text-left">Email</th>
                <th className="px-2 py-2 text-left">Role</th>
                <th className="px-2 py-2 text-left">Last login</th>
                <th className="px-2 py-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((item) => (
                <tr key={item.id} className="border-t border-white/10">
                  <td className="px-2 py-2">{item.full_name}</td>
                  <td className="px-2 py-2">{item.email}</td>
                  <td className="px-2 py-2">{item.role}</td>
                  <td className="px-2 py-2">{item.last_login_at ? new Date(item.last_login_at).toLocaleString() : '-'}</td>
                  <td className="px-2 py-2">
                    {admin?.role === 'admin' && admin.id !== item.id ? (
                      <button type="button" className="admin-btn-soft" onClick={() => removeAdmin(item.id)}>Demote to student</button>
                    ) : (
                      <span className="text-xs text-slate-500">No action</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {admin?.role === 'admin' && (
        <section className="admin-glass p-4">
          <h3 className="text-base font-semibold">Add Admin / Moderator</h3>
          <form onSubmit={addAdmin} className="mt-3 grid gap-3 md:grid-cols-2">
            <input className="admin-input" placeholder="Full name" value={adminForm.full_name} onChange={(e) => setAdminForm((p) => ({ ...p, full_name: e.target.value }))} required />
            <input className="admin-input" placeholder="Email" type="email" value={adminForm.email} onChange={(e) => setAdminForm((p) => ({ ...p, email: e.target.value }))} required />
            <input className="admin-input" placeholder="Password" type="password" value={adminForm.password} onChange={(e) => setAdminForm((p) => ({ ...p, password: e.target.value }))} required />
            <select className="admin-input" value={adminForm.role} onChange={(e) => setAdminForm((p) => ({ ...p, role: e.target.value }))}>
              <option value="moderator">moderator</option>
              <option value="admin">admin</option>
            </select>
            <button type="submit" className="admin-btn-primary md:col-span-2"><Plus size={16} /> Add admin</button>
          </form>
        </section>
      )}
    </div>
  );
};

export default AdminSettingsPage;
