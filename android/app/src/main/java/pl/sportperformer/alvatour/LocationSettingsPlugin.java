package pl.sportperformer.alvatour;

import android.app.Activity;
import android.content.Intent;
import android.location.LocationManager;
import android.provider.Settings;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.location.LocationManagerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.common.api.ResolvableApiException;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.LocationSettingsRequest;
import com.google.android.gms.location.Priority;

/**
 * Włączanie lokalizacji telefonu dla "Mojej pozycji" na mapie planu.
 * Gdy lokalizacja jest wyłączona, pokazuje systemowe okno Androida "Włączyć lokalizację?" (jedno kliknięcie OK).
 * Gdy to okno jest niedostępne (brak Usług Google Play), otwiera ekran ustawień lokalizacji.
 * Nie czyta ani nie zapisuje pozycji: tylko sprawdza i prosi o włączenie.
 */
@CapacitorPlugin(name = "LocationSettings")
public class LocationSettingsPlugin extends Plugin {
    private ActivityResultLauncher<IntentSenderRequest> launcher;
    private PluginCall pending;

    @Override
    public void load() {
        launcher = getActivity().registerForActivityResult(new ActivityResultContracts.StartIntentSenderForResult(), (res) -> {
            PluginCall call = pending;
            pending = null;
            if (call == null) return;
            boolean ok = res.getResultCode() == Activity.RESULT_OK || locationOn();
            JSObject r = new JSObject();
            r.put("enabled", ok);
            r.put("how", ok ? "dialog" : "declined");
            call.resolve(r);
        });
    }

    private boolean locationOn() {
        LocationManager lm = (LocationManager) getContext().getSystemService(android.content.Context.LOCATION_SERVICE);
        return lm != null && LocationManagerCompat.isLocationEnabled(lm);
    }

    @PluginMethod
    public void isEnabled(PluginCall call) {
        JSObject r = new JSObject();
        r.put("enabled", locationOn());
        call.resolve(r);
    }

    @PluginMethod
    public void ensureEnabled(PluginCall call) {
        if (locationOn()) {
            JSObject r = new JSObject();
            r.put("enabled", true);
            r.put("how", "already");
            call.resolve(r);
            return;
        }
        try {
            LocationRequest req = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 10000).build();
            LocationSettingsRequest sreq = new LocationSettingsRequest.Builder().addLocationRequest(req).setAlwaysShow(true).build();
            LocationServices.getSettingsClient(getActivity()).checkLocationSettings(sreq)
                .addOnSuccessListener((x) -> {
                    JSObject r = new JSObject();
                    r.put("enabled", true);
                    r.put("how", "already");
                    call.resolve(r);
                })
                .addOnFailureListener((e) -> {
                    if (e instanceof ResolvableApiException && pending == null) {
                        try {
                            pending = call;
                            launcher.launch(new IntentSenderRequest.Builder(((ResolvableApiException) e).getResolution()).build());
                            return;
                        } catch (Exception ex) {
                            pending = null;
                        }
                    }
                    openSettings(call);
                });
        } catch (Throwable t) {
            // brak Usług Google Play: ekran ustawień lokalizacji
            openSettings(call);
        }
    }

    private void openSettings(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            JSObject r = new JSObject();
            r.put("enabled", false);
            r.put("how", "settings");
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Nie udało się otworzyć ustawień lokalizacji.");
        }
    }
}
