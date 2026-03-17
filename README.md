# Retro Foundry

Plain HTML site for [retro-foundry.github.io](https://retro-foundry.github.io).

## Setup

1. **Banner**: Put your Retro FOUNDRY banner image at `assets/images/banner.png`. The page references this file at the top.
2. **Projects**: Edit `index.html` and duplicate a `.project-card` block for each project. For each project set:
   - `href` and thumbnail `src` (link and image URL)
   - `.project-title a` text and `href`
   - `.project-text` description
3. Replace `assets/images/thumb-placeholder.svg` with real thumbnails, or use your own image paths in the `src` attributes.

## Deploy

Push to the `main` branch. On GitHub, set the repo to use **GitHub Pages** with source “Deploy from a branch” and branch `main` (root or `/docs`). The site is static HTML, no build step.

## Structure

- `index.html` – single page with banner, nav, project grid, footer
- `assets/css/style.css` – styles (dark theme, Patreon button, project cards)
- `assets/images/banner.png` – your banner (add this file)
- `assets/images/` – project thumbnails
