export function JsonLd({ data }: { data: object }) {
  const html = JSON.stringify(data).replace(/</g, '\\u003c')
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: html }} />
}
