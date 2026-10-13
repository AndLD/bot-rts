import { docsMetadata, DocsView, docSlugs } from '../../../../../site/docs/DocsView'

// Every page of the documentation is known at build time, so each is rendered statically
export const dynamicParams = false

export const generateStaticParams = () => docSlugs().map((slug) => ({ slug }))

type Props = { params: Promise<{ slug?: string[] }> }

export async function generateMetadata({ params }: Props) {
  return docsMetadata('ru', (await params).slug)
}

export default async function DocsPage({ params }: Props) {
  const { slug } = await params

  return <DocsView locale="ru" slugParts={slug} />
}
