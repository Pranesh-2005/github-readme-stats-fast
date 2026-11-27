# Contributing

Thanks for helping out! Bug fixes, new card options, tests and translations are all welcome.

New here? Start with an issue labelled
[`good first issue`](https://github.com/Pranesh-2005/github-readme-stats-fast/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22).
Comment on it to say you are taking it, so two people don't work on the same thing.
You don't need to wait to be assigned.

## Local setup

Requires Node.js 20+.

```bash
git clone https://github.com/<your-username>/github-readme-stats-fast
cd github-readme-stats-fast
npm install
```

Create a `.env` file with a GitHub
[personal access token](https://github.com/settings/tokens) (no scopes needed for public data):

```bash
PAT_1=ghp_your_token
```

Run the local server and open a card in your browser:

```bash
node express.js
# http://localhost:9000/?username=<you>
# http://localhost:9000/streak?username=<you>
# http://localhost:9000/top-langs?username=<you>
```

## Before you open a pull request

```bash
npm test          # all tests must pass
npm run lint      # no warnings
npm run format    # prettier
```

- Keep the PR to one change and link the issue it fixes (`Fixes #123`).
- Add or update a test for any change in behaviour. If a card's SVG changes on purpose,
  update the snapshot with `npm test -- -u` and mention it in the PR.
- New query parameters should be documented in `Readme.md` next to the card they belong to.
- Card layout changes: paste a screenshot of the card before and after.

## Project layout

| Path            | What lives there                                                                 |
| --------------- | -------------------------------------------------------------------------------- |
| `api/`          | One serverless handler per card (`index.js` = stats, `streak.js`, `pin.js`, ...) |
| `src/fetchers/` | GitHub API calls and data processing                                             |
| `src/cards/`    | SVG rendering                                                                    |
| `src/common/`   | Shared helpers: colours, i18n, caching, retries                                  |
| `themes/`       | Theme colour definitions                                                         |
| `tests/`        | Jest tests, one file per card / fetcher                                          |

## Translations contribution

Card labels are translated in `src/translations.js`. To add a language, add your locale code
to each label you can translate, then check it with `?locale=<code>`. Partial translations are
fine: untranslated labels fall back to English.

## Themes contribution

Add a theme to `themes/index.js` with `title_color`, `icon_color`, `text_color`, `bg_color`
and `border_color`, and add a preview row for it to `themes/README.md`.
