package com.graphenelab.cloudexplorer.downloads;

import android.content.ClipData;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.ParcelFileDescriptor;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import androidx.annotation.NonNull;
import androidx.core.content.FileProvider;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Saves completed, decrypted files without exposing partial downloads or replacing user files. */
public class PublicDownloadsModule extends ReactContextBaseJavaModule {
  private static final String FOLDER = "Graphene Cloud Explorer";
  private final ExecutorService io = Executors.newSingleThreadExecutor();

  public PublicDownloadsModule(ReactApplicationContext context) {
    super(context);
  }

  @NonNull
  @Override
  public String getName() {
    return "PublicDownloads";
  }

  @Override
  public void invalidate() {
    io.shutdown();
    super.invalidate();
  }

  private static long copy(File source, OutputStream output) throws IOException {
    long copied = 0;
    try (FileInputStream input = new FileInputStream(source)) {
      byte[] buffer = new byte[64 * 1024];
      int count;
      while ((count = input.read(buffer)) != -1) {
        output.write(buffer, 0, count);
        copied += count;
      }
    }
    output.flush();
    return copied;
  }

  @ReactMethod
  public void exportFile(String sourcePath, String name, String mimeType, Promise promise) {
    io.execute(() -> {
      ContentResolver resolver = getReactApplicationContext().getContentResolver();
      Uri pendingUri = null;
      File legacyFile = null;
      try {
        if (name == null || name.trim().isEmpty() || name.equals(".") || name.equals("..")
            || name.contains("/") || name.contains("\\") || name.indexOf('\0') >= 0) {
          throw new IOException("Invalid download filename");
        }
        File source = new File(sourcePath);
        if (!source.isFile()) throw new IOException("Downloaded source is missing");
        long expectedSize = source.length();
        Uri savedUri;
        String savedName = name;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          ContentValues values = new ContentValues();
          values.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
          values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
          values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/" + FOLDER);
          values.put(MediaStore.MediaColumns.IS_PENDING, 1);
          pendingUri = resolver.insert(
              MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY), values);
          if (pendingUri == null) throw new IOException("Could not create download");
          long copied;
          try (OutputStream output = resolver.openOutputStream(pendingUri, "w")) {
            if (output == null) throw new IOException("Could not open download for writing");
            copied = copy(source, output);
          }
          // Verify the closed output before publishing it to other applications.
          try (ParcelFileDescriptor descriptor = resolver.openFileDescriptor(pendingUri, "r")) {
            if (descriptor == null || copied != expectedSize || descriptor.getStatSize() != expectedSize) {
              throw new IOException("Saved download has an unexpected size");
            }
          }
          values.clear();
          values.put(MediaStore.MediaColumns.IS_PENDING, 0);
          if (resolver.update(pendingUri, values, null, null) != 1) {
            throw new IOException("Could not publish download");
          }
          // MediaStore chooses a unique name when a file with this name already exists.
          try (Cursor cursor = resolver.query(pendingUri,
              new String[] {OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) savedName = cursor.getString(0);
          }
          savedUri = pendingUri;
        } else {
          File folder = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), FOLDER);
          if (!folder.isDirectory() && !folder.mkdirs()) throw new IOException("Could not create download folder");
          int dot = name.lastIndexOf('.');
          String base = dot > 0 ? name.substring(0, dot) : name;
          String suffix = dot > 0 ? name.substring(dot) : "";
          int counter = 0;
          File candidate;
          do {
            savedName = counter == 0 ? name : base + " (" + counter + ")" + suffix;
            candidate = new File(folder, savedName);
            counter++;
          } while (!candidate.createNewFile());
          legacyFile = candidate;
          long copied;
          try (FileOutputStream output = new FileOutputStream(legacyFile)) {
            copied = copy(source, output);
          }
          if (copied != expectedSize || legacyFile.length() != expectedSize) {
            throw new IOException("Saved download has an unexpected size");
          }
          savedUri = FileProvider.getUriForFile(getReactApplicationContext(),
              getReactApplicationContext().getPackageName() + ".provider", legacyFile);
        }
        WritableMap result = Arguments.createMap();
        result.putString("uri", savedUri.toString());
        result.putString("name", savedName);
        result.putString("mime", mimeType);
        result.putDouble("size", expectedSize);
        result.putString("displayPath", "Downloads/" + FOLDER + "/" + savedName);
        promise.resolve(result);
      } catch (Exception error) {
        if (pendingUri != null) {
          try { resolver.delete(pendingUri, null, null); } catch (Exception ignored) { }
        }
        if (legacyFile != null) legacyFile.delete();
        promise.reject("DOWNLOAD_SAVE_FAILED", error);
      }
    });
  }

  @ReactMethod
  public void statFile(String source, Promise promise) {
    io.execute(() -> {
      try {
        Uri uri = Uri.parse(source);
        ContentResolver resolver = getReactApplicationContext().getContentResolver();
        try (ParcelFileDescriptor descriptor = resolver.openFileDescriptor(uri, "r");
             Cursor cursor = resolver.query(uri,
                 new String[] {OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE}, null, null, null)) {
          if (descriptor == null || cursor == null || !cursor.moveToFirst()) {
            promise.resolve(null);
            return;
          }
          WritableMap result = Arguments.createMap();
          result.putString("name", cursor.getString(0));
          long actualSize = descriptor.getStatSize();
          result.putDouble("size", actualSize >= 0 ? actualSize : cursor.isNull(1) ? -1 : cursor.getLong(1));
          promise.resolve(result);
        }
      } catch (Exception error) {
        // Deleted downloads and revoked access are treated as missing local copies.
        promise.resolve(null);
      }
    });
  }

  private Intent fileIntent(String source, String mimeType, String action) {
    Uri uri = Uri.parse(source);
    Intent intent = new Intent(action);
    intent.setType(mimeType);
    if (Intent.ACTION_VIEW.equals(action)) intent.setDataAndType(uri, mimeType);
    else intent.putExtra(Intent.EXTRA_STREAM, uri);
    intent.setClipData(ClipData.newRawUri("Downloaded file", uri));
    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
    return intent;
  }

  @ReactMethod
  public void openFile(String source, String mimeType, Promise promise) {
    try {
      Intent intent = fileIntent(source, mimeType, Intent.ACTION_VIEW);
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      getReactApplicationContext().startActivity(intent);
      promise.resolve(true);
    } catch (Exception error) {
      promise.reject("DOWNLOAD_OPEN_FAILED", error);
    }
  }

  @ReactMethod
  public void shareFile(String source, String mimeType, String title, Promise promise) {
    try {
      Intent intent = fileIntent(source, mimeType, Intent.ACTION_SEND);
      Intent chooser = Intent.createChooser(intent, title);
      chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
      getReactApplicationContext().startActivity(chooser);
      promise.resolve(true);
    } catch (Exception error) {
      promise.reject("DOWNLOAD_SHARE_FAILED", error);
    }
  }
}
