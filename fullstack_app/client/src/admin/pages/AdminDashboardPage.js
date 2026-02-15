import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Chart } from 'chart.js/auto';
import { ArrowClockwise, DownloadSimple, Target, Users } from '@phosphor-icons/react';
import adminApi from '../adminApi';
import { useToast } from '../components/ToastContext';

const formatNumber = (value) => new Intl.NumberFormat('en-US').format(value || 0);

const AdminDashboardPage = () => {
  const { pushToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const dauRef = useRef(null);
  const catRef = useRef(null);
  const dauChart = useRef(null);
  const catChart = useRef(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await adminApi.get('/api/admin/dashboard/overview');
      setData(res.data);
    } catch (err) {
      pushToast(err.response?.data?.error || 'Dashboard yuklanmadi', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!data) return;

    if (dauChart.current) {
      dauChart.current.destroy();
      dauChart.current = null;
    }
    if (catChart.current) {
      catChart.current.destroy();
      catChart.current = null;
    }

    if (dauRef.current) {
      const labels = data.charts.daily_active_users.map((i) => i.day.slice(5));
      const values = data.charts.daily_active_users.map((i) => i.users);

      dauChart.current = new Chart(dauRef.current.getContext('2d'), {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Daily Active Users',
            data: values,
            borderColor: 'rgba(56,189,248,0.95)',
            backgroundColor: 'rgba(56,189,248,0.2)',
            tension: 0.3,
            fill: true,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#cbd5e1' } } },
          scales: {
            x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.2)' } },
            y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.2)' }, beginAtZero: true },
          },
        },
      });
    }

    if (catRef.current) {
      catChart.current = new Chart(catRef.current.getContext('2d'), {
        type: 'bar',
        data: {
          labels: data.charts.tests_by_category.map((i) => i.category),
          datasets: [{
            label: 'Tests completed',
            data: data.charts.tests_by_category.map((i) => i.count),
            backgroundColor: 'rgba(14,165,233,0.5)',
            borderColor: 'rgba(14,165,233,1)',
            borderWidth: 1,
            borderRadius: 10,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#cbd5e1' } } },
          scales: {
            x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.2)' } },
            y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.2)' }, beginAtZero: true },
          },
        },
      });
    }

    return () => {
      if (dauChart.current) dauChart.current.destroy();
      if (catChart.current) catChart.current.destroy();
    };
  }, [data]);

  const cards = useMemo(() => {
    if (!data) return [];
    return [
      {
        label: 'Total users',
        value: formatNumber(data.kpi.total_users),
        icon: Users,
      },
      {
        label: "Today's tests",
        value: formatNumber(data.kpi.todays_tests),
        icon: Target,
      },
      {
        label: 'Avg accuracy',
        value: `${data.kpi.avg_accuracy || 0}%`,
        icon: ArrowClockwise,
      },
      {
        label: 'Total downloads',
        value: formatNumber(data.kpi.total_downloads),
        icon: DownloadSimple,
      },
    ];
  }, [data]);

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Overview</h3>
          <p className="text-sm text-slate-400">Platform KPIs, charts and activity feed</p>
        </div>
        <button type="button" className="admin-btn-soft" onClick={fetchData} disabled={loading}>
          <ArrowClockwise size={16} className={loading ? 'animate-spin' : ''} />
          Yangilash
        </button>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className="admin-glass p-4">
              <div className="flex items-center justify-between text-sm text-slate-300">
                <span>{item.label}</span>
                <Icon size={18} className="text-sky-300" />
              </div>
              <p className="mt-3 text-2xl font-bold text-white">{item.value}</p>
            </article>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="admin-glass p-4">
          <h4 className="text-sm font-semibold text-white">Daily active users</h4>
          <div className="mt-3 h-72">
            <canvas ref={dauRef} />
          </div>
        </article>

        <article className="admin-glass p-4">
          <h4 className="text-sm font-semibold text-white">Tests by category</h4>
          <div className="mt-3 h-72">
            <canvas ref={catRef} />
          </div>
        </article>
      </section>

      <section className="admin-glass p-4">
        <h4 className="text-sm font-semibold text-white">Recent admin activity (last 20)</h4>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="px-2 py-2 text-left">Vaqt</th>
                <th className="px-2 py-2 text-left">Admin</th>
                <th className="px-2 py-2 text-left">Action</th>
                <th className="px-2 py-2 text-left">Entity</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recent_activity || []).map((item) => (
                <tr key={item.id} className="border-t border-white/10">
                  <td className="px-2 py-2 text-slate-300">{new Date(item.created_at).toLocaleString()}</td>
                  <td className="px-2 py-2 text-slate-200">{item.admin_name || item.admin_email || '-'}</td>
                  <td className="px-2 py-2 text-slate-100">{item.action}</td>
                  <td className="px-2 py-2 text-slate-300">{item.entity_type} {item.entity_id || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default AdminDashboardPage;
