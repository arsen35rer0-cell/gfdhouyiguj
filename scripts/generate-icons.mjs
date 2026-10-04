import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="100" fill="#0a0a0f"/>
  <path d="M256 68l152 56v118c0 106-66 182-152 204-86-22-152-98-152-204V124z" fill="#00ff9d"/>
  <path d="M256 128l96 36v74c0 68-42 116-96 130-54-14-96-62-96-130v-74z" fill="#0a0a0f"/>
  <circle cx="256" cy="238" r="36" fill="#00ff9d"/>
</svg>
`;

const androidRes = 'android/app/src/main/res';

const sizes = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192
};

await mkdir('resources', { recursive: true });

await sharp(Buffer.from(svg))
  .resize(512, 512)
  .png()
  .toFile('resources/icon.png');

if (!existsSync(androidRes)) {
  console.warn('Android project not found. Run `npx cap add android` first.');
} else {
  for (const [density, size] of Object.entries(sizes)) {
    const dir = `${androidRes}/mipmap-${density}`;
    await mkdir(dir, { recursive: true });

    const png = await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toBuffer();

    await writeFile(`${dir}/ic_launcher.png`, png);
    await writeFile(`${dir}/ic_launcher_round.png`, png);
  }

  const anydpi = `${androidRes}/mipmap-anydpi-v26`;
  await mkdir(anydpi, { recursive: true });

  const adaptiveIcon = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <background android:drawable="@color/ic_launcher_background"/>
  <foreground android:drawable="@drawable/ic_launcher_foreground"/>
</adaptive-icon>
`;

  await writeFile(`${anydpi}/ic_launcher.xml`, adaptiveIcon);
  await writeFile(`${anydpi}/ic_launcher_round.xml`, adaptiveIcon);

  await mkdir(`${androidRes}/drawable`, { recursive: true });

  const vector = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
  <path
      android:fillColor="#00FF9D"
      android:pathData="M54,14L86,26v26c0,22-14,38-32,42C36,90 22,74 22,52V26z" />
  <path
      android:fillColor="#0A0A0F"
      android:pathData="M54,30L74,38v14c0,14-9,24-20,27C43,76 34,66 34,52V38z" />
  <path
      android:fillColor="#00FF9D"
      android:pathData="M54,46m-8,0a8,8 0,1 1,16 0a8,8 0,1 1,-16 0" />
</vector>
`;

  await writeFile(`${androidRes}/drawable/ic_launcher_foreground.xml`, vector);

  await mkdir(`${androidRes}/values`, { recursive: true });

  const colors = `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <color name="ic_launcher_background">#0A0A0F</color>
</resources>
`;

  await writeFile(`${androidRes}/values/ic_launcher_background.xml`, colors);

  console.log('Android icons generated.');
}
