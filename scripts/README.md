# Verification scripts

`test-contact.mjs` checks the isolated contact form’s native-submission protection, response validation, uncertain-delivery guard, reload behavior and responsive states. Run `npm run test:forms`; see the root README for browser setup. All external requests are intercepted and no email is sent.

# Historical résumé PDF generator

`build-resume-pdf.py` generates a PDF from `resume.html` using `requirements-pdf.txt`. The current résumé page uses the browser print dialog. Regenerate the historical PDF only when that downloadable artifact is explicitly in scope, and inspect both pages before committing it.
