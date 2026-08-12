import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const buttonStyle = {
  padding: '6px 14px',
  background: '#111',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
};

const secondaryButtonStyle = {
  ...buttonStyle,
  background: '#eee',
  color: '#111',
};

export default function Notes() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newContent, setNewContent] = useState('');
  const [newTags, setNewTags] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [editTags, setEditTags] = useState('');

  async function loadNotes() {
    setLoading(true);
    const { data } = await supabase
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false });
    setNotes(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadNotes();
  }, []);

  function parseTags(input) {
    return input
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }

  async function addNote() {
    if (!newContent.trim()) return;

    await supabase.from('notes').insert({
      content: newContent.trim(),
      tags: newTags ? parseTags(newTags) : null,
    });

    setNewContent('');
    setNewTags('');
    loadNotes();
  }

  function startEdit(note) {
    setEditingId(note.id);
    setEditContent(note.content);
    setEditTags((note.tags || []).join(', '));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditContent('');
    setEditTags('');
  }

  async function saveEdit(id) {
    await supabase
      .from('notes')
      .update({
        content: editContent.trim(),
        tags: editTags ? parseTags(editTags) : null,
        updated_at: new Date(),
      })
      .eq('id', id);

    cancelEdit();
    loadNotes();
  }

  async function deleteNote(id) {
    await supabase.from('notes').delete().eq('id', id);
    loadNotes();
  }

  return (
    <div style={{ fontFamily: 'system-ui', maxWidth: 900, margin: '40px auto', padding: '0 20px' }}>
      <nav style={{ marginBottom: 20 }}>
        <Link href="/" style={{ marginRight: 16 }}>Funding Tracker</Link>
        <Link href="/notes" style={{ marginRight: 16, fontWeight: 600 }}>Notes</Link>
        <Link href="/ideas">Ideas</Link>
      </nav>

      <h1>Notes</h1>

      <div style={{ marginBottom: 32 }}>
        <textarea
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder="Write a note..."
          rows={4}
          style={{
            width: '100%',
            padding: 10,
            fontFamily: 'system-ui',
            fontSize: 14,
            border: '1px solid #ddd',
            borderRadius: 6,
            boxSizing: 'border-box',
            resize: 'vertical',
          }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            type="text"
            value={newTags}
            onChange={(e) => setNewTags(e.target.value)}
            placeholder="tags, comma separated (optional)"
            style={{
              flex: 1,
              padding: '6px 10px',
              fontFamily: 'system-ui',
              fontSize: 14,
              border: '1px solid #ddd',
              borderRadius: 6,
              boxSizing: 'border-box',
            }}
          />
          <button onClick={addNote} style={buttonStyle}>Add note</button>
        </div>
      </div>

      {loading && <p>Loading...</p>}
      {!loading && notes.length === 0 && <p>No notes yet.</p>}

      <div>
        {notes.map((note) => (
          <div key={note.id} style={{ borderBottom: '1px solid #eee', padding: '16px 0' }}>
            {editingId === note.id ? (
              <div>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: 10,
                    fontFamily: 'system-ui',
                    fontSize: 14,
                    border: '1px solid #ddd',
                    borderRadius: 6,
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
                <input
                  type="text"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  placeholder="tags, comma separated"
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    fontFamily: 'system-ui',
                    fontSize: 14,
                    border: '1px solid #ddd',
                    borderRadius: 6,
                    boxSizing: 'border-box',
                    marginTop: 8,
                  }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={() => saveEdit(note.id)} style={buttonStyle}>Save</button>
                  <button onClick={cancelEdit} style={secondaryButtonStyle}>Cancel</button>
                </div>
              </div>
            ) : (
              <div>
                <p style={{ margin: '0 0 8px', fontSize: 14, whiteSpace: 'pre-wrap' }}>{note.content}</p>

                {note.tags && note.tags.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    {note.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          background: '#eef',
                          padding: '2px 8px',
                          borderRadius: 10,
                          fontSize: 12,
                          marginRight: 6,
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
                  {note.source === 'ai_suggested' && <span>AI suggested · </span>}
                  {new Date(note.created_at).toLocaleString()}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => startEdit(note)} style={secondaryButtonStyle}>Edit</button>
                  <button onClick={() => deleteNote(note.id)} style={secondaryButtonStyle}>Delete</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
