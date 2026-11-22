# Retro Foundry Arcade

The [Retro Foundry Arcade](https://retro-foundry.github.io/rf/) runs on GitHub Pages without a build step. Browse by genre, search the catalog, or keep favourites and recently launched games in My Library. Library entries are stored in the current browser.

## Preview

Serve the repository root over HTTP, for example with `python -m http.server 8080`, and open `http://localhost:8080/rf/`. The site root forwards to the arcade. The rights-holder page is at `/rf/rights-holders.html`.

## Catalog

- Edit [assets/js/catalog.mjs](assets/js/catalog.mjs) to update game information and featured titles.
- Store storefront screenshots in [assets/images/arcade](assets/images/arcade). The current artwork comes from the repository’s screenshots, gameplay video and linked Retro Foundry demos.
- The Perfect Dark image shows the optional HD textures. [Retro Foundry’s Perfect Dark screenshot preview](https://www.patreon.com/retrofoundry/posts/perfect-dark-hd-168236192)
- Use the `requirement` field to show file requirements. The `disk` icon marks an ADF requirement and the `chip` icon marks a ROM requirement.
- Play links load each game’s existing URL as a full browser page in the current tab. Use the browser’s Back button to return to the arcade.

## Deploy

GitHub Pages serves the root of `main`. Push changes to `main` to publish.
