const contactEndpoint = 'https://api.caynetic.app/submit/cmklein';

document.addEventListener('DOMContentLoaded', () => {
	initContactForm();
});

async function initContactForm() {
	const form = document.getElementById('contact-form');
	const status = document.getElementById('status');
	const widget = document.querySelector('.cf-turnstile');

	if (!form || !status || !widget) return;

	await renderTurnstile(widget);
	wireForm(form, status, widget);
}

function renderTurnstile(widget) {
	return new Promise((resolve) => {
		const attempt = (tries) => {
			if (window.turnstile && window.turnstile.render) {
				window.turnstile.render(widget, { sitekey: widget.dataset.sitekey });
				return resolve();
			}
			if (tries <= 0) return resolve();
			setTimeout(() => attempt(tries - 1), 150);
		};
		attempt(20);
	});
}

function wireForm(form, status, widget) {
	form.addEventListener('submit', async (event) => {
		event.preventDefault();
		setStatus(status, 'Sending...', 'pending');

		const formData = new FormData(form);

		if (formData.get('company')) {
			setStatus(status, 'Error: invalid submission', 'error');
			return;
		}

		const token = formData.get('cf-turnstile-response');
		if (!token) {
			setStatus(status, 'Please complete the verification.', 'error');
			return;
		}

		const payload = {
			name: formData.get('name')?.trim(),
			email: formData.get('email')?.trim(),
			phone: formData.get('phone')?.trim(),
			message: formData.get('message')?.trim(),
			company: formData.get('company')?.trim(),
			turnstile_token: token
		};

		try {
			const res = await fetch(contactEndpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const body = await res.json().catch(() => ({}));

			if (res.ok) {
				setStatus(status, 'Sent successfully', 'success');
				form.reset();
				if (window.turnstile && window.turnstile.reset) {
					window.turnstile.reset(widget);
				}
			} else {
				setStatus(status, `Error: ${body.error || 'unknown error'}`, 'error');
			}
		} catch (err) {
			setStatus(status, 'Network error, try again.', 'error');
		}
	});
}

function setStatus(el, text, state) {
	el.textContent = text;
	el.className = state ? `status status-${state}` : 'status';
}
