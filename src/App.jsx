import { useState, useEffect, useCallback, useMemo } from 'react'

// =============================================================================
// ELCARO OS - LIVE POLYMARKET TERMINAL
// =============================================================================

// API paths (proxied through Vite in dev, direct in production with CORS headers)
const GAMMA_API = '/api/gamma'
const CLOB_API = '/api/clob'

// For production (Vercel/Netlify), use direct URLs with edge functions
const getApiUrl = (type) => {
  if (import.meta.env.PROD) {
    return type === 'gamma' 
      ? 'https://gamma-api.polymarket.com' 
      : 'https://clob.polymarket.com'
  }
  return type === 'gamma' ? GAMMA_API : CLOB_API
}

// =============================================================================
// DATA FETCHING
// =============================================================================

const fetchMarkets = async () => {
  const res = await fetch(`${getApiUrl('gamma')}/markets?active=true&closed=false&limit=12&order=volume24hr&ascending=false`)
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

const fetchOrderBook = async (tokenId) => {
  if (!tokenId) return null
  const res = await fetch(`${getApiUrl('clob')}/book?token_id=${tokenId}`)
  if (!res.ok) return null
  return res.json()
}

const fetchTrades = async (tokenId) => {
  if (!tokenId) return []
  try {
    const res = await fetch(`${getApiUrl('clob')}/trades?asset_id=${tokenId}&limit=50`)
    if (!res.ok) return []
    return res.json()
  } catch { return [] }
}

// =============================================================================
// WHALE DETECTION
// =============================================================================

const detectWhales = (trades, minUsd = 500) => {
  if (!Array.isArray(trades)) return []
  return trades
    .map(t => ({
      id: t.id || Math.random().toString(36).slice(2),
      side: t.side?.toUpperCase() || 'BUY',
      size: parseFloat(t.size || 0) * parseFloat(t.price || 0),
      price: parseFloat(t.price || 0),
      time: t.match_time || Date.now()
    }))
    .filter(t => t.size >= minUsd)
    .sort((a, b) => b.size - a.size)
    .slice(0, 15)
}

// =============================================================================
// COMPONENTS
// =============================================================================

function Header({ lastUpdate, error }) {
  return (
    <header className="flex justify-between items-center px-4 py-3 border-b border-slate-700 bg-slate-900/90">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-lg flex items-center justify-center text-lg font-bold text-black">Ξ</div>
        <div>
          <div className="text-sm font-bold text-white">ELCARO OS</div>
          <div className="text-[9px] text-slate-500 tracking-widest">LIVE POLYMARKET</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${error ? 'bg-red-500' : 'bg-green-500'} animate-pulse`} />
        <span className={`text-[10px] ${error ? 'text-red-400' : 'text-green-400'}`}>
          {error ? 'RECONNECTING' : 'LIVE'}
        </span>
        {lastUpdate && (
          <span className="text-[9px] text-slate-500 ml-2">
            {lastUpdate.toLocaleTimeString()}
          </span>
        )}
      </div>
    </header>
  )
}

function WhaleTicker({ whales }) {
  if (!whales?.length) {
    return (
      <div className="h-9 px-4 flex items-center border-b border-slate-700 bg-slate-900/50">
        <span className="text-[10px] text-slate-500">🐋 Scanning for whale activity...</span>
      </div>
    )
  }

  return (
    <div className="h-9 px-4 flex items-center gap-3 border-b border-slate-700 bg-slate-900/50 overflow-hidden">
      <span className="text-[10px] text-slate-400 shrink-0">🐋 WHALES</span>
      <div className="flex gap-2 overflow-x-auto">
        {whales.slice(0, 8).map(w => (
          <div key={w.id} className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border ${
            w.side === 'BUY' ? 'border-green-500/30 text-green-400' : 'border-red-500/30 text-red-400'
          } bg-slate-800/50 whitespace-nowrap`}>
            <span>{w.side === 'BUY' ? '▲' : '▼'}</span>
            <span className="text-amber-400">${w.size.toFixed(0)}</span>
            <span className="text-slate-500">@{w.price.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MarketList({ markets, selected, onSelect, loading }) {
  if (loading) {
    return (
      <div className="p-4 border-b border-slate-700">
        <div className="text-xs text-slate-500 animate-pulse">Loading markets...</div>
      </div>
    )
  }

  return (
    <div className="flex gap-2 p-2 border-b border-slate-700 overflow-x-auto bg-slate-900/30">
      {markets?.slice(0, 8).map(m => {
        const price = parseFloat(m.outcomePrices?.[0] || 0.5)
        const vol = parseFloat(m.volume24hr || 0)
        return (
          <button
            key={m.id}
            onClick={() => onSelect(m)}
            className={`flex flex-col px-3 py-2 rounded border min-w-[160px] text-left transition-all ${
              selected?.id === m.id
                ? 'bg-slate-800 border-cyan-500/50'
                : 'bg-slate-800/40 border-slate-700 hover:border-slate-600'
            }`}
          >
            <span className="text-[10px] text-slate-300 truncate">{m.question?.slice(0, 30)}...</span>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-sm font-bold ${price > 0.5 ? 'text-green-400' : 'text-red-400'}`}>
                {(price * 100).toFixed(0)}¢
              </span>
              <span className="text-[9px] text-slate-500">${(vol/1000).toFixed(0)}K</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function OrderBook({ book, loading }) {
  if (loading || !book?.bids?.length) {
    return (
      <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
        <div className="text-[11px] text-slate-400 mb-3">ORDER BOOK</div>
        <div className="text-xs text-slate-500">{loading ? 'Loading...' : 'Select a market'}</div>
      </div>
    )
  }

  const bids = book.bids.slice(0, 10)
  const asks = book.asks.slice(0, 10)
  const maxBid = Math.max(...bids.map(b => parseFloat(b.size)), 1)
  const maxAsk = Math.max(...asks.map(a => parseFloat(a.size)), 1)
  const mid = ((parseFloat(bids[0]?.price || 0) + parseFloat(asks[0]?.price || 1)) / 2).toFixed(3)

  return (
    <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
      <div className="flex justify-between items-center mb-3">
        <span className="text-[11px] text-slate-400">ORDER BOOK</span>
        <span className="text-[10px] text-slate-500">Mid: <span className="text-cyan-400">{mid}</span></span>
      </div>
      
      <div className="grid grid-cols-[1fr_50px_1fr] gap-1 text-[10px]">
        <div className="space-y-0.5">
          {bids.map((b, i) => {
            const size = parseFloat(b.size)
            const w = (size / maxBid) * 100
            return (
              <div key={i} className="relative h-5 flex items-center justify-end pr-1">
                <div className="absolute right-0 h-full bg-green-500/20 rounded-sm" style={{ width: `${w}%` }} />
                <span className="relative text-slate-400">{parseFloat(b.price).toFixed(3)}</span>
              </div>
            )
          })}
        </div>
        
        <div className="flex items-center justify-center">
          <div className="w-px h-full bg-slate-700" />
        </div>
        
        <div className="space-y-0.5">
          {asks.map((a, i) => {
            const size = parseFloat(a.size)
            const w = (size / maxAsk) * 100
            return (
              <div key={i} className="relative h-5 flex items-center pl-1">
                <div className="absolute left-0 h-full bg-red-500/20 rounded-sm" style={{ width: `${w}%` }} />
                <span className="relative text-slate-400">{parseFloat(a.price).toFixed(3)}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function SignalFeed({ signals }) {
  const [expanded, setExpanded] = useState(null)

  if (!signals?.length) {
    return (
      <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
        <div className="text-[11px] text-slate-400 mb-2">SIGNAL FEED</div>
        <div className="text-xs text-slate-500">Analyzing market data...</div>
      </div>
    )
  }

  return (
    <div className="bg-slate-900/50 border border-slate-700 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <span className="text-[11px] font-semibold text-slate-300">LIVE SIGNALS</span>
        <span className="text-[9px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded">{signals.length} active</span>
      </div>
      
      <div className="divide-y divide-slate-700/50 max-h-[350px] overflow-y-auto">
        {signals.map(s => (
          <div
            key={s.id}
            className="p-3 hover:bg-slate-800/30 cursor-pointer transition-all"
            onClick={() => setExpanded(expanded === s.id ? null : s.id)}
          >
            <div className="flex items-start gap-3">
              <span className="text-xl">{s.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${s.levelClass}`}>{s.level}</span>
                  <span className="text-[11px] text-slate-200">{s.title}</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">{s.summary}</p>
                {expanded === s.id && (
                  <div className="mt-2 p-2 bg-slate-800/50 rounded text-[10px] text-slate-300">
                    {s.detail}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ScoreDial({ score, breakdown }) {
  const rot = -135 + (score / 100) * 270
  const label = score >= 65 ? 'BULLISH' : score >= 45 ? 'NEUTRAL' : 'BEARISH'
  const labelClass = score >= 65 ? 'text-green-400 bg-green-500/20 border-green-500/40' 
                   : score >= 45 ? 'text-yellow-400 bg-yellow-500/20 border-yellow-500/40'
                   : 'text-red-400 bg-red-500/20 border-red-500/40'

  return (
    <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
      <div className="text-[11px] text-slate-400 text-center mb-2">ELCARO SCORE</div>
      
      <div className="relative flex justify-center mb-4">
        <svg viewBox="0 0 200 110" className="w-48">
          <defs>
            <linearGradient id="dg" x1="0%" x2="100%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
          </defs>
          <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#1e293b" strokeWidth="8" />
          <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#dg)" strokeWidth="5" 
                strokeDasharray={`${(score / 100) * 251} 251`} />
          <g transform={`rotate(${rot} 100 100)`}>
            <line x1="100" y1="100" x2="100" y2="45" stroke="#fff" strokeWidth="2" />
            <circle cx="100" cy="100" r="5" fill="#0f172a" stroke="#fff" strokeWidth="2" />
          </g>
        </svg>
        <div className="absolute bottom-0 flex flex-col items-center">
          <span className="text-3xl font-bold text-white">{score}</span>
          <span className={`text-[9px] font-semibold px-2 py-0.5 rounded border ${labelClass}`}>{label}</span>
        </div>
      </div>
      
      <div className="space-y-2 pt-3 border-t border-slate-700">
        {breakdown.map(b => (
          <div key={b.name} className="flex items-center gap-2 text-[10px]">
            <span>{b.icon}</span>
            <span className="text-slate-500 w-14">{b.name}</span>
            <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
              <div className={`h-full ${b.color}`} style={{ width: `${b.value}%` }} />
            </div>
            <span className="text-slate-300 w-6 text-right">{b.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// MAIN APP
// =============================================================================

export default function App() {
  const [markets, setMarkets] = useState([])
  const [selected, setSelected] = useState(null)
  const [book, setBook] = useState(null)
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)

  // Fetch markets
  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchMarkets()
        setMarkets(data || [])
        if (!selected && data?.length) setSelected(data[0])
        setError(null)
        setLastUpdate(new Date())
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [])

  // Fetch book & trades for selected market
  useEffect(() => {
    if (!selected?.clobTokenIds?.[0]) return
    
    const tokenId = selected.clobTokenIds[0]
    const load = async () => {
      const [b, t] = await Promise.all([
        fetchOrderBook(tokenId),
        fetchTrades(tokenId)
      ])
      setBook(b)
      setTrades(t || [])
    }
    load()
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
  }, [selected])

  // Detect whales
  const whales = useMemo(() => detectWhales(trades), [trades])

  // Generate signals
  const signals = useMemo(() => {
    const sigs = []
    
    // Whale signals
    whales.slice(0, 3).forEach(w => {
      sigs.push({
        id: `whale-${w.id}`,
        icon: '🐋',
        level: w.size > 5000 ? 'CRITICAL' : w.size > 2000 ? 'HIGH' : 'MODERATE',
        levelClass: w.size > 5000 ? 'text-red-400 bg-red-500/20' : w.size > 2000 ? 'text-orange-400 bg-orange-500/20' : 'text-yellow-400 bg-yellow-500/20',
        title: `$${w.size.toFixed(0)} ${w.side}`,
        summary: `Large ${w.side.toLowerCase()} order at ${w.price.toFixed(3)}`,
        detail: `A trader executed a $${w.size.toFixed(0)} ${w.side} order. This suggests ${w.side === 'BUY' ? 'bullish' : 'bearish'} sentiment from a significant market participant.`
      })
    })
    
    // Book imbalance
    if (book?.bids?.length && book?.asks?.length) {
      const bidVol = book.bids.slice(0, 5).reduce((s, b) => s + parseFloat(b.size), 0)
      const askVol = book.asks.slice(0, 5).reduce((s, a) => s + parseFloat(a.size), 0)
      const ratio = bidVol / (bidVol + askVol)
      
      if (ratio > 0.6 || ratio < 0.4) {
        sigs.push({
          id: 'imbalance',
          icon: '📊',
          level: ratio > 0.7 || ratio < 0.3 ? 'HIGH' : 'MODERATE',
          levelClass: ratio > 0.7 || ratio < 0.3 ? 'text-orange-400 bg-orange-500/20' : 'text-yellow-400 bg-yellow-500/20',
          title: `Book ${ratio > 0.5 ? 'bid' : 'ask'} heavy`,
          summary: `${(ratio * 100).toFixed(0)}% bid / ${((1 - ratio) * 100).toFixed(0)}% ask imbalance`,
          detail: `The order book shows ${ratio > 0.5 ? 'more buyers' : 'more sellers'} waiting. This can indicate near-term price pressure.`
        })
      }
    }
    
    // Volume signal
    if (selected?.volume24hr > 50000) {
      sigs.push({
        id: 'volume',
        icon: '🔥',
        level: selected.volume24hr > 200000 ? 'HIGH' : 'MODERATE',
        levelClass: selected.volume24hr > 200000 ? 'text-orange-400 bg-orange-500/20' : 'text-yellow-400 bg-yellow-500/20',
        title: `High volume: $${(selected.volume24hr / 1000).toFixed(0)}K`,
        summary: 'Active trading in this market today',
        detail: `This market has traded $${selected.volume24hr.toLocaleString()} in the last 24 hours, indicating high interest.`
      })
    }
    
    return sigs
  }, [whales, book, selected])

  // Calculate score
  const { score, breakdown } = useMemo(() => {
    let whaleScore = 50, bookScore = 50, volScore = 50
    
    if (whales.length) {
      const buyVol = whales.filter(w => w.side === 'BUY').reduce((s, w) => s + w.size, 0)
      const sellVol = whales.filter(w => w.side === 'SELL').reduce((s, w) => s + w.size, 0)
      const total = buyVol + sellVol
      if (total > 0) whaleScore = Math.round((buyVol / total) * 100)
    }
    
    if (book?.bids?.length && book?.asks?.length) {
      const bidVol = book.bids.slice(0, 10).reduce((s, b) => s + parseFloat(b.size), 0)
      const askVol = book.asks.slice(0, 10).reduce((s, a) => s + parseFloat(a.size), 0)
      bookScore = Math.round((bidVol / (bidVol + askVol)) * 100)
    }
    
    if (selected?.volume24hr) {
      volScore = Math.min(100, Math.round((selected.volume24hr / 100000) * 50 + 50))
    }
    
    return {
      score: Math.round(whaleScore * 0.4 + bookScore * 0.4 + volScore * 0.2),
      breakdown: [
        { icon: '🐋', name: 'Whales', value: whaleScore, color: 'bg-green-500' },
        { icon: '📊', name: 'Book', value: bookScore, color: 'bg-blue-500' },
        { icon: '📈', name: 'Volume', value: volScore, color: 'bg-purple-500' },
      ]
    }
  }, [whales, book, selected])

  return (
    <div className="min-h-screen bg-[#0a0e17]" style={{
      backgroundImage: 'radial-gradient(ellipse at 20% 20%, rgba(34,197,94,0.03) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(239,68,68,0.03) 0%, transparent 50%)'
    }}>
      <Header lastUpdate={lastUpdate} error={error} />
      <WhaleTicker whales={whales} />
      <MarketList markets={markets} selected={selected} onSelect={setSelected} loading={loading} />
      
      {selected && (
        <div className="px-4 py-3 border-b border-slate-700">
          <div className="text-sm font-medium text-white">{selected.question}</div>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-2xl font-bold text-cyan-400">
              {(parseFloat(selected.outcomePrices?.[0] || 0.5) * 100).toFixed(1)}¢
            </span>
            <span className="text-[10px] text-slate-500">
              Vol: ${parseFloat(selected.volume24hr || 0).toLocaleString()} • 
              Liq: ${parseFloat(selected.liquidity || 0).toLocaleString()}
            </span>
          </div>
        </div>
      )}
      
      <div className="p-4 space-y-4 max-w-6xl mx-auto">
        <SignalFeed signals={signals} />
        
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
          <OrderBook book={book} loading={!selected} />
          <ScoreDial score={score} breakdown={breakdown} />
        </div>
      </div>
      
      <footer className="border-t border-slate-800 px-4 py-2 text-[9px] text-slate-500 flex justify-between">
        <span>ELCARO OS v1.0</span>
        <span>Polymarket Data • Auto-refresh 5s</span>
      </footer>
    </div>
  )
}
