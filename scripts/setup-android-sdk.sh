#!/bin/bash
set -e

# Install Android SDK tools
export ANDROID_HOME=/android-sdk
export PATH=$ANDROID_HOME/tools/bin:$PATH

# Accept licenses
yes | sdkmanager --licenses

# Install required build tools and platforms
sdkmanager "platform-tools" "build-tools;33.0.2" "platforms;android-33"

# Verify Gradle wrapper
chmod +x ./gradlew
./gradlew --version