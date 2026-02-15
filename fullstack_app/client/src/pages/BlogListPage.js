import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MagnifyingGlass, NotePencil, UserCircle } from '@phosphor-icons/react';
import api from '../api';
import { AuthContext } from '../contexts/AuthContext';

const BLOG_CATEGORIES = [
  { key: '', title: 'Barchasi' },
  { key: 'jinoyat', title: 'Jinoyat huquqi' },
  { key: 'fuqarolik', title: 'Fuqarolik huquqi' },
  { key: 'konstitutsiya', title: 'Konstitutsiya' },
  { key: 'mehnat', title: 'Mehnat huquqi' },
  { key: 'xalqaro', title: 'Xalqaro huquq' },
  { key: 'talim', title: "Ta'lim" },
];

const BlogListPage = () => {
  const { user } = useContext(AuthContext);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');

  const fetchPosts = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/blog/posts', {
        params: {
          q: query.trim(),
          category,
          limit: 30,
          offset: 0,
        },
      });
      setPosts(res.data?.posts || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Postlarni yuklashda xatolik');
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [category]);

  const emptyText = useMemo(() => {
    if (loading) return 'Yuklanmoqda...';
    if (query.trim() || category) return "Filtr bo'yicha post topilmadi.";
    return "Hali postlar yo'q.";
  }, [loading, query, category]);

  return (
    <main className="site-container page-stack">
      <section className="glass-card card-pad blog-list-head">
        <div>
          <h1 className="section-title">Lawinate Blog</h1>
          <p className="subtle" style={{ marginTop: 8 }}>
            Yuridik mavzulardagi postlarni o&apos;qing va tajribangizni ulashing.
          </p>
        </div>
        <div className="actions">
          {user ? (
            <Link to="/blog/create" className="btn btn-primary">
              <NotePencil size={16} weight="bold" /> Post yaratish
            </Link>
          ) : (
            <Link to="/auth" className="btn btn-soft">Post yozish uchun kirish</Link>
          )}
        </div>
      </section>

      <section className="glass-card card-pad">
        <form
          className="blog-list-filter"
          onSubmit={(event) => {
            event.preventDefault();
            fetchPosts();
          }}
        >
          <div className="form-group">
            <label htmlFor="blog-category">Kategoriya</label>
            <select
              id="blog-category"
              className="select"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {BLOG_CATEGORIES.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.title}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group blog-query-group">
            <label htmlFor="blog-query">Qidiruv</label>
            <div className="blog-query-row">
              <div className="blog-query-wrap">
                <MagnifyingGlass size={18} weight="bold" color="var(--text-muted)" className="blog-query-icon" />
                <input
                  id="blog-query"
                  className="input"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Sarlavha, tag yoki muallif bo'yicha qidiring"
                  style={{ paddingLeft: 36 }}
                />
              </div>
              <button type="submit" className="btn btn-primary">Qidirish</button>
            </div>
          </div>
        </form>
        {error && <p className="notice error" style={{ marginTop: 10 }}>{error}</p>}
      </section>

      <section className="blog-card-grid">
        {posts.length === 0 ? (
          <article className="glass-card card-pad">{emptyText}</article>
        ) : (
          posts.map((post) => (
            <article key={post.id} className="blog-card">
              {post.cover_image ? (
                <img src={post.cover_image} alt={post.title} className="blog-card-cover" />
              ) : (
                <div className="blog-card-cover placeholder" />
              )}

              <div className="blog-card-body">
                <div className="blog-preview-meta">
                  <span className="blog-chip">{post.category}</span>
                  <span className="blog-chip">{new Date(post.published_at || post.created_at).toLocaleDateString()}</span>
                </div>

                <h3 className="blog-card-title">
                  <Link to={post.link}>{post.title}</Link>
                </h3>
                <p className="subtle">{post.excerpt}</p>

                <div className="blog-author-row">
                  {post.author?.profile_image ? (
                    <img src={post.author.profile_image} alt={post.author.full_name} className="blog-author-avatar" />
                  ) : (
                    <div className="blog-author-avatar placeholder">
                      <UserCircle size={20} weight="fill" />
                    </div>
                  )}
                  <span>{post.author?.full_name || 'Muallif'}</span>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
};

export default BlogListPage;
