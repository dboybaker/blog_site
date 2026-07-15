# demietrich.com

Source for my personal site and technical blog, built with [Hugo](https://gohugo.io/) and self-hosted on a home server behind Caddy and Cloudflare.

**Live:** https://demietrich.com

## About

A blog where I document hands-on work in local LLM inference learning and experimenting on a dual-RTX 3090 homelab.

## Stack

- **Hugo (Extended)** — static site generator; custom theme (`themes/demitheme`), no external theme dependency
- **Caddy** — web server with automatic TLS via the Cloudflare DNS-01 challenge
- **Cloudflare** — DNS and edge caching
- **GitHub Actions** — CI/CD via a self-hosted runner (see Deployment)

## Local development

Requires Hugo Extended.

```bash
git clone https://github.com/dboybaker/blog_site.git
cd blog_site
hugo server -D
```

`hugo server -D` includes drafts and serves a live-reloading preview at http://localhost:1313.

Production build (output lands in `public/`, which is gitignored):

```bash
hugo --minify
```

## Deployment

Pushes to `main` trigger a GitHub Actions workflow that runs on a **self-hosted runner on the web server itself**. The runner builds the site with Hugo and writes the output directly to the directory Caddy serves — no rsync, no SSH from a cloud runner, no inbound ports opened. The build destination is passed to the workflow as an environment variable set on the runner, so no machine-specific paths live in the repo.

CSS and JS are fingerprinted through Hugo's asset pipeline (`resources.Get | minify | fingerprint`), so every change produces a new content-hashed filename. Cache invalidation is automatic for both the CDN and returning visitors — no manual purges, no stale styles.

## Structure

```
content/           # Markdown posts and pages
themes/demitheme/  # Custom theme: layouts, partials, shortcodes
assets/            # Pipeline-processed CSS/JS (fingerprinted at build)
static/            # Files served verbatim
hugo.toml          # Site config
.github/workflows/ # Deploy workflow
```

## Elsewhere

- Site — https://demietrich.com
- Hugging Face — https://huggingface.co/dboybaker
- LinkedIn — https://www.linkedin.com/in/demietrich/
