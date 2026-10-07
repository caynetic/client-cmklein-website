# cmklein.com

Christopher Klein’s static portfolio: Home, Projects, Résumé and Contact. Cloudflare Pages serves production from this repository.

## Development

Use Node.js 20 or newer. Install dependencies with `npm ci`, then run `npm run build:css` after changing HTML or Tailwind classes. Serve the root with a local HTTP server. Production redirects `.html` paths to extensionless routes; a development server should resolve `/projects`, `/resume` and `/contact` to their HTML files.

- `static/css/poster.css`: active editorial theme and responsive layouts.
- `static/css/tailwind-input.css` and `tailwind.css`: Tailwind input and generated CSS.
- `static/js/scripts.js`: navigation, motion controls, printing and contact handling.
- Font Awesome 6.4.0 provides the existing icons.
- `resume.html` is the résumé content source; its action opens the browser print dialog.

## Contact safety

The contact form submits to the existing Caynetic Inbox endpoint with Cloudflare Turnstile. Controls start disabled until JavaScript installs the submission handler; direct contact remains available if loading fails. Only a successful response with `status: "ok"` clears the draft. Recognized validation rejections permit correction and retry. Unknown responses, SMTP errors, token replay and timeouts keep submission locked and direct the visitor to contact Christopher.

A submission marker in session storage survives reloads in the same tab. No contact details or verification tokens are stored. If storage is unavailable, use direct contact. This is a browser guard, not server-side idempotency across separate tabs or browsers.

## Checks

Run `npm run build:css` and `npm run test:forms`. The browser regression suite serves isolated local files and intercepts all external requests; it sends no email. Install its browser with `npx playwright install chromium`, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to a local Chrome/Chromium executable. Optional `CMK_TEST_OUTPUT` saves test screenshots and a JSON result outside the checkout.

On this Mac, run headless Chrome checks through the approved host execution path outside Codex’s sandbox. Keep browser profiles separate from personal sessions. Inspect the form’s mobile, desktop and failure-state screenshots as well as test results.

## Deployment

Push changes to a feature branch for review. Cloudflare Pages deploys production updates to `main`; pushing a feature branch does not establish production deployment. Verify provider deployment and live source before claiming the changes are live. A real delivery test requires explicit authorization and separate receiving-mailbox confirmation.

## License

Private and proprietary. All rights reserved.
