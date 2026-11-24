import { access, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const manifestPath = resolve('src-tauri/gen/android/app/src/main/AndroidManifest.xml');

try {
  await access(manifestPath);
} catch {
  console.error(
    `AndroidManifest.xml not found at ${manifestPath}. Run "npx tauri android init --ci" first.`
  );
  process.exit(1);
}

let xml = await readFile(manifestPath, 'utf8');

if (!xml.includes('android.software.leanback')) {
  xml = xml.replace(
    '<application',
    `    <uses-feature android:name="android.software.leanback" android:required="false" />\n` +
      `    <uses-feature android:name="android.hardware.touchscreen" android:required="false" />\n\n    <application`
  );
}

if (!xml.includes('android:usesCleartextTraffic')) {
  xml = xml.replace('<application', '<application\n        android:usesCleartextTraffic="true"');
}

if (!xml.includes('android:banner=')) {
  xml = xml.replace('<application', '<application\n        android:banner="@mipmap/ic_launcher"');
}

if (!xml.includes('android.intent.category.LEANBACK_LAUNCHER')) {
  xml = xml.replace(
    '<category android:name="android.intent.category.LAUNCHER" />',
    '<category android:name="android.intent.category.LAUNCHER" />\n                <category android:name="android.intent.category.LEANBACK_LAUNCHER" />'
  );
}

await writeFile(manifestPath, xml, 'utf8');
console.log(
  'Patched AndroidManifest.xml with Android TV Leanback launcher & local media transport support.'
);
