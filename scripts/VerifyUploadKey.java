import java.io.File;
import java.io.IOException;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.UnrecoverableKeyException;

// Read credentials from the environment so passwords never appear in command arguments.
class VerifyUploadKey {
    public static void main(String[] args) {
        if (args.length != 1) {
            System.exit(1);
        }
        try {
            KeyStore store = KeyStore.getInstance(
                new File(args[0]),
                System.getenv("APP_UPLOAD_STORE_PASSWORD").toCharArray()
            );
            String alias = System.getenv("APP_UPLOAD_KEY_ALIAS");
            if (!store.containsAlias(alias)) {
                System.exit(3);
            }
            if (!store.isKeyEntry(alias)) {
                System.exit(4);
            }
            if (!(store.getKey(alias, System.getenv("APP_UPLOAD_KEY_PASSWORD").toCharArray()) instanceof PrivateKey)) {
                System.exit(4);
            }
        } catch (UnrecoverableKeyException error) {
            System.exit(5);
        } catch (IOException error) {
            System.exit(2);
        } catch (Exception error) {
            System.exit(1);
        }
    }
}
