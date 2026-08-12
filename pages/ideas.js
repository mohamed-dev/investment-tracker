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

function draftFromIdea(idea) {
  return `${idea.title}\n\n${idea.rationale}`;
}

export default function Ideas() {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState({});

  async function loadIdeas() {
    setLoading(true);
    const { data } = await supabase
      .from('idea_suggestions')
      .select('*')
      .eq('status', 'new')
      .order('created_at', { ascending: false });

    setIdeas(data || []);
    setDrafts(Object.fromEntries((data || []).map((idea) => [idea.id, draftFromIdea(idea)])));
    setLoading(false);
  }

  useEffect(() => {
    loadIdeas();
  }, []);

  async function saveToNotes(idea) {
    const content = drafts[idea.id];
    if (!content?.trim()) return;

    await supabase.from('notes').insert({
      content: content.trim(),
      source: 'ai_suggested',
    });

    await supabase
      .from('idea_suggestions')
      .update({ status: 'saved_to_notes' })
      .eq('id', idea.id);

    setIdeas((prev) => prev.filter((i) => i.id !== idea.id));
  }

  async function dismiss(idea) {
    await supabase
      .from('idea_suggestions')
      .update({ status: 'dismissed' })
      .eq('id', idea.id);

    setIdeas((prev) => prev.filter((i) => i.id !== idea.id));
  }

  return (
    <div style={{ fontFamily: 'system-ui', maxWidth: 900, margin: '40px auto', padding: '0 20px' }}>
      <nav style={{ marginBottom: 20 }}>
        <Link href="/" style={{ marginRight: 16 }}>Funding Tracker</Link>
        <Link href="/notes" style={{ marginRight: 16 }}>Notes</Link>
        <Link href="/ideas" style={{ fontWeight: 600 }}>Ideas</Link>
      </nav>

      <h1>AI-Suggested Ideas</h1>

      {loading && <p>Loading...</p>}
      {!loading && ideas.length === 0 && <p>No new ideas right now. Check back after the next enrichment run.</p>}

      <div>
        {ideas.map((idea) => (
          <div key={idea.id} style={{ border: '1px solid #eee', borderRadius: 8, padding: 20, marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 6px' }}>{idea.title}</h3>

            <div style={{ fontSize: 13, color: '#666', marginBottom: 10 }}>
              {idea.based_on_region && (
                <span style={{ background: '#eef', padding: '2px 8px', borderRadius: 10, fontSize: 12, marginRight: 6 }}>
                  {idea.based_on_region}
                </span>
              )}
              {idea.based_on_sector && (
                <span style={{ background: '#eef', padding: '2px 8px', borderRadius: 10, fontSize: 12 }}>
                  {idea.based_on_sector}
                </span>
              )}
            </div>

            <p style={{ fontSize: 14, color: '#555', margin: '0 0 12px' }}>{idea.rationale}</p>

            <textarea
              value={drafts[idea.id] ?? ''}
              onChange={(e) => setDrafts((prev) => ({ ...prev, [idea.id]: e.target.value }))}
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
                marginBottom: 10,
              }}
            />

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => saveToNotes(idea)} style={buttonStyle}>Save to Notes</button>
              <button onClick={() => dismiss(idea)} style={secondaryButtonStyle}>Dismiss</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
