# Reflux Diary

A personal, phone-first web app for logging food (by barcode, label photo or typing), drinks with volume, and reflux symptom check-ins, then spotting which ingredients, products, drinks and habits line up with worse symptoms.

All data stays in your phone's browser. Nothing is sent anywhere except barcode numbers, which go to Open Food Facts for lookup.

## Put it on GitHub Pages

1. Create a new repository on GitHub (e.g. `reflux-diary`). It can be public or private, but Pages on private repos needs a paid plan.
2. Upload all the files from this folder to the repository root. Use **Add file → Upload files** on github.com.
3. Go to **Settings → Pages**, set **Source: Deploy from a branch**, then choose branch `main` and folder `/ (root)`. Save.
4. After a minute it's live at `https://<your-username>.github.io/reflux-diary/`.
5. Open that link in Chrome on your Android phone. Tap **⋮ → Add to Home screen / Install app**.

The camera only works over HTTPS, which GitHub Pages provides.

## How to use it

- **+ Food**: scan a barcode, photograph the ingredients panel, pick from your library, or type it in. For home-cooked or batch-prepped dishes, add them once with brand "Homemade" and reuse them from the library.
- **+ Drink**: choose the type, confirm caffeine/alcohol/fizzy, and set the volume.
- **Check-in** (a badge appears once items are waiting): rate None / Mild / Moderate / Severe. Then tick any behaviours that happened, such as rushing, a large portion or lying down. One check-in covers everything logged since the last one, and you can untick anything that doesn't apply.
- **Insights**: each row shows how much worse (+) or better (−) your symptoms averaged when that item was present vs absent. Treat anything under ~3 occurrences, or anything before ~20–30 check-ins, as a hint only.
- **Compare**: pick two products to see which ingredients are unique to each.
- **Merge** duplicate ingredient names by tapping them in Insights.
- **Data**: export a JSON backup regularly. You can also export check-ins as CSV.

## Updating the app

If you change any file, also bump `CACHE` in `sw.js` (e.g. `reflux-diary-v2`) so phones pick up the new version.
