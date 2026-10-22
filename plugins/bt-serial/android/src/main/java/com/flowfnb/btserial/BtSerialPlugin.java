package com.flowfnb.btserial;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.os.Build;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/** Bluetooth Classic (SPP) for thermal/label printers that are paired in Android settings. */
@CapacitorPlugin(
    name = "BtSerial",
    permissions = { @Permission(alias = "bt", strings = { Manifest.permission.BLUETOOTH_CONNECT }) }
)
public class BtSerialPlugin extends Plugin {
    private static final UUID SPP = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private final Map<String, BluetoothSocket> sockets = new HashMap<>();

    private BluetoothAdapter adapter() {
        BluetoothManager m = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        return m == null ? null : m.getAdapter();
    }

    private boolean needPerm(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 31 && getPermissionState("bt") != PermissionState.GRANTED) {
            requestPermissionForAlias("bt", call, "permCb");
            return true;
        }
        return false;
    }

    @PermissionCallback
    private void permCb(PluginCall call) {
        if (getPermissionState("bt") != PermissionState.GRANTED) { call.reject("Izin Bluetooth ditolak. Izinkan 'Perangkat di sekitar' untuk aplikasi POS."); return; }
        String m = call.getMethodName();
        if ("listPaired".equals(m)) listPaired(call);
        else if ("connect".equals(m)) connect(call);
        else if ("write".equals(m)) write(call);
    }

    @PluginMethod
    public void listPaired(PluginCall call) {
        if (needPerm(call)) return;
        BluetoothAdapter a = adapter();
        if (a == null) { call.reject("Tablet tidak punya Bluetooth"); return; }
        if (!a.isEnabled()) { call.reject("Nyalakan Bluetooth di tablet terlebih dulu."); return; }
        JSArray list = new JSArray();
        try {
            for (BluetoothDevice d : a.getBondedDevices()) {
                JSObject o = new JSObject();
                o.put("address", d.getAddress());
                o.put("name", d.getName() == null ? d.getAddress() : d.getName());
                o.put("type", d.getType());
                list.put(o);
            }
        } catch (SecurityException e) { call.reject("Izin Bluetooth belum diberikan"); return; }
        JSObject r = new JSObject();
        r.put("devices", list);
        call.resolve(r);
    }

    private BluetoothSocket open(String address) throws Exception {
        BluetoothSocket s = sockets.get(address);
        if (s != null && s.isConnected()) return s;
        if (s != null) { try { s.close(); } catch (Exception ignored) {} }
        BluetoothAdapter a = adapter();
        if (a == null) throw new Exception("Tablet tidak punya Bluetooth");
        BluetoothDevice d = a.getRemoteDevice(address);
        try { a.cancelDiscovery(); } catch (SecurityException ignored) {}
        try {
            s = d.createRfcommSocketToServiceRecord(SPP);
            s.connect();
        } catch (Exception first) {
            try { if (s != null) s.close(); } catch (Exception ignored) {}
            // Fallback used by many cheap printers
            s = (BluetoothSocket) d.getClass().getMethod("createRfcommSocket", int.class).invoke(d, 1);
            s.connect();
        }
        sockets.put(address, s);
        return s;
    }

    @PluginMethod
    public void connect(PluginCall call) {
        if (needPerm(call)) return;
        String address = call.getString("address");
        if (address == null) { call.reject("address wajib"); return; }
        new Thread(() -> {
            try { open(address); call.resolve(); }
            catch (Exception e) { call.reject("Gagal tersambung ke printer. Pastikan printer menyala, dekat tablet, dan tidak sedang dipakai perangkat lain."); }
        }).start();
    }

    @PluginMethod
    public void write(PluginCall call) {
        if (needPerm(call)) return;
        String address = call.getString("address");
        String data = call.getString("data");
        if (address == null || data == null) { call.reject("address & data wajib"); return; }
        new Thread(() -> {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            for (int attempt = 0; attempt < 2; attempt++) {
                try {
                    OutputStream os = open(address).getOutputStream();
                    for (int i = 0; i < bytes.length; i += 512) {
                        os.write(bytes, i, Math.min(512, bytes.length - i));
                        os.flush();
                        Thread.sleep(15);
                    }
                    call.resolve();
                    return;
                } catch (Exception e) {
                    BluetoothSocket s = sockets.remove(address);
                    try { if (s != null) s.close(); } catch (Exception ignored) {}
                }
            }
            call.reject("Gagal mengirim ke printer Bluetooth. Coba Hubungkan ulang.");
        }).start();
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        String address = call.getString("address");
        BluetoothSocket s = address == null ? null : sockets.remove(address);
        try { if (s != null) s.close(); } catch (Exception ignored) {}
        call.resolve();
    }
}
