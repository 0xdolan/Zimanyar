# Marketing images

Rendered by `make marketing` (`scripts/marketing/render.sh`, headless Chrome with a throwaway profile) from the HTML templates in `scripts/marketing/`. Never edit the PNGs by hand.

Every Kurdish example and finding in these images is real: the rules come from the rule catalogue, the IPA is computed by zimankit, and the lessons exist in the tutorials. The content lives in `scripts/marketing/data.js`.

> **Design preview.** Until the apps exist, the interface in these images is a design mock-up rendered from HTML, and the store screenshots carry a "Design preview" label. Once the apps are built, the store screenshots are replaced by real Playwright screenshots of the built apps (`assets/screenshots/`); the banner, tiles and ads keep this template system.

| file | size | where it is used |
|---|---|---|
| `banner.png` | 1280 × 640 | README hero, website Open Graph image |
| `social-preview.png` | 1280 × 640 | GitHub repository social preview (upload in the repository settings) |
| `store/chrome-small-tile.png` | 440 × 280 | Chrome Web Store small promo tile |
| `store/chrome-marquee.png` | 1400 × 560 | Chrome Web Store marquee promo tile |
| `store/screenshot-1-check-sorani.png` | 1280 × 800 | store screenshot: underlines while typing (Sorani) |
| `store/screenshot-2-explain-kurmanji.png` | 1280 × 800 | store screenshot: explanations, fixes, examples, lessons (Kurmanji) |
| `store/screenshot-3-learn.png` | 1280 × 800 | store screenshot: lesson reader |
| `store/screenshot-4-everywhere.png` | 1280 × 800 | store screenshot: popup, Linux desktop, command line |
| `ads/ad-square-{en,ckb,kmr}.png` | 1080 × 1080 | social posts (Instagram, Facebook, Mastodon) in English, Sorani, Kurmanji |
| `ads/ad-landscape-en.png` | 1200 × 675 | X / Twitter, LinkedIn, blog posts |
| `ads/ad-story-{en,ckb,kmr}.png` | 1080 × 1920 | stories and reels covers |

The Chrome Web Store screenshots (1280 × 800) also satisfy Firefox Add-ons and Flathub/AppStream requirements.

To re-render one image: `scripts/marketing/render.sh ad-square` (any part of the output name).
