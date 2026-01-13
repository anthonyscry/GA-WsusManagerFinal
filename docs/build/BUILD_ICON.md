# Building App Icons

To create the Windows ICO file from the SVG logo:

## Option 1: Using Online Converter (Quick)
1. Open `assets/logo.svg` in a browser
2. Use an online SVG to ICO converter (e.g., https://convertio.co/svg-ico/)
3. Generate ICO file with multiple sizes (16x16, 32x32, 48x48, 256x256)
4. Save as `build/icon.ico`

## Option 2: Using ImageMagick (if installed)
```powershell
magick assets/logo.svg -resize 256x256 build/icon-256.png
magick assets/logo.svg -resize 128x128 build/icon-128.png
magick assets/logo.svg -resize 64x64 build/icon-64.png
magick assets/logo.svg -resize 48x48 build/icon-48.png
magick assets/logo.svg -resize 32x32 build/icon-32.png
magick assets/logo.svg -resize 16x16 build/icon-16.png
magick build/icon-16.png build/icon-32.png build/icon-48.png build/icon-64.png build/icon-128.png build/icon-256.png build/icon.ico
```

## Option 3: Using electron-icon-maker (npm package)
```powershell
npm install --save-dev electron-icon-maker
npx electron-icon-maker --input=./assets/logo.svg --output=./build
```

## Option 4: Manual PNG creation
1. Export SVG to PNG at 512x512 pixels
2. Save as `build/icon.png`
3. Use an online PNG to ICO converter to create `build/icon.ico`

**Note**: The app will work without the ICO file, but the Windows executable will use the default Electron icon. The SVG logo is already being used in the UI components.
