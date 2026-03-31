#!/bin/bash
set -e

echo "Building web..."
npx expo export --platform web

echo "Copying fonts..."
mkdir -p dist/fonts
cp dist/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/*.ttf dist/fonts/
cp dist/assets/node_modules/@react-navigation/elements/lib/module/assets/*.png dist/fonts/ 2>/dev/null || true

echo "Deploying..."
npx vercel --prod

echo "Done!"
