const REPO = 'Ferchke7/wachcha';
const FALLBACK_VERSION = '0.0.1';

const I18N = {
  en: {
    navDownloads: 'Downloads',
    navFeatures: 'Features',
    navBuild: 'Build',
    navWebApp: 'Web App',
    heroBadge: 'MIT Open-Source · Tauri v2 + Rust + Preact',
    heroTitle: 'One open cinema hub for Movies, Turkish Dizis, Russian TV & Anime.',
    heroSubtitle:
      'Zero public servers. Native libmpv + GLSL shaders & lazy Shaka Player. Unified multi-vertical search with canonical deduplication, Stremio Addon v3, and M3U8 Live TV.',
    launchWebApp: 'Launch Live Web App',
    allReleases: 'All Releases',
    downloadsTitle: 'Download Wachcha',
    downloadsSubtitle:
      'Prebuilt binaries compiled automatically via GitHub Actions with SHA-256 checksums.',
    winDesc:
      'Native desktop window with optional libmpv-2.dll GLSL upscaling and automatic Shaka Player fallback.',
    androidDesc:
      'Signed release APK with Leanback TV launcher metadata, 10-foot D-pad focus rings, and mobile bottom sheets.',
    macDesc:
      'Native overlay titlebar and WebKit-compatible IndexedDB SWR cache. Clear quarantine with xattr -cr /Applications/Wachcha.app if prompted.',
    linuxDesc:
      'Portable AppImage plus native .deb and .rpm packages declaring optional libmpv2 acceleration.',
    featuresTitle: 'Built for Speed, Privacy & Extensibility',
    featuresSubtitle:
      'Clean-room open-source media engine with strict in-process transport security.',
    feat1Title: 'Unified Search & Deduplication',
    feat1Desc:
      'Aggregate AniLiberty, Shikimori, Yummy Public, TMDB (RU/TR/EN), TVMaze, Rutube, and Official Turkish Broadcasters — merged by canonical IMDb, TMDB, MAL & Shikimori IDs.',
    feat2Title: 'In-Process wachcha-media://',
    feat2Desc:
      'No bundled Node.js or public HTTP server. Authenticated HLS/DASH segments flow via opaque hex sessions with strict HTTPS allowlists and disabled redirects.',
    feat3Title: 'libmpv + GLSL & Shaka Player',
    feat3Desc:
      'Native libmpv decoding with Anime4K/FSR/FSRCNNX upscalers over a random-key loopback relay, plus lazy-loaded Shaka Player with skip markers & auto-next.',
    feat4Title: 'Stremio v3 & M3U8 Playlists',
    feat4Desc:
      'Plug in any community Stremio Addon manifest.json or free M3U8 Live TV list without modifying core code. Full English, Russian, and Turkish UI built in.',
    buildTitle: 'Build from Source',
    buildSubtitle:
      'Reproduce any desktop installer, Android/TV APK, or web bundle locally with Node 22 and Rust.',
    downloadFor: 'Download for',
    copy: 'Copy',
    copied: 'Copied!',
  },
  ru: {
    navDownloads: 'Скачать',
    navFeatures: 'Возможности',
    navBuild: 'Сборка',
    navWebApp: 'Веб-приложение',
    heroBadge: 'MIT Open-Source · Tauri v2 + Rust + Preact',
    heroTitle: 'Единый открытый медиацентр: Фильмы, Сериалы, Турецкие сериалы и Аниме.',
    heroSubtitle:
      'Никаких открытых серверов. Нативный libmpv с GLSL-шейдерами и ленивый Shaka Player. Единый поиск с дедупликацией по ID, Stremio Addons v3 и M3U8 ТВ.',
    launchWebApp: 'Открыть Веб-версию',
    allReleases: 'Все релизы',
    downloadsTitle: 'Скачать Wachcha',
    downloadsSubtitle:
      'Готовые сборки собираются автоматически в GitHub Actions с контрольными суммами SHA-256.',
    winDesc:
      'Нативное окно Windows с поддержкой libmpv-2.dll (GLSL апскейл) и автоматическим переходом на Shaka Player.',
    androidDesc:
      'Подписанный релизный APK с поддержкой Android TV Leanback, пульта D-pad и мобильного интерфейса.',
    macDesc:
      'Нативный overlay titlebar и кэш IndexedDB. Если macOS покажет Gatekeeper, выполните xattr -cr /Applications/Wachcha.app.',
    linuxDesc:
      'Портативный AppImage, а также пакеты .deb и .rpm с опциональным ускорением через libmpv2.',
    featuresTitle: 'Скорость, безопасность и расширяемость',
    featuresSubtitle: 'Открытый медиадвижок с защищённым внутрипроцессным транспортом потоков.',
    feat1Title: 'Единый поиск и дедупликация',
    feat1Desc:
      'AniLiberty, Shikimori, Yummy Public, TMDB (RU/TR/EN), TVMaze, Rutube и турецкие телеканалы объединяются по IMDb, TMDB, MAL и Shikimori ID.',
    feat2Title: 'Протокол wachcha-media://',
    feat2Desc:
      'Без встроенного Node.js и публичных портов. Потоки идут через одноразовые hex-сессии с белым списком HTTPS-доменов и запретом редиректов.',
    feat3Title: 'libmpv + GLSL и Shaka Player',
    feat3Desc:
      'Нативный libmpv с шейдерами Anime4K/FSR/FSRCNNX через локальный relay, плюс ленивый Shaka Player с пропуском опенингов.',
    feat4Title: 'Stremio v3 и M3U8 плейлисты',
    feat4Desc:
      'Подключайте любые аддоны Stremio (manifest.json) и открытые M3U8-плейлисты прямо в настройках. Полная локализация EN / RU / TR.',
    buildTitle: 'Сборка из исходного кода',
    buildSubtitle:
      'Соберите установщик Windows, APK для Android/TV, macOS DMG или веб-сборку локально.',
    downloadFor: 'Скачать для',
    copy: 'Копировать',
    copied: 'Скопировано!',
  },
  tr: {
    navDownloads: 'İndir',
    navFeatures: 'Özellikler',
    navBuild: 'Derleme',
    navWebApp: 'Web Uygulaması',
    heroBadge: 'MIT Açık Kaynak · Tauri v2 + Rust + Preact',
    heroTitle: 'Türk Dizileri, Filmler, Rus TV ve Anime için tek açık medya merkezi.',
    heroSubtitle:
      'Açık sunucu yok. Yerel libmpv + GLSL gölgelendiriciler ve Shaka Player. Birleşik arama, Stremio Addon v3 ve M3U8 Canlı TV desteği.',
    launchWebApp: 'Web Uygulamasını Aç',
    allReleases: 'Tüm Sürümler',
    downloadsTitle: "Wachcha'yı İndir",
    downloadsSubtitle:
      'GitHub Actions ile otomatik derlenen kurulum dosyaları ve SHA-256 doğrulama özetleri.',
    winDesc:
      'İsteğe bağlı libmpv-2.dll GLSL yükseltme ve otomatik Shaka Player destekli yerel Windows uygulaması.',
    androidDesc:
      'Leanback TV başlatıcı, 10-foot D-pad kumanda odağı ve mobil arayüzlü imzalı APK paketi.',
    macDesc:
      'Apple Silicon yerel macOS uygulaması. Gatekeeper uyarısı için xattr -cr /Applications/Wachcha.app çalıştırabilirsiniz.',
    linuxDesc:
      'Taşınabilir AppImage ile opsiyonel libmpv2 hızlandırmalı yerel .deb ve .rpm paketleri.',
    featuresTitle: 'Hız, Gizlilik ve Genişletilebilirlik',
    featuresSubtitle: 'Katı süreç içi medya aktarımıyla tamamen açık kaynak medya motoru.',
    feat1Title: 'Birleşik Arama ve Tekilleştirme',
    feat1Desc:
      'Resmi Türk kanalları, TVMaze, TMDB (TR/EN/RU), Rutube, AniLiberty, Shikimori ve Yummy Public tek aramada birleşir.',
    feat2Title: 'Süreç İçi wachcha-media://',
    feat2Desc:
      'Yerleşik Node.js veya açık HTTP portu yok. Akışlar sıkı HTTPS izin listesi ve yönlendirmesiz oturumlarla aktarılır.',
    feat3Title: 'libmpv + GLSL ve Shaka Player',
    feat3Desc:
      'Anime4K/FSR/FSRCNNX destekli yerel libmpv ve atlama işaretçili Shaka Player hibrit oynatıcısı.',
    feat4Title: 'Stremio v3 ve M3U8 Listeleri',
    feat4Desc:
      'Topluluk Stremio eklentilerini (manifest.json) veya ücretsiz M3U8 canlı yayın listelerini anında ekleyin.',
    buildTitle: 'Kaynak Koddan Derle',
    buildSubtitle:
      'Node 22 ve Rust ile Windows .exe, Android/TV .apk, macOS .dmg veya Linux paketlerini derleyin.',
    downloadFor: 'İndir:',
    copy: 'Kopyala',
    copied: 'Kopyalandı!',
  },
};

const BUILD_COMMANDS = {
  windows: `git clone https://github.com/${REPO}.git
cd wachcha
npm install

# Build Windows NSIS (.exe) & WiX (.msi) installers
npx tauri build --config src-tauri/tauri.windows.conf.json`,
  android: `git clone https://github.com/${REPO}.git
cd wachcha
npm install

# Add Rust Android targets (requires JDK 17 + Android SDK/NDK)
rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android

# Initialize Tauri Android project, sync icons & Android TV Leanback manifest
npx tauri android init --ci
npx tauri icon src-tauri/icons/app-icon.png
node scripts/patch-android-tv.mjs

# Build ARM64 and Universal APKs
npx tauri android build --apk --target aarch64
npx tauri android build --apk`,
  macos: `git clone https://github.com/${REPO}.git
cd wachcha
npm install

# Build macOS .dmg and .app bundle
npx tauri build --config src-tauri/tauri.macos.conf.json`,
  linux: `sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libmpv-dev rpm

git clone https://github.com/${REPO}.git
cd wachcha
npm install

# Build .AppImage, .deb, and .rpm
NO_STRIP=true npx tauri build --config src-tauri/tauri.linux.conf.json`,
  web: `git clone https://github.com/${REPO}.git
cd wachcha
npm install

# Local web preview (http://127.0.0.1:4179)
npm run dev:web

# Full verification suite (format, Vitest, Vite build, Rust tests, stdio probe)
npm run format:check && npm test && npm run build:web && npm run test:rust && npm run probe:build && npm run check:probe`,
};

const ASSET_KEYS = {
  'windows-setup': name => /windows.*setup\.exe$/i.test(name),
  'windows-msi': name => /windows.*\.msi$/i.test(name),
  'windows-portable': name => /windows.*portable\.zip$/i.test(name),
  'android-universal': name => /android.*universal\.apk$/i.test(name),
  'android-arm64': name => /android.*arm64\.apk$/i.test(name),
  'macos-dmg': name => /macos.*\.dmg$/i.test(name),
  'linux-appimage': name => /linux.*\.AppImage$/i.test(name),
  'linux-deb': name => /linux.*\.deb$/i.test(name),
  'linux-rpm': name => /linux.*\.rpm$/i.test(name),
};

function detectOs() {
  const ua = (navigator.userAgent || '').toLowerCase();
  if (ua.includes('android')) return 'android';
  if (ua.includes('win')) return 'windows';
  if (ua.includes('mac') && !ua.includes('iphone') && !ua.includes('ipad')) return 'macos';
  if (ua.includes('linux')) return 'linux';
  return 'windows';
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

const state = {
  lang: 'en',
  os: detectOs(),
  version: `v${FALLBACK_VERSION}`,
  activeTab: 'windows',
  assets: {},
};

function detectLang() {
  const saved = localStorage.getItem('wachcha-site-lang');
  if (saved && I18N[saved]) return saved;
  const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return I18N[nav] ? nav : 'en';
}

function updatePrimaryCta() {
  const dict = I18N[state.lang];
  const osMeta = {
    windows: { name: 'Windows (.exe)', key: 'windows-setup' },
    android: { name: 'Android & TV (.apk)', key: 'android-universal' },
    macos: { name: 'macOS (.dmg)', key: 'macos-dmg' },
    linux: { name: 'Linux (.AppImage)', key: 'linux-appimage' },
  }[state.os];

  const primary = document.getElementById('primary-download');
  const label = document.getElementById('primary-download-label');
  const meta = document.getElementById('primary-download-meta');
  if (!primary || !label || !meta) return;

  const fallbackHref = document.querySelector(`[data-asset="${osMeta.key}"]`)?.getAttribute('href');
  const live = state.assets[osMeta.key];
  primary.setAttribute('href', live?.url || fallbackHref || '#downloads');
  label.textContent = `${dict.downloadFor} ${osMeta.name}`;
  meta.textContent = live?.size ? `${state.version} · ${live.size}` : state.version;

  document.querySelectorAll('.platform-card').forEach(card => {
    card.classList.toggle('recommended', card.getAttribute('data-os') === state.os);
  });
}

function applyLang(lang) {
  state.lang = I18N[lang] ? lang : 'en';
  localStorage.setItem('wachcha-site-lang', state.lang);
  document.documentElement.lang = state.lang;

  const dict = I18N[state.lang];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key && dict[key]) el.textContent = dict[key];
  });

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-lang') === state.lang);
  });

  const copyBtn = document.getElementById('copy-build-btn');
  if (copyBtn) copyBtn.textContent = dict.copy;

  updatePrimaryCta();
}

function renderBuildTab(target) {
  state.activeTab = BUILD_COMMANDS[target] ? target : 'windows';
  const code = document.getElementById('build-code');
  if (code) code.textContent = BUILD_COMMANDS[state.activeTab];
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-target') === state.activeTab);
  });
}

async function hydrateLatestRelease() {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return;
    const rel = await res.json();
    if (rel.tag_name) {
      state.version = rel.tag_name;
      const badge = document.getElementById('version-badge');
      if (badge) badge.textContent = rel.tag_name;
    }
    const assets = Array.isArray(rel.assets) ? rel.assets : [];
    for (const asset of assets) {
      if (asset.name === 'SHA256SUMS.txt') {
        const link = document.getElementById('checksums-link');
        if (link) link.setAttribute('href', asset.browser_download_url);
      }
      for (const [key, matcher] of Object.entries(ASSET_KEYS)) {
        if (matcher(asset.name)) {
          const size = formatBytes(asset.size);
          state.assets[key] = { url: asset.browser_download_url, size };
          const anchor = document.querySelector(`[data-asset="${key}"]`);
          const sizeEl = document.querySelector(`[data-size="${key}"]`);
          if (anchor) anchor.setAttribute('href', asset.browser_download_url);
          if (sizeEl && size) sizeEl.textContent = size;
        }
      }
    }
    updatePrimaryCta();
  } catch {
    // Offline or rate-limited: static v0.0.1 fallback URLs remain active.
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => applyLang(btn.getAttribute('data-lang') || 'en'));
  });

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () =>
      renderBuildTab(btn.getAttribute('data-target') || 'windows')
    );
  });

  const copyBtn = document.getElementById('copy-build-btn');
  copyBtn?.addEventListener('click', async () => {
    const text = BUILD_COMMANDS[state.activeTab] || '';
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = I18N[state.lang].copied;
      setTimeout(() => {
        copyBtn.textContent = I18N[state.lang].copy;
      }, 1600);
    } catch {
      // Clipboard API unavailable in non-secure context.
    }
  });

  applyLang(detectLang());
  renderBuildTab(state.os === 'android' ? 'android' : state.os);
  void hydrateLatestRelease();
});
