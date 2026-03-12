const { createAsyncRouter } = require('../middleware');
const { sanitizeText, sanitizeMultilineText, nowIso } = require('../utils');

const ALLOWED_VOICE_MIMES = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg'];

function buildVoiceUrl(row) {
  if (!row.voice_blob_base64 || !row.voice_mime_type) return null;
  return `data:${row.voice_mime_type};base64,${row.voice_blob_base64}`;
}

async function ensureMembership(db, groupId, userId) {
  const group = await db.get('SELECT * FROM chat_groups WHERE id = ?', [groupId]);
  if (!group) return null;

  const existing = await db.get(
    'SELECT * FROM chat_group_members WHERE group_id = ? AND user_id = ?',
    [groupId, userId]
  );

  if (!existing) {
    await db.run(
      `INSERT INTO chat_group_members (group_id, user_id, role, joined_at)
       VALUES (?, ?, 'member', ?)` ,
      [groupId, userId, nowIso()]
    );
  }

  return group;
}

function createPublicChatRouter(db) {
  const router = createAsyncRouter();

  router.get('/groups', async (req, res) => {
    const search = sanitizeText(req.query.search || '', 120).toLowerCase();
    const where = ['1 = 1'];
    const params = [];

    if (search) {
      where.push('LOWER(g.name) LIKE ?');
      params.push(`%${search}%`);
    }

    const groups = await db.all(
      `SELECT g.*,
              owner.full_name as owner_name,
              (
                SELECT COUNT(*)
                FROM chat_group_members m
                WHERE m.group_id = g.id
              ) as member_count,
              (
                SELECT COUNT(*)
                FROM chat_group_members m2
                WHERE m2.group_id = g.id AND m2.user_id = ?
              ) as is_member
       FROM chat_groups g
       LEFT JOIN users owner ON owner.id = g.created_by
       WHERE ${where.join(' AND ')}
       ORDER BY g.updated_at DESC, g.id DESC
       LIMIT 200` ,
      [req.authUser.id, ...params]
    );

    res.json({
      groups: groups.map((group) => ({
        id: group.id,
        name: group.name,
        created_by: group.created_by,
        owner_name: group.owner_name,
        member_count: group.member_count || 0,
        is_member: !!group.is_member,
        created_at: group.created_at,
        updated_at: group.updated_at
      }))
    });
  });

  router.post('/groups', async (req, res) => {
    const name = sanitizeText(req.body.name, 80);
    if (!name) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    const now = nowIso();
    const created = await db.run(
      `INSERT INTO chat_groups (name, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?)` ,
      [name, req.authUser.id, now, now]
    );

    await db.run(
      `INSERT INTO chat_group_members (group_id, user_id, role, joined_at)
       VALUES (?, ?, 'owner', ?)` ,
      [created.lastID, req.authUser.id, now]
    );

    const group = await db.get(
      `SELECT g.*, u.full_name as owner_name
       FROM chat_groups g
       LEFT JOIN users u ON u.id = g.created_by
       WHERE g.id = ?`,
      [created.lastID]
    );

    res.status(201).json({
      group: {
        id: group.id,
        name: group.name,
        created_by: group.created_by,
        owner_name: group.owner_name,
        member_count: 1,
        is_member: true,
        created_at: group.created_at,
        updated_at: group.updated_at
      }
    });
  });

  router.post('/groups/:id/join', async (req, res) => {
    const groupId = Number(req.params.id);
    if (Number.isNaN(groupId)) return res.status(400).json({ error: 'Invalid group id' });

    const group = await ensureMembership(db, groupId, req.authUser.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    res.json({ ok: true });
  });

  router.get('/groups/:id/messages', async (req, res) => {
    const groupId = Number(req.params.id);
    if (Number.isNaN(groupId)) return res.status(400).json({ error: 'Invalid group id' });

    const group = await ensureMembership(db, groupId, req.authUser.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const limit = Math.min(Math.max(Number(req.query.limit) || 80, 1), 200);

    const rows = await db.all(
      `SELECT m.*,
              u.full_name as sender_name,
              u.email as sender_email
       FROM chat_messages m
       LEFT JOIN users u ON u.id = m.user_id
       WHERE m.group_id = ?
       ORDER BY m.id DESC
       LIMIT ?`,
      [groupId, limit]
    );

    const messages = rows
      .reverse()
      .map((row) => ({
        id: row.id,
        group_id: row.group_id,
        user_id: row.user_id,
        sender_name: row.sender_name,
        sender_email: row.sender_email,
        message: row.message_text,
        message_type: row.message_type,
        voice_mime_type: row.voice_mime_type,
        voice_duration_sec: row.voice_duration_sec,
        voice_url: buildVoiceUrl(row),
        created_at: row.created_at
      }));

    res.json({ group_id: groupId, messages });
  });

  router.post('/groups/:id/messages', async (req, res) => {
    const groupId = Number(req.params.id);
    if (Number.isNaN(groupId)) return res.status(400).json({ error: 'Invalid group id' });

    const group = await ensureMembership(db, groupId, req.authUser.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const messageText = sanitizeMultilineText(req.body.message, 3000);
    const rawVoiceB64 = typeof req.body.voice_blob_base64 === 'string' ? req.body.voice_blob_base64.trim() : '';
    const voiceMimeType = sanitizeText(req.body.voice_mime_type, 60).toLowerCase();
    const voiceDuration = Number(req.body.voice_duration_sec) || 0;

    let messageType = 'text';
    let voiceBlobB64 = null;
    let finalVoiceMime = null;
    let finalVoiceDuration = null;

    if (rawVoiceB64) {
      if (!ALLOWED_VOICE_MIMES.includes(voiceMimeType)) {
        return res.status(400).json({ error: 'Unsupported voice format' });
      }

      if (rawVoiceB64.length > 900000) {
        return res.status(400).json({ error: 'Voice message is too large' });
      }

      messageType = 'voice';
      voiceBlobB64 = rawVoiceB64;
      finalVoiceMime = voiceMimeType;
      finalVoiceDuration = Math.max(0, Math.min(voiceDuration, 600));
    } else if (!messageText) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const now = nowIso();
    const created = await db.run(
      `INSERT INTO chat_messages
        (group_id, user_id, message_text, message_type, voice_blob_base64, voice_mime_type, voice_duration_sec, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)` ,
      [groupId, req.authUser.id, messageText || null, messageType, voiceBlobB64, finalVoiceMime, finalVoiceDuration, now]
    );

    await db.run('UPDATE chat_groups SET updated_at = ? WHERE id = ?', [now, groupId]);

    const row = await db.get(
      `SELECT m.*,
              u.full_name as sender_name,
              u.email as sender_email
       FROM chat_messages m
       LEFT JOIN users u ON u.id = m.user_id
       WHERE m.id = ?`,
      [created.lastID]
    );

    res.status(201).json({
      message: {
        id: row.id,
        group_id: row.group_id,
        user_id: row.user_id,
        sender_name: row.sender_name,
        sender_email: row.sender_email,
        message: row.message_text,
        message_type: row.message_type,
        voice_mime_type: row.voice_mime_type,
        voice_duration_sec: row.voice_duration_sec,
        voice_url: buildVoiceUrl(row),
        created_at: row.created_at
      }
    });
  });

  return router;
}

module.exports = createPublicChatRouter;
