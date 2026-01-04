import { useState, useEffect, useMemo } from 'react'

const PROXY = 'https://corsproxy.io/?'
const GAMMA = `${PROXY}https://gamma-api.polymarket.com`
const CLOB = `${PROXY}https://clob.polymarket.com`

const safeNum = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n }
const fmt = (n) => { n = safeNum(n); return n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(0)+'K' : n.toFixed(0) }

const getPrice = (m) => {
  if (!m) return 0.5
  try {
    if (m.outcomePrices) {
      const p = typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices) : m.outcomePrices
      if (Array.isArray(p) && p[0]) return safeNum(p[0])
    }
  } catch {}
  return safeNum(m.bestBid) || safeNum(m.lastTradePrice) || 0.5
}

const getToken = (m) => {
  if (!m) return null
  try {
    if (m.clobTokenIds) {
      const t = typeof m.clobTokenIds === 'string' ? JSON.parse(m.clobTokenIds) : m.clobTokenIds
      if (Array.isArray(t) && t[0]) return t[0]
    }
  } catch {}
  return null
}

export default function App() {
  const [markets, setMarkets] = useState([])
  const [selected, setSelected] = useState(null)
  const [book, setBook] = useState(null)
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [time, setTime] = useState(new Date())

  // Fetch markets
  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`${GAMMA}/markets?active=true&closed=false&limit=15&order=volume24hr&ascending=false`)
        const d = await r.json()
        const filtered = (d || []).filter(m => safeNum(m.volume24hr) > 5000)
        setMarkets(filtered)
        if (!selected && filtered[0]) setSelected(filtered[0])
        setError(null)
        setTime(new Date())
      } catch (e) { setError(e.message) }
      finally { setLoading(false) }
    }
    load()
    const i = setInterval(load, 30000)
    return () => clearInterval(i)
  }, [])

  // Fetch book + trades
  useEffect(() => {
    const token = getToken(selected)
    if (!token) { setBook(null); setTrades([]); return }
    
    const load = async () => {
      try {
        const [b, t] = await Promise.all([
          fetch(`${CLOB}/book?token_id=${token}`).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(`${CLOB}/trades?asset_id=${token}&limit=50`).then(r => r.ok ? r.json() : []).catch(() => [])
        ])
        setBook(b)
        setTrades(Array.isArray(t) ? t : [])
      } catch {}
    }
    load()
    const i = setInterval(load, 5000)
    return () => clearInterval(i)
  }, [selected])

  // Whales
  const whales = useMemo(() => {
    if (!Array.isArray(trades)) return []
    return trades
      .map(t => ({ 
        id: t.id || Math.random().toString(36).slice(2),
        side: t.side?.toUpperCase() || 'BUY', 
        size: safeNum(t.size) * safeNum(t.price),
        price: safeNum(t.price),
        time: t.match_time
      }))
      .filter(t => t.size >= 100)
      .sort((a,b) => new Date(b.time) - new Date(a.time))
      .slice(0, 15)
  }, [trades])

  // Signals
  const signals = useMemo(() => {
    const s = []
    
    whales.slice(0, 4).forEach(w => {
      const mins = Math.floor((Date.now() - new Date(w.time)) / 60000)
      s.push({
        id: 'w-' + w.id,
        icon: '🐋',
        level: w.size > 2000 ? 'HIGH' : 'MODERATE',
        cls: w.size > 2000 ? 'text-orange-400 bg-orange-500/20' : 'text-yellow-400 bg-yellow-500/20',
        title: `$${fmt(w.size)} ${w.side}`,
        sub: `at ${(w.price*100).toFixed(0)}¢ • ${mins < 60 ? mins + 'm ago' : Math.floor(mins/60) + 'h ago'}`
      })
    })
    
    if (book?.bids?.length && book?.asks?.length) {
      const bv = book.bids.slice(0,5).reduce((a,b) => a + safeNum(b.size), 0)
      const av = book.asks.slice(0,5).reduce((a,b) => a + safeNum(a.size), 0)
      const r = bv / (bv + av + 0.001)
      s.push({
        id: 'book',
        icon: '📊',
        level: r > 0.6 || r < 0.4 ? 'HIGH' : 'INFO',
        cls: r > 0.6 || r < 0.4 ? 'text-orange-400 bg-orange-500/20' : 'text-blue-400 bg-blue-500/20',
        title: `Book ${r > 0.5 ? 'Bid' : 'Ask'} Heavy`,
        sub: `${(r*100).toFixed(0)}% vs ${((1-r)*100).toFixed(0)}%`
      })
    }
    
    const vol = safeNum(selected?.volume24hr)
    if (vol > 50000) {
      s.push({
        id: 'vol',
        icon: '🔥',
        level: vol > 500000 ? 'HIGH' : 'MODERATE',
        cls: vol > 500000 ? 'text-red-400 bg-red-500/20' : 'text-yellow-400 bg-yellow-500/20',
        title: `Vol: $${fmt(vol)}`,
        sub: '24h trading volume'
      })
    }
    
    const liq = safeNum(selected?.liquidity)
    if (liq > 100000) {
      s.push({
        id: 'liq',
        icon: '💧',
        level: 'INFO',
        cls: 'text-cyan-400 bg-cyan-500/20',
        title: `Liq: $${fmt(liq)}`,
        sub: 'Available liquidity'
      })
    }
    
    return s
  }, [whales, book, selected])

  // Score
  const score = useMemo(() => {
    let ws = 50, bs = 50
    if (whales.length) {
      const buy = whales.filter(w => w.side === 'BUY').reduce((a,w) => a + w.size, 0)
      const sell = whales.filter(w => w.side === 'SELL').reduce((a,w) => a + w.size, 0)
      if (buy + sell > 0) ws = Math.round(buy / (buy + sell) * 100)
    }
    if (book?.bids?.length && book?.asks?.length) {
      const bv = book.bids.slice(0,10).reduce((a,b) => a + safeNum(b.size), 0)
      const av = book.asks.slice(0,10).reduce((a,b) => a + safeNum(a.size), 0)
      if (bv + av > 0) bs = Math.round(bv / (bv + av) * 100)
    }
    return Math.round(ws * 0.5 + bs * 0.5)
  }, [whales, book])

  const price = getPrice(selected)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-mono">
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-lg flex items-center justify-center font-bold text-black">Ξ</div>
          <div>
            <div className="text-sm font-bold">ELCARO OS</div>
            <div className="text-[9px] text-slate-500">LIVE POLYMARKET</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${error ? 'bg-red-500' : 'bg-green-500'} animate-pulse`} />
          <span className={`text-[10px] ${error ? 'text-red-400' : 'text-green-400'}`}>{error ? 'ERROR' : 'LIVE'}</span>
          <span className="text-[9px] text-slate-500 ml-1">{time.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Whale Ticker */}
      <div className="h-9 px-4 flex items-center gap-3 border-b border-slate-800 overflow-x-auto">
        <span className="text-[10px] text-slate-500 shrink-0">🐋</span>
        {whales.length === 0 ? (
          <span className="text-[10px] text-slate-600">Scanning...</span>
        ) : whales.slice(0,8).map(w => (
          <span key={w.id} className={`text-[10px] px-2 py-0.5 rounded border whitespace-nowrap ${w.side === 'BUY' ? 'border-green-500/30 text-green-400' : 'border-red-500/30 text-red-400'}`}>
            {w.side === 'BUY' ? '▲' : '▼'} ${fmt(w.size)}
          </span>
        ))}
      </div>

      {/* Markets */}
      <div className="flex gap-2 p-2 border-b border-slate-800 overflow-x-auto">
        {loading ? (
          <span className="text-xs text-slate-500 animate-pulse">Loading...</span>
        ) : markets.slice(0,8).map(m => (
          <button key={m.id} onClick={() => setSelected(m)}
            className={`px-3 py-2 rounded border min-w-[150px] text-left ${selected?.id === m.id ? 'bg-slate-800 border-cyan-500/50' : 'bg-slate-900 border-slate-700'}`}>
            <div className="text-[10px] text-slate-400 truncate">{m.question?.slice(0,25)}...</div>
            <div className="flex gap-2 mt-1">
              <span className={`text-sm font-bold ${getPrice(m) > 0.5 ? 'text-green-400' : 'text-red-400'}`}>{(getPrice(m)*100).toFixed(0)}¢</span>
              <span className="text-[9px] text-slate-600">${fmt(m.volume24hr)}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Selected Market */}
      {selected && (
        <div className="px-4 py-3 border-b border-slate-800">
          <div className="text-sm text-white">{selected.question}</div>
          <div className="flex items-center gap-3 mt-1">
            <span className={`text-2xl font-bold ${price > 0.5 ? 'text-green-400' : 'text-red-400'}`}>{(price*100).toFixed(1)}¢</span>
            <span className="text-[10px] text-slate-500">Vol: ${fmt(selected.volume24hr)} • Liq: ${fmt(selected.liquidity)}</span>
          </div>
        </div>
      )}

      <div className="p-4 space-y-4 max-w-5xl mx-auto">
        {/* Signals */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-800 flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[11px] font-semibold">SIGNALS</span>
            <span className="text-[9px] text-slate-600">{signals.length}</span>
          </div>
          <div className="divide-y divide-slate-800/50 max-h-72 overflow-y-auto">
            {signals.length === 0 ? (
              <div className="p-4 text-xs text-slate-600">Analyzing...</div>
            ) : signals.map(s => (
              <div key={s.id} className="p-3 flex items-center gap-3">
                <span className="text-lg">{s.icon}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${s.cls}`}>{s.level}</span>
                    <span className="text-[11px] text-slate-200">{s.title}</span>
                  </div>
                  <div className="text-[10px] text-slate-500">{s.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4">
          {/* Order Book */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <div className="text-[11px] text-slate-400 mb-3">ORDER BOOK</div>
            {!book?.bids?.length ? (
              <div className="text-xs text-slate-600">{getToken(selected) ? 'Loading...' : 'No data'}</div>
            ) : (
              <div className="grid grid-cols-2 gap-4 text-[10px]">
                <div>
                  <div className="text-green-500 text-[9px] mb-1">BIDS</div>
                  {book.bids.slice(0,8).map((b,i) => (
                    <div key={i} className="flex justify-between py-0.5">
                      <span className="text-slate-500">{fmt(b.size)}</span>
                      <span className="text-slate-300">{(safeNum(b.price)*100).toFixed(1)}¢</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="text-red-500 text-[9px] mb-1">ASKS</div>
                  {book.asks.slice(0,8).map((a,i) => (
                    <div key={i} className="flex justify-between py-0.5">
                      <span className="text-slate-300">{(safeNum(a.price)*100).toFixed(1)}¢</span>
                      <span className="text-slate-500">{fmt(a.size)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Score */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <div className="text-[11px] text-slate-400 text-center mb-2">ELCARO SCORE</div>
            <div className="relative flex justify-center">
              <svg viewBox="0 0 200 110" className="w-40">
                <defs><linearGradient id="g" x1="0%" x2="100%"><stop offset="0%" stopColor="#ef4444"/><stop offset="50%" stopColor="#eab308"/><stop offset="100%" stopColor="#22c55e"/></linearGradient></defs>
                <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#1e293b" strokeWidth="8"/>
                <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#g)" strokeWidth="5" strokeDasharray={`${score*2.51} 251`}/>
                <g transform={`rotate(${-135 + score*2.7} 100 100)`}>
                  <line x1="100" y1="100" x2="100" y2="50" stroke="#fff" strokeWidth="2"/>
                  <circle cx="100" cy="100" r="4" fill="#0f172a" stroke="#fff" strokeWidth="2"/>
                </g>
              </svg>
              <div className="absolute bottom-0 text-center">
                <div className="text-2xl font-bold">{score}</div>
                <div className={`text-[9px] px-2 py-0.5 rounded ${score >= 60 ? 'text-green-400 bg-green-500/20' : score >= 40 ? 'text-yellow-400 bg-yellow-500/20' : 'text-red-400 bg-red-500/20'}`}>
                  {score >= 60 ? 'BULLISH' : score >= 40 ? 'NEUTRAL' : 'BEARISH'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="border-t border-slate-800 px-4 py-2 text-[9px] text-slate-600 flex justify-between">
        <span>ELCARO OS v1.1</span>
        <span>Live Data • 5s refresh</span>
      </footer>
    </div>
  )
}
