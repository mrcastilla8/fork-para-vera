import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'

/**
 * Sección de valoraciones y recomendaciones para un evento.
 * Consume el CRUD REST en /api/events/:id/reviews.
 */
function ReviewSection({ eventId, isPast }) {
  const { student, openModal } = useApp()

  const [summary, setSummary] = useState({
    averageRating: 0,
    recommendationRate: 0,
    totalReviews: 0,
    reviews: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Estado del formulario (creación o edición)
  const [rating, setRating] = useState(5)
  const [recommended, setRecommended] = useState(true)
  const [comment, setComment] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/events/${eventId}/reviews`)
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.message || 'No se pudieron cargar las valoraciones')
      }
      const data = await res.json()
      setSummary(data)
    } catch (err) {
      setError(err.message || 'Error de conexión con la API de valoraciones')
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    fetchReviews()
    setEditingId(null)
    setFormError('')
  }, [fetchReviews])

  const normalizedStudentEmail = student?.email?.trim().toLowerCase() || ''
  const myReview = summary.reviews.find(
    (r) => r.studentEmail.toLowerCase() === normalizedStudentEmail
  )

  const startEditing = (review) => {
    setEditingId(review.id)
    setRating(review.rating)
    setRecommended(review.recommended)
    setComment(review.comment || '')
    setFormError('')
  }

  const cancelEditing = () => {
    setEditingId(null)
    setRating(5)
    setRecommended(true)
    setComment('')
    setFormError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!student) {
      openModal()
      return
    }

    setSubmitting(true)
    setFormError('')
    try {
      const isEdit = editingId !== null
      const url = isEdit
        ? `/api/events/${eventId}/reviews/${editingId}`
        : `/api/events/${eventId}/reviews`

      const payload = isEdit
        ? { rating, recommended, comment }
        : {
            studentName: student.name,
            studentEmail: student.email,
            rating,
            recommended,
            comment,
          }

      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.message || 'No se pudo guardar la valoración')
      }

      cancelEditing()
      await fetchReviews()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (reviewId) => {
    setSubmitting(true)
    setFormError('')
    try {
      const res = await fetch(`/api/events/${eventId}/reviews/${reviewId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.message || 'No se pudo eliminar la valoración')
      }
      if (editingId === reviewId) cancelEditing()
      await fetchReviews()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const showForm = isPast && student && (!myReview || editingId !== null)

  return (
    <section className="reviews-section" aria-labelledby="reviews-heading">
      <div className="reviews-header">
        <h3 id="reviews-heading" className="detail-section-title">
          ⭐ Valoraciones y Recomendaciones
        </h3>

        {!loading && !error && (
          <div className="reviews-summary">
            <span className="reviews-summary__score">
              ★ {summary.averageRating > 0 ? summary.averageRating.toFixed(1) : '—'}
            </span>
            <span className="reviews-summary__meta">
              {summary.totalReviews} {summary.totalReviews === 1 ? 'valoración' : 'valoraciones'}
              {summary.totalReviews > 0 && ` · ${summary.recommendationRate}% lo recomienda`}
            </span>
          </div>
        )}
      </div>

      {!isPast && (
        <p className="reviews-notice">
          Las valoraciones y recomendaciones se habilitarán cuando este evento haya finalizado.
        </p>
      )}

      {isPast && !student && (
        <div className="reviews-cta">
          <p>¿Asististe a este evento? Identifícate para dejar tu valoración.</p>
          <button type="button" onClick={() => openModal()} className="btn btn--outline btn--sm">
            Identificarme para valorar
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="review-form">
          <h4 className="review-form__title">
            {editingId !== null ? 'Editar tu valoración' : 'Deja tu valoración'}
          </h4>

          <div className="review-form__row">
            <span className="review-form__label">Calificación:</span>
            <div className="star-picker" role="group" aria-label="Calificación de 1 a 5 estrellas">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`star-btn ${star <= rating ? 'star-btn--active' : ''}`}
                  aria-label={`${star} estrella${star > 1 ? 's' : ''}`}
                  aria-pressed={star === rating}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          <label className="review-form__checkbox">
            <input
              type="checkbox"
              checked={recommended}
              onChange={(e) => setRecommended(e.target.checked)}
            />
            <span>Recomiendo este evento a otros estudiantes</span>
          </label>

          <textarea
            className="review-form__textarea"
            rows={3}
            maxLength={400}
            placeholder="Cuéntanos qué te pareció la ponencia o qué mejorarías (opcional)..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />

          {formError && <p className="review-form__error">{formError}</p>}

          <div className="review-form__actions">
            <button type="submit" disabled={submitting} className="btn btn--primary btn--sm">
              {submitting
                ? 'Guardando...'
                : editingId !== null
                  ? 'Guardar cambios'
                  : 'Publicar valoración'}
            </button>
            {editingId !== null && (
              <button
                type="button"
                onClick={cancelEditing}
                disabled={submitting}
                className="btn btn--outline btn--sm"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}

      {loading ? (
        <p className="reviews-empty">Cargando valoraciones...</p>
      ) : error ? (
        <p className="reviews-empty">{error}</p>
      ) : summary.reviews.length === 0 ? (
        <p className="reviews-empty">Aún no hay valoraciones para este evento.</p>
      ) : (
        <ul className="reviews-list">
          {summary.reviews.map((review) => {
            const isMine =
              normalizedStudentEmail &&
              review.studentEmail.toLowerCase() === normalizedStudentEmail
            return (
              <li key={review.id} className="review-card">
                <div className="review-card__top">
                  <div>
                    <strong className="review-card__author">{review.studentName}</strong>
                    <span className="review-card__stars" aria-label={`${review.rating} de 5 estrellas`}>
                      {'★'.repeat(review.rating)}
                      {'☆'.repeat(5 - review.rating)}
                    </span>
                  </div>
                  <span
                    className={`badge ${review.recommended ? 'badge--success' : 'badge--past'}`}
                  >
                    {review.recommended ? '✓ Recomendado' : 'No recomendado'}
                  </span>
                </div>

                {review.comment && <p className="review-card__comment">{review.comment}</p>}

                {isMine && (
                  <div className="review-card__actions">
                    <button
                      type="button"
                      onClick={() => startEditing(review)}
                      disabled={submitting}
                      className="link-btn"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(review.id)}
                      disabled={submitting}
                      className="link-btn link-btn--danger"
                    >
                      Eliminar
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default ReviewSection
