# tilchi

Ingliz tili o'qituvchisi Mukhtasar Karimjonova sayti (tilchi.uz). Next.js 16 static export + velite MDX blog, Cloudflare Pages'ga deploy (wrangler).

## Local

```sh
pnpm install
pnpm dev        # development server
pnpm build      # velite -> OG images -> static export to out/
pnpm test       # vitest
pnpm check:budget  # JS budget gate (out/ mavjud bo'lishi kerak)
```

## Yangi blog post

`content/posts/<slug>.mdx` yarating — frontmatter: `title`, `description`, `date` (YYYY-MM-DD), `draft: true` nashrga qadar. Build paytida `/og/<slug>.png` avtomatik generatsiya qilinadi.

## Deploy va rollback

- Jonli sayt: tilchi.uz DNS Cloudflare'ga qaraydi — Cloudflare Pages loyihasi `tilchi` (`tilchi.pages.dev`). Deploy qo'lda, `main`'dan:

  ```sh
  pnpm build && wrangler pages deploy out --project-name tilchi --branch main
  ```

- `.github/workflows/static.yml` GitHub Pages'ga ham deploy qiladi, lekin DNS u yerga yo'naltirilmagan — jonli saytga ta'sir qilmaydi.
- Rollback: Cloudflare Pages → Deployments → oldingi deployment'ni "Rollback"; yoki `git revert` + qayta deploy.
- Dizayn spetsifikatsiyasi: `design.md`; bo'lim CSS'lari `src/styles/` (qarang `CONTEXT.md`).
- Migratsiyadan oldingi bitta-fayl sayt: `45105e5` commit'ida (`index.html`) — favqulodda holat uchun tiklanishi mumkin.
