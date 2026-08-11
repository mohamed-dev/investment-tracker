import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Uses the anon key here since this runs client-side. Set row-level security
// in Supabase to make funding_rounds/companies read-only for anon.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const regions = ['saudi', 'mena', 'usa', 'europe'];

export default function Home() {
  const [rounds, setRounds] = useState([]);
  const [region, setRegion] = useState('saudi');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('funding_rounds')
        .select('*, companies(name, sector)')
        .eq('region', region)
        .order('announced_date', { ascending: false })
        .limit(50);
      setRounds(data || []);
      setLoading(false);
    }
    load();
  }, [region]);

  return (
    <div style={{ fontFamily: 'system-ui', maxWidth: 900, margin: '40px auto', padding: '0 20px' }}>
      <h1>Funding Tracker</h1>
      <div style={{ marginBottom: 20 }}>
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

      {loading && <p>Loading...</p>}

      {!loading && rounds.length === 0 && <p>No data yet. Run the scraper first.</p>}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee' }}>
            <th style={{ padding: 8 }}>Company</th>
            <th style={{ padding: 8 }}>Amount</th>
            <th style={{ padding: 8 }}>Date</th>
            <th style={{ padding: 8 }}>Source</th>
          </tr>
        </thead>
        <tbody>
          {rounds.map((r) => (
            <tr key={r.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: 8 }}>{r.companies?.name}</td>
              <td style={{ padding: 8 }}>
                {r.amount_usd ? `$${(r.amount_usd / 1_000_000).toFixed(1)}M` : '-'}
              </td>
              <td style={{ padding: 8 }}>{r.announced_date}</td>
              <td style={{ padding: 8 }}>
                <a href={r.source_url} target="_blank" rel="noreferrer">
                  {r.source_name}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
