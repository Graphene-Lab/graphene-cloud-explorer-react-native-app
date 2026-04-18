package com.graphenelab.cloudexplorer.zk;

import android.util.Base64;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

import org.bouncycastle.crypto.digests.Blake2bDigest;

public class ZkCipherModule extends ReactContextBaseJavaModule {
  public ZkCipherModule(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @NonNull
  @Override
  public String getName() {
    return "ZkCipher";
  }

  @ReactMethod
  public void cryptZkChunksBase64(ReadableArray chunks, String derivedKeyB64, Promise promise) {
    try {
      if (chunks == null || derivedKeyB64 == null) {
        promise.resolve(Arguments.createArray());
        return;
      }
      byte[] derivedKey = Base64.decode(derivedKeyB64, Base64.DEFAULT);
      byte[] seal = blake2b512(derivedKey, null);
      byte[] current = blake2b512(seal, null);
      int cycle = 0;

      WritableArray output = Arguments.createArray();
      for (int i = 0; i < chunks.size(); i++) {
        String chunkB64 = chunks.getString(i);
        if (chunkB64 == null || chunkB64.isEmpty()) {
          output.pushString("");
          continue;
        }
        byte[] input = Base64.decode(chunkB64, Base64.DEFAULT);
        byte[] out = new byte[input.length];
        int offset = 0;
        while (offset < input.length) {
          int remaining = input.length - offset;
          int bytesRead = Math.min(8, remaining);
          int keyOffset = cycle * 8;
          for (int j = 0; j < bytesRead; j++) {
            out[offset + j] = (byte) (input[offset + j] ^ current[keyOffset + j]);
          }
          offset += bytesRead;
          cycle++;
          if (cycle >= 8) {
            current = blake2b512(current, seal);
            cycle = 0;
          }
        }
        String outB64 = Base64.encodeToString(out, Base64.NO_WRAP);
        output.pushString(outB64);
      }
      promise.resolve(output);
    } catch (Exception e) {
      promise.reject("ZK_CIPHER_ERROR", e);
    }
  }

  @ReactMethod
  public void cryptZkChunkBase64WithState(
      String chunkB64,
      String sealB64,
      String currentB64,
      int cycleCounter,
      Promise promise) {
    try {
      if (chunkB64 == null || sealB64 == null || currentB64 == null) {
        promise.resolve(null);
        return;
      }
      byte[] seal = Base64.decode(sealB64, Base64.DEFAULT);
      byte[] current = Base64.decode(currentB64, Base64.DEFAULT);
      int cycle = cycleCounter % 8;
      if (cycle < 0) cycle += 8;

      if (chunkB64.isEmpty()) {
        WritableMap result = Arguments.createMap();
        result.putString("chunkB64", "");
        result.putString("currentB64", Base64.encodeToString(current, Base64.NO_WRAP));
        result.putInt("cycleCounter", cycle);
        promise.resolve(result);
        return;
      }

      byte[] input = Base64.decode(chunkB64, Base64.DEFAULT);
      byte[] out = new byte[input.length];
      int offset = 0;
      while (offset < input.length) {
        int remaining = input.length - offset;
        int bytesRead = Math.min(8, remaining);
        int keyOffset = cycle * 8;
        for (int j = 0; j < bytesRead; j++) {
          out[offset + j] = (byte) (input[offset + j] ^ current[keyOffset + j]);
        }
        offset += bytesRead;
        cycle++;
        if (cycle >= 8) {
          current = blake2b512(current, seal);
          cycle = 0;
        }
      }

      WritableMap result = Arguments.createMap();
      result.putString("chunkB64", Base64.encodeToString(out, Base64.NO_WRAP));
      result.putString("currentB64", Base64.encodeToString(current, Base64.NO_WRAP));
      result.putInt("cycleCounter", cycle);
      promise.resolve(result);
    } catch (Exception e) {
      promise.reject("ZK_CIPHER_ERROR", e);
    }
  }

  private static byte[] blake2b512(byte[] input, byte[] key) {
    Blake2bDigest digest;
    if (key != null && key.length > 0) {
      digest = new Blake2bDigest(key, 64, null, null);
    } else {
      digest = new Blake2bDigest(512);
    }
    digest.update(input, 0, input.length);
    byte[] out = new byte[64];
    digest.doFinal(out, 0);
    return out;
  }
}
