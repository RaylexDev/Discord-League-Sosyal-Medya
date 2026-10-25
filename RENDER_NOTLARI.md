# Görsel motoru notları
- Tüm görseller `render/engine.js` üzerinden tek bir Chromium ile üretilir; Inter fontu `assets/fonts` içinde gömülüdür.
- Sunucuda emoji görünsün diye: `apt install fonts-noto-color-emoji` (Linux).
- Chromium yolu özel ise: `PUPPETEER_EXECUTABLE_PATH=/yol/chrome`.
- Panellerdeki özel emoji ID'leri (utils.js -> config.emojis) örnek ID'lerdir; kendi sunucundaki emoji ID'leriyle değiştir.
- Yeni API: instagramRenderer.renderPostCard / renderStory, twitterRenderer.renderTweetCard (artık kullanılıyor).
