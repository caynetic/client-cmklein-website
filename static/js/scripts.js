const contactEndpoint = 'https://api.caynetic.app/submit/cmklein';
let turnstileWidgetId = null;

document.addEventListener('DOMContentLoaded', () => {
	initContactForm();
});

async function initContactForm() {
	const form = document.getElementById('contact-form');
	const status = document.getElementById('status');
	const widget = document.getElementById('turnstile-container');

	if (!form || !status || !widget) return;

	await renderTurnstile(widget);
	wireForm(form, status, widget);
}

function renderTurnstile(widget) {
	if (turnstileWidgetId) return Promise.resolve();
	return new Promise((resolve) => {
		const attempt = (tries) => {
			if (window.turnstile && window.turnstile.render) {
				turnstileWidgetId = window.turnstile.render('#turnstile-container', {
					sitekey: widget.dataset.sitekey
				});
				return resolve();
			}
			if (tries <= 0) return resolve();
			setTimeout(() => attempt(tries - 1), 150);
		};
		attempt(20);
	});
}

function wireForm(form, status, widget) {
	const inputs = form.querySelectorAll('input, textarea');
	inputs.forEach((el) => {
		el.addEventListener('input', () => {
			if (el.classList.contains('field-error')) {
				el.classList.remove('field-error');
			}
		});
	});

	form.addEventListener('submit', async (event) => {
		event.preventDefault();

		if (!validateForm(form, status)) return;

		setStatus(status, 'Sending...', 'pending');
		const formData = new FormData(form);

		if (formData.get('company')) {
			setStatus(status, 'Unable to send right now. Please try again.', 'error');
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

			if (res.ok) {
				setStatus(status, 'Sent successfully', 'success');
				form.reset();
				inputs.forEach((el) => el.classList.remove('field-error'));
				if (window.turnstile && window.turnstile.reset && turnstileWidgetId) {
					window.turnstile.reset(turnstileWidgetId);
				}
			} else {
				setStatus(status, 'Unable to send right now. Please try again.', 'error');
			}
		} catch (err) {
			setStatus(status, 'Unable to send right now. Please try again.', 'error');
		}
	});
}

function setStatus(el, text, state) {
	el.textContent = text;
	el.className = state ? `status status-${state}` : 'status';
}

function validateForm(form, status) {
	const requiredFields = ['name', 'email', 'message'];
	let valid = true;

	requiredFields.forEach((fieldName) => {
		const field = form.querySelector(`#${fieldName}`);
		if (!field) return;

		const value = field.value.trim();
		let isValid = value.length > 0;
		if (fieldName === 'email') {
			isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
		}

		if (!isValid) {
			valid = false;
			field.classList.add('field-error');
		}
	});

	if (!valid) {
		setStatus(status, 'Please fill in the required fields.', 'error');
	}

	return valid;
}
