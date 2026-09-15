import { useState } from 'react'
import './App.css'

const MARKETPLACES = {
  cardmarket: 'Cardmarket',
  mindstage: 'Mindstage',
}

async function fetchCardData(name) {
  const res = await fetch(`/api/quantity?name=${encodeURIComponent(name)}`)
  const data = await res.json()
  return { quantity: data.quantity ?? null, price: data.price ?? null, cardUrl: data.cardUrl ?? null }
}

const SCRYFALL_IMG = (name) =>
  `https://api.scryfall.com/cards/named?format=image&version=normal&fuzzy=${encodeURIComponent(name)}`

function PreviewIcon() {
  return (
    <span
      className="preview-icon"
      onClick={(e) => e.preventDefault()}
    >
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="0.75" y="0.75" width="11.5" height="11.5" rx="1.25" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="4" cy="4.5" r="1" fill="currentColor"/>
        <path d="M1.5 9.5L4 6.5L6.5 9L8.5 7L11.5 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </span>
  )
}

function App() {
  const [marketplace, setMarketplace] = useState('cardmarket')
  const [username, setUsername] = useState('')
  const [cardList, setCardList] = useState('')
  const [copied, setCopied] = useState(false)
  const [quantities, setQuantities] = useState({})
  const [checkingStock, setCheckingStock] = useState(false)
  const [copiedUnavailable, setCopiedUnavailable] = useState(false)
  const [cardPreview, setCardPreview] = useState(null)

  const copyList = () => {
    navigator.clipboard.writeText(cardList)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const lines = cardList.split('\n')

  const cards = lines
    .map((line, lineIndex) => ({ name: line.trim().replace(/^\d+\s+/, ''), lineIndex }))
    .filter(({ name }) => name.length > 0)

  const removeCard = (lineIndex) => {
    const updated = lines.filter((_, i) => i !== lineIndex)
    setCardList(updated.join('\n'))
  }

  const makeUrl = (card) => {
    if (marketplace === 'mindstage') {
      return `https://www.svenskamagic.com/kortparmen/index.php?action=search&s_name=${encodeURIComponent(card).replace(/%20/g, '+')}&order=expansion&exact=true&n=1`
    }
    if (username) {
      return `https://www.cardmarket.com/en/Magic/Users/${encodeURIComponent(username)}/Offers/Singles?name=${encodeURIComponent(card)}&sortBy=name_asc`
    }
    return `https://www.cardmarket.com/en/Magic/Products/Search?category=-1&searchString=${encodeURIComponent(card).replace(/%20/g, '+')}&searchMode=v2`
  }

  const makeCheapUrl = (card) => {
    if (marketplace === 'mindstage') {
      return `https://www.svenskamagic.com/kortparmen/index.php?action=search&s_name=${encodeURIComponent(card).replace(/%20/g, '+')}&order=price&exact=true&n=1`
    }
    if (username) {
      return `https://www.cardmarket.com/en/Magic/Users/${encodeURIComponent(username)}/Offers/Singles?name=${encodeURIComponent(card)}&sortBy=price_asc`
    }
    return `https://www.cardmarket.com/en/Magic/Products/Singles?name=${encodeURIComponent(card)}&sortBy=price_asc`
  }

  const retryCard = async (name) => {
    setQuantities(prev => ({ ...prev, [name]: 'loading' }))
    try {
      const data = await fetchCardData(name)
      setQuantities(prev => ({ ...prev, [name]: data }))
    } catch {
      setQuantities(prev => ({ ...prev, [name]: 'error' }))
    }
  }

  const checkStock = async () => {
    setCheckingStock(true)
    const names = cards.map(c => c.name)
    setQuantities(Object.fromEntries(names.map(n => [n, 'loading'])))

    for (const name of names) {
      try {
        const data = await fetchCardData(name)
        setQuantities(prev => ({ ...prev, [name]: data }))
      } catch {
        setQuantities(prev => ({ ...prev, [name]: 'error' }))
      }
      await new Promise(r => setTimeout(r, 150))
    }

    setCheckingStock(false)
  }

  const copyUnavailable = () => {
    const names = cards
      .filter(({ name }) => {
        const q = quantities[name]
        if (!q || q === 'loading') return false
        return q === 'error' || q.price === null
      })
      .map(({ name }) => name)
      .join('\n')
    navigator.clipboard.writeText(names)
    setCopiedUnavailable(true)
    setTimeout(() => setCopiedUnavailable(false), 2000)
  }

  const handleMarketplaceChange = (e) => {
    setMarketplace(e.target.value)
    setQuantities({})
  }

  const showPreview = (name, e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const imageHeight = 307
    const top = Math.max(16, Math.min(rect.top, window.innerHeight - imageHeight - 16))
    setCardPreview({ name, top })
  }

  const hidePreview = () => setCardPreview(null)

  const isMindstage = marketplace === 'mindstage'

  const resolvedCards = cards.filter(({ name }) => {
    const q = quantities[name]
    return q && q !== 'loading' && q !== 'error'
  })
  const pricedCards = resolvedCards.filter(({ name }) => quantities[name].price !== null)
  const totalPrice = pricedCards.reduce((sum, { name }) => sum + quantities[name].price, 0)
  const unavailableCount = resolvedCards.length - pricedCards.length

  return (
    <div className="app">
      <div className="app-header">
        <h1>{MARKETPLACES[marketplace]} Search</h1>
      </div>

      <div className="app-body">
        <div className="inputs">
          <div className="field">
            <label htmlFor="marketplace">Marketplace</label>
            <select
              id="marketplace"
              value={marketplace}
              onChange={handleMarketplaceChange}
            >
              {Object.entries(MARKETPLACES).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {marketplace === 'cardmarket' && (
            <div className="field">
              <label htmlFor="username">Seller Username (optional)</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. Eliytresoc"
              />
            </div>
          )}

          <div className="field">
            <div className="field-header">
              <label htmlFor="cards">Card List (one per line)</label>
              <button className={`copy-btn${copied ? ' confirmed' : ''}`} onClick={copyList} disabled={!cardList.trim()}>
                {copied ? '✓ Copied' : 'Copy List'}
              </button>
            </div>
            <textarea
              id="cards"
              value={cardList}
              onChange={e => setCardList(e.target.value)}
              placeholder={"Aether Channeler\nLightning Bolt\nCounterspell"}
              rows={10}
            />
          </div>
        </div>

        {cards.length > 0 ? (
          <div className="results">
            <div className="results-header">
              <h2>Links ({cards.length})</h2>
              {isMindstage && (
                <button className="copy-btn" onClick={checkStock} disabled={checkingStock}>
                  {checkingStock ? 'Checking…' : 'Check Stock'}
                </button>
              )}
            </div>
            <ul className={isMindstage ? 'with-retry' : ''}>
              {isMindstage && (
                <li className="header-row">
                  <span className="col-header" />
                  <span className="col-header">Stock</span>
                  <span className="col-header">Price</span>
                  <span className="col-header" />
                  <span className="col-header" />
                </li>
              )}
              {cards.map(({ name, lineIndex }, idx) => {
                const qty = quantities[name]
                const cheapUrl = qty && qty !== 'loading' && qty !== 'error' && qty.price !== null
                  ? (qty.cardUrl ? `https://www.svenskamagic.com/kortparmen/${qty.cardUrl}` : makeCheapUrl(name))
                  : null
                return (
                  <li key={lineIndex} className={idx % 2 === 0 ? 'row-dark' : ''}>
                    <a href={makeUrl(name)} target="_blank" rel="noreferrer" onMouseEnter={(e) => showPreview(name, e)} onMouseLeave={hidePreview}>
                      <PreviewIcon />
                      {name}
                    </a>
                    {isMindstage && (
                      <span className="stock-cell">
                        {qty === undefined ? null :
                          qty === 'loading' ? <span className="stock loading">…</span> :
                          qty === 'error' ? <span className="stock error">!</span> :
                          <span className={`stock ${qty.quantity === null ? 'unknown' : qty.quantity === 0 ? 'out' : 'in'}`}>
                            {qty.quantity === null ? '?' : `${qty.quantity} st`}
                          </span>
                        }
                      </span>
                    )}
                    {isMindstage && (
                      cheapUrl
                        ? <a href={cheapUrl} target="_blank" rel="noreferrer" className="price-cell">{qty.price} kr</a>
                        : <span className="price-cell" />
                    )}
                    {isMindstage && (
                      <button
                        className="retry"
                        onClick={() => retryCard(name)}
                        disabled={qty === 'loading'}
                        title="Refresh"
                      >
                        ↻
                      </button>
                    )}
                    <button className="bought" onClick={() => removeCard(lineIndex)}>Bought</button>
                  </li>
                )
              })}
            </ul>
            {resolvedCards.length > 0 && (
              <div className="results-total">
                <span>
                  Total
                  {unavailableCount > 0 && (
                    <>
                      <span className="total-caveat"> · {unavailableCount} unavailable</span>
                      <button
                        className={`copy-unavailable${copiedUnavailable ? ' confirmed' : ''}`}
                        onClick={copyUnavailable}
                      >
                        {copiedUnavailable ? '✓ Copied' : 'Copy list'}
                      </button>
                    </>
                  )}
                </span>
                <span>{totalPrice} kr</span>
              </div>
            )}
          </div>
        ) : (
          <p className="hint">Enter at least one card to generate links.</p>
        )}
      </div>
      {cardPreview && (
        <div className="card-preview" style={{ top: cardPreview.top }}>
          <img src={SCRYFALL_IMG(cardPreview.name)} alt={cardPreview.name} />
        </div>
      )}
    </div>
  )
}

export default App
