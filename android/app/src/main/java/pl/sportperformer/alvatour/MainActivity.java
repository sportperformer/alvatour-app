package pl.sportperformer.alvatour;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // własne wtyczki AlvaTour (rejestrowane przed startem mostu Capacitor)
        registerPlugin(ShareTargetPlugin.class);
        super.onCreate(savedInstanceState);
        // Tylko AlvaTour DEV: automatyczne testy na emulatorze (GitHub Actions) sterują aplikacją przez WebView.
        // Wersja produkcyjna ma to wyłączone.
        if ("dev".equals(BuildConfig.FLAVOR)) {
            WebView.setWebContentsDebuggingEnabled(true);
        }
    }
}
