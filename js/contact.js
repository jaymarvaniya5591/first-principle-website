(function () {
  'use strict';
  var form = document.querySelector('.contact__form');
  if (!form) return;
  var status = form.querySelector('.contact__status');
  var button = form.querySelector('[type="submit"]');
  var textarea = form.elements.message;
  var first = form.elements.firstName;
  var last = form.elements.lastName;
  var widget = form.querySelector('.contact__challenge');
  var widgetId = null;
  var token = '';
  var initialising = null;
  var sending = false;
  var pending = null;

  function say(message) {
    status.textContent = message;
    status.classList.toggle('is-visible', Boolean(message));
  }
  function error(input, message) {
    var field = input.closest('.field');
    field.classList.toggle('is-invalid', Boolean(message));
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    field.querySelector('.field__error').textContent = message;
  }
  function namesValid() {
    var valid = Boolean(first.value.trim() || last.value.trim());
    first.setCustomValidity(valid ? '' : 'Please enter a first name or a last name.');
    last.setCustomValidity('');
    error(first, valid ? '' : 'Please enter a first name or a last name.');
    error(last, '');
    return valid;
  }
  [first, last].forEach(function (input) {
    input.addEventListener('input', function () {
      if (first.getAttribute('aria-invalid') === 'true') namesValid();
    });
  });
  [form.elements.email, form.elements.phone].forEach(function (input) {
    input.addEventListener('input', function () { error(input, ''); });
  });
  textarea.addEventListener('input', function () {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  });

  function loadTurnstile() {
    if (window.turnstile) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      var timer = setTimeout(function () { script.remove(); reject(new Error('Security check took too long. Please try again.')); }, 12000);
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onload = function () { clearTimeout(timer); resolve(); };
      script.onerror = function () { clearTimeout(timer); script.remove(); reject(new Error('Please allow the security check to load, then try again.')); };
      document.head.appendChild(script);
    });
  }
  function prepare() {
    if (widgetId !== null) return Promise.resolve();
    if (initialising) return initialising;
    initialising = (async function () {
      var response = await fetch('/api/contact', { signal: AbortSignal.timeout(12000) });
      var config = await response.json();
      if (!response.ok || !config.siteKey) throw new Error(config.error || 'The form is temporarily unavailable. Please email founder@getfirstprinciple.com.');
      await loadTurnstile();
      widget.hidden = false;
      widgetId = window.turnstile.render(widget, {
        sitekey: config.siteKey,
        action: 'contact',
        theme: 'light',
        size: 'flexible',
        callback: function (value) {
          token = value;
          if (!sending && /security check/i.test(status.textContent)) say('');
        },
        'expired-callback': function () { token = ''; },
        'error-callback': function () { token = ''; say('The security check could not load. Please try again, or email founder@getfirstprinciple.com.'); }
      });
    })().finally(function () { initialising = null; });
    return initialising;
  }
  // Load only when someone interacts with the form, keeping the landing page light.
  form.addEventListener('focusin', function () {
    prepare().catch(function (e) {
      say(e instanceof TypeError || e instanceof SyntaxError || e.name === 'TimeoutError'
        ? 'The form could not connect. Please try again, or email founder@getfirstprinciple.com.' : e.message);
    });
  });

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (sending) return;
    var firstInvalid = namesValid() ? null : first;
    [first, last, form.elements.email, form.elements.phone, textarea].forEach(function (input) {
      var message = '';
      if (input.name === 'phone') {
        var phone = input.value.trim();
        if (!/^[+\d\s().-]+$/.test(phone) || phone.replace(/\D/g, '').length < 7 || phone.replace(/\D/g, '').length > 15) message = 'Please enter a valid phone number.';
      } else if (input.name === 'email' && !/^[^\s@<>(),;:"\\\[\]]+@[^\s@<>(),;:"\\\[\]]+\.[^\s@<>(),;:"\\\[\]]+$/.test(input.value.trim())) {
        message = 'Please enter a valid email address.';
      } else if (input.maxLength > 0 && input.value.trim().length > input.maxLength) {
        message = 'Please shorten this entry.';
      }
      if (message) { error(input, message); if (!firstInvalid) firstInvalid = input; }
    });
    if (firstInvalid) { firstInvalid.focus(); return; }
    sending = true;
    button.disabled = true;
    button.textContent = 'Sending…';
    form.setAttribute('aria-busy', 'true');
    try {
      await prepare();
      if (!token) { say('Please complete the quick security check, then select Submit.'); return; }
      var lead = {};
      ['firstName', 'lastName', 'email', 'phone', 'message', 'company'].forEach(function (key) { lead[key] = form.elements[key].value.trim(); });
      var fingerprint = JSON.stringify(lead);
      // Retain the same ID for retries after a timeout; a changed enquiry gets a new ID.
      if (!pending || pending.fingerprint !== fingerprint) pending = { fingerprint: fingerprint, id: crypto.randomUUID() };
      var response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({}, lead, { submissionId: pending.id, turnstileToken: token })),
        signal: AbortSignal.timeout(35000)
      });
      var result = await response.json();
      if (!response.ok || result.ok !== true) throw new Error(result.error || 'We could not confirm your submission. Please try again, or email founder@getfirstprinciple.com.');
      var name = lead.firstName || lead.lastName;
      form.reset();
      textarea.style.height = '';
      pending = null;
      say('Thanks, ' + name + ' — your enquiry is with us. A real human will be in touch soon.');
    } catch (e) {
      say(e.name === 'TimeoutError' || e.name === 'AbortError' || e instanceof TypeError || e instanceof SyntaxError
        ? 'We could not confirm your submission. Your details are still here — please try again, or email founder@getfirstprinciple.com.'
        : e.message);
    } finally {
      token = '';
      if (widgetId !== null && window.turnstile) window.turnstile.reset(widgetId);
      sending = false;
      button.disabled = false;
      button.textContent = 'Submit';
      form.removeAttribute('aria-busy');
    }
  });
})();
