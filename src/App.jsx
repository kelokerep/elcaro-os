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

// Signal Card Component - shows insight upfront
function SignalCard({ signal, compact = false }) {
  const [showMore, setShowMore] = useState(false)
  
  if (compact) {
    return (
      <div className={`p-2 rounded-lg border ${signal.borderCls} ${signal.bgCls}`}>
        <div className="flex items-center gap-2">
          <span className="text-base">{signal.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-medium text-slate-200">{signal.title}</div>
            <div className="text-[9px] text-slate-400">{signal.insight}</div>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className={`p-3 rounded-lg border ${signal.borderCls} ${signal.bgCls}`}>
      <div className="flex items-start gap-3">
        <div className="text-2xl">{signal.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${signal.levelCls}`}>{signal.level}</span>
            <span className="text-[11px] font-semibold text-white">{signal.title}</span>
          </div>
          <div className="text-[11px] text-slate-300 leading-relaxed">{signal.insight}</div>
          {signal.action && (
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-[9px] text-slate-500">💡</span>
              <span className="text-[10px] text-cyan-400">{signal.action}</span>
            </div>
          )}
          {signal.extra && (
            <>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowMore(!showMore) }}
                className="text-[9px] text-slate-500 hover:text-slate-300 mt-2"
              >
                {showMore ? '▼ Less' : '▶ More details'}
              </button>
              {showMore && (
                <div className="mt-2 p-2 bg-slate-800/50 rounded text-[9px] text-slate-400 leading-relaxed">
                  {signal.extra}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [markets, setMarkets] = useState([])
  const [selected, setSelected] = useState(null)
  const [book, setBook] = useState(null)
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [time, setTime] = useState(new Date())

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

  useEffect(() => {
    const token = getToken(selected)
    if (!token) { setBook(null); setTrades([]); return }
    
    const load = async () => {
      try {
        const [b, t] = await Promise.all([
          fetch(`${CLOB}/book?token_id=${token}`).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(`${CLOB}/trades?asset_id=${token}&limit=100`).then(r => r.ok ? r.json() : []).catch(() => [])
        ])
        setBook(b)
        setTrades(Array.isArray(t) ? t : [])
      } catch {}
    }
    load()
    const i = setInterval(load, 8000)
    return () => clearInterval(i)
  }, [selected])

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
      .slice(0, 20)
  }, [trades])

  // Generate comprehensive signals
  const { keySignals, secondarySignals, quickStats } = useMemo(() => {
    const key = []
    const secondary = []
    const stats = []
    
    const price = getPrice(selected)
    const vol = safeNum(selected?.volume24hr)
    const liq = safeNum(selected?.liquidity)
    
    // === KEY SIGNALS (shown as full cards) ===
    
    // 1. Whale Summary
    if (whales.length > 0) {
      const buyWhales = whales.filter(w => w.side === 'BUY')
      const sellWhales = whales.filter(w => w.side === 'SELL')
      const totalBuy = buyWhales.reduce((a, w) => a + w.size, 0)
      const totalSell = sellWhales.reduce((a, w) => a + w.size, 0)
      const netFlow = totalBuy - totalSell
      const biggestTrade = whales[0]
      
      const sentiment = netFlow > 500 ? 'bullish' : netFlow < -500 ? 'bearish' : 'mixed'
      const sentimentEmoji = sentiment === 'bullish' ? '🟢' : sentiment === 'bearish' ? '🔴' : '🟡'
      
      key.push({
        id: 'whale-summary',
        icon: '🐋',
        level: Math.abs(netFlow) > 2000 ? 'CRITICAL' : Math.abs(netFlow) > 500 ? 'HIGH' : 'MODERATE',
        levelCls: Math.abs(netFlow) > 2000 ? 'text-red-400 bg-red-500/20' : Math.abs(netFlow) > 500 ? 'text-orange-400 bg-orange-500/20' : 'text-yellow-400 bg-yellow-500/20',
        borderCls: netFlow > 0 ? 'border-green-500/30' : netFlow < 0 ? 'border-red-500/30' : 'border-slate-700',
        bgCls: 'bg-slate-900/80',
        title: `Whale Activity: ${sentimentEmoji} ${sentiment.toUpperCase()}`,
        insight: `${whales.length} whale trades detected. Net flow: ${netFlow > 0 ? '+' : ''}$${fmt(netFlow)} (${buyWhales.length} buys totaling $${fmt(totalBuy)} vs ${sellWhales.length} sells totaling $${fmt(totalSell)}). Largest trade: $${fmt(biggestTrade.size)} ${biggestTrade.side} at ${(biggestTrade.price*100).toFixed(1)}¢.`,
        action: netFlow > 500 ? 'Smart money is accumulating. Consider following the trend.' : netFlow < -500 ? 'Large holders are exiting. Exercise caution.' : 'Mixed signals from whales. Wait for clearer direction.',
        extra: whales.slice(0, 5).map((w, i) => {
          const mins = Math.floor((Date.now() - new Date(w.time)) / 60000)
          return `${i+1}. $${fmt(w.size)} ${w.side} at ${(w.price*100).toFixed(1)}¢ (${mins < 60 ? mins + 'm' : Math.floor(mins/60) + 'h'} ago)`
        }).join('\n')
      })
    }
    
    // 2. Order Book Analysis
    if (book?.bids?.length && book?.asks?.length) {
      const bidDepth = book.bids.slice(0,10).reduce((a,b) => a + safeNum(b.size), 0)
      const askDepth = book.asks.slice(0,10).reduce((a,b) => a + safeNum(b.size), 0)
      const totalDepth = bidDepth + askDepth
      const ratio = totalDepth > 0 ? bidDepth / totalDepth : 0.5
      const spread = safeNum(book.asks[0]?.price) - safeNum(book.bids[0]?.price)
      const spreadPct = spread * 100
      const bestBid = safeNum(book.bids[0]?.price)
      const bestAsk = safeNum(book.asks[0]?.price)
      
      const pressure = ratio > 0.6 ? 'BUY' : ratio < 0.4 ? 'SELL' : 'BALANCED'
      const pressureEmoji = pressure === 'BUY' ? '🟢' : pressure === 'SELL' ? '🔴' : '⚖️'
      
      key.push({
        id: 'book-analysis',
        icon: '📊',
        level: ratio > 0.65 || ratio < 0.35 ? 'HIGH' : 'MODERATE',
        levelCls: ratio > 0.6 ? 'text-green-400 bg-green-500/20' : ratio < 0.4 ? 'text-red-400 bg-red-500/20' : 'text-blue-400 bg-blue-500/20',
        borderCls: ratio > 0.6 ? 'border-green-500/30' : ratio < 0.4 ? 'border-red-500/30' : 'border-blue-500/30',
        bgCls: 'bg-slate-900/80',
        title: `Order Book: ${pressureEmoji} ${pressure} Pressure`,
        insight: `Book is ${(ratio*100).toFixed(0)}% bids / ${((1-ratio)*100).toFixed(0)}% asks. Buy-side: $${fmt(bidDepth)} waiting. Sell-side: $${fmt(askDepth)} waiting. Spread: ${spreadPct.toFixed(2)}¢ (${(spreadPct/price*100).toFixed(1)}% of price). Best bid: ${(bestBid*100).toFixed(1)}¢ → Best ask: ${(bestAsk*100).toFixed(1)}¢.`,
        action: ratio > 0.6 ? 'Strong support below. Dips likely to be bought.' : ratio < 0.4 ? 'Resistance above. Rallies may face selling.' : 'Balanced book. Price may consolidate.',
        extra: `Top 3 bids: ${book.bids.slice(0,3).map(b => `${fmt(b.size)} @ ${(safeNum(b.price)*100).toFixed(1)}¢`).join(', ')}\nTop 3 asks: ${book.asks.slice(0,3).map(a => `${fmt(a.size)} @ ${(safeNum(a.price)*100).toFixed(1)}¢`).join(', ')}`
      })
    }
    
    // 3. Price & Probability Analysis
    const impliedProb = price * 100
    const yesReturn = ((1 - price) / price * 100).toFixed(0)
    const noReturn = (price / (1 - price) * 100).toFixed(0)
    
    key.push({
      id: 'price-analysis',
      icon: price > 0.7 ? '🎯' : price < 0.3 ? '⚠️' : '📈',
      level: price > 0.85 || price < 0.15 ? 'HIGH' : 'INFO',
      levelCls: price > 0.7 ? 'text-green-400 bg-green-500/20' : price < 0.3 ? 'text-red-400 bg-red-500/20' : 'text-blue-400 bg-blue-500/20',
      borderCls: 'border-slate-700',
      bgCls: 'bg-slate-900/80',
      title: `Implied Probability: ${impliedProb.toFixed(0)}% YES`,
      insight: `Market prices ${impliedProb.toFixed(1)}% chance of YES outcome. If you bet YES and win: +${yesReturn}% return. If you bet NO and win: +${noReturn}% return. ${price > 0.8 ? 'Market has high conviction in YES.' : price < 0.2 ? 'Market has high conviction in NO.' : 'Market is uncertain - potential for large moves.'}`,
      action: price > 0.85 ? `Low upside on YES (${yesReturn}%). Consider NO if you have contrarian view.` : price < 0.15 ? `Low upside on NO (${noReturn}%). Consider YES if you see a catalyst.` : 'Balanced risk/reward. Position based on your conviction.'
    })
    
    // 4. Volume & Liquidity Analysis
    if (vol > 10000) {
      const volToLiq = liq > 0 ? vol / liq : 0
      const turnover = volToLiq > 5 ? 'VERY HIGH' : volToLiq > 2 ? 'HIGH' : volToLiq > 1 ? 'MODERATE' : 'LOW'
      const depthRating = liq > 1000000 ? 'DEEP' : liq > 500000 ? 'GOOD' : liq > 200000 ? 'MODERATE' : 'THIN'
      const maxPosition = liq * 0.02
      const estSlippage = liq > 500000 ? '< 0.5%' : liq > 200000 ? '0.5-1%' : '1-3%'
      
      key.push({
        id: 'volume-liquidity',
        icon: '💰',
        level: vol > 500000 ? 'HIGH' : 'MODERATE',
        levelCls: vol > 500000 ? 'text-orange-400 bg-orange-500/20' : 'text-yellow-400 bg-yellow-500/20',
        borderCls: 'border-slate-700',
        bgCls: 'bg-slate-900/80',
        title: `Volume $${fmt(vol)} • Liquidity $${fmt(liq)}`,
        insight: `24h volume: $${vol.toLocaleString()}. Turnover: ${volToLiq.toFixed(1)}x (${turnover}). Liquidity depth: ${depthRating}. Est. slippage on $1K order: ${estSlippage}. Recommended max position: $${fmt(maxPosition)}.`,
        action: vol > 500000 ? 'Hot market with conviction. Good for momentum trades.' : volToLiq > 3 ? 'High turnover suggests active debate. Watch for breakouts.' : 'Normal activity. Suitable for swing positions.'
      })
    }
    
    // === SECONDARY SIGNALS (shown as compact cards) ===
    
    // 5. Momentum
    if (trades.length >= 5) {
      const recent = trades.slice(0, 10)
      const avgPrice = recent.reduce((a, t) => a + safeNum(t.price), 0) / recent.length
      const priceDiff = price - avgPrice
      const momentum = priceDiff > 0.02 ? '🚀 UP' : priceDiff < -0.02 ? '🔻 DOWN' : '➡️ FLAT'
      
      secondary.push({
        id: 'momentum',
        icon: priceDiff > 0 ? '🚀' : priceDiff < 0 ? '🔻' : '➡️',
        borderCls: priceDiff > 0.01 ? 'border-green-500/30' : priceDiff < -0.01 ? 'border-red-500/30' : 'border-slate-700',
        bgCls: priceDiff > 0.01 ? 'bg-green-500/5' : priceDiff < -0.01 ? 'bg-red-500/5' : 'bg-slate-900/50',
        title: `Momentum: ${momentum}`,
        insight: `${priceDiff > 0 ? '+' : ''}${(priceDiff*100).toFixed(1)}¢ vs recent trades`
      })
    }
    
    // 6. Spread Alert
    if (book?.bids?.length && book?.asks?.length) {
      const spread = (safeNum(book.asks[0]?.price) - safeNum(book.bids[0]?.price)) * 100
      const spreadStatus = spread > 3 ? '⚠️ WIDE' : spread > 1 ? '📏 MODERATE' : '✅ TIGHT'
      
      secondary.push({
        id: 'spread',
        icon: spread > 3 ? '⚠️' : '📏',
        borderCls: spread > 3 ? 'border-yellow-500/30' : 'border-slate-700',
        bgCls: spread > 3 ? 'bg-yellow-500/5' : 'bg-slate-900/50',
        title: `Spread: ${spreadStatus}`,
        insight: `${spread.toFixed(2)}¢ bid-ask gap. ${spread > 2 ? 'Use limit orders.' : 'Acceptable for market orders.'}`
      })
    }
    
    // 7. Recent Activity
    if (trades.length > 0) {
      const last10Mins = trades.filter(t => (Date.now() - new Date(t.match_time)) < 600000)
      const activityLevel = last10Mins.length > 10 ? '🔥 VERY ACTIVE' : last10Mins.length > 3 ? '📈 ACTIVE' : '😴 QUIET'
      
      secondary.push({
        id: 'activity',
        icon: last10Mins.length > 10 ? '🔥' : last10Mins.length > 3 ? '📈' : '😴',
        borderCls: last10Mins.length > 10 ? 'border-orange-500/30' : 'border-slate-700',
        bgCls: last10Mins.length > 10 ? 'bg-orange-500/5' : 'bg-slate-900/50',
        title: activityLevel,
        insight: `${last10Mins.length} trades in last 10 min`
      })
    }
    
    // 8. Price Level
    const priceZone = price > 0.9 ? '🔝 CEILING' : price > 0.7 ? '📈 HIGH' : price < 0.1 ? '📉 FLOOR' : price < 0.3 ? '📉 LOW' : '↔️ MID'
    secondary.push({
      id: 'price-zone',
      icon: price > 0.7 ? '📈' : price < 0.3 ? '📉' : '↔️',
      borderCls: 'border-slate-700',
      bgCls: 'bg-slate-900/50',
      title: `Zone: ${priceZone}`,
      insight: `${(price*100).toFixed(1)}¢ - ${price > 0.8 || price < 0.2 ? 'Limited room to move' : 'Room for movement'}`
    })
    
    // 9. Best Entry Points
    if (book?.bids?.length) {
      const supportLevel = safeNum(book.bids[2]?.price || book.bids[0]?.price)
      secondary.push({
        id: 'support',
        icon: '🛡️',
        borderCls: 'border-green-500/20',
        bgCls: 'bg-slate-900/50',
        title: `Support: ${(supportLevel*100).toFixed(1)}¢`,
        insight: 'Strong buy orders here'
      })
    }
    
    if (book?.asks?.length) {
      const resistLevel = safeNum(book.asks[2]?.price || book.asks[0]?.price)
      secondary.push({
        id: 'resistance',
        icon: '🚧',
        borderCls: 'border-red-500/20',
        bgCls: 'bg-slate-900/50',
        title: `Resistance: ${(resistLevel*100).toFixed(1)}¢`,
        insight: 'Strong sell orders here'
      })
    }
    
    // === QUICK STATS ===
    stats.push({ label: 'Price', value: `${(price*100).toFixed(1)}¢`, color: price > 0.5 ? 'text-green-400' : 'text-red-400' })
    stats.push({ label: '24h Vol', value: `$${fmt(vol)}`, color: 'text-white' })
    stats.push({ label: 'Liquidity', value: `$${fmt(liq)}`, color: 'text-cyan-400' })
    stats.push({ label: 'Trades', value: `${trades.length}`, color: 'text-white' })
    
    if (whales.length > 0) {
      const netFlow = whales.filter(w => w.side === 'BUY').reduce((a,w) => a + w.size, 0) - 
                      whales.filter(w => w.side === 'SELL').reduce((a,w) => a + w.size, 0)
      stats.push({ label: 'Net Flow', value: `${netFlow > 0 ? '+' : ''}$${fmt(netFlow)}`, color: netFlow > 0 ? 'text-green-400' : 'text-red-400' })
    }
    
    return { keySignals: key, secondarySignals: secondary, quickStats: stats }
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-mono">
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-lg flex items-center justify-center font-bold text-black">Ξ</div>
          <div>
            <div className="text-sm font-bold">ELCARO OS</div>
            <div className="text-[9px] text-slate-500">PREDICTION INTELLIGENCE</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${error ? 'bg-red-500' : 'bg-green-500'} animate-pulse`} />
          <span className={`text-[10px] ${error ? 'text-red-400' : 'text-green-400'}`}>{error ? 'ERROR' : 'LIVE'}</span>
          <span className="text-[9px] text-slate-500 ml-1">{time.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Markets */}
      <div className="flex gap-2 p-2 border-b border-slate-800 overflow-x-auto">
        {loading ? (
          <span className="text-xs text-slate-500 animate-pulse">Loading markets...</span>
        ) : markets.slice(0,8).map(m => (
          <button key={m.id} onClick={() => setSelected(m)}
            className={`px-3 py-2 rounded border min-w-[140px] text-left transition-all ${selected?.id === m.id ? 'bg-slate-800 border-cyan-500/50' : 'bg-slate-900 border-slate-700 hover:border-slate-600'}`}>
            <div className="text-[10px] text-slate-400 truncate">{m.question?.slice(0,22)}...</div>
            <div className="flex gap-2 mt-1">
              <span className={`text-sm font-bold ${getPrice(m) > 0.5 ? 'text-green-400' : 'text-red-400'}`}>{(getPrice(m)*100).toFixed(0)}¢</span>
              <span className="text-[9px] text-slate-600">${fmt(m.volume24hr)}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Selected Market Header */}
      {selected && (
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/50">
          <div className="text-sm text-white font-medium">{selected.question}</div>
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            {quickStats.map(s => (
              <div key={s.label} className="flex items-center gap-1.5">
                <span className="text-[9px] text-slate-500">{s.label}:</span>
                <span className={`text-[11px] font-semibold ${s.color}`}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="p-4 space-y-4 max-w-5xl mx-auto">
        
        {/* Score Banner */}
        <div className={`p-3 rounded-lg border flex items-center justify-between ${
          score >= 60 ? 'bg-green-500/10 border-green-500/30' : 
          score <= 40 ? 'bg-red-500/10 border-red-500/30' : 
          'bg-yellow-500/10 border-yellow-500/30'
        }`}>
          <div className="flex items-center gap-3">
            <div className="text-3xl font-bold">{score}</div>
            <div>
              <div className={`text-[11px] font-bold ${score >= 60 ? 'text-green-400' : score <= 40 ? 'text-red-400' : 'text-yellow-400'}`}>
                {score >= 60 ? '🟢 BULLISH' : score <= 40 ? '🔴 BEARISH' : '🟡 NEUTRAL'}
              </div>
              <div className="text-[9px] text-slate-400">ELCARO Sentiment Score</div>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 text-right">
            <div>Whale Flow: {score >= 50 ? '↑' : '↓'}</div>
            <div>Book Pressure: {score >= 50 ? 'Buy' : 'Sell'}</div>
          </div>
        </div>

        {/* Secondary Signals Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {secondarySignals.map(s => (
            <SignalCard key={s.id} signal={s} compact />
          ))}
        </div>

        {/* Key Signals */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[11px] font-semibold text-slate-300">DETAILED ANALYSIS</span>
            <span className="text-[9px] text-slate-600">{keySignals.length} insights</span>
          </div>
          
          {keySignals.length === 0 ? (
            <div className="p-4 text-xs text-slate-600 bg-slate-900 rounded-lg border border-slate-800">
              Analyzing market data...
            </div>
          ) : (
            keySignals.map(s => <SignalCard key={s.id} signal={s} />)
          )}
        </div>

        {/* Order Book */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-[11px] text-slate-400 mb-3">ORDER BOOK</div>
          {!book?.bids?.length ? (
            <div className="text-xs text-slate-600">{getToken(selected) ? 'Loading...' : 'No data'}</div>
          ) : (
            <div className="grid grid-cols-2 gap-6 text-[10px]">
              <div>
                <div className="text-green-500 text-[9px] mb-2 font-semibold">BIDS (BUYERS)</div>
                {book.bids.slice(0,8).map((b,i) => {
                  const pct = safeNum(b.size) / book.bids.slice(0,8).reduce((a,x) => a + safeNum(x.size), 0) * 100
                  return (
                    <div key={i} className="flex items-center gap-2 py-0.5">
                      <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500/50" style={{width: `${pct}%`}} />
                      </div>
                      <span className="text-slate-500 w-12">{fmt(b.size)}</span>
                      <span className="text-green-400">{(safeNum(b.price)*100).toFixed(1)}¢</span>
                    </div>
                  )
                })}
              </div>
              <div>
                <div className="text-red-500 text-[9px] mb-2 font-semibold">ASKS (SELLERS)</div>
                {book.asks.slice(0,8).map((a,i) => {
                  const pct = safeNum(a.size) / book.asks.slice(0,8).reduce((x,y) => x + safeNum(y.size), 0) * 100
                  return (
                    <div key={i} className="flex items-center gap-2 py-0.5">
                      <span className="text-red-400">{(safeNum(a.price)*100).toFixed(1)}¢</span>
                      <span className="text-slate-500 w-12">{fmt(a.size)}</span>
                      <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-red-500/50" style={{width: `${pct}%`}} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="border-t border-slate-800 px-4 py-2 text-[9px] text-slate-600 flex justify-between">
        <span>ELCARO OS v2.0</span>
        <span>Live Data • 8s refresh</span>
      </footer>
    </div>
  )
}
