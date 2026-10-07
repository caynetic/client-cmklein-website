const contactEndpoint = 'https://inbox.caynetic.online/webforms/submit/cmklein';
const CONTACT_PENDING_KEY = 'cmklein-contact-pending-v1';
const CONTACT_TIMEOUT_MS = 30000;
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

// Store only a submission marker, never contact details or verification tokens.
function readPendingContact() {
	try {
		return sessionStorage.getItem(CONTACT_PENDING_KEY) === '1';
	} catch {
		return null;
	}
}

function rememberPendingContact(pending) {
	try {
		if (pending) sessionStorage.setItem(CONTACT_PENDING_KEY, '1');
		else sessionStorage.removeItem(CONTACT_PENDING_KEY);
		return true;
	} catch {
		return false;
	}
}

function isConfirmedContactRejection(response, body) {
	// These exact Inbox responses reject the request before attempting delivery.
	// Token replay, SMTP failures and unrecognized responses remain uncertain.
	const errors = {
		400: ['invalid request body', 'missing field: message', 'missing field: turnstile_token',
			'invalid turnstile token', 'invalid field: name', 'invalid field: email', 'invalid field: phone',
			'message too long', 'honeypot tripped', 'turnstile_verification_failed'],
		403: ['missing origin header', 'origin not allowed'],
		404: ['unknown client'],
		429: ['rate_limited']
	};
	return errors[response.status]?.includes(body?.error) === true;
}

function wireForm(form, status, turnstileEnabled) {
	const inputs = form.querySelectorAll('input, textarea');
	const fields = form.querySelector('fieldset');
	const submitButton = form.querySelector('[type="submit"]');
	const pending = readPendingContact();
	let deliveryPending = pending === true;
	let storageAvailable = pending !== null;
	const unknownMessage = 'I couldn’t confirm whether your message went through. Your message is still here. Please contact me directly before sending it again.';
	const overlay = form.closest('.contact-form-shell').querySelector('[data-contact-overlay]');
	const feedback = overlay.querySelector('.contact-feedback');
	const progress = overlay.querySelector('.contact-progress');
	const icon = overlay.querySelector('.contact-feedback-icon');
	const title = overlay.querySelector('.contact-feedback-title');
	const copy = overlay.querySelector('.contact-feedback-copy');
	const close = overlay.querySelector('[data-feedback-close]');
	let sending = false;
	const showFeedback = (state, heading, message) => {
		fields.disabled = true;
		form.inert = true;
		overlay.dataset.state = state;
		title.textContent = heading;
		copy.textContent = message;
		progress.hidden = state !== 'pending';
		icon.hidden = state === 'pending';
		icon.querySelector('i').className = state === 'success' ? 'fa-solid fa-check' : 'fa-solid fa-triangle-exclamation';
		close.hidden = state === 'pending';
		close.firstChild.textContent = state === 'success' ? 'Back to form ' : 'Back to message ';
		overlay.hidden = false;
		if (state === 'pending') feedback.focus();
		else close.focus({ preventScroll: true });
	};
	const closeFeedback = () => {
		if (sending) return;
		overlay.hidden = true;
		form.inert = false;
		fields.disabled = false;
		submitButton.disabled = deliveryPending || !storageAvailable;
		if (deliveryPending) setStatus(status, unknownMessage, 'error');
		else if (!storageAvailable) setStatus(status, 'The online form is unavailable in this browser. Please use the direct contact links.', 'error');
		form.querySelector(overlay.dataset.state === 'success' ? '#name' : '#message').focus();
	};
	close.addEventListener('click', closeFeedback);
	overlay.addEventListener('keydown', (event) => {
		if (event.key === 'Escape' && !sending) {
			event.preventDefault();
			closeFeedback();
		}
	});
	inputs.forEach((el) => {
		el.addEventListener('input', () => {
			clearFieldError(el);
		});
	});

	form.addEventListener('submit', async (event) => {
		event.preventDefault();
		if (sending || deliveryPending || !storageAvailable || !overlay.hidden) return;

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

		// Persist before sending so reloads cannot silently enable a duplicate.
		if (!rememberPendingContact(true)) {
			storageAvailable = false;
			submitButton.disabled = true;
			setStatus(status, 'The online form is unavailable in this browser. Please use the direct contact links.', 'error');
			return;
		}
		deliveryPending = true;
		submitButton.disabled = true;
		sending = true;
		form.setAttribute('aria-busy', 'true');
		setStatus(status, '', '');
		showFeedback('pending', 'Sending your message…', 'Please wait a moment.');
		const controller = new AbortController();
		let timeout;

		try {
			// Bound both headers and body reads, even if a transport ignores abort.
			// A late result cannot change the settled UI.
			const { res, body } = await Promise.race([
				(async () => {
					const res = await fetch(contactEndpoint, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(payload),
						signal: controller.signal
					});
					const body = await res.json().catch(() => null);
					return { res, body };
				})(),
				new Promise((_, reject) => {
					timeout = setTimeout(() => {
						controller.abort();
						reject(new Error('Contact delivery was not confirmed in time.'));
					}, CONTACT_TIMEOUT_MS);
				})
			]);

			if (res.ok && body?.status === 'ok') {
				deliveryPending = false;
				storageAvailable = rememberPendingContact(false);
				form.reset();
				inputs.forEach(clearFieldError);
				showFeedback('success', 'Message sent.', 'Thanks for reaching out.');
			} else if (isConfirmedContactRejection(res, body)) {
				deliveryPending = false;
				storageAvailable = rememberPendingContact(false);
				showFeedback('error', 'Your message was not sent.', res.status === 429
					? 'Please wait a minute, complete verification, and try again, or use the direct contact links.'
					: 'Your message is still here. Please check your details and verification, or use the direct contact links.');
			} else {
				showFeedback('error', 'Send status unknown.', unknownMessage);
			}
		} catch {
			showFeedback('error', 'Send status unknown.', unknownMessage);
		} finally {
			clearTimeout(timeout);
			sending = false;
			form.removeAttribute('aria-busy');
			submitButton.disabled = deliveryPending || !storageAvailable;
			if (window.turnstile?.reset && turnstileWidgetId !== null) {
				window.turnstile.reset(turnstileWidgetId);
			}
		}
	});

	// Native submission stays disabled until its prevention handler is installed.
	fields.disabled = false;
	submitButton.disabled = deliveryPending || !storageAvailable;
	document.querySelector('[data-contact-fallback]')?.setAttribute('hidden', '');
	if (deliveryPending) {
		setStatus(status, 'An earlier submission is still unconfirmed. Please contact me directly before sending another message.', 'error');
	} else if (!storageAvailable) {
		setStatus(status, 'The online form is unavailable in this browser. Please use the direct contact links.', 'error');
	}
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
