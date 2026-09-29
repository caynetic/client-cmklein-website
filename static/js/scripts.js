const contactEndpoint = 'https://inbox.caynetic.online/webforms/submit/cmklein';
let turnstileWidgetId = null;
const turnstileScriptSrc = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

document.addEventListener('DOMContentLoaded', () => {
	initNavigation();
	initPosterMotion();
	document.querySelector('[data-print-resume]')?.addEventListener('click', () => window.print());
	initContactForm();
});

function initNavigation() {
	const toggle = document.querySelector('.menu-toggle');
	const nav = document.getElementById('site-navigation');
	if (!toggle || !nav) return;
	const setOpen = (open) => {
		toggle.setAttribute('aria-expanded', String(open));
		nav.classList.toggle('is-open', open);
		toggle.querySelector('i')?.classList.toggle('fa-bars', !open);
		toggle.querySelector('i')?.classList.toggle('fa-xmark', open);
	};
	toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
			setOpen(false);
			toggle.focus();
		}
	});
	window.matchMedia('(max-width: 760px)').addEventListener('change', () => setOpen(false));
	document.documentElement.classList.add('js');
}

function initPosterMotion() {
	const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
	const tickers = [...document.querySelectorAll('[data-ticker]')];
	const reveals = [...document.querySelectorAll('[data-reveal]')];
	let observer = null;

	tickers.forEach((ticker) => {
		const track = ticker.querySelector('.ticker-track');
		const group = track?.querySelector('.ticker-group');
		const button = ticker.querySelector('.ticker-toggle');
		if (!track || !group || !button) return;
		const copy = group.cloneNode(true);
		copy.setAttribute('aria-hidden', 'true');
		track.append(copy);
		ticker.dataset.paused = 'false';
		button.addEventListener('click', () => {
			const paused = ticker.dataset.paused !== 'true';
			ticker.dataset.paused = String(paused);
			button.setAttribute('aria-label', paused ? 'Resume scrolling strip' : 'Pause scrolling strip');
			button.title = paused ? 'Resume scrolling text' : 'Pause scrolling text';
			button.querySelector('i').className = paused ? 'fa-solid fa-play' : 'fa-solid fa-pause';
		});
	});

	const applyPreference = () => {
		observer?.disconnect();
		const motion = !preference.matches;
		document.documentElement.classList.toggle('motion-ready', motion);
		tickers.forEach((ticker) => {
			ticker.classList.toggle('ticker-ready', motion);
			ticker.querySelector('.ticker-toggle').hidden = !motion;
		});
		if (!motion || !('IntersectionObserver' in window)) {
			reveals.forEach((element) => element.classList.add('is-revealed'));
			return;
		}
		observer = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				if (!entry.isIntersecting) return;
				entry.target.classList.add('is-revealed');
				observer.unobserve(entry.target);
			});
		}, { threshold: 0.1, rootMargin: '0px 0px -24px 0px' });
		reveals.forEach((element) => {
			const bounds = element.getBoundingClientRect();
			if (bounds.top < window.innerHeight && bounds.bottom > 0) element.classList.add('is-revealed');
			element.classList.add('reveal-ready');
			if (!element.classList.contains('is-revealed')) observer.observe(element);
		});
	};
	document.addEventListener('focusin', (event) => {
		const element = event.target.closest('[data-reveal]');
		if (element) {
			element.classList.add('is-revealed');
			observer?.unobserve(element);
		}
	});
	document.addEventListener('visibilitychange', () => {
		tickers.forEach((ticker) => { ticker.dataset.suspended = String(document.hidden); });
	});
	preference.addEventListener('change', applyPreference);
	applyPreference();
}

async function initContactForm() {
	const form = document.getElementById('contact-form');
	const status = document.getElementById('status');
	const widget = document.getElementById('turnstile-container');

	if (!form || !status || !widget) return;

	const turnstileEnabled = shouldEnableTurnstile(widget);
	wireForm(form, status, turnstileEnabled);
	if (turnstileEnabled) {
		await ensureTurnstileScript();
		await renderTurnstile(widget);
	} else {
		widget.classList.add('hidden');
	}
}

function shouldEnableTurnstile(widget) {
	const hostname = window.location.hostname;
	const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
	return !isLocal && Boolean(widget?.dataset?.sitekey);
}

function ensureTurnstileScript() {
	if (window.turnstile && window.turnstile.render) return Promise.resolve();

	const existing = document.querySelector(`script[src="${turnstileScriptSrc}"]`);
	if (existing) {
		return new Promise((resolve) => {
			const attempt = (tries) => {
				if (window.turnstile && window.turnstile.render) {
					return resolve();
				}
				if (tries <= 0) return resolve();
				setTimeout(() => attempt(tries - 1), 150);
			};
			attempt(20);
		});
	}

	return new Promise((resolve) => {
		const script = document.createElement('script');
		script.src = turnstileScriptSrc;
		script.async = true;
		script.defer = true;
		script.onload = () => resolve();
		script.onerror = () => resolve();
		document.head.appendChild(script);
	});
}

function renderTurnstile(widget) {
	if (turnstileWidgetId !== null) return Promise.resolve();
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

function wireForm(form, status, turnstileEnabled) {
	const inputs = form.querySelectorAll('input, textarea');
	const submit = form.querySelector('button[type="submit"]');
	const submitLabel = submit.innerHTML;
	let sending = false;
	inputs.forEach((el) => {
		el.addEventListener('input', () => {
			clearFieldError(el);
		});
	});

	form.addEventListener('submit', async (event) => {
		event.preventDefault();
		if (sending) return;

		if (!validateForm(form)) {
			setStatus(status, 'Please check the highlighted fields.', 'error');
			form.querySelector('[aria-invalid="true"]')?.focus();
			return;
		}

		const formData = new FormData(form);

		if (formData.get('company')) {
			setStatus(status, 'Unable to send right now. Please try again.', 'error');
			return;
		}

		const token = formData.get('cf-turnstile-response');
		if (turnstileEnabled && !token) {
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

		sending = true;
		submit.disabled = true;
		submit.textContent = 'Sending…';
		form.setAttribute('aria-busy', 'true');
		setStatus(status, 'Sending your message…', 'pending');

		try {
			const res = await fetch(contactEndpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			if (res.ok) {
				setStatus(status, 'Sent successfully', 'success');
				form.reset();
				inputs.forEach(clearFieldError);
			} else {
				setStatus(status, 'Unable to send right now. Please try again.', 'error');
			}
		} catch (err) {
			setStatus(status, 'Unable to send right now. Please try again.', 'error');
		} finally {
			sending = false;
			submit.disabled = false;
			submit.innerHTML = submitLabel;
			form.removeAttribute('aria-busy');
			if (window.turnstile?.reset && turnstileWidgetId !== null) {
				window.turnstile.reset(turnstileWidgetId);
			}
		}
	});
}

function setStatus(el, text, state) {
	el.textContent = text;
	if (!text || !state) {
		el.className = 'status hidden';
		return;
	}
	el.className = `status status-${state}`;
}

function clearFieldError(field) {
	field.classList.remove('field-error');
	field.removeAttribute('aria-invalid');
	const error = document.getElementById(`${field.id}-error`);
	if (error) error.textContent = '';
}

function validateForm(form) {
	const requiredFields = ['name', 'email', 'message'];
	let valid = true;

	requiredFields.forEach((fieldName) => {
		const field = form.querySelector(`#${fieldName}`);
		if (!field) return;

		const value = field.value.trim();
		clearFieldError(field);
		let isValid = value.length > 0;
		if (fieldName === 'email') {
			isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
		}

		if (!isValid) {
			valid = false;
			field.classList.add('field-error');
			field.setAttribute('aria-invalid', 'true');
			const error = document.getElementById(`${fieldName}-error`);
			if (error) error.textContent = fieldName === 'email' ? 'Enter a valid email address.' : `Enter your ${fieldName}.`;
		}
	});

	return valid;
}
