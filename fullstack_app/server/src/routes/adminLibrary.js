const { createAsyncRouter } = require('../middleware');
const { sanitizeText, toBoolean, clampNumber, isAllowed, nowIso, serializeBook } = require('../utils');
const { logAdminAction } = require('../db');

function createAdminLibraryRouter(db) {
  const router = createAsyncRouter();

  async function getBookTableColumns() {
    const rows = await db.all('PRAGMA table_info(books)');
    return rows.map((row) => row.name);
  }

  async function createBookRecord(payload) {
    const cols = await getBookTableColumns();
    if (cols.includes('link')) {
      return db.run(
        `INSERT INTO books (title, author, category, link, file_url, cover_url, downloads, featured, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)` ,
        [
          payload.title,
          payload.author,
          payload.category,
          payload.fileUrl,
          payload.fileUrl,
          payload.coverUrl,
          payload.featured,
          payload.status,
          nowIso(),
          nowIso()
        ]
      );
    }

    return db.run(
      `INSERT INTO books (title, author, category, file_url, cover_url, downloads, featured, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)` ,
      [
        payload.title,
        payload.author,
        payload.category,
        payload.fileUrl,
        payload.coverUrl,
        payload.featured,
        payload.status,
        nowIso(),
        nowIso()
      ]
    );
  }

  async function updateBookRecord(id, payload) {
    const cols = await getBookTableColumns();
    if (cols.includes('link')) {
      return db.run(
        `UPDATE books
         SET title=?, author=?, category=?, link=?, file_url=?, cover_url=?, downloads=?, featured=?, status=?, updated_at=?
         WHERE id=?` ,
        [
          payload.title,
          payload.author,
          payload.category,
          payload.fileUrl,
          payload.fileUrl,
          payload.coverUrl,
          payload.downloads,
          payload.featured,
          payload.status,
          nowIso(),
          id
        ]
      );
    }

    return db.run(
      `UPDATE books
       SET title=?, author=?, category=?, file_url=?, cover_url=?, downloads=?, featured=?, status=?, updated_at=?
       WHERE id=?` ,
      [
        payload.title,
        payload.author,
        payload.category,
        payload.fileUrl,
        payload.coverUrl,
        payload.downloads,
        payload.featured,
        payload.status,
        nowIso(),
        id
      ]
    );
  }

  router.get('/books', async (req, res) => {
    const search = sanitizeText(req.query.search || '', 120).toLowerCase();
    const category = sanitizeText(req.query.category || '', 60).toLowerCase();

    const where = ['1 = 1'];
    const params = [];

    if (search) {
      where.push('(LOWER(title) LIKE ? OR LOWER(author) LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (category) {
      where.push('category = ?');
      params.push(category);
    }

    const rows = await db.all(
      `SELECT * FROM books WHERE ${where.join(' AND ')} ORDER BY featured DESC, updated_at DESC`,
      params
    );

    res.json({ books: rows.map(serializeBook) });
  });

  router.post('/books', async (req, res) => {
    const title = sanitizeText(req.body.title, 200);
    const author = sanitizeText(req.body.author, 150);
    const category = sanitizeText(req.body.category, 60).toLowerCase();
    const fileUrl = sanitizeText(req.body.file_url || req.body.link, 500);
    const coverUrl = sanitizeText(req.body.cover_url || '', 500);
    const featured = toBoolean(req.body.featured) ? 1 : 0;
    const status = isAllowed(sanitizeText(req.body.status, 20).toLowerCase(), ['draft', 'published', 'archived'], 'published');

    if (!title || !author || !category || !fileUrl) {
      return res.status(400).json({ error: 'title, author, category, file_url majburiy' });
    }

    const created = await createBookRecord({
      title,
      author,
      category,
      fileUrl,
      coverUrl,
      featured,
      status
    });

    await logAdminAction(db, req.authUser.id, 'library:create', 'book', created.lastID, { title });

    const row = await db.get('SELECT * FROM books WHERE id = ?', [created.lastID]);
    res.status(201).json({ book: serializeBook(row) });
  });

  router.put('/books/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const existing = await db.get('SELECT * FROM books WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Kitob topilmadi' });

    const title = sanitizeText(req.body.title || existing.title, 200);
    const author = sanitizeText(req.body.author || existing.author, 150);
    const category = sanitizeText(req.body.category || existing.category, 60).toLowerCase();
    const fileUrl = sanitizeText(req.body.file_url || existing.file_url, 500);
    const coverUrl = sanitizeText(req.body.cover_url || existing.cover_url, 500);
    const downloads = clampNumber(req.body.downloads ?? existing.downloads, 0, 100000000, existing.downloads || 0);
    const featured = req.body.featured === undefined ? existing.featured : (toBoolean(req.body.featured) ? 1 : 0);
    const status = isAllowed(
      sanitizeText(req.body.status || existing.status, 20).toLowerCase(),
      ['draft', 'published', 'archived'],
      existing.status
    );

    await updateBookRecord(id, {
      title,
      author,
      category,
      fileUrl,
      coverUrl,
      downloads,
      featured,
      status
    });

    await logAdminAction(db, req.authUser.id, 'library:update', 'book', id, { title });

    const row = await db.get('SELECT * FROM books WHERE id = ?', [id]);
    res.json({ book: serializeBook(row) });
  });

  router.patch('/books/:id/featured', async (req, res) => {
    const id = Number(req.params.id);
    const featured = toBoolean(req.body.featured) ? 1 : 0;
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const existing = await db.get('SELECT * FROM books WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Kitob topilmadi' });

    await db.run('UPDATE books SET featured=?, updated_at=? WHERE id=?', [featured, nowIso(), id]);
    await logAdminAction(db, req.authUser.id, 'library:featured', 'book', id, { featured: !!featured });

    const row = await db.get('SELECT * FROM books WHERE id = ?', [id]);
    res.json({ book: serializeBook(row) });
  });

  return router;
}

module.exports = createAdminLibraryRouter;
