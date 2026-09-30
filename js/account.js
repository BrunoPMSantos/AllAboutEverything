import {
  getUser,
  getSettings,
  login,
  signup,
  logout,
  oauthLogin,
  handleAuthCallback,
  requestPasswordRecovery,
  updateUser,
  acceptInvite,
  onAuthChange,
  AuthError,
  MissingIdentityError,
} from 'https://esm.sh/@netlify/identity@2.0.0?bundle'

const $ = (sel) => document.querySelector(sel)
const views = document.querySelectorAll('[data-view]')
const tabs = document.querySelectorAll('[data-show]')
const notice = $('#auth-notice')

let inviteToken = null
let hasProviders = false
let current = 'loading'

function show(name) {
  current = name
  views.forEach((v) => { v.hidden = v.dataset.view !== name })
  tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.show === name)))
  $('#auth-tabs').hidden = !['login', 'signup'].includes(name)
  $('#oauth').hidden = !(hasProviders && ['login', 'signup'].includes(name))
}

function say(message, tone = 'info') {
  notice.textContent = message
  notice.dataset.tone = tone
  notice.hidden = !message
}

function describe(error, context) {
  if (error instanceof MissingIdentityError) {
    return 'Accounts are not available here yet — Netlify Identity is not enabled for this site.'
  }
  if (error instanceof AuthError) {
    if (error.status === 401) return context === 'login' ? 'That email and password do not match.' : error.message
    if (error.status === 403) return 'New accounts are by invitation only. Write to the desk for an invite.'
    if (error.status === 422) return 'Check your email address, and use a password of at least 8 characters.'
    return error.message
  }
  return 'Something went wrong. Please try again.'
}

function renderProfile(user) {
  const name = user.name || user.userMetadata?.full_name || ''
  $('#profile-greeting').textContent = name ? `Welcome back, ${name}.` : 'Welcome back.'
  $('#profile-email').textContent = user.email ?? '—'
  $('#profile-since').textContent = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : '—'
  $('#profile-name').value = name
  show('profile')
}

// Wrap a form submit: disables the button while working, reports errors.
function handle(form, context, fn) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const button = form.querySelector('button[type="submit"]')
    button.disabled = true
    say('')
    try {
      await fn(new FormData(form))
    } catch (error) {
      say(describe(error, context), 'error')
    } finally {
      button.disabled = false
    }
  })
}

tabs.forEach((t) => t.addEventListener('click', () => { say(''); show(t.dataset.show) }))
document.querySelectorAll('[data-goto]').forEach((a) =>
  a.addEventListener('click', (e) => { e.preventDefault(); say(''); show(a.dataset.goto) }),
)

handle($('#login-form'), 'login', async (data) => {
  const user = await login(data.get('email'), data.get('password'))
  renderProfile(user)
})

handle($('#signup-form'), 'signup', async (data) => {
  const user = await signup(data.get('email'), data.get('password'), { full_name: data.get('name') })
  if (user.confirmedAt) {
    renderProfile(user)
    say('Your account is ready.', 'success')
  } else {
    show('login')
    say('Almost there — check your inbox for a confirmation link.', 'success')
  }
})

handle($('#forgot-form'), 'forgot', async (data) => {
  await requestPasswordRecovery(data.get('email'))
  show('login')
  say('If that address has an account, a reset link is on its way.', 'success')
})

handle($('#reset-form'), 'reset', async (data) => {
  const user = await updateUser({ password: data.get('password') })
  renderProfile(user)
  say('Your password has been updated.', 'success')
})

handle($('#invite-form'), 'invite', async (data) => {
  const user = await acceptInvite(inviteToken, data.get('password'))
  inviteToken = null
  renderProfile(user)
  say('Invitation accepted. Welcome to the desk.', 'success')
})

handle($('#profile-form'), 'profile', async (data) => {
  const user = await updateUser({ data: { full_name: data.get('name') } })
  renderProfile(user)
  say('Profile saved.', 'success')
})

$('#logout-button').addEventListener('click', async () => {
  try { await logout() } catch (error) { say(describe(error), 'error'); return }
  show('login')
  say('You are signed out.', 'info')
})

document.querySelectorAll('[data-provider]').forEach((b) =>
  b.addEventListener('click', () => {
    try { oauthLogin(b.dataset.provider) } catch (error) { say(describe(error), 'error') }
  }),
)

onAuthChange((event) => {
  // Keep other tabs in step with sign-in / sign-out.
  if (event === 'logout' && current === 'profile') show('login')
})

async function init() {
  try {
    const result = await handleAuthCallback()
    if (result) {
      history.replaceState(null, '', location.pathname)
      switch (result.type) {
        case 'recovery':
          show('reset')
          say('Choose a new password to finish resetting your account.', 'info')
          return
        case 'invite':
          inviteToken = result.token
          show('invite')
          return
        case 'confirmation':
          renderProfile(result.user)
          say('Email confirmed. You are signed in.', 'success')
          return
        case 'email_change':
          renderProfile(result.user)
          say('Your email address has been updated.', 'success')
          return
        case 'oauth':
          renderProfile(result.user)
          return
      }
    }
  } catch (error) {
    history.replaceState(null, '', location.pathname)
    say(describe(error), 'error')
  }

  const user = await getUser()
  if (user) renderProfile(user)
  else show(location.hash === '#signup' ? 'signup' : 'login')

  try {
    const settings = await getSettings()
    if (settings.disableSignup) {
      $('[data-show="signup"]').hidden = true
      if (current === 'signup') current = 'login'
    }
    const enabled = Object.entries(settings.providers).filter(([, on]) => on).map(([p]) => p)
    document.querySelectorAll('[data-provider]').forEach((b) => { b.hidden = !enabled.includes(b.dataset.provider) })
    hasProviders = enabled.length > 0
    show(current)
  } catch (error) {
    if (error instanceof MissingIdentityError) say(describe(error), 'error')
  }
}

init()
