import { CATEGORIES, mockEvents } from './src/data/mockData.js'

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept')
  res.end(JSON.stringify(payload))
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
    })
    req.on('end', () => {
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

/**
 * Plugin de Vite que expone endpoints mock bajo /api/* durante `npm run dev`
 * para que las pruebas desde Scalar ("Test Request") funcionen sin backend externo.
 */
export function mockApiPlugin() {
  const events = mockEvents.map((ev) => ({ ...ev }))
  const inscriptionsByEvent = new Map()

  return {
    name: 'eventos-fisi-mock-api',
    configureServer(server) {
      server.middlewares.use('/api', async (req, res, next) => {
        if (req.method === 'OPTIONS') {
          return sendJson(res, 204, {})
        }

        const url = new URL(req.url || '/', 'http://localhost')
        const pathname = url.pathname

        if (req.method === 'GET' && pathname === '/categories') {
          return sendJson(res, 200, CATEGORIES)
        }

        if (req.method === 'GET' && pathname === '/events') {
          const today = new Date().toISOString().split('T')[0]
          const search = (url.searchParams.get('search') || '').toLowerCase()
          const category = url.searchParams.get('category') || 'all'
          const status = url.searchParams.get('status') || 'all'
          const cost = url.searchParams.get('cost') || 'all'

          const filtered = events.filter((event) => {
            const isUpcoming = event.date >= today
            if (status === 'upcoming' && !isUpcoming) return false
            if (status === 'past' && isUpcoming) return false
            if (category !== 'all' && event.category !== category) return false
            if (cost === 'free' && !event.isFree) return false
            if (cost === 'paid' && event.isFree) return false
            if (search) {
              const match =
                event.title.toLowerCase().includes(search) ||
                event.speaker.toLowerCase().includes(search) ||
                event.category.toLowerCase().includes(search)
              if (!match) return false
            }
            return true
          })

          return sendJson(res, 200, filtered)
        }

        const eventDetailMatch = pathname.match(/^\/events\/(\d+)$/)
        if (req.method === 'GET' && eventDetailMatch) {
          const id = Number(eventDetailMatch[1])
          const event = events.find((e) => e.id === id)
          if (!event) {
            return sendJson(res, 404, { message: 'Evento no encontrado' })
          }
          return sendJson(res, 200, event)
        }

        const inscriptionMatch = pathname.match(/^\/events\/(\d+)\/inscriptions$/)
        if (inscriptionMatch) {
          const id = Number(inscriptionMatch[1])
          const event = events.find((e) => e.id === id)
          if (!event) {
            return sendJson(res, 404, { message: 'Evento no encontrado' })
          }

          if (req.method === 'POST') {
            try {
              const body = await readJsonBody(req)
              const { name, email, phone } = body || {}
              if (!name || name.trim().length < 3) {
                return sendJson(res, 400, { message: 'El nombre debe tener al menos 3 caracteres' })
              }
              if (!email || !/^[^\s@]+@(unmsm|universidad)\.edu\.pe$/i.test(email)) {
                return sendJson(res, 400, { message: 'Usa un correo @unmsm.edu.pe o @universidad.edu.pe' })
              }
              if (!phone || !/^[0-9]{7,15}$/.test(phone)) {
                return sendJson(res, 400, { message: 'El teléfono debe tener entre 7 y 15 dígitos' })
              }

              const today = new Date().toISOString().split('T')[0]
              if (event.date < today) {
                return sendJson(res, 400, { message: 'No es posible inscribirse a un evento pasado' })
              }
              if (event.enrolled >= event.capacity) {
                return sendJson(res, 400, { message: 'No quedan cupos disponibles para este evento' })
              }

              const emails = inscriptionsByEvent.get(id) || new Set()
              if (!emails.has(email)) {
                emails.add(email)
                inscriptionsByEvent.set(id, emails)
                event.enrolled += 1
              }

              return sendJson(res, 201, {
                eventId: id,
                studentEmail: email,
                status: 'enrolled',
              })
            } catch {
              return sendJson(res, 400, { message: 'JSON inválido en el cuerpo de la petición' })
            }
          }

          if (req.method === 'DELETE') {
            const email = url.searchParams.get('email')
            const emails = inscriptionsByEvent.get(id)
            if (!email || !emails || !emails.has(email)) {
              return sendJson(res, 404, { message: 'Inscripción no encontrada para ese correo' })
            }
            emails.delete(email)
            event.enrolled = Math.max(0, event.enrolled - 1)
            return sendJson(res, 200, { eventId: id, status: 'cancelled' })
          }
        }

        next()
      })
    },
  }
}
