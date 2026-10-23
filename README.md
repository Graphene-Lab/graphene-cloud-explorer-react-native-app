## Repo Info
This Cloud Explorer project continues work originally built by Khayym, intending to extend project by adding features like payment, keycloak account, client side encrrytion etc. and fixing bugs.

Android builds and releases: see [local builds, cloud builds, and publishing](docs/android-builds-and-releases.md).

## Run Locally

Clone the project


Go to the project directory

```bash
  cd cloud-storage
```

Install dependencies

```bash
  yarn install
```

Run project

```bash
  yarn run android
```


If you use for iso you must install pods

```bash
  cd ios
  pod install
  cd ..
```


# Setting up the development environment

 ## 1. Install Android Studio
- Download and install Android Studio. While on Android Studio installation wizard, make sure the boxes next to all of the following items are checked:

  - Android SDK
  - Android SDK Platform
  - Android Virtual Device

## 2. Install the Android SDK
Android Studio installs the latest Android SDK by default. Building a React Native app with native code, however, requires the Android 12 (S) SDK in particular. Additional Android SDKs can be installed through the SDK Manager in Android Studio.

To do that, open Android Studio, click on "Configure" button and select "SDK Manager".

The SDK Manager can also be found within the Android Studio "Preferences" dialog, under Appearance & Behavior → System Settings → Android SDK.

Select the "SDK Platforms" tab from within the SDK Manager, then check the box next to "Show Package Details" in the bottom right corner. Look for and expand the Android 12 (S) entry, then make sure the following items are checked:

Android SDK Platform 31
Intel x86 Atom_64 System Image or Google APIs Intel x86 Atom System Image
Next, select the "SDK Tools" tab and check the box next to "Show Package Details" here as well. Look for and expand the "Android SDK Build-Tools" entry, then make sure that 31.0.0 is selected.

Finally, click "Apply" to download and install the Android SDK and related build tools.

## 3. Configure the ANDROID_SDK_ROOT environment variable
The React Native tools require some environment variables to be set up in order to build apps with native code.

Add the following lines to your $HOME/.bash_profile or $HOME/.bashrc (if you are using zsh then ~/.zprofile or ~/.zshrc) config file:

```bash
export ANDROID_SDK_ROOT=$HOME/Library/Android/Sdk
export PATH=$PATH:$ANDROID_SDK_ROOT/emulator
export PATH=$PATH:$ANDROID_SDK_ROOT/platform-tools
```

** .bash_profile is specific to bash. If you're using another shell, you will need to edit the appropriate shell-specific config file.

# 4. Watchman https://facebook.github.io/watchman/docs/install.html
Follow the Watchman installation guide to compile and install Watchman from source.

Watchman is a tool by Facebook for watching changes in the filesystem. It is highly recommended you install it for better performance and increased compatibility in certain edge cases (translation: you may be able to get by without installing this, but your mileage may vary; installing this now may save you from a headache later).

Note: add gradle-s.properties file in android folder with this keys:
APP_UPLOAD_STORE_FILE=
APP_UPLOAD_STORE_PASSWORD=
APP_UPLOAD_KEY_ALIAS=
APP_UPLOAD_KEY_PASSWORD=
