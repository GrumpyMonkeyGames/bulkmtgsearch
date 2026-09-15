import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

let browser = null

async function getBrowser() {
  if (!browser) {
    const puppeteer = await import('puppeteer')
    browser = await puppeteer.default.launch({ headless: 'shell' })
  }
  return browser
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'mindstage-proxy',
      configureServer(server) {
        server.httpServer?.once('close', async () => {
          if (browser) { await browser.close(); browser = null }
        })

        server.middlewares.use('/api/quantity', async (req, res) => {
          const { URL } = await import('url')
          const parsed = new URL(`http://localhost${req.url}`)
          const name = parsed.searchParams.get('name')

          if (!name) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Missing name' }))
            return
          }

          const target = `https://www.svenskamagic.com/kortparmen/index.php?action=search&s_name=${encodeURIComponent(name).replace(/%20/g, '+')}&order=name&exact=true&n=1`

          try {
            const b = await getBrowser()
            const page = await b.newPage()
            try {
              await page.goto(target, { waitUntil: 'networkidle2', timeout: 20000 })
              const result = await page.evaluate(() => {
                const spans = document.querySelectorAll('span.mini.text_gra')
                if (!spans.length) return { quantity: null, price: null, cardUrl: null }
                let total = 0
                let minPrice = null
                let cheapestCardHref = null
                spans.forEach(span => {
                  const qm = span.textContent.match(/(\d+)/)
                  const qty = qm ? parseInt(qm[1], 10) : 0
                  total += qty
                  if (qty > 0) {
                    const priceSpan = span.parentElement
                    if (priceSpan) {
                      const text = Array.from(priceSpan.childNodes)
                        .filter(n => n.nodeType === 3)
                        .map(n => n.textContent)
                        .join('')
                      const pm = text.match(/(\d+)/)
                      if (pm) {
                        const p = parseInt(pm[1], 10)
                        if (minPrice === null || p < minPrice) {
                          minPrice = p
                          // Walk up from span; stop at the first ancestor containing
                          // exactly one a.cardpic-holder — that's this card's own row
                          let el = span
                          cheapestCardHref = null
                          while (el && el.tagName !== 'BODY') {
                            el = el.parentElement
                            if (!el) break
                            const cardLinks = el.querySelectorAll('a.cardpic-holder')
                            if (cardLinks.length === 1) {
                              cheapestCardHref = cardLinks[0].getAttribute('href')
                              break
                            }
                          }
                        }
                      }
                    }
                  }
                })
                return { quantity: total, price: minPrice, cardUrl: cheapestCardHref }
              })
              console.log(`[mindstage] "${name}" → ${result.quantity} st, min ${result.price} kr, cardUrl: ${result.cardUrl}`)
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(result))
            } finally {
              await page.close()
            }
          } catch (e) {
            console.error(`[mindstage] "${name}" error:`, e.message)
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: e.message }))
          }
        })
      },
    },
  ],
})
