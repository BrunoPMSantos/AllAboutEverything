// Shared on every page: keeps the nav "Sign in / Account" link in sync with the
// Identity session, and forwards auth callback links (email confirmation,
// password recovery, invites, OAuth) to the account page, which processes them.
import { getUser, onAuthChange } from 'https://esm.sh/@netlify/identity@2.0.0?bundle'

const CALLBACK_HASH = /(confirmation_token|recovery_token|invite_token|email_change_token|access_token|error)=/

if (CALLBACK_HASH.test(location.hash) && location.pathname !== '/account.html') {
  location.replace('/account.html' + location.hash)
}

const link = document.querySelector('[data-auth-link]')

function render(user) {
  if (!link) return
  link.textContent = user ? 'Account' : 'Sign in'
  link.title = user ? `Signed in as ${user.email ?? ''}` : ''
}

render(await getUser())
onAuthChange((_event, user) => render(user))
