package pl.sportperformer.alvatour;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Aktualizacja AlvaTour bez przeglądarki: pobranie APK z GitHub Releases do pamięci aplikacji,
 * kontrola (rozmiar, SHA-256, ta sama aplikacja, ten sam klucz podpisu) i systemowe okno "Aktualizuj".
 * Chrome na Androidzie potrafi zawiesić się na 100% przy pobieraniu APK z GitHuba, stąd własne pobieranie.
 */
@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {

    private File apkFile() {
        File dir = new File(getContext().getCacheDir(), "aktualizacja");
        //noinspection ResultOfMethodCallIgnored
        dir.mkdirs();
        return new File(dir, "AlvaTour-aktualizacja.apk");
    }

    @PluginMethod
    public void download(PluginCall call) {
        String url = call.getString("url");
        long expectedSize = call.getLong("size", -1L);
        String expectedSha = call.getString("sha256", "");
        if (url == null || !url.startsWith("https://github.com/")) {
            call.reject("Nieprawidłowy adres aktualizacji.");
            return;
        }
        new Thread(() -> {
            File out = apkFile();
            try {
                MessageDigest sha = MessageDigest.getInstance("SHA-256");
                HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection();
                con.setInstanceFollowRedirects(true);
                con.setConnectTimeout(15000);
                con.setReadTimeout(30000);
                con.setRequestProperty("User-Agent", "AlvaTour-aktualizacja");
                int code = con.getResponseCode();
                if (code != 200) throw new Exception("Serwer odpowiedział kodem " + code);
                long total = con.getContentLengthLong();
                if (total <= 0) total = expectedSize;
                long done = 0;
                long lastNotify = 0;
                try (InputStream in = con.getInputStream(); FileOutputStream fos = new FileOutputStream(out)) {
                    byte[] buf = new byte[64 * 1024];
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        fos.write(buf, 0, n);
                        sha.update(buf, 0, n);
                        done += n;
                        long now = System.currentTimeMillis();
                        if (now - lastNotify > 250) {
                            lastNotify = now;
                            JSObject p = new JSObject();
                            p.put("downloaded", done);
                            p.put("total", total);
                            notifyListeners("progress", p);
                        }
                    }
                } finally {
                    con.disconnect();
                }
                if (expectedSize > 0 && done != expectedSize) {
                    throw new Exception("Plik jest niekompletny (" + done + " z " + expectedSize + " bajtów).");
                }
                String got = hex(sha.digest());
                if (expectedSha != null && !expectedSha.isEmpty() && !got.equalsIgnoreCase(expectedSha)) {
                    throw new Exception("Suma kontrolna pliku się nie zgadza. Plik jest uszkodzony.");
                }
                JSObject ret = verify(out);
                ret.put("sha256", got);
                ret.put("size", done);
                call.resolve(ret);
            } catch (Exception e) {
                //noinspection ResultOfMethodCallIgnored
                out.delete();
                call.reject(e.getMessage() == null ? "Nie udało się pobrać aktualizacji." : e.getMessage());
            }
        }).start();
    }

    /** Pobrany plik musi być tą samą aplikacją (np. DEV -> DEV) i mieć ten sam klucz podpisu. */
    private JSObject verify(File apk) throws Exception {
        PackageManager pm = getContext().getPackageManager();
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        PackageInfo archive = pm.getPackageArchiveInfo(apk.getAbsolutePath(), flags);
        if (archive == null) throw new Exception("Pobrany plik nie jest poprawną aplikacją Android.");
        String pkg = getContext().getPackageName();
        if (!pkg.equals(archive.packageName)) {
            throw new Exception("To inna aplikacja (" + archive.packageName + "), a nie " + pkg + ". Nie instaluję.");
        }
        PackageInfo installed = pm.getPackageInfo(pkg, flags);
        Set<String> mine = certs(installed);
        Set<String> theirs = certs(archive);
        theirs.retainAll(mine);
        if (mine.isEmpty() || theirs.isEmpty()) {
            throw new Exception("Aktualizacja jest podpisana innym kluczem niż zainstalowana aplikacja. Nie instaluję.");
        }
        JSObject ret = new JSObject();
        ret.put("packageName", archive.packageName);
        ret.put("versionName", archive.versionName);
        ret.put("versionCode", Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? archive.getLongVersionCode() : archive.versionCode);
        return ret;
    }

    @SuppressWarnings("deprecation")
    private static Set<String> certs(PackageInfo info) throws Exception {
        Set<String> out = new HashSet<>();
        Signature[] sigs;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            if (info.signingInfo == null) return out;
            sigs = info.signingInfo.hasMultipleSigners() ? info.signingInfo.getApkContentsSigners() : info.signingInfo.getSigningCertificateHistory();
        } else {
            sigs = info.signatures;
        }
        if (sigs == null) return out;
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        for (Signature s : sigs) out.add(hex(md.digest(s.toByteArray())));
        return out;
    }

    @PluginMethod
    public void install(PluginCall call) {
        File apk = apkFile();
        if (!apk.exists()) {
            call.reject("Najpierw pobierz aktualizację.");
            return;
        }
        Context ctx = getContext();
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !ctx.getPackageManager().canRequestPackageInstalls()) {
            // jednorazowa zgoda Androida: "Zezwalaj z tego źródła" dla AlvaTour
            Intent s = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + ctx.getPackageName()));
            s.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(s);
            ret.put("needsPermission", true);
            call.resolve(ret);
            return;
        }
        Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", apk);
        Intent i = new Intent(Intent.ACTION_VIEW);
        i.setDataAndType(uri, "application/vnd.android.package-archive");
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        ctx.startActivity(i);
        ret.put("started", true);
        call.resolve(ret);
    }

    private static String hex(byte[] b) {
        StringBuilder sb = new StringBuilder();
        for (byte x : b) sb.append(String.format(Locale.ROOT, "%02x", x));
        return sb.toString();
    }
}
