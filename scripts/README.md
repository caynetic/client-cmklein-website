# Résumé PDF

The downloadable résumé is generated from `resume.html`, which is the source of truth for its content.

Install the PDF dependency in your Python environment with `python3 -m pip install -r scripts/requirements-pdf.txt`, then run `python3 scripts/build-resume-pdf.py` after editing the résumé. The script writes `static/documents/christopher-m-klein-resume.pdf`, which the résumé page links to for download.

Inspect both PDF pages after regenerating, and commit the page and PDF together.
