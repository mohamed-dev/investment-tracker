import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const regions = ['saudi', 'mena', 'usa', 'europe'];

export default function Home() {
  const [rounds, setRounds] = useState([]);
  const [region, setRegion] = useState('saudi');
  const [loading, setLoading] = useState(true);
  const [aiOnly, setAiOnly] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      let query = supabase
        .from('funding_rounds')
        .select('*, companies(name, sector)')
        .eq('region', region)
        .order('announced_date', { ascending: false })
        .limit(50);

      if (aiOnly) query = query.eq('is_ai_saas', true);

      const { data } = await query;
      setRounds(data || []);
      setLoading(false);
    }
    load();
  }, [region, aiOnly]);

  return (
    <div style={{ fontFamily: 'system-ui', maxWidth: 900, margin: '40px auto', padding: '0 20px' }}>
      <h1>Funding Tracker</h1>

      <div style={{ marginBottom: 12 }}>
        {regions.map((r) => (
          <button
            key={r}
            onClick={() => setRegion(r)}
            style={{
              marginRight: 8,
              padding: '6px 14px',
              background: region === r ? '#111' : '#eee',
              color: region === r ? '#fff' : '#111',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            {r.toUpperCase()}
          </button>
        ))}
      </div>

      <label style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
        <input type="checkbox" checked={aiOnly} onChange={(e) => setAiOnly(e.target.checked)} />
        AI / SaaS only
      </label>

      {loading && <p>Loading...</p>}
      {!loading && rounds.length === 0 && <p>No data yet, or nothing enriched for this filter.</p>}

      <div>
        {rounds.map((r) => (
          <div key={r.id} style={{ borderBottom: '1px solid #eee', padding: '16px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h3 style={{ margin: 0 }}>{r.companies?.name}</h3>
              <span style={{ fontWeight: 600 }}>
                {r.amount_usd ? `$${(r.amount_usd / 1_000_000).toFixed(1)}M` : '-'}
              </span>
            </div>

            <div style={{ fontSize: 13, color: '#666', margin: '4px 0' }}>
              {r.sector && <span style={{ marginRight: 10 }}>Sector: {r.sector}</span>}
              {r.funding_stage && r.funding_stage !== 'not specified' && (
                <span style={{ marginRight: 10 }}>Stage: {r.funding_stage}</span>
              )}
              {r.is_ai_saas && (
                <span style={{ background: '#eef', padding: '2px 8px', borderRadius: 10, fontSize: 12 }}>
                  AI/SaaS
                </span>
              )}
            </div>

            {r.summary && r.summary !== 'Not enough information in snippet.' && (
              <p style={{ margin: '6px 0', fontSize: 14 }}>{r.summary}</p>
            )}

            {r.extracted_investors && r.extracted_investors !== 'not mentioned' && (
              <p style={{ margin: '2px 0', fontSize: 13, color: '#555' }}>
                Investors: {r.extracted_investors}
              </p>
            )}

            {r.tech_notes && r.tech_notes !== 'none mentioned' && (
              <p style={{ margin: '2px 0', fontSize: 13, color: '#555' }}>Tech: {r.tech_notes}</p>
            )}

            <div style={{ fontSize: 12, marginTop: 6 }}>
              <a href={r.source_url} target="_blank" rel="noreferrer">{r.source_name}</a>
              {' · '}{r.announced_date}
              {r.enrichment_status === 'pending' && (
                <span style={{ color: '#999' }}> · not yet enriched</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
