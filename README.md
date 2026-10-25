<div align="center">

# ⚽ Golazo Social

**Discord sunucunuzda futbol temalı sosyal medya simülasyonu.**

Instagram, X (Twitter) ve TikTok esintili hesaplar, gönderiler ve etkileşimler tek bir Discord botunda.

[Kurulum](#-kurulum) · [Komutlar](#-komutlar) · [Yapılandırma](#-yapılandırma) · [Güvenlik](#-güvenlik-ve-veriler)

![Node.js](https://img.shields.io/badge/Node.js-20.6%2B-339933?logo=node.js&logoColor=white)
![discord.js](https://img.shields.io/badge/discord.js-v14-5865F2?logo=discord&logoColor=white)
![Lisans](https://img.shields.io/badge/Lisans-belirtilmedi-lightgrey)

</div>

---

## ✨ Özellikler

- 📸 Discord içinde Instagram tarzı profiller ve gönderiler
- 🗨️ X (Twitter) tarzı tweet ve etkileşim simülasyonu
- 🎵 TikTok tarzı video akışı ve etkileşim simülasyonu
- 🖼️ Profil, gönderi ve akışlar için görsel kartlar
- 🪙 Beğeni ve etkinliklerle çalışan oyun içi ekonomi
- 🤖 İsteğe bağlı NPC hesapları ve kanal etkinlikleri
- 🎨 Sunucuya özel emoji kurulumu (`.emojikur`)

> Bu proje sosyal ağları **oyun/simülasyon amacıyla** Discord içinde canlandırır; Instagram, X veya TikTok'a bağlanmaz.

## 🧰 Gereksinimler

- [Node.js 20.6 veya üzeri](https://nodejs.org/)
- Discord bot uygulaması ve bot tokenı
- Windows, macOS veya Linux

Görsel üretiminde Puppeteer kullanılır. Chromium bulunamazsa Puppeteer kendi Chromium sürümünü indirip kullanır. Linux sunucularda Chromium sistem bağımlılıkları gerekebilir.

## 🚀 Kurulum

### 1. Projeyi indirin

```bash
git clone <REPOSITORY_URL>
cd golazo-social
```

`<REPOSITORY_URL>` kısmını kendi GitHub depo adresinizle değiştirin.

### 2. Bağımlılıkları yükleyin

```bash
npm install
```

### 3. Ortam dosyasını oluşturun

Projede `.env.example` dosyasını `.env` adıyla kopyalayın:

**Windows PowerShell**

```powershell
Copy-Item .env.example .env
```

**macOS / Linux**

```bash
cp .env.example .env
```

`.env` dosyasını açıp Discord bot tokenınızı girin:

```dotenv
DISCORD_TOKEN=buraya_yeni_bot_tokeninizi_yazin
NPC_CHANNEL_ID=
```

`NPC_CHANNEL_ID` isteğe bağlıdır; NPC etkinliklerinin gönderileceği kanalın ID'sidir. Kullanmayacaksanız boş bırakın.

### 4. Discord botunu hazırlayın

1. [Discord Developer Portal](https://discord.com/developers/applications) üzerinden bir uygulama ve bot oluşturun.
2. **Bot** sekmesinde **Message Content Intent** ve **Server Members Intent** seçeneklerini açın.
3. OAuth2 URL Generator'da `bot` kapsamını seçin. Botun temel kullanımı için **View Channels**, **Send Messages**, **Embed Links** ve **Attach Files** izinlerini verin.
4. Emoji yükleme komutu kullanılacaksa ayrıca sunucuda emoji/sticker yönetme izni verin.
5. Botu sunucunuza ekleyin.

Tokenınızı yalnızca `.env` dosyasına yazın; kaynak koda, ekran görüntüsüne veya herkese açık mesajlara eklemeyin.

### 5. Botu başlatın

```bash
npm start
```

Bot komut öneki varsayılan olarak `.` şeklindedir. Botu durdurmak için `Ctrl+C` kullanın.

## 💬 Komutlar

| Komut | Açıklama |
| --- | --- |
| `.insta` | Instagram simülasyonundaki hesap ve içerik işlemleri |
| `.tw` | X/Twitter simülasyonundaki hesap ve gönderi işlemleri |
| `.tt` | TikTok simülasyonundaki hesap ve video işlemleri |
| `.emojikur` | Botun emoji görsellerini sunucuya yükler ve eşleştirir |

Platform komutlarının alt komutları için Discord'da komutu tek başına gönderin; bot kullanım yönergelerini gösterir. Örnek: `.insta`, `.tw` veya `.tt`.

## ⚙️ Yapılandırma

| Değişken | Gerekli | Açıklama |
| --- | :---: | --- |
| `DISCORD_TOKEN` | ✅ | Discord Developer Portal'dan alınan bot tokenı |
| `NPC_CHANNEL_ID` | ❌ | NPC etkinliklerinin gönderileceği metin kanalı ID'si |

Görsel motoru için farklı bir Chromium yolu gerekiyorsa `PUPPETEER_EXECUTABLE_PATH` ortam değişkenini tanımlayabilirsiniz. Linux'ta emoji yazı tipi gerekirse sisteminize Noto Color Emoji yükleyin.

## 🧪 Test

```bash
npm test
```

Testler `data/` içindeki simülasyon verilerini yenileyebilir. Testten sonra botu çalıştırdığınızda hesaplar yeniden oluşturulabilir.

## 🔐 Güvenlik ve veriler

- `.env` ve `data/*.json` Git tarafından yok sayılır. Gerçek tokenları ve sunucu/kullanıcı verilerini depoya göndermeyin.
- `data/` dosyaları ilk çalıştırmada otomatik oluşturulur; yerel hesaplar, gönderiler ve emoji eşleştirmeleri burada saklanır.
- Bu depoya başlangıçta özel kullanıcı, sunucu veya simülasyon verisi eklenmez.
- Bir token daha önce paylaşıldıysa `.env`'den silmek yeterli değildir: Developer Portal'dan **yenileyin (Reset Token)** ve yeni tokenı kullanın. Eski tokenı iptal edilmiş kabul edin.

## 🛠️ Sorun giderme

**`DISCORD_TOKEN` tanımlı değil:** `.env.example` dosyasını `.env` olarak kopyaladığınızı ve `DISCORD_TOKEN` satırını doldurduğunuzu kontrol edin.

**Bot mesaj komutlarını algılamıyor:** Developer Portal'da Message Content Intent'in açık olduğunu ve botun kanalı görüntüleyip mesajları okuyabildiğini doğrulayın.

**Görseller oluşturulamıyor:** `npm install` komutunu yeniden çalıştırın. Linux sunucuda Chromium bağımlılıklarını ve gerekirse `PUPPETEER_EXECUTABLE_PATH` ayarını kontrol edin.

---

<div align="center">

Golazo Social · Discord içinde futbol ve sosyal medya simülasyonu

</div>
