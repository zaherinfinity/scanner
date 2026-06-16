import { useState, useRef } from 'react';

export default function Home() {
  const [activeTab, setActiveTab] = useState('finder');
  const [finderDomain, setFinderDomain] = useState('');
  const [finderLimit, setFinderLimit] = useState(50);
  const [finderData, setFinderData] = useState([]);
  const [finderLoading, setFinderLoading] = useState(false);
  const [analyzerUrl, setAnalyzerUrl] = useState('');
  const [analyzerData, setAnalyzerData] = useState(null);
  const [analyzerLoading, setAnalyzerLoading] = useState(false);
  const [paramsUrl, setParamsUrl] = useState('');
  const [paramsData, setParamsData] = useState([]);
  const [paramsLoading, setParamsLoading] = useState(false);
  const [batchItems, setBatchItems] = useState([]);
  const [batchResult, setBatchResult] = useState([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const fileInputRef = useRef();

  const [stats, setStats] = useState({ targets: 0, live: 0, params: 0, apis: 0 });

  const updateStats = (data) => setStats(prev => ({ ...prev, ...data }));

  const toast = (msg, type = 'info') => {
    alert(msg); // replace with a proper toast component if desired
  };

  // ---- Finder ----
  const handleFind = async () => {
    if (!finderDomain) return toast('Enter a domain', 'error');
    setFinderLoading(true);
    try {
      const res = await fetch('/api/find', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: finderDomain, limit: finderLimit })
      });
      const data = await res.json();
      setFinderData(data.targets || []);
      updateStats({ targets: data.targets?.length || 0 });
      toast(`Found ${data.targets?.length || 0} targets`);
    } catch (e) {
      toast('Error: ' + e.message, 'error');
    }
    setFinderLoading(false);
  };

  // ---- Analyzer ----
  const handleAnalyze = async () => {
    if (!analyzerUrl) return toast('Enter a URL', 'error');
    setAnalyzerLoading(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: analyzerUrl })
      });
      const data = await res.json();
      setAnalyzerData(data);
      updateStats({ apis: data.apis?.length || 0 });
      toast('Analysis complete');
    } catch (e) {
      toast('Error: ' + e.message, 'error');
    }
    setAnalyzerLoading(false);
  };

  // ---- Params ----
  const handleParams = async () => {
    if (!paramsUrl) return toast('Enter a URL', 'error');
    setParamsLoading(true);
    try {
      const res = await fetch('/api/params', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: paramsUrl })
      });
      const data = await res.json();
      setParamsData(data.params || []);
      updateStats({ params: data.params?.length || 0 });
      toast(`Found ${data.params?.length || 0} parameters`);
    } catch (e) {
      toast('Error: ' + e.message, 'error');
    }
    setParamsLoading(false);
  };

  // ---- Batch ----
  const handleBatchLoad = () => {
    const file = fileInputRef.current.files[0];
    if (!file) return toast('Select a file', 'error');
    const reader = new FileReader();
    reader.onload = (e) => {
      const lines = e.target.result.split('\n').map(s => s.trim()).filter(Boolean);
      setBatchItems(lines);
      toast(`Loaded ${lines.length} items`);
    };
    reader.readAsText(file);
  };

  const runBatch = async (op) => {
    if (!batchItems.length) return toast('Load items first', 'error');
    setBatchLoading(true);
    try {
      const res = await fetch('/api/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: batchItems, operation: op })
      });
      const data = await res.json();
      setBatchResult(data.results || []);
      toast('Batch complete');
    } catch (e) {
      toast('Error: ' + e.message, 'error');
    }
    setBatchLoading(false);
  };

  // ---- Export ----
  const exportResults = (source, format) => {
    let data = [];
    let filename = '';
    if (source === 'finder') { data = finderData; filename = 'targets'; }
    else if (source === 'analyzer') { data = analyzerData; filename = 'analysis'; }
    else if (source === 'params') { data = paramsData; filename = 'params'; }
    else if (source === 'batch') { data = batchResult; filename = 'batch'; }
    if (!data || !data.length) return toast('No data to export', 'error');
    const content = format === 'json' ? JSON.stringify(data, null, 2) : data.map(d => typeof d === 'string' ? d : d.url || JSON.stringify(d)).join('\n');
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${filename}.${format === 'json' ? 'json' : 'txt'}`;
    a.click();
  };

  // ---- Render ----
  return (
    <div style={{ fontFamily: 'Inter, sans-serif', background: '#0b0d15', color: '#f0f4ff', minHeight: '100vh' }}>
      {/* Header */}
      <header style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(11,13,21,0.75)', backdropFilter: 'blur(20px)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '1.35rem', fontWeight: 700 }}>
            <i className="fas fa-bolt" style={{ background: 'linear-gradient(135deg, #6c5ce7, #00cec9, #fd79a8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}></i>
            <span style={{ background: 'linear-gradient(135deg, #6c5ce7, #00cec9, #fd79a8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Zaher Infinity</span>
            <span style={{ fontSize: '0.6rem', background: '#6c5ce7', padding: '2px 10px', borderRadius: 100, color: '#fff' }}>2026</span>
          </div>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            {['finder','analyzer','params','batch'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{ background: 'transparent', border: 'none', color: activeTab === tab ? '#fff' : '#a8b5d9', fontWeight: 500, cursor: 'pointer', padding: '6px 12px', borderBottom: activeTab === tab ? '2px solid #6c5ce7' : 'none' }}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
            <button onClick={() => { setFinderData([]); setAnalyzerData(null); setParamsData([]); setBatchResult([]); setBatchItems([]); }} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 100, padding: '6px 18px', color: '#a8b5d9', cursor: 'pointer' }}>
              <i className="fas fa-eraser"></i> Clear
            </button>
          </div>
        </div>
      </header>

      {/* Hero Stats */}
      <div style={{ textAlign: 'center', padding: '40px 24px 20px' }}>
        <h1 style={{ fontSize: 'clamp(2.4rem, 6vw, 4.2rem)', fontWeight: 700, background: 'linear-gradient(135deg, #6c5ce7, #00cec9, #fd79a8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Target Intelligence Suite</h1>
        <p style={{ color: '#a8b5d9', maxWidth: 640, margin: '0 auto 20px' }}>Discover domains, analyze technologies, scan parameters – real data, real time.</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 40, flexWrap: 'wrap' }}>
          <div><div style={{ fontSize: '1.8rem', fontWeight: 700 }}>{stats.targets}</div><div style={{ color: '#5e6f8d', fontSize: '0.8rem' }}><i className="fas fa-crosshairs"></i> Targets</div></div>
          <div><div style={{ fontSize: '1.8rem', fontWeight: 700 }}>{stats.live}</div><div style={{ color: '#5e6f8d', fontSize: '0.8rem' }}><i className="fas fa-heartbeat"></i> Live</div></div>
          <div><div style={{ fontSize: '1.8rem', fontWeight: 700 }}>{stats.params}</div><div style={{ color: '#5e6f8d', fontSize: '0.8rem' }}><i className="fas fa-code"></i> Params</div></div>
          <div><div style={{ fontSize: '1.8rem', fontWeight: 700 }}>{stats.apis}</div><div style={{ color: '#5e6f8d', fontSize: '0.8rem' }}><i className="fas fa-plug"></i> APIs</div></div>
        </div>
      </div>

      {/* Panels */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px' }}>
        {activeTab === 'finder' && (
          <div style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(16px)', borderRadius: 24, padding: '32px 36px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h2 style={{ display: 'flex', gap: 12, marginBottom: 6 }}><i className="fas fa-search" style={{ color: '#00cec9' }}></i> Domain Target Finder</h2>
            <p style={{ color: '#a8b5d9', marginBottom: 20 }}>Enter a domain (e.g. go.th, example.com) to discover real subdomains and URLs.</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <input type="text" value={finderDomain} onChange={e => setFinderDomain(e.target.value)} placeholder="e.g. example.com" style={{ flex: 1, minWidth: 200, padding: '14px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#fff' }} />
              <select value={finderLimit} onChange={e => setFinderLimit(Number(e.target.value))} style={{ padding: '14px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#fff' }}>
                {[30,50,100,250,500].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <button onClick={handleFind} disabled={finderLoading} style={{ padding: '14px 32px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #6c5ce7, #00cec9, #fd79a8)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                {finderLoading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-rocket"></i>} {finderLoading ? 'Searching...' : 'Find Targets'}
              </button>
            </div>
            {finderData.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 12 }}>
                  <span style={{ fontWeight: 600 }}><i className="fas fa-list-ul"></i> Discovered Targets ({finderData.length})</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => exportResults('finder','txt')} style={{ padding: '6px 16px', borderRadius: 10, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#a8b5d9', cursor: 'pointer' }}><i className="fas fa-file-alt"></i> TXT</button>
                    <button onClick={() => exportResults('finder','json')} style={{ padding: '6px 16px', borderRadius: 10, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#a8b5d9', cursor: 'pointer' }}><i className="fas fa-code"></i> JSON</button>
                  </div>
                </div>
                <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                  {finderData.map((url, i) => (
                    <div key={i} style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ color: '#5e6f8d', minWidth: 30 }}>#{i+1}</span>
                      <span style={{ color: '#a8b5d9' }}>{url}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'analyzer' && (
          <div style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(16px)', borderRadius: 24, padding: '32px 36px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h2 style={{ display: 'flex', gap: 12, marginBottom: 6 }}><i className="fas fa-microscope" style={{ color: '#00cec9' }}></i> Web Technology Analyzer</h2>
            <p style={{ color: '#a8b5d9', marginBottom: 20 }}>Analyze a URL for CMS, frameworks, security, and APIs.</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <input type="text" value={analyzerUrl} onChange={e => setAnalyzerUrl(e.target.value)} placeholder="https://example.com" style={{ flex: 1, minWidth: 200, padding: '14px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#fff' }} />
              <button onClick={handleAnalyze} disabled={analyzerLoading} style={{ padding: '14px 32px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #6c5ce7, #00cec9, #fd79a8)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                {analyzerLoading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-chart-line"></i>} {analyzerLoading ? 'Analyzing...' : 'Analyze'}
              </button>
            </div>
            {analyzerData && (
              <div style={{ marginTop: 24 }}>
                <h3><i className="fas fa-cubes" style={{ color: '#00cec9' }}></i> Analysis Report</h3>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 12, marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                    <div><strong>Status:</strong> {analyzerData.status_code}</div>
                    <div><strong>Response:</strong> {analyzerData.response_time?.toFixed(2)}s</div>
                    <div><strong>Score:</strong> <span style={{ color: analyzerData.score >= 80 ? '#00cec9' : analyzerData.score >= 60 ? '#fdcb6e' : '#fd79a8' }}>{analyzerData.score}/100</span></div>
                    <div><strong>Title:</strong> {analyzerData.info?.Title || 'N/A'}</div>
                  </div>
                  {analyzerData.technologies && Object.entries(analyzerData.technologies).map(([cat, items]) => items.length > 0 && (
                    <div key={cat}><strong style={{ color: '#00cec9' }}>{cat}:</strong> {items.join(', ')}</div>
                  ))}
                  {analyzerData.security && (
                    <div><strong style={{ color: '#00cec9' }}>Security:</strong> HTTPS: {analyzerData.security.HTTPS ? <i className="fas fa-check-circle" style={{ color: '#00cec9' }}></i> : <i className="fas fa-times-circle" style={{ color: '#fd79a8' }}></i>}</div>
                  )}
                  {analyzerData.apis && analyzerData.apis.length > 0 && (
                    <div><strong style={{ color: '#00cec9' }}>APIs ({analyzerData.apis.length}):</strong> {analyzerData.apis.map(a => a.endpoint).join(', ')}</div>
                  )}
                </div>
                <button onClick={() => exportResults('analyzer','json')} style={{ marginTop: 12, padding: '6px 16px', borderRadius: 10, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#a8b5d9', cursor: 'pointer' }}><i className="fas fa-code"></i> Export JSON</button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'params' && (
          <div style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(16px)', borderRadius: 24, padding: '32px 36px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h2 style={{ display: 'flex', gap: 12, marginBottom: 6 }}><i className="fas fa-link" style={{ color: '#00cec9' }}></i> Parameter Scanner</h2>
            <p style={{ color: '#a8b5d9', marginBottom: 20 }}>Extract URL parameters like ?id=, ?page= from a page.</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <input type="text" value={paramsUrl} onChange={e => setParamsUrl(e.target.value)} placeholder="https://example.com/page.php" style={{ flex: 1, minWidth: 200, padding: '14px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#fff' }} />
              <button onClick={handleParams} disabled={paramsLoading} style={{ padding: '14px 32px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #6c5ce7, #00cec9, #fd79a8)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                {paramsLoading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-barcode"></i>} {paramsLoading ? 'Scanning...' : 'Scan Params'}
              </button>
            </div>
            {paramsData.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span><i className="fas fa-tags"></i> Found {paramsData.length} parameters</span>
                  <button onClick={() => exportResults('params','json')} style={{ padding: '6px 16px', borderRadius: 10, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#a8b5d9', cursor: 'pointer' }}><i className="fas fa-code"></i> Export JSON</button>
                </div>
                <div style={{ maxHeight: 300, overflowY: 'auto', marginTop: 8 }}>
                  {paramsData.map((p, i) => (
                    <div key={i} style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, marginBottom: 4 }}>
                      <strong style={{ color: '#fdcb6e' }}>{p.name}</strong> = <span style={{ color: '#a8b5d9' }}>{p.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'batch' && (
          <div style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(16px)', borderRadius: 24, padding: '32px 36px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h2 style={{ display: 'flex', gap: 12, marginBottom: 6 }}><i className="fas fa-layer-group" style={{ color: '#00cec9' }}></i> Batch Import & Scan</h2>
            <p style={{ color: '#a8b5d9', marginBottom: 20 }}>Upload a .txt file with domains/URLs (one per line).</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <input type="file" ref={fileInputRef} accept=".txt,.csv" style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#fff' }} />
              <button onClick={handleBatchLoad} style={{ padding: '14px 32px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #6c5ce7, #00cec9, #fd79a8)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                <i className="fas fa-upload"></i> Load File
              </button>
            </div>
            {batchItems.length > 0 && (
              <>
                <p style={{ marginTop: 16 }}>Loaded <strong>{batchItems.length}</strong> items</p>
                <div style={{ maxHeight: 120, overflowY: 'auto', background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: 12, fontSize: '0.85rem', color: '#a8b5d9' }}>
                  {batchItems.slice(0, 20).map((s, i) => <div key={i}>{s}</div>)}
                  {batchItems.length > 20 && <div>... and {batchItems.length - 20} more</div>}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  <button onClick={() => runBatch('find')} disabled={batchLoading} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: '#00b894', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                    <i className="fas fa-compass"></i> Find Targets
                  </button>
                  <button onClick={() => runBatch('analyze')} disabled={batchLoading} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: '#00b894', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                    <i className="fas fa-microscope"></i> Analyze All
                  </button>
                  <button onClick={() => runBatch('params')} disabled={batchLoading} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: '#00b894', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                    <i className="fas fa-code"></i> Scan Params
                  </button>
                </div>
              </>
            )}
            {batchResult.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <h3><i className="fas fa-database"></i> Batch Results ({batchResult.length})</h3>
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {batchResult.map((item, i) => (
                    <div key={i} style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, marginBottom: 4, borderLeft: `4px solid ${item.status === 200 || item.live ? '#00cec9' : '#fd79a8'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#a8b5d9' }}>{item.url}</span>
                        <span style={{ color: item.status === 200 || item.live ? '#00cec9' : '#fd79a8' }}>
                          {item.status || 'unknown'}
                          {item.status === 200 || item.live ? <i className="fas fa-check-circle" style={{ marginLeft: 4 }}></i> : <i className="fas fa-times-circle" style={{ marginLeft: 4 }}></i>}
                        </span>
                      </div>
                      {item.params && <span style={{ fontSize: '0.75rem', color: '#5e6f8d' }}><i className="fas fa-code"></i> {item.params.length} params</span>}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={() => exportResults('batch','txt')} style={{ padding: '6px 16px', borderRadius: 10, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#a8b5d9', cursor: 'pointer' }}><i className="fas fa-file-alt"></i> Export TXT</button>
                  <button onClick={() => exportResults('batch','json')} style={{ padding: '6px 16px', borderRadius: 10, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#a8b5d9', cursor: 'pointer' }}><i className="fas fa-code"></i> Export JSON</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <footer style={{ textAlign: 'center', padding: '30px 0 20px', borderTop: '1px solid rgba(255,255,255,0.04)', color: '#5e6f8d', marginTop: 40 }}>
        <i className="fas fa-bolt" style={{ color: '#6c5ce7' }}></i> Zaher Infinity · Target Intelligence Suite 2026 · Built with <i className="fas fa-heart" style={{ color: '#fd79a8' }}></i>
      </footer>
    </div>
  );
}
