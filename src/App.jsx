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

export default function App() {
  const [markets, setMarkets] = useState([])
  const [selected, setSelected] = useState(null)
  const [book, setBook] = useState(null)
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [time, setTime] = useState(new Date())
  const [expanded, setExpanded] = useState(new Set())
  const [paused, setPaused] = useState(false)
  
  // Pause refresh when reading
  const pauseTimeout = useRef(null)
  
  const handleExpand = (id) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
        // Pause refreshes for 30 seconds when expanding
        setPaused(true)
        clearTimeout(pauseTimeout.current)
        pauseTimeout.current = setTimeout(() => setPaused(false), 30000)
      }
      return next
    })
  }

  useEffect(() => {
    const load = async () => {
      if (paused) return // Skip refresh if user is reading
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
  }, [paused])

  useEffect(() => {
    const token = getToken(selected)
    if (!token) { setBook(null); setTrades([]); return }
    
    const load = async () => {
      if (paused) return // Skip refresh if user is reading
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
  }, [selected, paused])

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
      .filter(t => t.size >= 50)
      .sort((a,b) => new Date(b.time) - new Date(a.time))
      .slice(0, 15)
  }, [trades])

  // Enhanced signals with stable IDs
  const signals = useMemo(() => {
    const s = []
    const price = getPrice(selected)
    const vol = safeNum(selected?.volume24hr)
    const liq = safeNum(selected?.liquidity)
    
    // Whale activity signals - use index for stable ID
    if (whales.length > 0) {
      const recentWhales = whales.slice(0, 5)
      const buyWhales = recentWhales.filter(w => w.side === 'BUY')
      const sellWhales = recentWhales.filter(w => w.side === 'SELL')
      const totalBuy = buyWhales.reduce((a, w) => a + w.size, 0)
      const totalSell = sellWhales.reduce((a, w) => a + w.size, 0)
      const netFlow = totalBuy - totalSell
      
      recentWhales.slice(0, 3).forEach((w, idx) => {
        const mins = Math.floor((Date.now() - new Date(w.time)) / 60000)
        const timeStr = mins < 1 ? 'just now' : mins < 60 ? `${mins}m ago` : `${Math.floor(mins/60)}h ago`
        const priceImpact = w.size > 1000 ? 'may move price 1-3%' : 'minimal price impact'
        
        s.push({
          id: `whale-${idx}`, // Stable index-based ID
          icon: '🐋',
          level: w.size > 2000 ? 'CRITICAL' : w.size > 500 ? 'HIGH' : 'MODERATE',
          cls: w.size > 2000 ? 'text-red-400 bg-red-500/20' : w.size > 500 ? 'text-orange-400 bg-orange-500/20' : 'text-yellow-400 bg-yellow-500/20',
          title: `$${fmt(w.size)} ${w.side} Detected`,
          sub: `Executed at ${(w.price*100).toFixed(1)}¢ • ${timeStr}`,
          detail: `A ${w.side === 'BUY' ? 'buyer' : 'seller'} placed a $${w.size.toFixed(0)} order at ${(w.price*100).toFixed(1)}¢. This is ${w.size > vol * 0.01 ? 'significant relative to daily volume' : 'a moderate-sized trade'}. ${w.side === 'BUY' ? 'Bullish signal - smart money may be accumulating YES shares.' : 'Bearish signal - large holder may be exiting or shorting.'} Expected impact: ${priceImpact}.`
        })
      })
      
      if (Math.abs(netFlow) > 200) {
        s.push({
          id: 'flow',
          icon: netFlow > 0 ? '📈' : '📉',
          level: Math.abs(netFlow) > 1000 ? 'HIGH' : 'MODERATE',
          cls: netFlow > 0 ? 'text-green-400 bg-green-500/20' : 'text-red-400 bg-red-500/20',
          title: `Net Flow: ${netFlow > 0 ? '+' : ''}$${fmt(netFlow)}`,
          sub: `${buyWhales.length} buys ($${fmt(totalBuy)}) vs ${sellWhales.length} sells ($${fmt(totalSell)})`,
          detail: `Recent whale activity shows ${netFlow > 0 ? 'net buying pressure' : 'net selling pressure'}. ${Math.abs(netFlow) > 1000 ? 'This is a strong directional signal.' : 'Moderate signal strength.'} ${netFlow > 0 ? 'Institutions may be positioning for YES outcome. Consider following the smart money if fundamentals align.' : 'Large holders are reducing exposure. This could indicate insider knowledge or profit-taking. Proceed with caution.'}`
        })
      }
    }
    
    if (book?.bids?.length && book?.asks?.length) {
      const bidDepth = book.bids.slice(0,10).reduce((a,b) => a + safeNum(b.size), 0)
      const askDepth = book.asks.slice(0,10).reduce((a,b) => a + safeNum(b.size), 0)
      const totalDepth = bidDepth + askDepth
      const ratio = totalDepth > 0 ? bidDepth / totalDepth : 0.5
      const spread = safeNum(book.asks[0]?.price) - safeNum(book.bids[0]?.price)
      const spreadPct = spread * 100
      
      s.push({
        id: 'book',
        icon: '📊',
        level: ratio > 0.65 || ratio < 0.35 ? 'HIGH' : 'MODERATE',
        cls: ratio > 0.55 ? 'text-green-400 bg-green-500/20' : ratio < 0.45 ? 'text-red-400 bg-red-500/20' : 'text-blue-400 bg-blue-500/20',
        title: `Book Imbalance: ${(ratio*100).toFixed(0)}% Bids`,
        sub: `$${fmt(bidDepth)} buying vs $${fmt(askDepth)} selling pressure`,
        detail: `The order book shows ${ratio > 0.55 ? 'more buyers than sellers' : ratio < 0.45 ? 'more sellers than buyers' : 'balanced positioning'}. Top 10 levels: $${fmt(bidDepth)} in bids, $${fmt(askDepth)} in asks. ${ratio > 0.6 ? 'Strong buy-side support suggests price floor. Dips may be bought quickly.' : ratio < 0.4 ? 'Heavy sell-side pressure. Rallies may face resistance. Consider waiting for better entry.' : 'Neutral positioning - market is undecided. Watch for catalyst to break the stalemate.'}`
      })
      
      if (spreadPct > 1) {
        s.push({
          id: 'spread',
          icon: '↔️',
          level: spreadPct > 3 ? 'HIGH' : 'MODERATE',
          cls: 'text-purple-400 bg-purple-500/20',
          title: `Wide Spread: ${spreadPct.toFixed(1)}¢`,
          sub: `Bid: ${(safeNum(book.bids[0]?.price)*100).toFixed(1)}¢ → Ask: ${(safeNum(book.asks[0]?.price)*100).toFixed(1)}¢`,
          detail: `The bid-ask spread is ${spreadPct.toFixed(2)}¢ (${(spreadPct/price*100).toFixed(1)}% of price). ${spreadPct > 3 ? 'This is unusually wide, indicating low liquidity or high uncertainty. Market makers are demanding premium for risk. Use limit orders to avoid slippage.' : 'Moderate spread. Liquidity is acceptable but use limit orders for larger positions.'} Cost to round-trip: ~${(spreadPct*2).toFixed(1)}¢ per share.`
        })
      }
    }
    
    if (vol > 50000) {
      const volToLiq = liq > 0 ? vol / liq : 0
      const turnover = volToLiq > 5 ? 'extremely high turnover' : volToLiq > 2 ? 'high turnover' : 'normal turnover'
      
      s.push({
        id: 'vol',
        icon: '🔥',
        level: vol > 1000000 ? 'CRITICAL' : vol > 200000 ? 'HIGH' : 'MODERATE',
        cls: vol > 500000 ? 'text-red-400 bg-red-500/20' : vol > 200000 ? 'text-orange-400 bg-orange-500/20' : 'text-yellow-400 bg-yellow-500/20',
        title: `24h Volume: $${fmt(vol)}`,
        sub: `${turnover} • ${volToLiq.toFixed(1)}x liquidity traded`,
        detail: `This market traded $${vol.toLocaleString()} in the past 24 hours. ${vol > 500000 ? 'Exceptional activity - this is a hot market with strong conviction on both sides. High volume often precedes major price moves.' : vol > 200000 ? 'Above-average activity indicates growing interest. Catalyst may be approaching.' : 'Healthy trading activity. Market has sufficient interest for reliable price discovery.'} Volume/liquidity ratio: ${volToLiq.toFixed(1)}x (${turnover}).`
      })
    }
    
    if (liq > 50000) {
      const depthScore = liq > 1000000 ? 'institutional-grade' : liq > 500000 ? 'deep' : liq > 200000 ? 'adequate' : 'thin'
      const slippage = liq > 500000 ? '<0.5%' : liq > 200000 ? '0.5-1%' : '1-3%'
      
      s.push({
        id: 'liq',
        icon: '💧',
        level: liq > 500000 ? 'HIGH' : 'INFO',
        cls: 'text-cyan-400 bg-cyan-500/20',
        title: `Liquidity: $${fmt(liq)}`,
        sub: `${depthScore} depth • Est. slippage: ${slippage} on $1K order`,
        detail: `$${liq.toLocaleString()} available liquidity. Depth rating: ${depthScore}. ${liq > 500000 ? 'You can trade $5K+ with minimal slippage. Suitable for larger positions.' : liq > 200000 ? 'Adequate for positions up to $2K. Larger orders should be split.' : 'Thin liquidity - use small position sizes and limit orders. Expect 1-3% slippage on market orders.'} Recommended max position: $${fmt(liq * 0.02)} (2% of liquidity).`
      })
    }
    
    if (price > 0.85 || price < 0.15) {
      const impliedProb = price * 100
      
      s.push({
        id: 'price',
        icon: price > 0.85 ? '🎯' : '⚠️',
        level: 'HIGH',
        cls: price > 0.85 ? 'text-green-400 bg-green-500/20' : 'text-red-400 bg-red-500/20',
        title: `${price > 0.85 ? 'High' : 'Low'} Probability: ${impliedProb.toFixed(0)}%`,
        sub: `Market strongly expects ${price > 0.85 ? 'YES' : 'NO'} outcome`,
        detail: `At ${impliedProb.toFixed(1)}¢, the market implies ${impliedProb.toFixed(0)}% probability of YES. ${price > 0.85 ? `Betting YES offers ${(100-impliedProb).toFixed(0)}% max return but high risk if wrong. Betting NO could yield ${(impliedProb/(1-price)).toFixed(0)}x return on upset.` : `Betting NO offers ${impliedProb.toFixed(0)}% max return. Betting YES could yield ${((1-price)/price).toFixed(0)}x return if market is wrong.`} Consider: Is there information the market is missing?`
      })
    }
    
    if (trades.length >= 5) {
      const recent5 = trades.slice(0, 5)
      const avgPrice = recent5.reduce((a, t) => a + safeNum(t.price), 0) / 5
      const priceDiff = price - avgPrice
      const momentum = priceDiff > 0.02 ? 'upward' : priceDiff < -0.02 ? 'downward' : 'neutral'
      
      if (Math.abs(priceDiff) > 0.01) {
        s.push({
          id: 'momentum',
          icon: priceDiff > 0 ? '🚀' : '🔻',
          level: Math.abs(priceDiff) > 0.03 ? 'HIGH' : 'MODERATE',
          cls: priceDiff > 0 ? 'text-green-400 bg-green-500/20' : 'text-red-400 bg-red-500/20',
          title: `${momentum.charAt(0).toUpperCase() + momentum.slice(1)} Momentum`,
          sub: `${priceDiff > 0 ? '+' : ''}${(priceDiff*100).toFixed(1)}¢ from recent avg`,
          detail: `Price is ${Math.abs(priceDiff*100).toFixed(1)}¢ ${priceDiff > 0 ? 'above' : 'below'} the recent trade average of ${(avgPrice*100).toFixed(1)}¢. ${Math.abs(priceDiff) > 0.03 ? 'Strong momentum - trend may continue.' : 'Moderate movement.'} ${priceDiff > 0 ? 'Buyers are in control. Consider riding the trend but watch for reversal.' : 'Sellers are pushing price down. Wait for stabilization before buying.'}`
        })
      }
    }
    
    return s.sort((a, b) => {
      const order = { CRITICAL: 0, HIGH: 1, MODERATE: 2, INFO: 3 }
      return (order[a.level] ?? 4) - (order[b.level] ?? 4)
    })
  }, [whales, book, selected, trades])

  const score = useMemo(() => {
    let ws = 50, bs = 50
    if (whales.length) {
      const buy = whales.filter(w => w.side === 'BUY').reduce((a,w) => a + w.size, 0)
      const sell = whales.filter(w => w.side === 'SELL').reduce((a,w) => a + w.size, 0)
      if (buy + sell > 0) ws = Math.round(buy / (buy + sell) * 100)
    }
    if (book?.bids?.length && book?.asks?.length) {
      const bv = book.bids.slice(0,10).reduce((a,b) => a + safeNum(b.size), 0)
      const av = book.asks.slice(0,10).reduce((a,b) => a + safeNum(b.size), 0)
      if (bv + av > 0) bs = Math.round(bv / (bv + av) * 100)
    }
    return Math.round(ws * 0.5 + bs * 0.5)
  }, [whales, book])

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
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${error ? 'bg-red-500' : paused ? 'bg-yellow-500' : 'bg-green-500'} animate-pulse`} />
          <span className={`text-[10px] ${error ? 'text-red-400' : paused ? 'text-yellow-400' : 'text-green-400'}`}>
            {error ? 'ERROR' : paused ? 'PAUSED' : 'LIVE'}
          </span>
          <span className="text-[9px] text-slate-500 ml-1">{time.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Pause indicator */}
      {paused && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/30 px-4 py-1.5 flex items-center justify-between">
          <span className="text-[10px] text-yellow-400">⏸ Auto-refresh paused while reading</span>
          <button 
            onClick={() => { setPaused(false); setExpanded(new Set()) }}
            className="text-[10px] text-yellow-400 hover:text-yellow-300 underline"
          >
            Resume
          </button>
        </div>
      )}

      {/* Whale Ticker */}
      <div className="h-9 px-4 flex items-center gap-3 border-b border-slate-800 overflow-x-auto">
        <span className="text-[10px] text-slate-500 shrink-0">🐋</span>
        {whales.length === 0 ? (
          <span className="text-[10px] text-slate-600">Scanning for whale activity...</span>
        ) : whales.slice(0,8).map((w, i) => (
          <span key={i} className={`text-[10px] px-2 py-0.5 rounded border whitespace-nowrap ${w.side === 'BUY' ? 'border-green-500/30 text-green-400' : 'border-red-500/30 text-red-400'}`}>
            {w.side === 'BUY' ? '▲' : '▼'} ${fmt(w.size)} @{(w.price*100).toFixed(0)}¢
          </span>
        ))}
      </div>

      {/* Markets */}
      <div className="flex gap-2 p-2 border-b border-slate-800 overflow-x-auto">
        {loading ? (
          <span className="text-xs text-slate-500 animate-pulse">Loading markets...</span>
        ) : markets.slice(0,8).map(m => (
          <button key={m.id} onClick={() => { setSelected(m); setExpanded(new Set()); setPaused(false) }}
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
            <span className="text-[11px] font-semibold">INTELLIGENCE FEED</span>
            <span className="text-[9px] text-slate-600 bg-slate-800 px-2 py-0.5 rounded">{signals.length} signals</span>
            {hasExpanded && (
              <button 
                onClick={() => { setExpanded(new Set()); setPaused(false) }}
                className="ml-auto text-[9px] text-slate-500 hover:text-slate-300"
              >
                Collapse all
              </button>
            )}
          </div>
          <div className="divide-y divide-slate-800/50 max-h-[450px] overflow-y-auto">
            {signals.length === 0 ? (
              <div className="p-4 text-xs text-slate-600">Analyzing market data...</div>
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
                      <div className="mt-2 p-3 bg-slate-800/70 rounded text-[10px] text-slate-300 leading-relaxed border-l-2 border-cyan-500/50">
                        {s.detail}
                      </div>
                    )}
                    {!expanded.has(s.id) && (
                      <div className="text-[9px] text-cyan-500/70 mt-1">tap for analysis →</div>
                    )}
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
                  <div className="text-green-500 text-[9px] mb-1">BIDS (BUY)</div>
                  {book.bids.slice(0,8).map((b,i) => (
                    <div key={i} className="flex justify-between py-0.5">
                      <span className="text-slate-500">{fmt(b.size)}</span>
                      <span className="text-green-400/80">{(safeNum(b.price)*100).toFixed(1)}¢</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="text-red-500 text-[9px] mb-1">ASKS (SELL)</div>
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
            <div className="text-[9px] text-slate-600 text-center mt-3">
              Based on whale flow + order book
            </div>
          </div>
        </div>
      </div>

      <footer className="border-t border-slate-800 px-4 py-2 text-[9px] text-slate-600 flex justify-between">
        <span>ELCARO OS v1.3</span>
        <span>{paused ? '⏸ Paused' : 'Live'} • 5s refresh</span>
      </footer>
    </div>
  )
}
