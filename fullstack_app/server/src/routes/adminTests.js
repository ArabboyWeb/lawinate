const { createAsyncRouter } = require('../middleware');
const {
  sanitizeText,
  pickDifficulty,
  pickStatus,
  pickCorrectOption,
  escapeCsv,
  parseCsv,
  nowIso
} = require('../utils');
const { logAdminAction } = require('../db');

function createAdminTestsRouter(db) {
  const router = createAsyncRouter();

  router.get('/tests', async (req, res) => {
    const search = sanitizeText(req.query.search || '', 120).toLowerCase();
    const category = sanitizeText(req.query.category || '', 40).toLowerCase();
    const difficulty = sanitizeText(req.query.difficulty || '', 20).toLowerCase();
    const status = sanitizeText(req.query.status || '', 20).toLowerCase();

    const where = ['1 = 1'];
    const params = [];

    if (search) {
      where.push('(LOWER(t.title) LIKE ? OR LOWER(t.category) LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    if (category) {
      where.push('t.category = ?');
      params.push(category);
    }
    if (difficulty) {
      where.push('t.difficulty = ?');
      params.push(difficulty);
    }
    if (status) {
      where.push('t.status = ?');
      params.push(status);
    }

    const tests = await db.all(
      `SELECT t.*, u.full_name as created_by_name,
              (SELECT COUNT(*) FROM questions q WHERE q.test_id = t.id) as question_count
       FROM tests t
       LEFT JOIN users u ON u.id = t.created_by
       WHERE ${where.join(' AND ')}
       ORDER BY t.updated_at DESC`,
      params
    );

    res.json({ tests });
  });

  router.post('/tests', async (req, res) => {
    const title = sanitizeText(req.body.title, 200);
    const category = sanitizeText(req.body.category, 40).toLowerCase();
    const difficulty = pickDifficulty(sanitizeText(req.body.difficulty, 20).toLowerCase(), 'medium');
    const status = pickStatus(sanitizeText(req.body.status, 20).toLowerCase(), 'draft');

    if (!title || !category) {
      return res.status(400).json({ error: 'title va category shart' });
    }

    const created = await db.run(
      `INSERT INTO tests (title, category, difficulty, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)` ,
      [title, category, difficulty, status, req.authUser.id, nowIso(), nowIso()]
    );

    await logAdminAction(db, req.authUser.id, 'tests:create', 'test', created.lastID, { title, category });

    const test = await db.get('SELECT * FROM tests WHERE id = ?', [created.lastID]);
    res.status(201).json({ test });
  });

  router.put('/tests/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const existing = await db.get('SELECT * FROM tests WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Test topilmadi' });

    const title = sanitizeText(req.body.title || existing.title, 200);
    const category = sanitizeText(req.body.category || existing.category, 40).toLowerCase();
    const difficulty = pickDifficulty(sanitizeText(req.body.difficulty || existing.difficulty, 20).toLowerCase(), existing.difficulty);
    const status = pickStatus(sanitizeText(req.body.status || existing.status, 20).toLowerCase(), existing.status);

    await db.run(
      `UPDATE tests
       SET title = ?, category = ?, difficulty = ?, status = ?, updated_at = ?
       WHERE id = ?` ,
      [title, category, difficulty, status, nowIso(), id]
    );

    await logAdminAction(db, req.authUser.id, 'tests:update', 'test', id, { title, category, difficulty, status });

    const test = await db.get('SELECT * FROM tests WHERE id = ?', [id]);
    res.json({ test });
  });

  router.patch('/tests/:id/status', async (req, res) => {
    const id = Number(req.params.id);
    const status = pickStatus(sanitizeText(req.body.status, 20).toLowerCase(), 'draft');

    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const existing = await db.get('SELECT id FROM tests WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Test topilmadi' });

    await db.run('UPDATE tests SET status = ?, updated_at = ? WHERE id = ?', [status, nowIso(), id]);
    await db.run('UPDATE questions SET status = ?, updated_at = ? WHERE test_id = ?', [status, nowIso(), id]);

    await logAdminAction(db, req.authUser.id, 'tests:status', 'test', id, { status });

    const test = await db.get('SELECT * FROM tests WHERE id = ?', [id]);
    res.json({ test });
  });

  router.delete('/tests/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const existing = await db.get('SELECT * FROM tests WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Test topilmadi' });

    await db.run('DELETE FROM tests WHERE id = ?', [id]);
    await logAdminAction(db, req.authUser.id, 'tests:delete', 'test', id, { title: existing.title });

    res.json({ ok: true });
  });

  router.get('/questions', async (req, res) => {
    const search = sanitizeText(req.query.search || '', 160).toLowerCase();
    const status = sanitizeText(req.query.status || '', 20).toLowerCase();
    const testId = Number(req.query.test_id);

    const where = ['1 = 1'];
    const params = [];

    if (search) {
      where.push('LOWER(q.question_text) LIKE ?');
      params.push(`%${search}%`);
    }
    if (!Number.isNaN(testId) && testId > 0) {
      where.push('q.test_id = ?');
      params.push(testId);
    }
    if (status) {
      where.push('q.status = ?');
      params.push(status);
    }

    const questions = await db.all(
      `SELECT q.*, t.title as test_title, t.category as test_category
       FROM questions q
       JOIN tests t ON t.id = q.test_id
       WHERE ${where.join(' AND ')}
       ORDER BY q.updated_at DESC
       LIMIT 500`,
      params
    );

    res.json({ questions });
  });

  router.post('/questions', async (req, res) => {
    const testId = Number(req.body.test_id);
    if (Number.isNaN(testId)) return res.status(400).json({ error: 'test_id notogri' });

    const test = await db.get('SELECT * FROM tests WHERE id = ?', [testId]);
    if (!test) return res.status(404).json({ error: 'Test topilmadi' });

    const questionText = sanitizeText(req.body.question_text, 1200);
    const optionA = sanitizeText(req.body.option_a, 400);
    const optionB = sanitizeText(req.body.option_b, 400);
    const optionC = sanitizeText(req.body.option_c, 400);
    const optionD = sanitizeText(req.body.option_d, 400);
    const correctOption = pickCorrectOption(req.body.correct_option);
    const explanation = sanitizeText(req.body.explanation, 1600);
    const status = pickStatus(sanitizeText(req.body.status || test.status, 20).toLowerCase(), 'draft');

    if (!questionText || !optionA || !optionB || !optionC || !optionD) {
      return res.status(400).json({ error: 'Savol va variantlar majburiy' });
    }

    const created = await db.run(
      `INSERT INTO questions (test_id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [testId, questionText, optionA, optionB, optionC, optionD, correctOption, explanation, status, nowIso(), nowIso()]
    );

    await db.run('UPDATE tests SET updated_at = ? WHERE id = ?', [nowIso(), testId]);
    await logAdminAction(db, req.authUser.id, 'questions:create', 'question', created.lastID, { test_id: testId });

    const question = await db.get('SELECT * FROM questions WHERE id = ?', [created.lastID]);
    res.status(201).json({ question });
  });

  router.put('/questions/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const existing = await db.get('SELECT * FROM questions WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Savol topilmadi' });

    const testId = Number(req.body.test_id || existing.test_id);
    const questionText = sanitizeText(req.body.question_text || existing.question_text, 1200);
    const optionA = sanitizeText(req.body.option_a || existing.option_a, 400);
    const optionB = sanitizeText(req.body.option_b || existing.option_b, 400);
    const optionC = sanitizeText(req.body.option_c || existing.option_c, 400);
    const optionD = sanitizeText(req.body.option_d || existing.option_d, 400);
    const correctOption = pickCorrectOption(req.body.correct_option || existing.correct_option);
    const explanation = sanitizeText(req.body.explanation || existing.explanation, 1600);
    const status = pickStatus(sanitizeText(req.body.status || existing.status, 20).toLowerCase(), existing.status);

    await db.run(
      `UPDATE questions
       SET test_id=?, question_text=?, option_a=?, option_b=?, option_c=?, option_d=?, correct_option=?, explanation=?, status=?, updated_at=?
       WHERE id=?` ,
      [testId, questionText, optionA, optionB, optionC, optionD, correctOption, explanation, status, nowIso(), id]
    );

    await db.run('UPDATE tests SET updated_at = ? WHERE id = ?', [nowIso(), testId]);
    await logAdminAction(db, req.authUser.id, 'questions:update', 'question', id, { test_id: testId });

    const question = await db.get('SELECT * FROM questions WHERE id = ?', [id]);
    res.json({ question });
  });

  router.delete('/questions/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const existing = await db.get('SELECT * FROM questions WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Savol topilmadi' });

    await db.run('DELETE FROM questions WHERE id = ?', [id]);
    await db.run('UPDATE tests SET updated_at = ? WHERE id = ?', [nowIso(), existing.test_id]);
    await logAdminAction(db, req.authUser.id, 'questions:delete', 'question', id, { test_id: existing.test_id });

    res.json({ ok: true });
  });

  router.get('/tests/export', async (req, res) => {
    const format = sanitizeText(req.query.format || 'json', 10).toLowerCase();
    const tests = await db.all('SELECT * FROM tests ORDER BY id ASC');
    const questions = await db.all('SELECT * FROM questions ORDER BY id ASC');

    if (format === 'csv') {
      const rows = [[
        'test_id', 'test_title', 'category', 'difficulty', 'test_status',
        'question_id', 'question_text', 'option_a', 'option_b', 'option_c', 'option_d',
        'correct_option', 'explanation', 'question_status'
      ]];

      const map = tests.reduce((acc, t) => {
        acc[t.id] = t;
        return acc;
      }, {});

      questions.forEach((q) => {
        const t = map[q.test_id] || {};
        rows.push([
          t.id || '', t.title || '', t.category || '', t.difficulty || '', t.status || '',
          q.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
          q.correct_option, q.explanation || '', q.status
        ]);
      });

      const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="lawinate-tests-export.csv"');
      return res.send(csv);
    }

    res.json({ exported_at: nowIso(), tests, questions });
  });

  router.post('/tests/import', async (req, res) => {
    let tests = [];
    let questions = [];

    if (Array.isArray(req.body.tests) || Array.isArray(req.body.questions)) {
      tests = Array.isArray(req.body.tests) ? req.body.tests : [];
      questions = Array.isArray(req.body.questions) ? req.body.questions : [];
    } else if (req.body.format === 'csv' && typeof req.body.csv === 'string') {
      const rows = parseCsv(req.body.csv);
      rows.forEach((row, idx) => {
        tests.push({
          temp_id: row.test_id || `csv-${idx}`,
          title: row.test_title,
          category: row.category,
          difficulty: row.difficulty,
          status: row.test_status
        });
        questions.push({
          test_id: row.test_id || `csv-${idx}`,
          question_text: row.question_text,
          option_a: row.option_a,
          option_b: row.option_b,
          option_c: row.option_c,
          option_d: row.option_d,
          correct_option: row.correct_option,
          explanation: row.explanation,
          status: row.question_status
        });
      });
    } else {
      return res.status(400).json({ error: 'Import payload invalid' });
    }

    const idMap = {};
    let importedTests = 0;
    let importedQuestions = 0;

    for (const item of tests) {
      const title = sanitizeText(item.title, 200);
      const category = sanitizeText(item.category, 40).toLowerCase();
      const difficulty = pickDifficulty(sanitizeText(item.difficulty, 20).toLowerCase(), 'medium');
      const status = pickStatus(sanitizeText(item.status, 20).toLowerCase(), 'draft');

      if (!title || !category) continue;

      const existing = await db.get('SELECT id FROM tests WHERE LOWER(title)=? AND category=?', [title.toLowerCase(), category]);

      let testId;
      if (existing) {
        testId = existing.id;
        await db.run('UPDATE tests SET difficulty=?, status=?, updated_at=? WHERE id=?', [difficulty, status, nowIso(), testId]);
      } else {
        const created = await db.run(
          `INSERT INTO tests (title, category, difficulty, status, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)` ,
          [title, category, difficulty, status, req.authUser.id, nowIso(), nowIso()]
        );
        testId = created.lastID;
        importedTests += 1;
      }

      if (item.temp_id) idMap[String(item.temp_id)] = testId;
      if (item.id) idMap[String(item.id)] = testId;
    }

    for (const item of questions) {
      let testId = Number(item.test_id);
      if (Number.isNaN(testId)) testId = idMap[String(item.test_id)] || null;
      if (!testId) continue;

      const questionText = sanitizeText(item.question_text, 1200);
      const optionA = sanitizeText(item.option_a, 400);
      const optionB = sanitizeText(item.option_b, 400);
      const optionC = sanitizeText(item.option_c, 400);
      const optionD = sanitizeText(item.option_d, 400);
      const correctOption = pickCorrectOption(item.correct_option);
      const explanation = sanitizeText(item.explanation, 1600);
      const status = pickStatus(sanitizeText(item.status, 20).toLowerCase(), 'draft');

      if (!questionText || !optionA || !optionB || !optionC || !optionD) continue;

      const existing = await db.get(
        `SELECT id FROM questions WHERE test_id=? AND LOWER(question_text)=?`,
        [testId, questionText.toLowerCase()]
      );

      if (existing) {
        await db.run(
          `UPDATE questions
           SET option_a=?, option_b=?, option_c=?, option_d=?, correct_option=?, explanation=?, status=?, updated_at=?
           WHERE id=?`,
          [optionA, optionB, optionC, optionD, correctOption, explanation, status, nowIso(), existing.id]
        );
      } else {
        await db.run(
          `INSERT INTO questions (test_id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
          [testId, questionText, optionA, optionB, optionC, optionD, correctOption, explanation, status, nowIso(), nowIso()]
        );
        importedQuestions += 1;
      }
    }

    await logAdminAction(db, req.authUser.id, 'tests:import', 'test', null, {
      tests: importedTests,
      questions: importedQuestions
    });

    res.json({ imported_tests: importedTests, imported_questions: importedQuestions });
  });

  return router;
}

module.exports = createAdminTestsRouter;
