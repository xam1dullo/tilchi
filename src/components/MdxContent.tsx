import { run } from '@mdx-js/mdx'
import * as runtime from 'react/jsx-runtime'

export async function MdxContent({ code }: { code: string }) {
  const { default: Content } = await run(code, runtime)
  return (
    <div className="article-body">
      <Content />
    </div>
  )
}
