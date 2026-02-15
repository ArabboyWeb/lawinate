import React, { useEffect, useState } from 'react';
import { Books, DownloadSimple, MagnifyingGlass } from '@phosphor-icons/react';
import api from '../api';

const CATEGORIES = [
  { key: '', title: 'Barchasi' },
  { key: 'jinoyat', title: 'Jinoyat' },
  { key: 'fuqarolik', title: 'Fuqarolik' },
  { key: 'kodeks', title: 'Kodeks' },
  { key: 'mamuriy', title: 'Ma\'muriy' },
  { key: 'hujjat', title: 'Hujjatlar' },
];

const LibraryPage = () => {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');

  const fetchBooks = () => {
    setLoading(true);
    setError('');

    const params = {};
    if (category) params.category = category;
    if (query.trim()) params.q = query.trim();

    api
      .get('/api/books', { params })
      .then((res) => setBooks(res.data.books || []))
      .catch((err) => setError(err.response?.data?.error || 'Kitoblarni olishda xatolik'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchBooks();
  }, [category]);

  const handleSearch = (event) => {
    event.preventDefault();
    fetchBooks();
  };

  return (
    <main className="site-container page-stack library-page">
      <header className="glass-card card-pad library-hero">
        <h1 className="section-title">Smart Kutubxona</h1>
        <p className="subtle" style={{ marginTop: 8 }}>
          Yuridik adabiyotlar va qonunchilik hujjatlarini qidiring.
        </p>
      </header>

      <section className="glass-card card-pad library-controls">
        <form className="library-form" onSubmit={handleSearch}>
          <div className="form-group">
            <label htmlFor="category">Kategoriya</label>
            <select
              id="category"
              className="select"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {CATEGORIES.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.title}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group library-query">
            <label htmlFor="query">Qidiruv</label>
            <div className="library-search-row">
              <div className="library-search-input">
                <MagnifyingGlass
                  size={18}
                  weight="bold"
                  color="var(--text-muted)"
                  style={{ position: 'absolute', left: 10, top: 12 }}
                />
                <input
                  id="query"
                  className="input"
                  style={{ paddingLeft: 36 }}
                  placeholder="Kitob nomi yoki muallif bo'yicha qidirish"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary">Qidirish</button>
            </div>
          </div>
        </form>

        {error && <p className="notice error" style={{ marginTop: 10 }}>{error}</p>}
      </section>

      {loading ? (
        <section className="glass-card card-pad">Yuklanmoqda...</section>
      ) : (
        <section className="library-results">
          {books.length === 0 ? (
            <article className="glass-card card-pad">
              Qidiruv bo'yicha kitob topilmadi.
            </article>
          ) : (
            books.map((book) => (
              <article key={book.id} className={`book-card library-book ${book.featured ? 'featured' : ''}`}>
                <header className="library-book-head">
                  <div className="icon-badge purple" style={{ marginBottom: 0 }}>
                    <Books size={22} weight="fill" />
                  </div>
                  <div>
                    <h3>{book.title}</h3>
                    <p className="book-meta">{book.author || "Muallif ko'rsatilmagan"}</p>
                  </div>
                </header>

                <dl className="library-book-stats">
                  <div>
                    <dt>Kategoriya</dt>
                    <dd>{book.category || '-'}</dd>
                  </div>
                  <div>
                    <dt>Yuklashlar</dt>
                    <dd>{book.downloads}</dd>
                  </div>
                </dl>

                <footer style={{ marginTop: 'auto' }}>
                  {book.link ? (
                    <a href={book.link} target="_blank" rel="noopener noreferrer" className="btn btn-soft">
                      <DownloadSimple size={16} weight="bold" /> Yuklab olish
                    </a>
                  ) : (
                    <span className="notice" style={{ display: 'inline-block', marginTop: 6 }}>
                      Fayl havolasi mavjud emas
                    </span>
                  )}
                </footer>
              </article>
            ))
          )}
        </section>
      )}
    </main>
  );
};

export default LibraryPage;
