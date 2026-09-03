# Artwork source files

Original, higher-resolution artwork. **Not shipped** — `public/` is what deploys,
and `test/library.test.js` fails on any file in `public/images/` that no exercise
references, which is what keeps the deploy from carrying dead weight.

The shipped format is `.webp`, and that is enforced rather than conventional: the
Cadence plan payload sends `image_ref` as a bare filename and Cadence resolves it
against its own assets, so an extension it cannot render is a broken image on an
employee's phone.

To add artwork: drop the original here, then encode into `public/images/` and add
the id to `DEFAULT_IMAGES` in `index.html`.

```
python -c "from PIL import Image; im=Image.open('artwork-source/NAME.png'); \
im.convert('RGB').save('public/images/NAME.webp','WEBP',quality=82,method=6)"
```

`npm test` will tell you what you missed.
