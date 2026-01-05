import { useState, useEffect, useMemo, useRef } from 'react'

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

// Extract keywords from market questions
const extractKeywords = (markets) => {
  const stopWords = new Set(['will', 'the', 'be', 'to', 'in', 'of', 'a', 'an', 'and', 'or', 'for', 'on', 'at', 'by', 'is', 'it', 'as', 'with', 'that', 'this', 'from', 'are', 'was', 'were', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'but', 'not', 'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'just', 'should', 'now', 'before', 'after', 'during', 'above', 'below', 'between', 'into', 'through', 'about', 'against', 'its', 'his', 'her', 'their', 'our', 'your', 'any', 'if', 'then', 'else', 'over', 'under', 'again', 'further', 'once', 'here', 'there', 'these', 'those', 'am', 'being', 'having', 'doing', 'would', 'could', 'might', 'must', 'shall', 'may', 'need', 'dare', 'ought', 'used', 'get', 'make', 'go', 'see', 'come', 'take', 'know', 'think', 'say', 'let', 'put', 'give', 'first', 'last', 'next', 'new', 'old', 'high', 'low', 'end', 'win', 'lose', 'yes', 'no'])
  
  const keywordMap = {}
  
  markets.forEach(m => {
    const question = m.question || ''
    const words = question.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/)
    const vol = safeNum(m.volume24hr)
    const liq = safeNum(m.liquidity)
    const price = getPrice(m)
    const potential = Math.min(price, 1 - price) * 2 // How close to 50/50
    const createdAt = new Date(m.createdAt || m.startDate || 0).getTime()
    const recency = Math.max(0, 1 - (Date.now() - createdAt) / (30 * 24 * 60 * 60 * 1000)) // 0-1 based on last 30 days
    
    words.forEach(word => {
      if (word.length < 3 || stopWords.has(word)) return
      if (!keywordMap[word]) {
        keywordMap[word] = { word, volume: 0, count: 0, potential: 0, recency: 0, markets: [] }
      }
      keywordMap[word].volume += vol
      keywordMap[word].count += 1
      keywordMap[word].potential += potential
      keywordMap[word].recency += recency
      keywordMap[word].markets.push(m.id)
    })
  })
  
  // Score and sort keywords
  return Object.values(keywordMap)
    .map(k => ({
      ...k,
      score: (k.volume / 1000000) * 0.4 + k.count * 0.2 + (k.potential / k.count) * 0.2 + (k.recency / k.count) * 0.2
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 30)
}

export default function App() {
  const [allMarkets, setAllMarkets] = useState([])
  const [markets, setMarkets] = useState([])
  const [selected, setSelected] = useState(null)
  const [book, setBook] = useState(null)
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [time, setTime] = useState(new Date())
  const [expanded, setExpanded] = useState(new Set())
  const [paused, setPaused] = useState(false)
  const [priceHistory, setPriceHistory] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [showSearch, setShowSearch] = useState(false)
  const [searching, setSearching] = useState(false)
  
  const pauseTimeout = useRef(null)
  const searchTimeout = useRef(null)
  
  const handleExpand = (id) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
        setPaused(true)
        clearTimeout(pauseTimeout.current)
        pauseTimeout.current = setTimeout(() => setPaused(false), 30000)
      }
      return next
    })
  }

  // Fetch all markets for search
  useEffect(() => {
    const load = async () => {
      if (paused) return
      try {
        const r = await fetch(`${GAMMA}/markets?active=true&closed=false&limit=100&order=volume24hr&ascending=false`)
        const d = await r.json()
        setAllMarkets(d || [])
        const filtered = (d || []).filter(m => safeNum(m.volume24hr) > 5000).slice(0, 15)
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
  }, [paused])

  // Search handler
  const handleSearch = async (query) => {
    setSearchQuery(query)
    clearTimeout(searchTimeout.current)
    
    if (query.length < 2) {
      setSearchResults([])
      return
    }
    
    setSearching(true)
    searchTimeout.current = setTimeout(async () => {
      try {
        // Search in loaded markets first
        const localResults = allMarkets.filter(m => 
          m.question?.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 20)
        
        // Also try API search
        const r = await fetch(`${GAMMA}/markets?active=true&closed=false&limit=20&order=volume24hr&ascending=false`)
        const apiResults = await r.json()
        const filtered = (apiResults || []).filter(m => 
          m.question?.toLowerCase().includes(query.toLowerCase())
        )
        
        // Merge and dedupe
        const merged = [...localResults]
        filtered.forEach(m => {
          if (!merged.find(x => x.id === m.id)) merged.push(m)
        })
        
        setSearchResults(merged.slice(0, 15))
      } catch (e) {
        setSearchResults(allMarkets.filter(m => 
          m.question?.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 15))
      }
      setSearching(false)
    }, 300)
  }

  // Keywords cloud
  const keywords = useMemo(() => extractKeywords(allMarkets), [allMarkets])

  useEffect(() => {
    const token = getToken(selected)
    if (!token) { setBook(null); setTrades([]); return }
    
    const load = async () => {
      if (paused) return
      try {
        const [b, t] = await Promise.all([
          fetch(`${CLOB}/book?token_id=${token}`).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(`${CLOB}/trades?asset_id=${token}&limit=100`).then(r => r.ok ? r.json() : []).catch(() => [])
        ])
        setBook(b)
        const tradesArr = Array.isArray(t) ? t : []
        setTrades(tradesArr)
        
        if (tradesArr.length > 0) {
          const latestPrice = safeNum(tradesArr[0]?.price)
          setPriceHistory(prev => [...prev, { price: latestPrice, time: Date.now() }].slice(-20))
        }
      } catch {}
    }
    load()
    const i = setInterval(load, 5000)
    return () => clearInterval(i)
  }, [selected, paused])

  const recentTrades = useMemo(() => {
    if (!Array.isArray(trades)) return []
    const fifteenMinsAgo = Date.now() - 15 * 60 * 1000
    return trades
      .map(t => ({ 
        id: t.id || Math.random().toString(36).slice(2),
        side: t.side?.toUpperCase() || 'BUY', 
        size: safeNum(t.size) * safeNum(t.price),
        price: safeNum(t.price),
        time: new Date(t.match_time).getTime()
      }))
      .filter(t => t.time > fifteenMinsAgo && t.size >= 50)
      .sort((a,b) => b.time - a.time)
  }, [trades])

  const signals = useMemo(() => {
    const s = []
    const now = Date.now()
    const price = getPrice(selected)
    const vol = safeNum(selected?.volume24hr)
    const liq = safeNum(selected?.liquidity)
    
    if (book?.bids?.length && book?.asks?.length) {
      const bestBid = safeNum(book.bids[0]?.price)
      const bestAsk = safeNum(book.asks[0]?.price)
      const spread = bestAsk - bestBid
      const spreadPct = spread * 100
      const mid = (bestBid + bestAsk) / 2
      
      const bidDepth5 = book.bids.slice(0,5).reduce((a,b) => a + safeNum(b.size), 0)
      const askDepth5 = book.asks.slice(0,5).reduce((a,b) => a + safeNum(b.size), 0)
      const totalDepth5 = bidDepth5 + askDepth5
      const imbalance5 = totalDepth5 > 0 ? (bidDepth5 - askDepth5) / totalDepth5 : 0
      
      const bidDepthFull = book.bids.reduce((a,b) => a + safeNum(b.size), 0)
      const askDepthFull = book.asks.reduce((a,b) => a + safeNum(b.size), 0)
      
      const pressureDirection = imbalance5 > 0.15 ? 'BUY' : imbalance5 < -0.15 ? 'SELL' : 'NEUTRAL'
      const pressureStrength = Math.abs(imbalance5)
      
      if (pressureStrength > 0.1) {
        s.push({
          id: 'pressure',
          icon: imbalance5 > 0 ? '🟢' : '🔴',
          level: pressureStrength > 0.3 ? 'CRITICAL' : pressureStrength > 0.2 ? 'HIGH' : 'MODERATE',
          cls: imbalance5 > 0 ? 'text-green-400 bg-green-500/20' : 'text-red-400 bg-red-500/20',
          title: `${pressureDirection} Pressure: ${(pressureStrength * 100).toFixed(0)}%`,
          sub: `NOW • $${fmt(bidDepth5)} bids vs $${fmt(askDepth5)} asks`,
          detail: `Real-time order book shows ${imbalance5 > 0 ? 'buyers outweighing sellers' : 'sellers outweighing buyers'} by ${(pressureStrength * 100).toFixed(0)}%. Bid depth: $${fmt(bidDepthFull)} total. Ask depth: $${fmt(askDepthFull)} total. ${imbalance5 > 0.2 ? 'Strong buy wall - price likely to push up.' : imbalance5 < -0.2 ? 'Heavy sell pressure - expect downward movement.' : 'Moderate imbalance.'}`
        })
      }
      
      if (spreadPct > 0.5) {
        s.push({
          id: 'spread',
          icon: '↔️',
          level: spreadPct > 3 ? 'HIGH' : 'MODERATE',
          cls: spreadPct > 3 ? 'text-orange-400 bg-orange-500/20' : 'text-purple-400 bg-purple-500/20',
          title: `Spread: ${spreadPct.toFixed(2)}¢`,
          sub: `NOW • Bid ${(bestBid*100).toFixed(1)}¢ → Ask ${(bestAsk*100).toFixed(1)}¢`,
          detail: `Current spread is ${spreadPct.toFixed(2)}¢. ${spreadPct > 3 ? 'Wide spread - use limit orders only.' : 'Moderate spread.'} Round-trip cost: ~${(spreadPct*2).toFixed(1)}¢ per share.`
        })
      }
      
      const bidWall = book.bids.find(b => safeNum(b.size) > bidDepthFull * 0.3)
      const askWall = book.asks.find(a => safeNum(a.size) > askDepthFull * 0.3)
      
      if (bidWall) {
        s.push({
          id: 'bid-wall',
          icon: '🧱',
          level: 'HIGH',
          cls: 'text-green-400 bg-green-500/20',
          title: `Buy Wall: $${fmt(bidWall.size)} at ${(safeNum(bidWall.price)*100).toFixed(1)}¢`,
          sub: `NOW • Strong support level`,
          detail: `A $${fmt(bidWall.size)} buy order at ${(safeNum(bidWall.price)*100).toFixed(1)}¢ creates strong support. Price unlikely to fall below without significant selling.`
        })
      }
      
      if (askWall) {
        s.push({
          id: 'ask-wall',
          icon: '🧱',
          level: 'HIGH',
          cls: 'text-red-400 bg-red-500/20',
          title: `Sell Wall: $${fmt(askWall.size)} at ${(safeNum(askWall.price)*100).toFixed(1)}¢`,
          sub: `NOW • Resistance level`,
          detail: `A $${fmt(askWall.size)} sell order at ${(safeNum(askWall.price)*100).toFixed(1)}¢ creates resistance. Watch for wall removal as bullish signal.`
        })
      }
    }
    
    if (recentTrades.length > 0) {
      const buyTrades = recentTrades.filter(t => t.side === 'BUY')
      const sellTrades = recentTrades.filter(t => t.side === 'SELL')
      const buyVol = buyTrades.reduce((a, t) => a + t.size, 0)
      const sellVol = sellTrades.reduce((a, t) => a + t.size, 0)
      const netFlow = buyVol - sellVol
      const totalFlow = buyVol + sellVol
      
      if (totalFlow > 100) {
        s.push({
          id: 'flow-15m',
          icon: netFlow > 0 ? '📈' : netFlow < 0 ? '📉' : '➡️',
          level: Math.abs(netFlow) > 1000 ? 'HIGH' : 'MODERATE',
          cls: netFlow > 0 ? 'text-green-400 bg-green-500/20' : netFlow < 0 ? 'text-red-400 bg-red-500/20' : 'text-slate-400 bg-slate-500/20',
          title: `15min Flow: ${netFlow > 0 ? '+' : ''}$${fmt(netFlow)}`,
          sub: `RECENT • ${buyTrades.length} buys vs ${sellTrades.length} sells`,
          detail: `Last 15 min: ${recentTrades.length} trades, $${fmt(totalFlow)} volume. ${netFlow > 0 ? 'Buyers aggressive.' : netFlow < 0 ? 'Sellers in control.' : 'Balanced.'}`
        })
      }
      
      const whales = recentTrades.filter(t => t.size >= 500).slice(0, 3)
      whales.forEach((w, idx) => {
        const minsAgo = Math.floor((now - w.time) / 60000)
        s.push({
          id: `whale-${idx}`,
          icon: '🐋',
          level: w.size > 2000 ? 'CRITICAL' : 'HIGH',
          cls: w.side === 'BUY' ? 'text-green-400 bg-green-500/20' : 'text-red-400 bg-red-500/20',
          title: `$${fmt(w.size)} ${w.side}`,
          sub: `${minsAgo}m ago • at ${(w.price*100).toFixed(1)}¢`,
          detail: `Whale ${w.side === 'BUY' ? 'bought' : 'sold'} $${w.size.toFixed(0)} at ${(w.price*100).toFixed(1)}¢. ${w.side === 'BUY' ? 'Bullish signal.' : 'Bearish signal.'}`
        })
      })
    }
    
    if (priceHistory.length >= 3) {
      const latest = priceHistory[priceHistory.length - 1]?.price || price
      const oldest = priceHistory[0]?.price || price
      const change = latest - oldest
      const changePct = oldest > 0 ? (change / oldest) * 100 : 0
      
      if (Math.abs(changePct) > 0.5) {
        s.push({
          id: 'momentum',
          icon: change > 0 ? '🚀' : '🔻',
          level: Math.abs(changePct) > 2 ? 'HIGH' : 'MODERATE',
          cls: change > 0 ? 'text-green-400 bg-green-500/20' : 'text-red-400 bg-red-500/20',
          title: `${change > 0 ? 'Rising' : 'Falling'}: ${change > 0 ? '+' : ''}${changePct.toFixed(1)}%`,
          sub: `TREND • ${(oldest*100).toFixed(1)}¢ → ${(latest*100).toFixed(1)}¢`,
          detail: `Price moved ${Math.abs(changePct).toFixed(1)}% ${change > 0 ? 'up' : 'down'} recently. ${change > 0 ? 'Buyers in control.' : 'Sellers pushing down.'}`
        })
      }
    }
    
    if (liq < 100000 && liq > 0) {
      s.push({
        id: 'low-liq', icon: '⚠️', level: 'HIGH', cls: 'text-yellow-400 bg-yellow-500/20',
        title: `Low Liquidity: $${fmt(liq)}`, sub: `CAUTION • High slippage risk`,
        detail: `Only $${fmt(liq)} liquidity. Use small positions and limit orders.`
      })
    } else if (liq >= 500000) {
      s.push({
        id: 'high-liq', icon: '💧', level: 'INFO', cls: 'text-cyan-400 bg-cyan-500/20',
        title: `Deep Liquidity: $${fmt(liq)}`, sub: `GOOD • Institutional depth`,
        detail: `$${fmt(liq)} available. Trade up to $${fmt(liq * 0.05)} with minimal slippage.`
      })
    }
    
    if (price > 0.9 || price < 0.1) {
      s.push({
        id: 'extreme', icon: price > 0.9 ? '🎯' : '💀', level: 'HIGH',
        cls: price > 0.9 ? 'text-green-400 bg-green-500/20' : 'text-red-400 bg-red-500/20',
        title: `${price > 0.9 ? 'Near Certain' : 'Near Zero'}: ${(price*100).toFixed(0)}%`,
        sub: `PROBABILITY • Strong consensus`,
        detail: `At ${(price*100).toFixed(1)}¢, market implies ${(price*100).toFixed(0)}% YES. ${price > 0.9 ? `NO pays ${(price/(1-price)).toFixed(1)}x on upset.` : `YES pays ${((1-price)/price).toFixed(1)}x if wrong.`}`
      })
    }
    
    const levelOrder = { CRITICAL: 0, HIGH: 1, MODERATE: 2, INFO: 3 }
    return s.sort((a, b) => (levelOrder[a.level] ?? 4) - (levelOrder[b.level] ?? 4))
  }, [book, recentTrades, selected, priceHistory])

  const score = useMemo(() => {
    let ws = 50, bs = 50
    if (recentTrades.length > 0) {
      const buy = recentTrades.filter(w => w.side === 'BUY').reduce((a,w) => a + w.size, 0)
      const sell = recentTrades.filter(w => w.side === 'SELL').reduce((a,w) => a + w.size, 0)
      if (buy + sell > 0) ws = Math.round(buy / (buy + sell) * 100)
    }
    if (book?.bids?.length && book?.asks?.length) {
      const bv = book.bids.slice(0,10).reduce((a,b) => a + safeNum(b.size), 0)
      const av = book.asks.slice(0,10).reduce((a,b) => a + safeNum(b.size), 0)
      if (bv + av > 0) bs = Math.round(bv / (bv + av) * 100)
    }
    return Math.round(ws * 0.5 + bs * 0.5)
  }, [recentTrades, book])

  const price = getPrice(selected)
  const hasExpanded = expanded.size > 0

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
        <div className="flex items-center gap-3">
          <button onClick={() => setShowSearch(!showSearch)} className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </button>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${error ? 'bg-red-500' : paused ? 'bg-yellow-500' : 'bg-green-500'} animate-pulse`} />
            <span className={`text-[10px] ${error ? 'text-red-400' : paused ? 'text-yellow-400' : 'text-green-400'}`}>
              {error ? 'ERROR' : paused ? 'PAUSED' : 'LIVE'}
            </span>
          </div>
        </div>
      </div>

      {/* Search Panel */}
      {showSearch && (
        <div className="border-b border-slate-800 bg-slate-900/80">
          <div className="p-4">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search markets... (e.g. Trump, Bitcoin, NBA)"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                autoFocus
              />
              {searching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            
            {/* Keywords Cloud */}
            <div className="mt-3">
              <div className="text-[9px] text-slate-500 mb-2">TRENDING KEYWORDS</div>
              <div className="flex flex-wrap gap-1.5">
                {keywords.slice(0, 20).map((k, i) => {
                  const size = k.score > 2 ? 'text-sm' : k.score > 1 ? 'text-xs' : 'text-[10px]'
                  const opacity = k.score > 2 ? 'opacity-100' : k.score > 1 ? 'opacity-80' : 'opacity-60'
                  const color = k.volume > 5000000 ? 'text-cyan-400 border-cyan-500/30' 
                              : k.potential / k.count > 0.8 ? 'text-amber-400 border-amber-500/30'
                              : k.recency / k.count > 0.5 ? 'text-green-400 border-green-500/30'
                              : 'text-slate-400 border-slate-600/30'
                  return (
                    <button
                      key={k.word}
                      onClick={() => { handleSearch(k.word); setSearchQuery(k.word) }}
                      className={`px-2 py-0.5 rounded border ${size} ${opacity} ${color} hover:opacity-100 hover:bg-slate-800 transition-all`}
                    >
                      {k.word}
                    </button>
                  )
                })}
              </div>
              <div className="flex gap-4 mt-2 text-[9px] text-slate-600">
                <span><span className="text-cyan-400">●</span> High Volume</span>
                <span><span className="text-amber-400">●</span> High Potential</span>
                <span><span className="text-green-400">●</span> Recent</span>
              </div>
            </div>
            
            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mt-3 border-t border-slate-800 pt-3">
                <div className="text-[9px] text-slate-500 mb-2">RESULTS ({searchResults.length})</div>
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {searchResults.map(m => {
                    const p = getPrice(m)
                    return (
                      <button
                        key={m.id}
                        onClick={() => { setSelected(m); setShowSearch(false); setSearchQuery(''); setSearchResults([]) }}
                        className="w-full text-left p-2 rounded bg-slate-800/50 hover:bg-slate-800 transition-colors flex items-center justify-between"
                      >
                        <span className="text-[11px] text-slate-300 truncate flex-1 mr-3">{m.question}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-sm font-bold ${p > 0.5 ? 'text-green-400' : 'text-red-400'}`}>{(p*100).toFixed(0)}¢</span>
                          <span className="text-[9px] text-slate-600">${fmt(m.volume24hr)}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {paused && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/30 px-4 py-1.5 flex items-center justify-between">
          <span className="text-[10px] text-yellow-400">⏸ Paused while reading</span>
          <button onClick={() => { setPaused(false); setExpanded(new Set()) }} className="text-[10px] text-yellow-400 hover:text-yellow-300 underline">Resume</button>
        </div>
      )}

      {/* Whale Ticker */}
      <div className="h-9 px-4 flex items-center gap-3 border-b border-slate-800 overflow-x-auto">
        <span className="text-[10px] text-slate-500 shrink-0">🐋 LIVE</span>
        {recentTrades.filter(t => t.size >= 200).length === 0 ? (
          <span className="text-[10px] text-slate-600">No large trades in last 15min</span>
        ) : recentTrades.filter(t => t.size >= 200).slice(0,8).map((w, i) => {
          const minsAgo = Math.floor((Date.now() - w.time) / 60000)
          return (
            <span key={i} className={`text-[10px] px-2 py-0.5 rounded border whitespace-nowrap ${w.side === 'BUY' ? 'border-green-500/30 text-green-400' : 'border-red-500/30 text-red-400'}`}>
              {w.side === 'BUY' ? '▲' : '▼'} ${fmt(w.size)} • {minsAgo}m
            </span>
          )
        })}
      </div>

      {/* Markets */}
      <div className="flex gap-2 p-2 border-b border-slate-800 overflow-x-auto">
        {loading ? (
          <span className="text-xs text-slate-500 animate-pulse">Loading...</span>
        ) : markets.slice(0,8).map(m => (
          <button key={m.id} onClick={() => { setSelected(m); setExpanded(new Set()); setPaused(false); setPriceHistory([]) }}
            className={`px-3 py-2 rounded border min-w-[150px] text-left transition-all ${selected?.id === m.id ? 'bg-slate-800 border-cyan-500/50' : 'bg-slate-900 border-slate-700 hover:border-slate-600'}`}>
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
            <div className={`w-2 h-2 rounded-full ${paused ? 'bg-yellow-500' : 'bg-green-500'} animate-pulse`} />
            <span className="text-[11px] font-semibold">LIVE SIGNALS</span>
            <span className="text-[9px] text-slate-600 bg-slate-800 px-2 py-0.5 rounded">{signals.length}</span>
            {hasExpanded && (
              <button onClick={() => { setExpanded(new Set()); setPaused(false) }} className="ml-auto text-[9px] text-slate-500 hover:text-slate-300">Collapse all</button>
            )}
          </div>
          <div className="divide-y divide-slate-800/50 max-h-[400px] overflow-y-auto">
            {signals.length === 0 ? (
              <div className="p-4 text-xs text-slate-600">Analyzing...</div>
            ) : signals.map(s => (
              <div key={s.id} className={`p-3 cursor-pointer transition-all ${expanded.has(s.id) ? 'bg-slate-800/50' : 'hover:bg-slate-800/30'}`} onClick={() => handleExpand(s.id)}>
                <div className="flex items-start gap-3">
                  <span className="text-lg mt-0.5">{s.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${s.cls}`}>{s.level}</span>
                      <span className="text-[11px] text-slate-200 font-medium">{s.title}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{s.sub}</div>
                    {expanded.has(s.id) && s.detail && (
                      <div className="mt-2 p-3 bg-slate-800/70 rounded text-[10px] text-slate-300 leading-relaxed border-l-2 border-cyan-500/50">{s.detail}</div>
                    )}
                    {!expanded.has(s.id) && <div className="text-[9px] text-cyan-500/70 mt-1">tap for analysis →</div>}
                  </div>
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
                      <span className="text-green-400/80">{(safeNum(b.price)*100).toFixed(1)}¢</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="text-red-500 text-[9px] mb-1">ASKS</div>
                  {book.asks.slice(0,8).map((a,i) => (
                    <div key={i} className="flex justify-between py-0.5">
                      <span className="text-red-400/80">{(safeNum(a.price)*100).toFixed(1)}¢</span>
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
        <span>ELCARO OS v1.5</span>
        <span>{paused ? '⏸' : '●'} {allMarkets.length} markets indexed</span>
      </footer>
    </div>
  )
}
