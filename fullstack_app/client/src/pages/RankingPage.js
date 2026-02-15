import React, { useEffect, useMemo, useState } from 'react';
import { Crown, MagnifyingGlass, Trophy } from '@phosphor-icons/react';
import api from '../api';

const RankingPage = () => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    api
      .get('/api/ranking')
      .then((res) => setList(res.data.ranking || []))
      .catch((err) => setError(err.response?.data?.error || 'Reytingni olishda xatolik'))
      .finally(() => setLoading(false));
  }, []);

  const filteredList = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return list;
    return list.filter((item) => String(item.name || '').toLowerCase().includes(query));
  }, [list, search]);

  const topThree = useMemo(() => filteredList.slice(0, 3), [filteredList]);

  return (
    <div className="site-container page-stack">
      <section className="glass-card card-pad">
        <h1 className="section-title">Live Reyting</h1>
        <p className="subtle" style={{ marginTop: 8 }}>
          Test natijalari bo'yicha eng yaxshi foydalanuvchilar.
        </p>
        <div className="form-group" style={{ marginTop: 14 }}>
          <label htmlFor="ranking-search">Foydalanuvchi qidirish</label>
          <div style={{ position: 'relative' }}>
            <MagnifyingGlass
              size={18}
              weight="bold"
              color="var(--text-muted)"
              style={{ position: 'absolute', left: 10, top: 12 }}
            />
            <input
              id="ranking-search"
              className="input"
              style={{ paddingLeft: 36 }}
              placeholder="Ism bo'yicha qidiring"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
      </section>

      {topThree.length > 0 && (
        <section className="grid cols-3">
          {topThree.map((item, index) => (
            <article key={item.rank} className="feature-card" style={{ textAlign: 'center' }}>
              <div className="icon-badge blue" style={{ margin: '0 auto 10px' }}>
                {index === 0 ? <Crown size={24} weight="fill" /> : <Trophy size={24} weight="fill" />}
              </div>
              <h3 style={{ margin: 0 }}>#{item.rank} {item.name}</h3>
              <p className="subtle" style={{ marginTop: 8 }}>{item.city || '-'}</p>
              <p className="subtle" style={{ marginTop: 4 }}>Aniqlik: {item.accuracy}%</p>
              <p className="subtle" style={{ marginTop: 4 }}>Ball: {item.points}</p>
            </article>
          ))}
        </section>
      )}

      <section className="glass-card card-pad">
        {loading ? (
          <p>Yuklanmoqda...</p>
        ) : error ? (
          <p className="notice error">{error}</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Ism</th>
                  <th>Shahar</th>
                  <th>Testlar</th>
                  <th>Aniqlik %</th>
                  <th>Ballar</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.length === 0 && (
                  <tr>
                    <td colSpan={6} className="subtle">Mos foydalanuvchi topilmadi.</td>
                  </tr>
                )}
                {filteredList.map((user) => (
                  <tr key={user.rank}>
                    <td>{user.rank}</td>
                    <td>{user.name}</td>
                    <td>{user.city || '-'}</td>
                    <td>{user.tests}</td>
                    <td>{user.accuracy}</td>
                    <td>{user.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default RankingPage;
