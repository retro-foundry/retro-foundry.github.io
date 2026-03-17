# Retro Foundry blog

Jekyll blog for [retro-foundry.github.io](https://retro-foundry.github.io).

## Run locally

```bash
bundle install
bundle exec jekyll serve
```

Then open [http://localhost:4000](http://localhost:4000). Use `bundle exec jekyll serve --baseurl=""` if you need to match production URLs exactly.

## Deploy

Push to the `main` branch. GitHub Pages will build and publish the site automatically.

## Structure

- `_config.yml` – site settings
- `_layouts/` – default and post layouts
- `_posts/` – blog posts (name: `YYYY-MM-DD-title.md`)
- `assets/css/` – styles
- `index.md` – blog listing
- `about.md` – about page
