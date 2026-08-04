package app.finly.personal;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Local plugins (ones living in this app rather than an npm package) are
        // not auto-discovered — they must be registered BEFORE super.onCreate()
        // builds the bridge, or calls to SmsReader fail as "not implemented".
        registerPlugin(SmsReaderPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
