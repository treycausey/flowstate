/** Shown in place of a /dev/* page in production builds. */
export default function DevOnlyNotice() {
  return (
    <div className="container stack" style={{ paddingTop: '1.25rem' }}>
      <h1>Dev only</h1>
      <p className="muted">This page is a development tool and is not available in this build.</p>
    </div>
  )
}
