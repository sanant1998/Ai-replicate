'use client'

/**
 * The last resort: an error thrown by the root layout itself, before any of the
 * app shell exists.
 *
 * This component replaces the entire document, so it has to bring its own
 * <html> and <body> — and it cannot rely on the stylesheet the root layout
 * imports, since the failure may be that layout. Hence the inline styles, which
 * are otherwise not how anything here is written.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          padding: '2rem',
          background: '#f8fafc',
          color: '#1e3a5f',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
        }}
      >
        <main>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>PaperPath is temporarily down</h1>
          <p style={{ marginTop: '0.5rem', color: '#2c5282' }}>
            We could not load the app. Please try again in a moment.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '1.5rem',
              minHeight: '2.75rem',
              padding: '0.75rem 1.75rem',
              borderRadius: '9999px',
              border: 0,
              background: '#ea580c',
              color: '#fff',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
          {error.digest && (
            <p style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: '#64748b' }}>
              Reference: {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  )
}
