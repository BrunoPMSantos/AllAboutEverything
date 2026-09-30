# All About Everything

A weekly journal of useful obsessions — every subject, taken seriously.

Static site (HTML/CSS) deployed on Netlify:

- `/` — welcome page: this week's issue, features, subscription band
- `/about.html` — about page: story, manifesto, masthead, FAQ

## Local development

```sh
netlify dev --port 8889
```

No build step; `netlify.toml` publishes the repo root.