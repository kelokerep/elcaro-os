import { useState, useEffect, useMemo, useRef, useCallback } from 'react'

const PROXY = 'https://corsproxy.io/?'
const GAMMA = `${PROXY}https://gamma-api.polymarket.com`
const CLOB = `${PROXY}https://clob.polymarket.com`
const NEWS_API = `${PROXY}https://newsdata.io/api/1/news?apikey=pub_6aborxyz123`

// =============================================================================
// TRANSLATIONS
// =============================================================================
const translations = {
  en: {
    title: 'ELCARO OS',
    subtitle: 'LIVE POLYMARKET',
    live: 'LIVE',
    paused: 'PAUSED',
    error: 'ERROR',
    search: 'Search markets...',
    trending: 'TRENDING KEYWORDS',
    results: 'RESULTS',
    signals: 'LIVE SIGNALS',
    news: 'NEWS',
    orderBook: 'ORDER BOOK',
    bids: 'BIDS',
    asks: 'ASKS',
    score: 'ELCARO SCORE',
    bullish: 'BULLISH',
    neutral: 'NEUTRAL', 
    bearish: 'BEARISH',
    alerts: 'ALERTS',
    alertsOn: 'Alerts ON',
    alertsOff: 'Alerts OFF',
    noLargeTrades: 'No large trades in last 15min',
    loading: 'Loading...',
    analyzing: 'Analyzing...',
    noData: 'No data',
    pausedReading: 'Paused while reading',
    resume: 'Resume',
    collapseAll: 'Collapse all',
    tapAnalysis: 'tap for analysis →',
    highVolume: 'High Volume',
    highPotential: 'High Potential',
    recent: 'Recent',
    now: 'NOW',
    trend: 'TREND',
    caution: 'CAUTION',
    good: 'GOOD',
    probability: 'PROBABILITY',
    // Signal translations
    buyPressure: 'BUY Pressure',
    sellPressure: 'SELL Pressure',
    spread: 'Spread',
    buyWall: 'Buy Wall',
    sellWall: 'Sell Wall',
    flow15m: '15min Flow',
    rising: 'Rising',
    falling: 'Falling',
    lowLiquidity: 'Low Liquidity',
    deepLiquidity: 'Deep Liquidity',
    nearCertain: 'Near Certain',
    nearZero: 'Near Zero',
    whaleAlert: 'WHALE ALERT',
    priceAlert: 'PRICE ALERT',
    noNews: 'No recent news found',
    fetchingNews: 'Fetching news...',
    settings: 'Settings',
    theme: 'Theme',
    language: 'Language',
    dark: 'Dark',
    darker: 'Darker',
    light: 'Light',
  },
  es: {
    title: 'ELCARO OS',
    subtitle: 'POLYMARKET EN VIVO',
    live: 'EN VIVO',
    paused: 'PAUSADO',
    error: 'ERROR',
    search: 'Buscar mercados...',
    trending: 'PALABRAS CLAVE',
    results: 'RESULTADOS',
    signals: 'SEÑALES EN VIVO',
    news: 'NOTICIAS',
    orderBook: 'LIBRO DE ÓRDENES',
    bids: 'COMPRAS',
    asks: 'VENTAS',
    score: 'PUNTUACIÓN ELCARO',
    bullish: 'ALCISTA',
    neutral: 'NEUTRAL',
    bearish: 'BAJISTA',
    alerts: 'ALERTAS',
    alertsOn: 'Alertas ON',
    alertsOff: 'Alertas OFF',
    noLargeTrades: 'Sin operaciones grandes en 15min',
    loading: 'Cargando...',
    analyzing: 'Analizando...',
    noData: 'Sin datos',
    pausedReading: 'Pausado mientras lees',
    resume: 'Reanudar',
    collapseAll: 'Cerrar todo',
    tapAnalysis: 'toca para análisis →',
    highVolume: 'Alto Volumen',
    highPotential: 'Alto Potencial',
    recent: 'Reciente',
    now: 'AHORA',
    trend: 'TENDENCIA',
    caution: 'PRECAUCIÓN',
    good: 'BUENO',
    probability: 'PROBABILIDAD',
    buyPressure: 'Presión COMPRA',
    sellPressure: 'Presión VENTA',
    spread: 'Spread',
    buyWall: 'Muro de Compra',
    sellWall: 'Muro de Venta',
    flow15m: 'Flujo 15min',
    rising: 'Subiendo',
    falling: 'Bajando',
    lowLiquidity: 'Baja Liquidez',
    deepLiquidity: 'Alta Liquidez',
    nearCertain: 'Casi Seguro',
    nearZero: 'Casi Cero',
    whaleAlert: 'ALERTA BALLENA',
    priceAlert: 'ALERTA PRECIO',
    noNews: 'Sin noticias recientes',
    fetchingNews: 'Buscando noticias...',
    settings: 'Ajustes',
    theme: 'Tema',
    language: 'Idioma',
    dark: 'Oscuro',
    darker: 'Más Oscuro',
    light: 'Claro',
  }
}

// =============================================================================
// THEMES
// =============================================================================
const themes = {
  dark: {
    bg: 'bg-slate-950',
    bgGradient: 'radial-gradient(ellipse at 20% 20%, rgba(34,197,94,0.03) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(239,68,68,0.03) 0%, transparent 50%)',
    card: 'bg-slate-900',
    border: 'border-slate-800',
    text: 'text-slate-200',
    textMuted: 'text-slate-500',
    textDim: 'text-slate-600',
    input: 'bg-slate-800 border-slate-700',
    hover: 'hover:bg-slate-800',
    selected: 'bg-slate-800 border-cyan-500/50',
    unselected: 'bg-slate-900 border-slate-700',
  },
  darker: {
    bg: 'bg-black',
    bgGradient: 'radial-gradient(ellipse at 20% 20%, rgba(34,197,94,0.02) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(239,68,68,0.02) 0%, transparent 50%)',
    card: 'bg-zinc-950',
    border: 'border-zinc-900',
    text: 'text-zinc-200',
    textMuted: 'text-zinc-500',
    textDim: 'text-zinc-700',
    input: 'bg-zinc-900 border-zinc-800',
    hover: 'hover:bg-zinc-900',
    selected: 'bg-zinc-900 border-cyan-500/50',
    unselected: 'bg-zinc-950 border-zinc-800',
  },
  light: {
    bg: 'bg-gray-100',
    bgGradient: 'radial-gradient(ellipse at 20% 20%, rgba(34,197,94,0.05) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(239,68,68,0.05) 0%, transparent 50%)',
    card: 'bg-white',
    border: 'border-gray-200',
    text: 'text-gray-900',
    textMuted: 'text-gray-500',
    textDim: 'text-gray-400',
    input: 'bg-white border-gray-300',
    hover: 'hover:bg-gray-50',
    selected: 'bg-white border-cyan-500',
    unselected: 'bg-gray-50 border-gray-200',
  }
}

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

const extractKeywords = (markets) => {
  const stopWords = new Set(['will', 'the', 'be', 'to', 'in', 'of', 'a', 'an', 'and', 'or', 'for', 'on', 'at', 'by', 'is', 'it', 'as', 'with', 'that', 'this', 'from', 'are', 'was', 'were', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'but', 'not', 'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'just', 'should', 'now', 'before', 'after', 'during'])
  const keywordMap = {}
  markets.forEach(m => {
    const words = (m.question || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/)
    const vol = safeNum(m.volume24hr)
    const price = getPrice(m)
    const potential = Math.min(price, 1 - price) * 2
    const recency = Math.max(0, 1 - (Date.now() - new Date(m.createdAt || 0).getTime()) / (30 * 24 * 60 * 60 * 1000))
    words.forEach(word => {
      if (word.length < 3 || stopWords.has(word)) return
      if (!keywordMap[word]) keywordMap[word] = { word, volume: 0, count: 0, potential: 0, recency: 0 }
      keywordMap[word].volume += vol
      keywordMap[word].count += 1
      keywordMap[word].potential += potential
      keywordMap[word].recency += recency
    })
  })
  return Object.values(keywordMap)
    .map(k => ({ ...k, score: (k.volume / 1000000) * 0.4 + k.count * 0.2 + (k.potential / k.count) * 0.2 + (k.recency / k.count) * 0.2 }))
    .sort((a, b) => b.score - a.score).slice(0, 30)
}

export default function App() {
  // State
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
  const [showSettings, setShowSettings] = useState(false)
  const [searching, setSearching] = useState(false)
  
  // News & Alerts
  const [news, setNews] = useState([])
  const [newsLoading, setNewsLoading] = useState(false)
  const [alertsEnabled, setAlertsEnabled] = useState(false)
  const [alerts, setAlerts] = useState([])
  const lastWhaleRef = useRef(null)
  const lastPriceRef = useRef(null)
  
  // Settings
  const [theme, setTheme] = useState(() => localStorage.getItem('elcaro-theme') || 'dark')
  const [lang, setLang] = useState(() => localStorage.getItem('elcaro-lang') || 'en')
  
  const t = translations[lang]
  const th = themes[theme]
  
  const pauseTimeout = useRef(null)
  const searchTimeout = useRef(null)
  
  // Save settings
  useEffect(() => { localStorage.setItem('elcaro-theme', theme) }, [theme])
  useEffect(() => { localStorage.setItem('elcaro-lang', lang) }, [lang])
  
  // Request notification permission
  useEffect(() => {
    if (alertsEnabled && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [alertsEnabled])
  
  const sendAlert = useCallback((title, body, type = 'info') => {
    const alert = { id: Date.now(), title, body, type, time: new Date() }
    setAlerts(prev => [alert, ...prev].slice(0, 20))
    
    if (alertsEnabled && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '🐋' })
    }
  }, [alertsEnabled])

  const handleExpand = (id) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else {
        next.add(id)
        setPaused(true)
        clearTimeout(pauseTimeout.current)
        pauseTimeout.current = setTimeout(() => setPaused(false), 30000)
      }
      return next
    })
  }

  // Fetch markets
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

  // Fetch news for selected market
  useEffect(() => {
    if (!selected?.question) return
    const fetchNews = async () => {
      setNewsLoading(true)
      try {
        // Extract key terms from question
        const terms = selected.question
          .replace(/[^a-zA-Z0-9\s]/g, '')
          .split(' ')
          .filter(w => w.length > 3)
          .slice(0, 3)
          .join(' ')
        
        // Use DuckDuckGo instant answer API as fallback (no key needed)
        const r = await fetch(`${PROXY}https://api.duckduckgo.com/?q=${encodeURIComponent(terms)}&format=json&no_html=1`)
        const d = await r.json()
        
        const newsItems = []
        if (d.AbstractText) {
          newsItems.push({ title: d.Heading || terms, description: d.AbstractText, url: d.AbstractURL, source: d.AbstractSource })
        }
        if (d.RelatedTopics) {
          d.RelatedTopics.slice(0, 4).forEach(topic => {
            if (topic.Text) newsItems.push({ title: topic.Text.slice(0, 80), description: topic.Text, url: topic.FirstURL, source: 'DuckDuckGo' })
          })
        }
        setNews(newsItems.slice(0, 5))
      } catch (e) {
        setNews([])
      }
      setNewsLoading(false)
    }
    fetchNews()
  }, [selected?.id])

  // Search
  const handleSearch = async (query) => {
    setSearchQuery(query)
    clearTimeout(searchTimeout.current)
    if (query.length < 2) { setSearchResults([]); return }
    setSearching(true)
    searchTimeout.current = setTimeout(() => {
      const results = allMarkets.filter(m => m.question?.toLowerCase().includes(query.toLowerCase())).slice(0, 15)
      setSearchResults(results)
      setSearching(false)
    }, 300)
  }

  const keywords = useMemo(() => extractKeywords(allMarkets), [allMarkets])

  // Fetch book & trades
  useEffect(() => {
    const token = getToken(selected)
    if (!token) { setBook(null); setTrades([]); return }
    
    const load = async () => {
      if (paused) return
      try {
        const [b, tr] = await Promise.all([
          fetch(`${CLOB}/book?token_id=${token}`).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(`${CLOB}/trades?asset_id=${token}&limit=100`).then(r => r.ok ? r.json() : []).catch(() => [])
        ])
        setBook(b)
        const tradesArr = Array.isArray(tr) ? tr : []
        setTrades(tradesArr)
        
        // Track price & check for alerts
        if (tradesArr.length > 0) {
          const latestPrice = safeNum(tradesArr[0]?.price)
          const latestTrade = tradesArr[0]
          
          // Whale alert
          const tradeSize = safeNum(latestTrade?.size) * latestPrice
          if (alertsEnabled && tradeSize >= 1000 && lastWhaleRef.current !== latestTrade?.id) {
            lastWhaleRef.current = latestTrade?.id
            sendAlert(t.whaleAlert, `$${fmt(tradeSize)} ${latestTrade?.side?.toUpperCase()} @ ${(latestPrice*100).toFixed(1)}¢`, 'whale')
          }
          
          // Price movement alert (>2% change)
          if (alertsEnabled && lastPriceRef.current) {
            const priceDiff = Math.abs(latestPrice - lastPriceRef.current) / lastPriceRef.current
            if (priceDiff > 0.02) {
              sendAlert(t.priceAlert, `${latestPrice > lastPriceRef.current ? '📈' : '📉'} ${(priceDiff*100).toFixed(1)}% move to ${(latestPrice*100).toFixed(1)}¢`, 'price')
            }
          }
          lastPriceRef.current = latestPrice
          
          setPriceHistory(prev => [...prev, { price: latestPrice, time: Date.now() }].slice(-20))
        }
      } catch {}
    }
    load()
    const i = setInterval(load, 5000)
    return () => clearInterval(i)
  }, [selected, paused, alertsEnabled, sendAlert, t])

  const recentTrades = useMemo(() => {
    if (!Array.isArray(trades)) return []
    const fifteenMinsAgo = Date.now() - 15 * 60 * 1000
    return trades
      .map(t => ({ id: t.id || Math.random().toString(36).slice(2), side: t.side?.toUpperCase() || 'BUY', size: safeNum(t.size) * safeNum(t.price), price: safeNum(t.price), time: new Date(t.match_time).getTime() }))
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
      const bidDepth5 = book.bids.slice(0,5).reduce((a,b) => a + safeNum(b.size), 0)
      const askDepth5 = book.asks.slice(0,5).reduce((a,b) => a + safeNum(b.size), 0)
      const totalDepth5 = bidDepth5 + askDepth5
      const imbalance5 = totalDepth5 > 0 ? (bidDepth5 - askDepth5) / totalDepth5 : 0
      const bidDepthFull = book.bids.reduce((a,b) => a + safeNum(b.size), 0)
      const askDepthFull = book.asks.reduce((a,b) => a + safeNum(b.size), 0)
      const pressureStrength = Math.abs(imbalance5)
      
      if (pressureStrength > 0.1) {
        s.push({
          id: 'pressure', icon: imbalance5 > 0 ? '🟢' : '🔴',
          level: pressureStrength > 0.3 ? 'CRITICAL' : pressureStrength > 0.2 ? 'HIGH' : 'MODERATE',
          cls: imbalance5 > 0 ? 'text-green-400 bg-green-500/20' : 'text-red-400 bg-red-500/20',
          title: `${imbalance5 > 0 ? t.buyPressure : t.sellPressure}: ${(pressureStrength * 100).toFixed(0)}%`,
          sub: `${t.now} • $${fmt(bidDepth5)} vs $${fmt(askDepth5)}`,
          detail: `${imbalance5 > 0 ? 'Buyers outweighing sellers' : 'Sellers outweighing buyers'} by ${(pressureStrength * 100).toFixed(0)}%. Total depth: $${fmt(bidDepthFull)} bids, $${fmt(askDepthFull)} asks.`
        })
      }
      
      if (spreadPct > 0.5) {
        s.push({
          id: 'spread', icon: '↔️', level: spreadPct > 3 ? 'HIGH' : 'MODERATE',
          cls: spreadPct > 3 ? 'text-orange-400 bg-orange-500/20' : 'text-purple-400 bg-purple-500/20',
          title: `${t.spread}: ${spreadPct.toFixed(2)}¢`,
          sub: `${t.now} • ${(bestBid*100).toFixed(1)}¢ → ${(bestAsk*100).toFixed(1)}¢`,
          detail: `${spreadPct > 3 ? 'Wide spread - use limit orders.' : 'Moderate spread.'} Round-trip: ~${(spreadPct*2).toFixed(1)}¢`
        })
      }
      
      const bidWall = book.bids.find(b => safeNum(b.size) > bidDepthFull * 0.3)
      const askWall = book.asks.find(a => safeNum(a.size) > askDepthFull * 0.3)
      if (bidWall) s.push({ id: 'bid-wall', icon: '🧱', level: 'HIGH', cls: 'text-green-400 bg-green-500/20', title: `${t.buyWall}: $${fmt(bidWall.size)}`, sub: `${t.now} • ${(safeNum(bidWall.price)*100).toFixed(1)}¢`, detail: `Strong support at ${(safeNum(bidWall.price)*100).toFixed(1)}¢` })
      if (askWall) s.push({ id: 'ask-wall', icon: '🧱', level: 'HIGH', cls: 'text-red-400 bg-red-500/20', title: `${t.sellWall}: $${fmt(askWall.size)}`, sub: `${t.now} • ${(safeNum(askWall.price)*100).toFixed(1)}¢`, detail: `Resistance at ${(safeNum(askWall.price)*100).toFixed(1)}¢` })
    }
    
    if (recentTrades.length > 0) {
      const buyVol = recentTrades.filter(t => t.side === 'BUY').reduce((a, t) => a + t.size, 0)
      const sellVol = recentTrades.filter(t => t.side === 'SELL').reduce((a, t) => a + t.size, 0)
      const netFlow = buyVol - sellVol
      const totalFlow = buyVol + sellVol
      
      if (totalFlow > 100) {
        s.push({
          id: 'flow-15m', icon: netFlow > 0 ? '📈' : netFlow < 0 ? '📉' : '➡️',
          level: Math.abs(netFlow) > 1000 ? 'HIGH' : 'MODERATE',
          cls: netFlow > 0 ? 'text-green-400 bg-green-500/20' : netFlow < 0 ? 'text-red-400 bg-red-500/20' : 'text-slate-400 bg-slate-500/20',
          title: `${t.flow15m}: ${netFlow > 0 ? '+' : ''}$${fmt(netFlow)}`,
          sub: `$${fmt(buyVol)} buys vs $${fmt(sellVol)} sells`,
          detail: `${recentTrades.length} trades, $${fmt(totalFlow)} volume in 15min.`
        })
      }
      
      recentTrades.filter(t => t.size >= 500).slice(0, 2).forEach((w, idx) => {
        const minsAgo = Math.floor((now - w.time) / 60000)
        s.push({
          id: `whale-${idx}`, icon: '🐋', level: w.size > 2000 ? 'CRITICAL' : 'HIGH',
          cls: w.side === 'BUY' ? 'text-green-400 bg-green-500/20' : 'text-red-400 bg-red-500/20',
          title: `$${fmt(w.size)} ${w.side}`,
          sub: `${minsAgo}m ago • ${(w.price*100).toFixed(1)}¢`,
          detail: `Whale ${w.side === 'BUY' ? 'bought' : 'sold'} $${w.size.toFixed(0)}`
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
          id: 'momentum', icon: change > 0 ? '🚀' : '🔻',
          level: Math.abs(changePct) > 2 ? 'HIGH' : 'MODERATE',
          cls: change > 0 ? 'text-green-400 bg-green-500/20' : 'text-red-400 bg-red-500/20',
          title: `${change > 0 ? t.rising : t.falling}: ${change > 0 ? '+' : ''}${changePct.toFixed(1)}%`,
          sub: `${t.trend} • ${(oldest*100).toFixed(1)}¢ → ${(latest*100).toFixed(1)}¢`,
          detail: `Price ${change > 0 ? 'up' : 'down'} ${Math.abs(changePct).toFixed(1)}%`
        })
      }
    }
    
    if (liq < 100000 && liq > 0) s.push({ id: 'low-liq', icon: '⚠️', level: 'HIGH', cls: 'text-yellow-400 bg-yellow-500/20', title: `${t.lowLiquidity}: $${fmt(liq)}`, sub: t.caution, detail: 'High slippage risk' })
    else if (liq >= 500000) s.push({ id: 'high-liq', icon: '💧', level: 'INFO', cls: 'text-cyan-400 bg-cyan-500/20', title: `${t.deepLiquidity}: $${fmt(liq)}`, sub: t.good, detail: 'Institutional depth' })
    
    if (price > 0.9 || price < 0.1) {
      s.push({
        id: 'extreme', icon: price > 0.9 ? '🎯' : '💀', level: 'HIGH',
        cls: price > 0.9 ? 'text-green-400 bg-green-500/20' : 'text-red-400 bg-red-500/20',
        title: `${price > 0.9 ? t.nearCertain : t.nearZero}: ${(price*100).toFixed(0)}%`,
        sub: t.probability,
        detail: `${price > 0.9 ? `NO pays ${(price/(1-price)).toFixed(1)}x` : `YES pays ${((1-price)/price).toFixed(1)}x`}`
      })
    }
    
    return s.sort((a, b) => ({ CRITICAL: 0, HIGH: 1, MODERATE: 2, INFO: 3 }[a.level] ?? 4) - ({ CRITICAL: 0, HIGH: 1, MODERATE: 2, INFO: 3 }[b.level] ?? 4))
  }, [book, recentTrades, selected, priceHistory, t])

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
    <div className={`min-h-screen ${th.bg} ${th.text} font-mono`} style={{ backgroundImage: th.bgGradient }}>
      {/* Header */}
      <div className={`flex justify-between items-center px-4 py-3 border-b ${th.border}`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-lg flex items-center justify-center font-bold text-black">Ξ</div>
          <div>
            <div className="text-sm font-bold">{t.title}</div>
            <div className={`text-[9px] ${th.textMuted}`}>{t.subtitle}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowSearch(!showSearch)} className={`${th.textMuted} hover:text-white transition-colors`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </button>
          <button onClick={() => setAlertsEnabled(!alertsEnabled)} className={`text-[10px] px-2 py-1 rounded ${alertsEnabled ? 'bg-green-500/20 text-green-400' : `${th.textMuted}`}`}>
            {alertsEnabled ? '🔔' : '🔕'}
          </button>
          <button onClick={() => setShowSettings(!showSettings)} className={`${th.textMuted} hover:text-white transition-colors`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${error ? 'bg-red-500' : paused ? 'bg-yellow-500' : 'bg-green-500'} animate-pulse`} />
            <span className={`text-[10px] ${error ? 'text-red-400' : paused ? 'text-yellow-400' : 'text-green-400'}`}>
              {error ? t.error : paused ? t.paused : t.live}
            </span>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className={`border-b ${th.border} ${th.card} p-4`}>
          <div className="flex flex-wrap gap-6">
            <div>
              <div className={`text-[9px] ${th.textMuted} mb-2`}>{t.theme.toUpperCase()}</div>
              <div className="flex gap-2">
                {['dark', 'darker', 'light'].map(thm => (
                  <button key={thm} onClick={() => setTheme(thm)} className={`px-3 py-1 rounded text-[10px] border ${theme === thm ? 'border-cyan-500 text-cyan-400' : `${th.border} ${th.textMuted}`}`}>
                    {t[thm]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className={`text-[9px] ${th.textMuted} mb-2`}>{t.language.toUpperCase()}</div>
              <div className="flex gap-2">
                <button onClick={() => setLang('en')} className={`px-3 py-1 rounded text-[10px] border ${lang === 'en' ? 'border-cyan-500 text-cyan-400' : `${th.border} ${th.textMuted}`}`}>EN</button>
                <button onClick={() => setLang('es')} className={`px-3 py-1 rounded text-[10px] border ${lang === 'es' ? 'border-cyan-500 text-cyan-400' : `${th.border} ${th.textMuted}`}`}>ES</button>
              </div>
            </div>
            <div>
              <div className={`text-[9px] ${th.textMuted} mb-2`}>{t.alerts.toUpperCase()}</div>
              <button onClick={() => setAlertsEnabled(!alertsEnabled)} className={`px-3 py-1 rounded text-[10px] border ${alertsEnabled ? 'border-green-500 text-green-400' : `${th.border} ${th.textMuted}`}`}>
                {alertsEnabled ? t.alertsOn : t.alertsOff}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search Panel */}
      {showSearch && (
        <div className={`border-b ${th.border} ${th.card}/80 p-4`}>
          <input type="text" value={searchQuery} onChange={(e) => handleSearch(e.target.value)} placeholder={t.search}
            className={`w-full ${th.input} rounded-lg px-4 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500`} autoFocus />
          <div className="mt-3">
            <div className={`text-[9px] ${th.textMuted} mb-2`}>{t.trending}</div>
            <div className="flex flex-wrap gap-1.5">
              {keywords.slice(0, 20).map(k => {
                const size = k.score > 2 ? 'text-sm' : k.score > 1 ? 'text-xs' : 'text-[10px]'
                const color = k.volume > 5000000 ? 'text-cyan-400 border-cyan-500/30' : k.potential / k.count > 0.8 ? 'text-amber-400 border-amber-500/30' : k.recency / k.count > 0.5 ? 'text-green-400 border-green-500/30' : `${th.textMuted} ${th.border}`
                return <button key={k.word} onClick={() => { handleSearch(k.word); setSearchQuery(k.word) }} className={`px-2 py-0.5 rounded border ${size} ${color} hover:opacity-100 ${th.hover} transition-all`}>{k.word}</button>
              })}
            </div>
            <div className={`flex gap-4 mt-2 text-[9px] ${th.textDim}`}>
              <span><span className="text-cyan-400">●</span> {t.highVolume}</span>
              <span><span className="text-amber-400">●</span> {t.highPotential}</span>
              <span><span className="text-green-400">●</span> {t.recent}</span>
            </div>
          </div>
          {searchResults.length > 0 && (
            <div className={`mt-3 border-t ${th.border} pt-3`}>
              <div className={`text-[9px] ${th.textMuted} mb-2`}>{t.results} ({searchResults.length})</div>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {searchResults.map(m => (
                  <button key={m.id} onClick={() => { setSelected(m); setShowSearch(false); setSearchQuery(''); setSearchResults([]) }}
                    className={`w-full text-left p-2 rounded ${th.hover} transition-colors flex items-center justify-between`}>
                    <span className={`text-[11px] truncate flex-1 mr-3`}>{m.question}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-sm font-bold ${getPrice(m) > 0.5 ? 'text-green-400' : 'text-red-400'}`}>{(getPrice(m)*100).toFixed(0)}¢</span>
                      <span className={`text-[9px] ${th.textDim}`}>${fmt(m.volume24hr)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {paused && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/30 px-4 py-1.5 flex items-center justify-between">
          <span className="text-[10px] text-yellow-400">⏸ {t.pausedReading}</span>
          <button onClick={() => { setPaused(false); setExpanded(new Set()) }} className="text-[10px] text-yellow-400 hover:text-yellow-300 underline">{t.resume}</button>
        </div>
      )}

      {/* Whale Ticker */}
      <div className={`h-9 px-4 flex items-center gap-3 border-b ${th.border} overflow-x-auto`}>
        <span className={`text-[10px] ${th.textMuted} shrink-0`}>🐋 {t.live}</span>
        {recentTrades.filter(t => t.size >= 200).length === 0 ? (
          <span className={`text-[10px] ${th.textDim}`}>{t.noLargeTrades}</span>
        ) : recentTrades.filter(t => t.size >= 200).slice(0,8).map((w, i) => (
          <span key={i} className={`text-[10px] px-2 py-0.5 rounded border whitespace-nowrap ${w.side === 'BUY' ? 'border-green-500/30 text-green-400' : 'border-red-500/30 text-red-400'}`}>
            {w.side === 'BUY' ? '▲' : '▼'} ${fmt(w.size)} • {Math.floor((Date.now() - w.time) / 60000)}m
          </span>
        ))}
      </div>

      {/* Markets */}
      <div className={`flex gap-2 p-2 border-b ${th.border} overflow-x-auto`}>
        {loading ? <span className={`text-xs ${th.textMuted} animate-pulse`}>{t.loading}</span>
        : markets.slice(0,8).map(m => (
          <button key={m.id} onClick={() => { setSelected(m); setExpanded(new Set()); setPaused(false); setPriceHistory([]) }}
            className={`px-3 py-2 rounded border min-w-[150px] text-left transition-all ${selected?.id === m.id ? th.selected : th.unselected}`}>
            <div className={`text-[10px] ${th.textMuted} truncate`}>{m.question?.slice(0,25)}...</div>
            <div className="flex gap-2 mt-1">
              <span className={`text-sm font-bold ${getPrice(m) > 0.5 ? 'text-green-400' : 'text-red-400'}`}>{(getPrice(m)*100).toFixed(0)}¢</span>
              <span className={`text-[9px] ${th.textDim}`}>${fmt(m.volume24hr)}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Selected Market */}
      {selected && (
        <div className={`px-4 py-3 border-b ${th.border}`}>
          <div className="text-sm">{selected.question}</div>
          <div className="flex items-center gap-3 mt-1">
            <span className={`text-2xl font-bold ${price > 0.5 ? 'text-green-400' : 'text-red-400'}`}>{(price*100).toFixed(1)}¢</span>
            <span className={`text-[10px] ${th.textMuted}`}>Vol: ${fmt(selected.volume24hr)} • Liq: ${fmt(selected.liquidity)}</span>
          </div>
        </div>
      )}

      <div className="p-4 space-y-4 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
          {/* Signals */}
          <div className={`${th.card} border ${th.border} rounded-lg overflow-hidden`}>
            <div className={`px-4 py-2 border-b ${th.border} flex items-center gap-2`}>
              <div className={`w-2 h-2 rounded-full ${paused ? 'bg-yellow-500' : 'bg-green-500'} animate-pulse`} />
              <span className="text-[11px] font-semibold">{t.signals}</span>
              <span className={`text-[9px] ${th.textDim} ${th.card} px-2 py-0.5 rounded`}>{signals.length}</span>
              {hasExpanded && <button onClick={() => { setExpanded(new Set()); setPaused(false) }} className={`ml-auto text-[9px] ${th.textMuted} hover:text-white`}>{t.collapseAll}</button>}
            </div>
            <div className={`divide-y ${th.border}/50 max-h-[400px] overflow-y-auto`}>
              {signals.length === 0 ? <div className={`p-4 text-xs ${th.textDim}`}>{t.analyzing}</div>
              : signals.map(s => (
                <div key={s.id} className={`p-3 cursor-pointer transition-all ${expanded.has(s.id) ? `${th.card}/50` : th.hover}`} onClick={() => handleExpand(s.id)}>
                  <div className="flex items-start gap-3">
                    <span className="text-lg mt-0.5">{s.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${s.cls}`}>{s.level}</span>
                        <span className="text-[11px] font-medium">{s.title}</span>
                      </div>
                      <div className={`text-[10px] ${th.textMuted} mt-0.5`}>{s.sub}</div>
                      {expanded.has(s.id) && <div className={`mt-2 p-3 ${th.card}/70 rounded text-[10px] leading-relaxed border-l-2 border-cyan-500/50`}>{s.detail}</div>}
                      {!expanded.has(s.id) && <div className="text-[9px] text-cyan-500/70 mt-1">{t.tapAnalysis}</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* News + Alerts */}
          <div className="space-y-4">
            {/* News */}
            <div className={`${th.card} border ${th.border} rounded-lg overflow-hidden`}>
              <div className={`px-4 py-2 border-b ${th.border}`}>
                <span className="text-[11px] font-semibold">📰 {t.news}</span>
              </div>
              <div className="p-3 space-y-2 max-h-48 overflow-y-auto">
                {newsLoading ? <div className={`text-[10px] ${th.textDim}`}>{t.fetchingNews}</div>
                : news.length === 0 ? <div className={`text-[10px] ${th.textDim}`}>{t.noNews}</div>
                : news.map((n, i) => (
                  <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" className={`block p-2 rounded ${th.hover} transition-colors`}>
                    <div className="text-[10px] font-medium line-clamp-2">{n.title}</div>
                    <div className={`text-[9px] ${th.textDim} mt-1`}>{n.source}</div>
                  </a>
                ))}
              </div>
            </div>

            {/* Alerts */}
            <div className={`${th.card} border ${th.border} rounded-lg overflow-hidden`}>
              <div className={`px-4 py-2 border-b ${th.border} flex items-center justify-between`}>
                <span className="text-[11px] font-semibold">🔔 {t.alerts}</span>
                <span className={`text-[9px] ${alertsEnabled ? 'text-green-400' : th.textDim}`}>{alertsEnabled ? 'ON' : 'OFF'}</span>
              </div>
              <div className="p-3 space-y-2 max-h-48 overflow-y-auto">
                {alerts.length === 0 ? <div className={`text-[10px] ${th.textDim}`}>{alertsEnabled ? 'Listening for alerts...' : 'Enable alerts to receive notifications'}</div>
                : alerts.slice(0, 10).map(a => (
                  <div key={a.id} className={`p-2 rounded ${th.card}/50 border-l-2 ${a.type === 'whale' ? 'border-cyan-500' : 'border-amber-500'}`}>
                    <div className="text-[10px] font-medium">{a.title}</div>
                    <div className={`text-[9px] ${th.textDim}`}>{a.body}</div>
                    <div className={`text-[8px] ${th.textDim} mt-1`}>{a.time.toLocaleTimeString()}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4">
          {/* Order Book */}
          <div className={`${th.card} border ${th.border} rounded-lg p-4`}>
            <div className={`text-[11px] ${th.textMuted} mb-3`}>{t.orderBook}</div>
            {!book?.bids?.length ? <div className={`text-xs ${th.textDim}`}>{getToken(selected) ? t.loading : t.noData}</div>
            : (
              <div className="grid grid-cols-2 gap-4 text-[10px]">
                <div>
                  <div className="text-green-500 text-[9px] mb-1">{t.bids}</div>
                  {book.bids.slice(0,8).map((b,i) => (
                    <div key={i} className="flex justify-between py-0.5">
                      <span className={th.textMuted}>{fmt(b.size)}</span>
                      <span className="text-green-400/80">{(safeNum(b.price)*100).toFixed(1)}¢</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="text-red-500 text-[9px] mb-1">{t.asks}</div>
                  {book.asks.slice(0,8).map((a,i) => (
                    <div key={i} className="flex justify-between py-0.5">
                      <span className="text-red-400/80">{(safeNum(a.price)*100).toFixed(1)}¢</span>
                      <span className={th.textMuted}>{fmt(a.size)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Score */}
          <div className={`${th.card} border ${th.border} rounded-lg p-4`}>
            <div className={`text-[11px] ${th.textMuted} text-center mb-2`}>{t.score}</div>
            <div className="relative flex justify-center">
              <svg viewBox="0 0 200 110" className="w-40">
                <defs><linearGradient id="g" x1="0%" x2="100%"><stop offset="0%" stopColor="#ef4444"/><stop offset="50%" stopColor="#eab308"/><stop offset="100%" stopColor="#22c55e"/></linearGradient></defs>
                <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke={theme === 'light' ? '#e5e7eb' : '#1e293b'} strokeWidth="8"/>
                <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#g)" strokeWidth="5" strokeDasharray={`${score*2.51} 251`}/>
                <g transform={`rotate(${-135 + score*2.7} 100 100)`}>
                  <line x1="100" y1="100" x2="100" y2="50" stroke={theme === 'light' ? '#374151' : '#fff'} strokeWidth="2"/>
                  <circle cx="100" cy="100" r="4" fill={theme === 'light' ? '#fff' : '#0f172a'} stroke={theme === 'light' ? '#374151' : '#fff'} strokeWidth="2"/>
                </g>
              </svg>
              <div className="absolute bottom-0 text-center">
                <div className="text-2xl font-bold">{score}</div>
                <div className={`text-[9px] px-2 py-0.5 rounded ${score >= 60 ? 'text-green-400 bg-green-500/20' : score >= 40 ? 'text-yellow-400 bg-yellow-500/20' : 'text-red-400 bg-red-500/20'}`}>
                  {score >= 60 ? t.bullish : score >= 40 ? t.neutral : t.bearish}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className={`border-t ${th.border} px-4 py-2 text-[9px] ${th.textDim} flex justify-between`}>
        <span>ELCARO OS v1.6</span>
        <span>{allMarkets.length} markets • {lang.toUpperCase()}</span>
      </footer>
    </div>
  )
}
