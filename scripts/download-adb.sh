#!/bin/bash
set -e

BINARIES_DIR="packages/app/src-tauri/binaries"
mkdir -p "$BINARIES_DIR"

echo "Downloading macOS platform-tools..."
curl -L -o /tmp/platform-tools-darwin.zip "https://dl.google.com/android/repository/platform-tools-latest-darwin.zip"
unzip -o /tmp/platform-tools-darwin.zip -d /tmp
cp /tmp/platform-tools/adb "$BINARIES_DIR/adb-aarch64-apple-darwin"
cp /tmp/platform-tools/adb "$BINARIES_DIR/adb-x86_64-apple-darwin"
chmod +x "$BINARIES_DIR/adb-aarch64-apple-darwin" "$BINARIES_DIR/adb-x86_64-apple-darwin"
rm -rf /tmp/platform-tools /tmp/platform-tools-darwin.zip
echo "macOS ADB ready"

echo "Downloading Windows platform-tools..."
curl -L -o /tmp/platform-tools-windows.zip "https://dl.google.com/android/repository/platform-tools-latest-windows.zip"
unzip -o /tmp/platform-tools-windows.zip -d /tmp
cp /tmp/platform-tools/adb.exe "$BINARIES_DIR/adb-x86_64-pc-windows-msvc.exe"
rm -rf /tmp/platform-tools /tmp/platform-tools-windows.zip
echo "Windows ADB ready"

echo "All ADB binaries downloaded to $BINARIES_DIR"
ls -la "$BINARIES_DIR"
