package pl.sportperformer.alvatour;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Odbiór "Udostępnij -> AlvaTour" (ACTION_SEND, text/plain) z Google Maps, Claude, Gemini itd.
 *
 * - zimny start (aplikacja była zamknięta): tekst czeka w pending, JS odbiera go przez takePending(),
 * - aplikacja otwarta: zdarzenie "shareReceived" (zachowane, jeśli JS jeszcze nie nasłuchuje).
 */
@CapacitorPlugin(name = "ShareTarget")
public class ShareTargetPlugin extends Plugin {

    private JSObject pending;

    @Override
    public void load() {
        JSObject data = readShare(getActivity().getIntent());
        if (data != null) pending = data;
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        JSObject data = readShare(intent);
        if (data != null) notifyListeners("shareReceived", data, true);
    }

    @PluginMethod
    public void takePending(PluginCall call) {
        JSObject ret = new JSObject();
        if (pending != null) {
            ret.put("share", pending);
            pending = null;
        }
        call.resolve(ret);
    }

    private JSObject readShare(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return null;
        String type = intent.getType();
        if (type == null || !type.startsWith("text/")) return null;
        JSObject data = new JSObject();
        data.put("text", str(intent.getCharSequenceExtra(Intent.EXTRA_TEXT)));
        data.put("subject", str(intent.getCharSequenceExtra(Intent.EXTRA_SUBJECT)));
        data.put("title", str(intent.getCharSequenceExtra(Intent.EXTRA_TITLE)));
        // oznacz jako obsłużone, żeby po odtworzeniu ekranu ten sam tekst nie wczytał się drugi raz
        if (getActivity() != null && intent == getActivity().getIntent()) {
            getActivity().setIntent(new Intent(Intent.ACTION_MAIN));
        }
        return data;
    }

    private static String str(CharSequence s) {
        return s == null ? "" : s.toString();
    }
}
