import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Chart } from 'chart.js/auto';
import {
  ArrowClockwise,
  ChartBar,
  CursorClick,
  DownloadSimple,
  Eye,
  SignIn,
  Target,
  Users
} from '@phosphor-icons/react';
import adminApi from '../adminApi';
import { useToast } from '../components/ToastContext';

const formatNumber = (value) => new Intl.NumberFormat('en-US').format(value || 0);
const formatDateTime = (value) => (value ? new Date(value).toLocaleString() : '-');
const formatMetaSummary = (meta) => {
  if (!meta || typeof meta !== 'object') return '-';

  return Object.entries(meta)
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
    .join(' | ')
    .slice(0, 220);
};

const AdminDashboardPage = () => {
  const { pushToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const trafficRef = useRef(null);
  const dauRef = useRef(null);
  const catRef = useRef(null);
  const trafficChart = useRef(null);
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

    if (trafficChart.current) {
      trafficChart.current.destroy();
      trafficChart.current = null;
    }
    if (dauChart.current) {
      dauChart.current.destroy();
      dauChart.current = null;
    }
    if (catChart.current) {
      catChart.current.destroy();
      catChart.current = null;
    }

    if (trafficRef.current) {
      const labels = (data.traffic?.charts?.daily || []).map((item) => item.day.slice(5));
      const pageViews = (data.traffic?.charts?.daily || []).map((item) => item.page_views);
      const visitors = (data.traffic?.charts?.daily || []).map((item) => item.visitors);

      trafficChart.current = new Chart(trafficRef.current.getContext('2d'), {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Page views',
              data: pageViews,
              borderColor: 'rgba(34,197,94,0.95)',
              backgroundColor: 'rgba(34,197,94,0.16)',
              tension: 0.35,
              fill: true
            },
            {
              label: 'Visitors',
              data: visitors,
              borderColor: 'rgba(250,204,21,0.95)',
              backgroundColor: 'rgba(250,204,21,0.08)',
              tension: 0.35,
              fill: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#cbd5e1' } } },
          scales: {
            x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.2)' } },
            y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.2)' }, beginAtZero: true }
          }
        }
      });
    }

    if (dauRef.current) {
      const labels = data.charts.daily_active_users.map((item) => item.day.slice(5));
      const values = data.charts.daily_active_users.map((item) => item.users);

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
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#cbd5e1' } } },
          scales: {
            x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.2)' } },
            y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.2)' }, beginAtZero: true }
          }
        }
      });
    }

    if (catRef.current) {
      catChart.current = new Chart(catRef.current.getContext('2d'), {
        type: 'bar',
        data: {
          labels: data.charts.tests_by_category.map((item) => item.category),
          datasets: [{
            label: 'Tests completed',
            data: data.charts.tests_by_category.map((item) => item.count),
            backgroundColor: 'rgba(14,165,233,0.5)',
            borderColor: 'rgba(14,165,233,1)',
            borderWidth: 1,
            borderRadius: 10
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#cbd5e1' } } },
          scales: {
            x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.2)' } },
            y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.2)' }, beginAtZero: true }
          }
        }
      });
    }

    return () => {
      if (trafficChart.current) trafficChart.current.destroy();
      if (dauChart.current) dauChart.current.destroy();
      if (catChart.current) catChart.current.destroy();
    };
  }, [data]);

  const productCards = useMemo(() => {
    if (!data) return [];
    return [
      {
        label: 'Total users',
        value: formatNumber(data.kpi.total_users),
        icon: Users
      },
      {
        label: "Today's tests",
        value: formatNumber(data.kpi.todays_tests),
        icon: Target
      },
      {
        label: 'Avg accuracy',
        value: `${data.kpi.avg_accuracy || 0}%`,
        icon: ArrowClockwise
      },
      {
        label: 'Total downloads',
        value: formatNumber(data.kpi.total_downloads),
        icon: DownloadSimple
      }
    ];
  }, [data]);

  const trafficCards = useMemo(() => {
    const traffic = data?.traffic?.kpi;
    if (!traffic) return [];

    return [
      {
        label: '7d visitors',
        value: formatNumber(traffic.unique_visitors),
        icon: Users
      },
      {
        label: '7d page views',
        value: formatNumber(traffic.page_views),
        icon: Eye
      },
      {
        label: '7d sessions',
        value: formatNumber(traffic.sessions),
        icon: SignIn
      },
      {
        label: 'Tracked events',
        value: formatNumber(traffic.tracked_events),
        icon: CursorClick
      }
    ];
  }, [data]);

  const engagementCards = useMemo(() => {
    const traffic = data?.traffic?.kpi;
    if (!traffic) return [];

    return [
      {
        label: '7d exits',
        value: formatNumber(traffic.page_exits),
        icon: ArrowClockwise
      },
      {
        label: 'Outbound clicks',
        value: formatNumber(traffic.outbound_clicks),
        icon: CursorClick
      },
      {
        label: 'Download clicks',
        value: formatNumber(traffic.download_clicks),
        icon: DownloadSimple
      },
      {
        label: 'Client errors',
        value: formatNumber(traffic.errors),
        icon: Eye
      }
    ];
  }, [data]);

  const topSourceLabel = data?.traffic?.charts?.top_sources?.[0]?.label || 'direct / (none)';
  const topPages = data?.traffic?.charts?.top_pages || [];
  const topEvents = data?.traffic?.charts?.top_events || [];
  const topEventPaths = data?.traffic?.charts?.top_event_paths || [];
  const topSources = data?.traffic?.charts?.top_sources || [];
  const topReferrers = data?.traffic?.charts?.top_referrers || [];
  const recentTraffic = data?.traffic?.recent_events || [];

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Overview</h3>
          <p className="text-sm text-slate-400">Platform KPIs, traffic analytics and activity feed</p>
        </div>
        <button type="button" className="admin-btn-soft" onClick={fetchData} disabled={loading}>
          <ArrowClockwise size={16} className={loading ? 'animate-spin' : ''} />
          Yangilash
        </button>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {productCards.map((item) => {
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

      <section className="admin-glass p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-white">Traffic analytics (last 7 days)</h4>
            <p className="mt-1 text-sm text-slate-400">Route views, visitors, sessions and source attribution</p>
          </div>
          <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
            Top source: {topSourceLabel}
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {trafficCards.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.label} className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                <div className="flex items-center justify-between text-sm text-slate-300">
                  <span>{item.label}</span>
                  <Icon size={18} className="text-emerald-300" />
                </div>
                <p className="mt-3 text-2xl font-bold text-white">{item.value}</p>
              </article>
            );
          })}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {engagementCards.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.label} className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                <div className="flex items-center justify-between text-sm text-slate-300">
                  <span>{item.label}</span>
                  <Icon size={18} className="text-sky-300" />
                </div>
                <p className="mt-3 text-2xl font-bold text-white">{item.value}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <article className="admin-glass p-4">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
            <ChartBar size={16} className="text-emerald-300" />
            Traffic
          </h4>
          <div className="mt-3 h-72">
            <canvas ref={trafficRef} />
          </div>
        </article>

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

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="admin-glass p-4">
          <h4 className="text-sm font-semibold text-white">Top pages</h4>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="px-2 py-2 text-left">Path</th>
                  <th className="px-2 py-2 text-left">Views</th>
                  <th className="px-2 py-2 text-left">Visitors</th>
                </tr>
              </thead>
              <tbody>
                {topPages.map((item) => (
                  <tr key={item.path} className="border-t border-white/10">
                    <td className="px-2 py-2 text-slate-200">{item.path}</td>
                    <td className="px-2 py-2 text-slate-100">{formatNumber(item.views)}</td>
                    <td className="px-2 py-2 text-slate-300">{formatNumber(item.visitors)}</td>
                  </tr>
                ))}
                {topPages.length === 0 && (
                  <tr>
                    <td colSpan="3" className="px-2 py-3 text-slate-400">Hali traffic eventlar yo&apos;q.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-5">
            <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Top custom events</h5>
            <div className="mt-3 space-y-2">
              {topEvents.length > 0 ? topEvents.map((item) => (
                <div key={item.event_name} className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/30 px-3 py-2 text-sm">
                  <span className="text-slate-200">{item.event_name}</span>
                  <span className="font-semibold text-white">{formatNumber(item.count)}</span>
                </div>
              )) : (
                <p className="text-sm text-slate-400">Custom eventlar hali yozilmagan.</p>
              )}
            </div>
          </div>

          <div className="mt-5">
            <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Top event paths</h5>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-slate-400">
                  <tr>
                    <th className="px-2 py-2 text-left">Path</th>
                    <th className="px-2 py-2 text-left">Event</th>
                    <th className="px-2 py-2 text-left">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {topEventPaths.map((item, index) => (
                    <tr key={`${item.path}-${item.event_name}-${index}`} className="border-t border-white/10">
                      <td className="px-2 py-2 text-slate-200">{item.path}</td>
                      <td className="px-2 py-2 text-slate-100">{item.event_name}</td>
                      <td className="px-2 py-2 text-slate-300">{formatNumber(item.count)}</td>
                    </tr>
                  ))}
                  {topEventPaths.length === 0 && (
                    <tr>
                      <td colSpan="3" className="px-2 py-3 text-slate-400">Path-level event data hali yo&apos;q.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </article>

        <article className="admin-glass p-4">
          <h4 className="text-sm font-semibold text-white">Traffic sources</h4>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="px-2 py-2 text-left">Source / Medium</th>
                  <th className="px-2 py-2 text-left">Views</th>
                </tr>
              </thead>
              <tbody>
                {topSources.map((item) => (
                  <tr key={item.label} className="border-t border-white/10">
                    <td className="px-2 py-2 text-slate-200">{item.label}</td>
                    <td className="px-2 py-2 text-slate-100">{formatNumber(item.visits)}</td>
                  </tr>
                ))}
                {topSources.length === 0 && (
                  <tr>
                    <td colSpan="2" className="px-2 py-3 text-slate-400">Source ma&apos;lumotlari hali yo&apos;q.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-5">
            <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Top referrers</h5>
            <div className="mt-3 space-y-2">
              {topReferrers.length > 0 ? topReferrers.map((item) => (
                <div key={item.referrer} className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/30 px-3 py-2 text-sm">
                  <span className="truncate pr-4 text-slate-200">{item.referrer}</span>
                  <span className="shrink-0 font-semibold text-white">{formatNumber(item.views)}</span>
                </div>
              )) : (
                <p className="text-sm text-slate-400">Referrer ma&apos;lumotlari hali yo&apos;q.</p>
              )}
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="admin-glass p-4">
          <h4 className="text-sm font-semibold text-white">Recent traffic events</h4>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="px-2 py-2 text-left">Vaqt</th>
                  <th className="px-2 py-2 text-left">Event</th>
                  <th className="px-2 py-2 text-left">Path</th>
                  <th className="px-2 py-2 text-left">Source</th>
                  <th className="px-2 py-2 text-left">Meta</th>
                </tr>
              </thead>
              <tbody>
                {recentTraffic.map((item, index) => (
                  <tr key={`${item.created_at}-${item.event_name}-${index}`} className="border-t border-white/10">
                    <td className="px-2 py-2 text-slate-300">{formatDateTime(item.created_at)}</td>
                    <td className="px-2 py-2 text-slate-100">{item.event_name}</td>
                    <td className="px-2 py-2 text-slate-200">{item.path}</td>
                    <td className="px-2 py-2 text-slate-300">{item.source} / {item.medium}</td>
                    <td className="px-2 py-2 text-slate-400">{formatMetaSummary(item.meta)}</td>
                  </tr>
                ))}
                {recentTraffic.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-2 py-3 text-slate-400">Traffic eventlar hali kelmagan.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="admin-glass p-4">
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
                    <td className="px-2 py-2 text-slate-300">{formatDateTime(item.created_at)}</td>
                    <td className="px-2 py-2 text-slate-200">{item.admin_name || item.admin_email || '-'}</td>
                    <td className="px-2 py-2 text-slate-100">{item.action}</td>
                    <td className="px-2 py-2 text-slate-300">{item.entity_type} {item.entity_id || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </div>
  );
};

export default AdminDashboardPage;
