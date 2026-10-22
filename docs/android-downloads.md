# Android public downloads

Android downloads are saved to **Downloads / Graphene Cloud Explorer**. The app stages
the decrypted bytes in its cache, then the `PublicDownloads` Android module copies
them into `MediaStore.Downloads` (Android 10+). It keeps the entry pending until the
closed output has the expected size and deletes the entry if saving fails. Android
7–9 use the public download directory with the existing storage permission.

The module returns the actual saved filename and content URI. MediaStore chooses
a unique name for collisions; the legacy implementation creates a unique file
without overwriting. The private MMKV index stores these URIs by cloud connection
and remote path. Opening, sharing and image previews use the URI directly. Deleting
the public file invalidates its index entry and allows another download.

The success notification and the dialog with **Open** appear after the file is saved
and indexed. If an older download exists in the app's private folders, choosing
Download exports that copy without another remote transfer. iOS keeps its document
directory behavior. This change does not fix the separate encrypted-file rename issue.

## Automated checks

```powershell
npm run test:screens
npm run test:auth
```

The download suite (`tests/screens/downloads.test.js`) exercises the real download
orchestration, byte writer, persistent index, notifications, confirmation dialog,
Open handler, sharing and thumbnail rendering. Backend and Android services are
mocked; the test setup forbids live HTTP requests. Native MediaStore behavior still
requires a rebuilt Android app and a device/emulator.

## Device verification

1. Download a JPG, MP3 and PDF. After success, find each in Samsung My Files →
   Downloads → Graphene Cloud Explorer; verify size and open the content.
2. Use **Open** in the completion dialog and **Share** from the file menu.
3. Restart the app, then open/share the downloaded files again. Choosing Download
   again should show the saved location without creating another copy.
4. Download two different cloud files with the same filename. Both public files
   must remain intact; the completion dialog must show the actual saved name.
5. Delete one public file through My Files. The app should offer to download it again.
6. Choose Download on a file cached by an older app version. It should appear in
   public Downloads without another network download.
7. With notifications disabled, saving and the completion dialog must still work.
   On Android 9, deny storage permission and verify a failure with no success message.
8. Exercise a failed save (such as a full test device). Confirm there is no successful
   download notification or visible partial public file, and retry after freeing space.
