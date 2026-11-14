import { CATEGORIES, mockEvents } from './src/data/mockData.js'

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
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

const INSTITUTIONAL_EMAIL_RE = /^[^\s@]+@(unmsm|universidad)\.edu\.pe$/i

function buildReviewSummary(eventId, reviews) {
  const totalReviews = reviews.length
  if (totalReviews === 0) {
    return {
      eventId,
      averageRating: 0,
      recommendationRate: 0,
      totalReviews: 0,
      reviews: [],
    }
  }
  const sumRating = reviews.reduce((acc, r) => acc + r.rating, 0)
  const recommendedCount = reviews.filter((r) => r.recommended).length
  return {
    eventId,
    averageRating: Number((sumRating / totalReviews).toFixed(1)),
    recommendationRate: Math.round((recommendedCount / totalReviews) * 100),
    totalReviews,
    reviews,
  }
}

function validateReviewFields(body) {
  const { rating, recommended, comment } = body || {}
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return 'La calificación debe ser un número entero entre 1 y 5'
  }
  if (typeof recommended !== 'boolean') {
    return 'El campo recommended debe ser booleano (true o false)'
  }
  if (comment !== undefined && (typeof comment !== 'string' || comment.trim().length > 400)) {
    return 'El comentario no puede superar los 400 caracteres'
  }
  return null
}

/**
 * Plugin de Vite que expone endpoints mock bajo /api/* durante `npm run dev`
 * para que las pruebas desde Scalar ("Test Request") funcionen sin backend externo.
 */
export function mockApiPlugin() {
  const events = mockEvents.map((ev) => ({ ...ev }))
  const inscriptionsByEvent = new Map()
  let nextReviewId = 3
  const reviewsByEvent = new Map([
    [
      1,
      [
        {
          id: 1,
          eventId: 1,
          studentName: 'Luis Paredes',
          studentEmail: 'luis.paredes@unmsm.edu.pe',
          rating: 5,
          recommended: true,
          comment: 'Excelente introducción a IA, la demo con Python estuvo muy práctica.',
          createdAt: '2026-10-04T15:30:00.000Z',
          updatedAt: '2026-10-04T15:30:00.000Z',
        },
        {
          id: 2,
          eventId: 1,
          studentName: 'Valeria Quispe',
          studentEmail: 'valeria.quispe@unmsm.edu.pe',
          rating: 4,
          recommended: true,
          comment: 'Muy buena ponencia del Dr. Mendoza. Recomendado para ciclos intermedios.',
          createdAt: '2026-10-04T18:10:00.000Z',
          updatedAt: '2026-10-04T18:10:00.000Z',
        },
      ],
    ],
  ])

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
              if (!email || !INSTITUTIONAL_EMAIL_RE.test(email)) {
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

        // ── CRUD de Valoraciones y Recomendaciones (/events/:id/reviews) ────────
        const reviewsCollectionMatch = pathname.match(/^\/events\/(\d+)\/reviews$/)
        if (reviewsCollectionMatch) {
          const eventId = Number(reviewsCollectionMatch[1])
          const event = events.find((e) => e.id === eventId)
          if (!event) {
            return sendJson(res, 404, { message: 'Evento no encontrado' })
          }

          const list = reviewsByEvent.get(eventId) || []

          if (req.method === 'GET') {
            return sendJson(res, 200, buildReviewSummary(eventId, list))
          }

          if (req.method === 'POST') {
            try {
              const today = new Date().toISOString().split('T')[0]
              if (event.date >= today) {
                return sendJson(res, 400, {
                  message: 'Solo puedes valorar eventos que ya se realizaron',
                })
              }

              const body = await readJsonBody(req)
              const { studentName, studentEmail, rating, recommended, comment = '' } = body || {}

              if (!studentName || studentName.trim().length < 3) {
                return sendJson(res, 400, { message: 'El nombre debe tener al menos 3 caracteres' })
              }
              if (!studentEmail || !INSTITUTIONAL_EMAIL_RE.test(studentEmail)) {
                return sendJson(res, 400, {
                  message: 'Usa un correo @unmsm.edu.pe o @universidad.edu.pe',
                })
              }
              const fieldError = validateReviewFields(body)
              if (fieldError) {
                return sendJson(res, 400, { message: fieldError })
              }

              const normalizedEmail = studentEmail.trim().toLowerCase()
              if (list.some((r) => r.studentEmail.toLowerCase() === normalizedEmail)) {
                return sendJson(res, 409, {
                  message: 'Ya registraste una valoración para este evento. Puedes editarla.',
                })
              }

              const now = new Date().toISOString()
              const newReview = {
                id: nextReviewId++,
                eventId,
                studentName: studentName.trim(),
                studentEmail: normalizedEmail,
                rating,
                recommended,
                comment: comment.trim(),
                createdAt: now,
                updatedAt: now,
              }
              reviewsByEvent.set(eventId, [newReview, ...list])
              return sendJson(res, 201, newReview)
            } catch {
              return sendJson(res, 400, { message: 'JSON inválido en el cuerpo de la petición' })
            }
          }
        }

        const reviewItemMatch = pathname.match(/^\/events\/(\d+)\/reviews\/(\d+)$/)
        if (reviewItemMatch) {
          const eventId = Number(reviewItemMatch[1])
          const reviewId = Number(reviewItemMatch[2])
          const event = events.find((e) => e.id === eventId)
          if (!event) {
            return sendJson(res, 404, { message: 'Evento no encontrado' })
          }

          const list = reviewsByEvent.get(eventId) || []
          const idx = list.findIndex((r) => r.id === reviewId)
          if (idx === -1) {
            return sendJson(res, 404, { message: 'Valoración no encontrada' })
          }

          if (req.method === 'GET') {
            return sendJson(res, 200, list[idx])
          }

          if (req.method === 'PUT') {
            try {
              const body = await readJsonBody(req)
              const fieldError = validateReviewFields(body)
              if (fieldError) {
                return sendJson(res, 400, { message: fieldError })
              }

              const updated = {
                ...list[idx],
                rating: body.rating,
                recommended: body.recommended,
                comment: (body.comment ?? '').trim(),
                updatedAt: new Date().toISOString(),
              }
              const nextList = [...list]
              nextList[idx] = updated
              reviewsByEvent.set(eventId, nextList)
              return sendJson(res, 200, updated)
            } catch {
              return sendJson(res, 400, { message: 'JSON inválido en el cuerpo de la petición' })
            }
          }

          if (req.method === 'DELETE') {
            const nextList = list.filter((r) => r.id !== reviewId)
            reviewsByEvent.set(eventId, nextList)
            return sendJson(res, 200, {
              eventId,
              reviewId,
              status: 'deleted',
            })
          }
        }

        next()
      })
    },
  }
}
