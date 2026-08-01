# tilchi

Ingliz tili o'qituvchisi Mukhtasar Karimjonova sayti (tilchi.uz). Next.js 16 static export + velite MDX blog, GitHub Pages'ga deploy.

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

- Deploy: `main`'ga push — GitHub Pages workflow (`out/` build qilib upload qiladi).
- Rollback: eski build avtomatik saqlanadi — GitHub Pages environment'idan oldingi deployment'ni tanlang yoki `git revert` + push qiling.
- Migratsiyadan oldingi bitta-fayl sayt: `45105e5` commit'ida (`index.html`) — favqulodda holat uchun tiklanishi mumkin.
