import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarBlank, UserCircle } from '@phosphor-icons/react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import api from '../api';

marked.setOptions({
  gfm: true,
  breaks: true,
});

const BlogPostPage = () => {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError('');

    api
      .get(`/api/blog/posts/${slug}`)
      .then((res) => setPost(res.data?.post || null))
      .catch((err) => {
        setPost(null);
        setError(err.response?.data?.error || 'Post topilmadi');
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const safeHtml = useMemo(
    () => DOMPurify.sanitize(marked.parse(post?.content || '')),
    [post?.content]
  );

  return (
    <main className="site-container page-stack">
      <section className="glass-card card-pad">
        <div className="actions">
          <Link to="/blog" className="btn btn-soft">
            <ArrowLeft size={16} weight="bold" /> Blogga qaytish
          </Link>
          <Link to="/tests" className="btn btn-soft">Testlar</Link>
        </div>
      </section>

      {loading && (
        <section className="glass-card card-pad">
          <p>Yuklanmoqda...</p>
        </section>
      )}

      {!loading && error && (
        <section className="glass-card card-pad">
          <p className="notice error">{error}</p>
        </section>
      )}

      {!loading && !error && post && (
        <article className="glass-card card-pad blog-read-article">
          <div className="blog-preview-meta">
            <span className="blog-chip">{post.category}</span>
            <span className="blog-chip">
              <CalendarBlank size={14} weight="bold" /> {new Date(post.published_at || post.created_at).toLocaleString()}
            </span>
            {Array.isArray(post.tags) && post.tags.length > 0 && (
              <span className="blog-chip">{post.tags.map((item) => `#${item}`).join(' ')}</span>
            )}
          </div>

          <h1 className="section-title">{post.title}</h1>

          <div className="blog-author-row large">
            {post.author?.profile_image ? (
              <img src={post.author.profile_image} alt={post.author.full_name} className="blog-author-avatar large" />
            ) : (
              <div className="blog-author-avatar placeholder large">
                <UserCircle size={28} weight="fill" />
              </div>
            )}
            <div>
              <p style={{ margin: 0, fontWeight: 700 }}>{post.author?.full_name || 'Muallif'}</p>
              <p className="subtle" style={{ margin: 0 }}>Lawinate foydalanuvchisi</p>
            </div>
          </div>

          {post.cover_image && (
            <img src={post.cover_image} alt={post.title} className="blog-read-cover" />
          )}

          <div className="markdown-body blog-read-body" dangerouslySetInnerHTML={{ __html: safeHtml }} />
        </article>
      )}
    </main>
  );
};

export default BlogPostPage;
