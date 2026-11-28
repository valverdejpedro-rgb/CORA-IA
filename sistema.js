// Control del equipo (solo Windows) para CORA-IA — lista CERRADA de acciones.
// Etapa 1: leer (dispositivos de salida/entrada, volúmenes, apps con sonido, planes de energía).
// Etapa 2: volumen y silencio, en general y por aplicación. Además: maximizar/minimizar/restaurar ventanas (y cerrarlas de forma normal, como con la X; nunca a la fuerza).
// Sin programas de terceros: usa Core Audio de Windows (C# compilado una vez con PowerShell) y powercfg.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');

const PS_EXE = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
const POWERCFG = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'powercfg.exe');

const FUENTE_CS = String.raw`using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Text;

namespace Cora
{
    [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
    class MMDeviceEnumeratorCom { }

    [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDeviceEnumerator
    {
        [PreserveSig] int EnumAudioEndpoints(int dataFlow, int stateMask, out IMMDeviceCollection devices);
        [PreserveSig] int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice device);
        [PreserveSig] int GetDevice([MarshalAs(UnmanagedType.LPWStr)] string id, out IMMDevice device);
        [PreserveSig] int RegisterEndpointNotificationCallback(IntPtr client);
        [PreserveSig] int UnregisterEndpointNotificationCallback(IntPtr client);
    }

    [ComImport, Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDeviceCollection
    {
        [PreserveSig] int GetCount(out uint count);
        [PreserveSig] int Item(uint index, out IMMDevice device);
    }

    [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDevice
    {
        [PreserveSig] int Activate(ref Guid iid, int clsCtx, IntPtr activationParams, [MarshalAs(UnmanagedType.IUnknown)] out object iface);
        [PreserveSig] int OpenPropertyStore(int access, out IPropertyStore props);
        [PreserveSig] int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
        [PreserveSig] int GetState(out int state);
    }

    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    struct PropertyKey { public Guid fmtid; public uint pid; }

    [StructLayout(LayoutKind.Explicit, Size = 16)]
    struct PropVariant
    {
        [FieldOffset(0)] public ushort vt;
        [FieldOffset(8)] public IntPtr ptr;
        [FieldOffset(8)] public uint u32;
    }

    [ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IPropertyStore
    {
        [PreserveSig] int GetCount(out uint count);
        [PreserveSig] int GetAt(uint index, out PropertyKey key);
        [PreserveSig] int GetValue(ref PropertyKey key, out PropVariant value);
        [PreserveSig] int SetValue(ref PropertyKey key, ref PropVariant value);
        [PreserveSig] int Commit();
    }

    [ComImport, Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioEndpointVolume
    {
        [PreserveSig] int RegisterControlChangeNotify(IntPtr notify);
        [PreserveSig] int UnregisterControlChangeNotify(IntPtr notify);
        [PreserveSig] int GetChannelCount(out uint count);
        [PreserveSig] int SetMasterVolumeLevel(float level, ref Guid ctx);
        [PreserveSig] int SetMasterVolumeLevelScalar(float level, ref Guid ctx);
        [PreserveSig] int GetMasterVolumeLevel(out float level);
        [PreserveSig] int GetMasterVolumeLevelScalar(out float level);
        [PreserveSig] int SetChannelVolumeLevel(uint channel, float level, ref Guid ctx);
        [PreserveSig] int SetChannelVolumeLevelScalar(uint channel, float level, ref Guid ctx);
        [PreserveSig] int GetChannelVolumeLevel(uint channel, out float level);
        [PreserveSig] int GetChannelVolumeLevelScalar(uint channel, out float level);
        [PreserveSig] int SetMute([MarshalAs(UnmanagedType.Bool)] bool mute, ref Guid ctx);
        [PreserveSig] int GetMute([MarshalAs(UnmanagedType.Bool)] out bool mute);
    }

    [ComImport, Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioSessionManager2
    {
        [PreserveSig] int GetAudioSessionControl(IntPtr sessionGuid, int flags, out IntPtr session);
        [PreserveSig] int GetSimpleAudioVolume(IntPtr sessionGuid, int flags, out IntPtr volume);
        [PreserveSig] int GetSessionEnumerator(out IAudioSessionEnumerator sessionEnum);
        [PreserveSig] int RegisterSessionNotification(IntPtr notify);
        [PreserveSig] int UnregisterSessionNotification(IntPtr notify);
        [PreserveSig] int RegisterDuckNotification([MarshalAs(UnmanagedType.LPWStr)] string sessionId, IntPtr notify);
        [PreserveSig] int UnregisterDuckNotification(IntPtr notify);
    }

    [ComImport, Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioSessionEnumerator
    {
        [PreserveSig] int GetCount(out int count);
        [PreserveSig] int GetSession(int index, out IAudioSessionControl2 session);
    }

    [ComImport, Guid("BFB7FF88-7239-4FC9-8FA2-07C950BE9C6D"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioSessionControl2
    {
        [PreserveSig] int GetState(out int state);
        [PreserveSig] int GetDisplayName([MarshalAs(UnmanagedType.LPWStr)] out string name);
        [PreserveSig] int SetDisplayName([MarshalAs(UnmanagedType.LPWStr)] string name, ref Guid ctx);
        [PreserveSig] int GetIconPath([MarshalAs(UnmanagedType.LPWStr)] out string path);
        [PreserveSig] int SetIconPath([MarshalAs(UnmanagedType.LPWStr)] string path, ref Guid ctx);
        [PreserveSig] int GetGroupingParam(out Guid grouping);
        [PreserveSig] int SetGroupingParam(ref Guid grouping, ref Guid ctx);
        [PreserveSig] int RegisterAudioSessionNotification(IntPtr notify);
        [PreserveSig] int UnregisterAudioSessionNotification(IntPtr notify);
        [PreserveSig] int GetSessionIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string id);
        [PreserveSig] int GetSessionInstanceIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string id);
        [PreserveSig] int GetProcessId(out uint pid);
        [PreserveSig] int IsSystemSoundsSession();
        [PreserveSig] int SetDuckingPreference([MarshalAs(UnmanagedType.Bool)] bool optOut);
    }

    [ComImport, Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface ISimpleAudioVolume
    {
        [PreserveSig] int SetMasterVolume(float level, ref Guid ctx);
        [PreserveSig] int GetMasterVolume(out float level);
        [PreserveSig] int SetMute([MarshalAs(UnmanagedType.Bool)] bool mute, ref Guid ctx);
        [PreserveSig] int GetMute([MarshalAs(UnmanagedType.Bool)] out bool mute);
    }

    class Dev
    {
        public string Id; public string Name; public uint Form; public bool Def; public IMMDevice Obj;
    }

    class Ses
    {
        public string App; public int Pid; public int State; public ISimpleAudioVolume Vol;
    }

    public static class CoraAudio
    {
        const int CLSCTX_ALL = 23;
        static Guid NoCtx = Guid.Empty;

        [DllImport("ole32.dll")]
        static extern int PropVariantClear(ref PropVariant pv);

        static IMMDeviceEnumerator Enumerador()
        {
            return (IMMDeviceEnumerator)new MMDeviceEnumeratorCom();
        }

        static string Esc(string s)
        {
            if (s == null) return "";
            StringBuilder b = new StringBuilder();
            foreach (char c in s)
            {
                if (c == '"') b.Append("\\\"");
                else if (c == '\\') b.Append("\\\\");
                else if (c < 32 || c > 126) b.Append("\\u").Append(((int)c).ToString("x4"));
                else b.Append(c);
            }
            return b.ToString();
        }

        static string Bool(bool v) { return v ? "true" : "false"; }

        static string LeerTexto(IPropertyStore st, Guid fmt, uint pid)
        {
            PropertyKey k = new PropertyKey(); k.fmtid = fmt; k.pid = pid;
            PropVariant pv;
            if (st.GetValue(ref k, out pv) != 0) return "";
            string r = "";
            if (pv.vt == 31 && pv.ptr != IntPtr.Zero) r = Marshal.PtrToStringUni(pv.ptr);
            PropVariantClear(ref pv);
            return r ?? "";
        }

        static uint LeerNumero(IPropertyStore st, Guid fmt, uint pid)
        {
            PropertyKey k = new PropertyKey(); k.fmtid = fmt; k.pid = pid;
            PropVariant pv;
            if (st.GetValue(ref k, out pv) != 0) return 10;
            uint r = 10;
            if (pv.vt == 19) r = pv.u32;
            PropVariantClear(ref pv);
            return r;
        }

        static string IdPredeterminado(IMMDeviceEnumerator en, int flow)
        {
            IMMDevice d;
            if (en.GetDefaultAudioEndpoint(flow, 0, out d) != 0 || d == null) return "";
            string id;
            if (d.GetId(out id) != 0) return "";
            return id ?? "";
        }

        static List<Dev> Lista(int flow)
        {
            List<Dev> res = new List<Dev>();
            IMMDeviceEnumerator en = Enumerador();
            IMMDeviceCollection col;
            if (en.EnumAudioEndpoints(flow, 1, out col) != 0 || col == null) return res;
            uint n; col.GetCount(out n);
            string def = IdPredeterminado(en, flow);
            Guid fnKey = new Guid("a45c254e-df1c-4efd-8020-67d146a850e0");
            Guid ffKey = new Guid("1da5d803-d492-4edd-8c23-e0c0ffee7f0e");
            for (uint i = 0; i < n; i++)
            {
                IMMDevice d;
                if (col.Item(i, out d) != 0 || d == null) continue;
                Dev dev = new Dev();
                string id; d.GetId(out id); dev.Id = id ?? "";
                IPropertyStore st;
                if (d.OpenPropertyStore(0, out st) == 0 && st != null)
                {
                    dev.Name = LeerTexto(st, fnKey, 14);
                    dev.Form = LeerNumero(st, ffKey, 0);
                }
                else { dev.Name = ""; dev.Form = 10; }
                dev.Def = (dev.Id == def);
                dev.Obj = d;
                res.Add(dev);
            }
            return res;
        }

        static IAudioEndpointVolume VolumenDe(IMMDevice d)
        {
            object o;
            Guid iid = new Guid("5CDF2C82-841E-4546-9722-0CF74078229A");
            if (d.Activate(ref iid, CLSCTX_ALL, IntPtr.Zero, out o) != 0 || o == null) return null;
            return (IAudioEndpointVolume)o;
        }

        static List<Ses> Sesiones()
        {
            List<Ses> res = new List<Ses>();
            IMMDeviceEnumerator en = Enumerador();
            IMMDevice d;
            if (en.GetDefaultAudioEndpoint(0, 0, out d) != 0 || d == null) return res;
            object o;
            Guid iid = new Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F");
            if (d.Activate(ref iid, CLSCTX_ALL, IntPtr.Zero, out o) != 0 || o == null) return res;
            IAudioSessionManager2 mgr = (IAudioSessionManager2)o;
            IAudioSessionEnumerator se;
            if (mgr.GetSessionEnumerator(out se) != 0 || se == null) return res;
            int n; se.GetCount(out n);
            for (int i = 0; i < n; i++)
            {
                IAudioSessionControl2 c;
                if (se.GetSession(i, out c) != 0 || c == null) continue;
                if (c.IsSystemSoundsSession() == 0) continue;
                int state; c.GetState(out state);
                if (state == 2) continue;
                uint pid; c.GetProcessId(out pid);
                string app = "";
                try { app = Process.GetProcessById((int)pid).ProcessName; } catch (Exception) { }
                if (app.Length == 0) continue;
                ISimpleAudioVolume v = c as ISimpleAudioVolume;
                if (v == null) continue;
                Ses s = new Ses(); s.App = app; s.Pid = (int)pid; s.State = state; s.Vol = v;
                res.Add(s);
            }
            return res;
        }

        static int Pct(float f) { return (int)Math.Round(f * 100.0f); }
        static float Limita(int v) { if (v < 0) v = 0; if (v > 100) v = 100; return v / 100.0f; }

        static string JsonDispositivos(List<Dev> lista)
        {
            StringBuilder b = new StringBuilder("[");
            bool primero = true;
            foreach (Dev d in lista)
            {
                IAudioEndpointVolume v = VolumenDe(d.Obj);
                float vol = 0; bool mute = false;
                if (v != null) { v.GetMasterVolumeLevelScalar(out vol); v.GetMute(out mute); }
                if (!primero) b.Append(",");
                primero = false;
                b.Append("{\"id\":\"").Append(Esc(d.Id)).Append("\",\"nombre\":\"").Append(Esc(d.Name))
                 .Append("\",\"forma\":").Append(d.Form.ToString(CultureInfo.InvariantCulture))
                 .Append(",\"activo\":").Append(Bool(d.Def))
                 .Append(",\"volumen\":").Append(Pct(vol).ToString(CultureInfo.InvariantCulture))
                 .Append(",\"silenciado\":").Append(Bool(mute)).Append("}");
            }
            return b.Append("]").ToString();
        }

        static string JsonApps(List<Ses> ses)
        {
            Dictionary<string, int> idx = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            List<string> nombres = new List<string>();
            List<int> vol = new List<int>(), cuenta = new List<int>();
            List<bool> mute = new List<bool>(), suena = new List<bool>();
            foreach (Ses s in ses)
            {
                float f = 0; bool m = false; s.Vol.GetMasterVolume(out f); s.Vol.GetMute(out m);
                int i;
                if (!idx.TryGetValue(s.App, out i))
                {
                    idx[s.App] = nombres.Count; nombres.Add(s.App);
                    vol.Add(Pct(f)); cuenta.Add(1); mute.Add(m); suena.Add(s.State == 1);
                }
                else
                {
                    cuenta[i] = cuenta[i] + 1; mute[i] = mute[i] && m; suena[i] = suena[i] || s.State == 1;
                    if (Pct(f) > vol[i]) vol[i] = Pct(f);
                }
            }
            StringBuilder b = new StringBuilder("[");
            for (int k = 0; k < nombres.Count; k++)
            {
                if (k > 0) b.Append(",");
                b.Append("{\"app\":\"").Append(Esc(nombres[k])).Append("\",\"volumen\":").Append(vol[k].ToString(CultureInfo.InvariantCulture))
                 .Append(",\"silenciado\":").Append(Bool(mute[k])).Append(",\"sonando\":").Append(Bool(suena[k]))
                 .Append(",\"sesiones\":").Append(cuenta[k].ToString(CultureInfo.InvariantCulture)).Append("}");
            }
            return b.Append("]").ToString();
        }

        public static string Estado()
        {
            try
            {
                return "{\"ok\":true,\"salida\":" + JsonDispositivos(Lista(0)) + ",\"entrada\":" + JsonDispositivos(Lista(1)) + ",\"apps\":" + JsonApps(Sesiones()) + "}";
            }
            catch (Exception e) { return "{\"ok\":false,\"error\":\"" + Esc(e.Message) + "\"}"; }
        }

        static string Error(string msg) { return "{\"ok\":false,\"error\":\"" + Esc(msg) + "\"}"; }

        // flujo: "salida" | "entrada"; id vacio = dispositivo predeterminado
        // accion: establecer | subir | bajar | silenciar | activar_sonido | alternar
        public static string Dispositivo(string flujo, string id, string accion, int valor)
        {
            try
            {
                int flow = (flujo == "entrada") ? 1 : 0;
                IMMDevice dev = null; string nombre = ""; string devId = "";
                List<Dev> lista = Lista(flow);
                foreach (Dev d in lista)
                {
                    if ((id == null || id.Length == 0) ? d.Def : (d.Id == id)) { dev = d.Obj; nombre = d.Name; devId = d.Id; break; }
                }
                if (dev == null) return Error("No encontre ese dispositivo (puede estar desconectado).");
                IAudioEndpointVolume v = VolumenDe(dev);
                if (v == null) return Error("Ese dispositivo no permite controlar el volumen.");
                float actual; bool mute;
                v.GetMasterVolumeLevelScalar(out actual); v.GetMute(out mute);
                int pct = Pct(actual);
                Guid ctx = NoCtx;
                int r = 0;
                switch (accion)
                {
                    case "establecer": r = v.SetMasterVolumeLevelScalar(Limita(valor), ref ctx); if (valor > 0) v.SetMute(false, ref ctx); break;
                    case "subir": r = v.SetMasterVolumeLevelScalar(Limita(pct + valor), ref ctx); v.SetMute(false, ref ctx); break;
                    case "bajar": r = v.SetMasterVolumeLevelScalar(Limita(pct - valor), ref ctx); break;
                    case "silenciar": r = v.SetMute(true, ref ctx); break;
                    case "activar_sonido": r = v.SetMute(false, ref ctx); break;
                    case "alternar": r = v.SetMute(!mute, ref ctx); break;
                    default: return Error("Accion no permitida.");
                }
                if (r != 0) return Error("Windows no acepto el cambio (codigo " + r.ToString(CultureInfo.InvariantCulture) + ").");
                v.GetMasterVolumeLevelScalar(out actual); v.GetMute(out mute);
                return "{\"ok\":true,\"id\":\"" + Esc(devId) + "\",\"nombre\":\"" + Esc(nombre) + "\",\"volumen\":" + Pct(actual).ToString(CultureInfo.InvariantCulture) + ",\"silenciado\":" + Bool(mute) + "}";
            }
            catch (Exception e) { return Error(e.Message); }
        }

        // Volumen de una aplicacion (sesiones de audio del dispositivo de salida activo)
        public static string Aplicacion(string nombre, string accion, int valor)
        {
            try
            {
                List<Ses> todas = Sesiones();
                List<Ses> sel = new List<Ses>();
                foreach (Ses s in todas) if (string.Equals(s.App, nombre, StringComparison.OrdinalIgnoreCase)) sel.Add(s);
                if (sel.Count == 0)
                {
                    Dictionary<string, bool> parecidas = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);
                    foreach (Ses s in todas) if (s.App.IndexOf(nombre, StringComparison.OrdinalIgnoreCase) >= 0 || nombre.IndexOf(s.App, StringComparison.OrdinalIgnoreCase) >= 0) parecidas[s.App] = true;
                    if (parecidas.Count == 1) { foreach (string p in parecidas.Keys) nombre = p; foreach (Ses s in todas) if (string.Equals(s.App, nombre, StringComparison.OrdinalIgnoreCase)) sel.Add(s); }
                }
                if (sel.Count == 0) return "{\"ok\":false,\"error\":\"No encontre esa aplicacion con sonido. Solo aparecen las que estan sonando o sonaron hace poco.\",\"apps\":" + JsonApps(todas) + "}";
                Guid ctx = NoCtx;
                bool todasMute = true;
                foreach (Ses s in sel) { bool m; s.Vol.GetMute(out m); if (!m) todasMute = false; }
                foreach (Ses s in sel)
                {
                    switch (accion)
                    {
                        case "establecer": s.Vol.SetMasterVolume(Limita(valor), ref ctx); if (valor > 0) s.Vol.SetMute(false, ref ctx); break;
                        case "subir": { float f; s.Vol.GetMasterVolume(out f); s.Vol.SetMasterVolume(Limita(Pct(f) + valor), ref ctx); s.Vol.SetMute(false, ref ctx); break; }
                        case "bajar": { float f; s.Vol.GetMasterVolume(out f); s.Vol.SetMasterVolume(Limita(Pct(f) - valor), ref ctx); break; }
                        case "silenciar": s.Vol.SetMute(true, ref ctx); break;
                        case "activar_sonido": s.Vol.SetMute(false, ref ctx); break;
                        case "alternar": s.Vol.SetMute(!todasMute, ref ctx); break;
                        default: return Error("Accion no permitida.");
                    }
                }
                float nf = 0; bool nm = true;
                foreach (Ses s in sel) { float f; bool m; s.Vol.GetMasterVolume(out f); s.Vol.GetMute(out m); if (f > nf) nf = f; if (!m) nm = false; }
                return "{\"ok\":true,\"app\":\"" + Esc(sel[0].App) + "\",\"volumen\":" + Pct(nf).ToString(CultureInfo.InvariantCulture) + ",\"silenciado\":" + Bool(nm) + ",\"sesiones\":" + sel.Count.ToString(CultureInfo.InvariantCulture) + "}";
            }
            catch (Exception e) { return Error(e.Message); }
        }
    }
}

namespace Cora
{
    class Win { public IntPtr H; public string App; public string Titulo; public string Estado; }

    public static class CoraVentanas
    {
        delegate bool EnumProc(IntPtr h, IntPtr l);
        [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr l);
        [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
        [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
        [DllImport("user32.dll")] static extern bool IsZoomed(IntPtr h);
        [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int cmd);
        [DllImport("user32.dll")] static extern bool PostMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
        [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder sb, int max);
        [DllImport("user32.dll")] static extern int GetWindowTextLength(IntPtr h);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder sb, int max);
        [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
        [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h, uint cmd);
        [DllImport("user32.dll", EntryPoint = "GetWindowLongW")] static extern int GetWindowLong(IntPtr h, int idx);
        [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int attr, out int val, int size);

        static string Esc(string s)
        {
            if (s == null) return "";
            StringBuilder b = new StringBuilder();
            foreach (char c in s)
            {
                if (c == '"') b.Append("\\\"");
                else if (c == '\\') b.Append("\\\\");
                else if (c < 32 || c > 126) b.Append("\\u").Append(((int)c).ToString("x4"));
                else b.Append(c);
            }
            return b.ToString();
        }

        static string Error(string msg) { return "{\"ok\":false,\"error\":\"" + Esc(msg) + "\"}"; }

        static string EstadoDe(IntPtr h)
        {
            if (IsIconic(h)) return "minimizada";
            if (IsZoomed(h)) return "maximizada";
            return "normal";
        }

        // Ventanas "normales" de aplicaciones, de arriba hacia abajo (orden de pantalla)
        static List<Win> Lista()
        {
            List<Win> res = new List<Win>();
            EnumProc cb = delegate (IntPtr h, IntPtr l)
            {
                if (!IsWindowVisible(h)) return true;
                if (GetWindow(h, 4) != IntPtr.Zero) return true;
                if ((GetWindowLong(h, -20) & 0x80) != 0) return true;
                int cloaked;
                if (DwmGetWindowAttribute(h, 14, out cloaked, 4) == 0 && cloaked != 0) return true;
                int len = GetWindowTextLength(h);
                if (len == 0) return true;
                StringBuilder t = new StringBuilder(len + 1);
                GetWindowText(h, t, t.Capacity);
                StringBuilder c = new StringBuilder(64);
                GetClassName(h, c, 64);
                string cls = c.ToString();
                if (cls == "Shell_TrayWnd" || cls == "Shell_SecondaryTrayWnd" || cls == "Progman" || cls == "WorkerW") return true;
                uint pid; GetWindowThreadProcessId(h, out pid);
                string app = "";
                try { app = Process.GetProcessById((int)pid).ProcessName; } catch (Exception) { }
                if (app.Length == 0) return true;
                Win w = new Win(); w.H = h; w.App = app; w.Titulo = t.ToString(); w.Estado = EstadoDe(h);
                res.Add(w);
                return true;
            };
            EnumWindows(cb, IntPtr.Zero);
            GC.KeepAlive(cb);
            return res;
        }

        static string JsonLista(List<Win> l)
        {
            StringBuilder b = new StringBuilder("[");
            int n = 0;
            foreach (Win w in l)
            {
                if (n >= 25) break;
                if (n > 0) b.Append(",");
                string t = w.Titulo.Length > 60 ? w.Titulo.Substring(0, 60) : w.Titulo;
                b.Append("{\"app\":\"").Append(Esc(w.App)).Append("\",\"titulo\":\"").Append(Esc(t)).Append("\",\"estado\":\"").Append(w.Estado).Append("\"}");
                n++;
            }
            return b.Append("]").ToString();
        }

        static void MostrarEscritorio(string metodo)
        {
            Type t = Type.GetTypeFromProgID("Shell.Application");
            object sh = Activator.CreateInstance(t);
            t.InvokeMember(metodo, System.Reflection.BindingFlags.InvokeMethod, null, sh, null);
        }

        // accion: listar | maximizar | minimizar | restaurar | minimizar_todas | restaurar_todas
        public static string Ventana(string nombre, string accion)
        {
            try
            {
                if (accion == "minimizar_todas") { MostrarEscritorio("MinimizeAll"); return "{\"ok\":true,\"todas\":true,\"estado\":\"minimizadas\"}"; }
                if (accion == "restaurar_todas") { MostrarEscritorio("UndoMinimizeAll"); return "{\"ok\":true,\"todas\":true,\"estado\":\"restauradas\"}"; }
                List<Win> todas = Lista();
                if (accion == "listar") return "{\"ok\":true,\"ventanas\":" + JsonLista(todas) + "}";
                if (accion == "cerrar")
                {
                    if (nombre == null || nombre.Length == 0) return Error("Falta el nombre de la aplicacion.");
                    List<Win> aCerrar = new List<Win>();
                    foreach (Win w in todas) if (string.Equals(w.App, nombre, StringComparison.OrdinalIgnoreCase)) aCerrar.Add(w);
                    if (aCerrar.Count == 0)
                    {
                        Dictionary<string, bool> coinc = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);
                        foreach (Win w in todas)
                            if (w.App.IndexOf(nombre, StringComparison.OrdinalIgnoreCase) >= 0 || w.Titulo.IndexOf(nombre, StringComparison.OrdinalIgnoreCase) >= 0) coinc[w.App] = true;
                        if (coinc.Count > 1)
                        {
                            StringBuilder cc = new StringBuilder();
                            foreach (string a in coinc.Keys) { if (cc.Length > 0) cc.Append(", "); cc.Append(a); }
                            return Error("Hay varias aplicaciones que coinciden (" + cc.ToString() + "). Dime cual.");
                        }
                        if (coinc.Count == 1)
                        {
                            string unica2 = "";
                            foreach (string a in coinc.Keys) unica2 = a;
                            foreach (Win w in todas) if (string.Equals(w.App, unica2, StringComparison.OrdinalIgnoreCase)) aCerrar.Add(w);
                        }
                    }
                    if (aCerrar.Count == 0) return "{\"ok\":false,\"error\":\"No encontre una ventana abierta de esa aplicacion.\",\"ventanas\":" + JsonLista(todas) + "}";
                    string nombreApp = aCerrar[0].App;
                    string bajo = nombreApp.ToLowerInvariant();
                    if (bajo == "cora-ia" || bajo == "cora ia" || bajo == "electron" || bajo == "dwm" || bajo == "winlogon" || bajo == "csrss" || bajo == "searchhost" || bajo == "startmenuexperiencehost" || bajo == "shellexperiencehost")
                        return Error("Esa ventana no se puede cerrar desde CORA-IA (es CORA-IA misma o una parte de Windows).");
                    foreach (Win w in aCerrar) PostMessage(w.H, 0x0010, IntPtr.Zero, IntPtr.Zero);
                    System.Threading.Thread.Sleep(2000);
                    int quedan = 0;
                    foreach (Win w in Lista()) if (string.Equals(w.App, nombreApp, StringComparison.OrdinalIgnoreCase)) quedan++;
                    return "{\"ok\":true,\"cerrar\":true,\"app\":\"" + Esc(nombreApp) + "\",\"cerradas\":" + aCerrar.Count.ToString() + ",\"quedan\":" + quedan.ToString() + "}";
                }
                int cmd;
                if (accion == "maximizar") cmd = 3; else if (accion == "minimizar") cmd = 6; else if (accion == "restaurar") cmd = 9; else return Error("Accion no permitida.");
                if (nombre == null || nombre.Length == 0) return Error("Falta el nombre de la aplicacion.");
                List<Win> sel = new List<Win>();
                foreach (Win w in todas) if (string.Equals(w.App, nombre, StringComparison.OrdinalIgnoreCase)) sel.Add(w);
                if (sel.Count == 0)
                {
                    Dictionary<string, bool> apps = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);
                    foreach (Win w in todas)
                        if (w.App.IndexOf(nombre, StringComparison.OrdinalIgnoreCase) >= 0 || w.Titulo.IndexOf(nombre, StringComparison.OrdinalIgnoreCase) >= 0) apps[w.App] = true;
                    if (apps.Count > 1)
                    {
                        StringBuilder c = new StringBuilder();
                        foreach (string a in apps.Keys) { if (c.Length > 0) c.Append(", "); c.Append(a); }
                        return Error("Hay varias aplicaciones que coinciden (" + c.ToString() + "). Dime cual.");
                    }
                    if (apps.Count == 1)
                    {
                        string unica = "";
                        foreach (string a in apps.Keys) unica = a;
                        foreach (Win w in todas) if (string.Equals(w.App, unica, StringComparison.OrdinalIgnoreCase)) sel.Add(w);
                    }
                }
                if (sel.Count == 0) return "{\"ok\":false,\"error\":\"No encontre una ventana abierta de esa aplicacion.\",\"ventanas\":" + JsonLista(todas) + "}";
                List<Win> objetivo = new List<Win>();
                if (accion == "minimizar") objetivo = sel; else objetivo.Add(sel[0]);
                foreach (Win w in objetivo) ShowWindow(w.H, cmd);
                System.Threading.Thread.Sleep(250);
                if (accion != "minimizar") SetForegroundWindow(objetivo[0].H);
                string esperado = (accion == "maximizar") ? "maximizada" : (accion == "minimizar") ? "minimizada" : "normal";
                string real = EstadoDe(objetivo[0].H);
                bool logrado = (real == esperado);
                if (accion == "restaurar" && real == "maximizada") logrado = true;
                if (!logrado) return Error("Windows no dejo cambiar esa ventana (puede ser una aplicacion con permisos de administrador). Estado actual: " + real + ".");
                return "{\"ok\":true,\"app\":\"" + Esc(objetivo[0].App) + "\",\"titulo\":\"" + Esc(objetivo[0].Titulo.Length > 60 ? objetivo[0].Titulo.Substring(0, 60) : objetivo[0].Titulo) + "\",\"estado\":\"" + real + "\",\"cantidad\":" + objetivo.Count.ToString(CultureInfo.InvariantCulture) + "}";
            }
            catch (Exception e) { return Error(e.Message); }
        }
    }
}
`;

const SCRIPT_PS = String.raw`$ErrorActionPreference = 'Stop'
try {
  if ($env:CORA_OP -eq 'compilar') {
    Add-Type -TypeDefinition ([IO.File]::ReadAllText($env:CORA_SRC)) -OutputAssembly $env:CORA_DLL -OutputType Library -Language CSharp
    [Console]::Out.Write('{"ok":true}')
    exit 0
  }
  Add-Type -Path $env:CORA_DLL
  switch ($env:CORA_OP) {
    'estado'      { $r = [Cora.CoraAudio]::Estado() }
    'dispositivo' { $r = [Cora.CoraAudio]::Dispositivo($env:CORA_FLUJO, $env:CORA_ID, $env:CORA_ACCION, [int]$env:CORA_VALOR) }
    'aplicacion'  { $r = [Cora.CoraAudio]::Aplicacion($env:CORA_APP, $env:CORA_ACCION, [int]$env:CORA_VALOR) }
    'ventana'     { $r = [Cora.CoraVentanas]::Ventana($env:CORA_APP, $env:CORA_ACCION) }
    default       { $r = '{"ok":false,"error":"operacion desconocida"}' }
  }
  [Console]::Out.Write($r)
} catch {
  $m = ($_.Exception.Message -replace '[^\x20-\x7E]', '?') -replace '"', "'"
  [Console]::Out.Write('{"ok":false,"error":"' + $m + '"}')
}
`;

const ACCIONES = ['establecer', 'subir', 'bajar', 'silenciar', 'activar_sonido', 'alternar'];

// ---------- Ejecución de PowerShell (una a la vez) ----------
let datos = null, runner = null, preparado = null, cola = Promise.resolve();
function carpeta() {
  if (datos) return datos;
  let base;
  try { base = require('electron').app.getPath('userData'); } catch { base = path.join(os.tmpdir(), 'cora-ia'); }
  const hash = crypto.createHash('sha1').update(FUENTE_CS + SCRIPT_PS).digest('hex').slice(0, 10);
  const dir = path.join(base, 'sistema');
  fs.mkdirSync(dir, { recursive: true });
  datos = { dir, hash, src: path.join(dir, `audio-${hash}.cs`), dll: path.join(dir, `audio-${hash}.dll`), ps1: path.join(dir, `run-${hash}.ps1`) };
  fs.writeFileSync(datos.src, FUENTE_CS, 'utf8');
  fs.writeFileSync(datos.ps1, '\ufeff' + SCRIPT_PS, 'utf8'); // con BOM: PowerShell 5 lee bien el archivo
  return datos;
}
function ejecutarPS(env, timeout) {
  const d = carpeta();
  return new Promise((resolve) => {
    execFile(PS_EXE, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', d.ps1],
      { env: { ...process.env, CORA_SRC: d.src, CORA_DLL: d.dll, ...env }, windowsHide: true, timeout: timeout || 25000, maxBuffer: 1 << 20, encoding: 'utf8' },
      (err, stdout, stderr) => resolve({ err, out: String(stdout || '').replace(/^\ufeff/, '').trim(), errTxt: String(stderr || '').trim() }));
  });
}
async function asegurarModulo() {
  const d = carpeta();
  if (fs.existsSync(d.dll)) return null;
  const r = await ejecutarPS({ CORA_OP: 'compilar' }, 60000);
  if (fs.existsSync(d.dll)) return null;
  let motivo = ''; try { motivo = JSON.parse(r.out).error; } catch {}
  return 'No pude preparar el módulo de audio de Windows' + (motivo || r.errTxt || (r.err && r.err.message) ? ': ' + String(motivo || r.errTxt || r.err.message).slice(0, 160) : '') + '.';
}
// Devuelve el objeto JSON que respondió el módulo, o { ok:false, error }
function llamar(env) {
  const tarea = async () => {
    if (process.platform !== 'win32' && !runner) return { ok: false, error: 'Esta función solo está disponible en Windows.' };
    if (runner) return runner(env);
    if (!preparado) preparado = asegurarModulo();
    const fallo = await preparado;
    if (fallo) { preparado = null; return { ok: false, error: fallo }; }
    const r = await ejecutarPS(env);
    try { return JSON.parse(r.out); } catch { return { ok: false, error: 'Windows no respondió como se esperaba' + (r.err && r.err.killed ? ' (tardó demasiado)' : '') + '.' }; }
  };
  const p = cola.then(tarea, tarea);
  cola = p.catch(() => {});
  return p;
}

// ---------- Etiquetas sin marcas ni modelos ----------
// forma: 1 altavoces, 2 línea, 3 audífonos, 4 micrófono, 5 auricular con micrófono, 8 digital, 9 pantalla/TV
function etiqueta(nombre, forma, flujo) {
  const n = String(nombre || '');
  const inal = /bluetooth|hands-?free|wireless|inal[aá]mbric|airpods|buds/i.test(n);
  if (flujo === 'entrada') {
    if (forma === 5 || forma === 3 || inal) return inal ? 'Micrófono de audífonos inalámbricos' : 'Micrófono de audífonos';
    if (/array|internal|interno|integrad/i.test(n)) return 'Micrófono interno';
    if (/usb/i.test(n)) return 'Micrófono USB';
    if (forma === 2) return 'Entrada de línea';
    return 'Micrófono';
  }
  if (forma === 9 || /hdmi|displayport|high definition audio|\btv\b|monitor/i.test(n)) return 'Pantalla o TV';
  if (forma === 3 || forma === 5 || inal) return inal ? 'Audífonos inalámbricos' : 'Audífonos';
  if (/usb/i.test(n) || forma === 8 || /external|externo/i.test(n)) return 'Altavoces externos';
  return 'Altavoces internos';
}
let ultimo = { salida: [], entrada: [] }; // claves cortas (salida-1…) -> id real del dispositivo
function numerar(lista, flujo) {
  const cuenta = {}, total = {};
  const base = lista.map((d) => etiqueta(d.nombre, d.forma, flujo));
  base.forEach((b) => { total[b] = (total[b] || 0) + 1; });
  return lista.map((d, i) => {
    const b = base[i]; cuenta[b] = (cuenta[b] || 0) + 1;
    return { key: `${flujo}-${i + 1}`, id: d.id, etiqueta: total[b] > 1 ? `${b} ${cuenta[b]}` : b, tecnico: d.nombre, activo: !!d.activo, volumen: d.volumen, silenciado: !!d.silenciado };
  });
}
function parsePlanes(txt) {
  const out = [];
  for (const l of String(txt || '').split(/\r?\n/)) {
    const m = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s+\((.+?)\)\s*(\*)?\s*$/i.exec(l.trim());
    if (m) out.push({ guid: m[1].toLowerCase(), nombre: m[2], activo: !!m[3] });
  }
  return out;
}
function leerPlanes() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve([]);
    execFile(POWERCFG, ['/list'], { windowsHide: true, timeout: 8000, encoding: 'utf8' }, (err, out) => resolve(err ? [] : parsePlanes(out)));
  });
}
const estadoVol = (o) => `volumen ${o.volumen}%${o.silenciado ? ', SILENCIADO' : ''}`;
function formatearEstado(est, planes) {
  const fila = (d) => `- ${d.key} · ${d.etiqueta}${d.activo ? ' · ACTIVO (el que se usa ahora)' : ''} · ${estadoVol(d)} [detalle técnico, no lo menciones salvo que te lo pidan: ${d.tecnico}]`;
  const t = [];
  t.push('SALIDAS DE SONIDO:' + (ultimo.salida.length ? '\n' + ultimo.salida.map(fila).join('\n') : ' ninguna activa'));
  t.push('ENTRADAS (micrófonos):' + (ultimo.entrada.length ? '\n' + ultimo.entrada.map(fila).join('\n') : ' ninguna activa'));
  t.push('APLICACIONES CON SONIDO (en la salida activa):' + (est.apps && est.apps.length ? '\n' + est.apps.map((a) => `- ${a.app} · volumen ${a.volumen}%${a.silenciado ? ', SILENCIADA' : ''}${a.sonando ? ' · sonando' : ' · en pausa'}`).join('\n') : ' ninguna ahora'));
  if (planes.length) t.push('PLANES DE ENERGÍA (solo lectura por ahora): ' + planes.map((p) => p.nombre + (p.activo ? ' (activo)' : '')).join(', '));
  return t.join('\n');
}

// ---------- API pública (lista cerrada) ----------
async function estado() {
  const r = await llamar({ CORA_OP: 'estado' });
  if (!r || !r.ok) return 'No pude leer el estado del sonido: ' + ((r && r.error) || 'error desconocido') + '.';
  ultimo = { salida: numerar(r.salida || [], 'salida'), entrada: numerar(r.entrada || [], 'entrada') };
  return formatearEstado(r, await leerPlanes());
}
const entero = (v, def) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? n : def; };
function validarAccion(accion, valor) {
  if (!ACCIONES.includes(accion)) return { error: 'Acción no válida. Usa: ' + ACCIONES.join(', ') + '.' };
  let v = 0;
  if (accion === 'establecer') {
    v = entero(valor, NaN);
    if (!Number.isFinite(v) || v < 0 || v > 100) return { error: 'Para establecer el volumen dime un número entre 0 y 100.' };
  } else if (accion === 'subir' || accion === 'bajar') {
    v = entero(valor, 10);
    if (v < 1 || v > 100) return { error: 'El cambio de volumen debe estar entre 1 y 100.' };
  }
  return { valor: v };
}
async function volumen({ donde, dispositivo, accion, valor } = {}) {
  const val = validarAccion(accion, valor);
  if (val.error) return val.error;
  let flujo = donde === 'entrada' ? 'entrada' : 'salida', id = '', etiquetaDisp = '';
  if (dispositivo) {
    const clave = String(dispositivo).trim().toLowerCase();
    if (!/^(salida|entrada)-\d{1,2}$/.test(clave)) return 'Ese dispositivo no es válido: usa una clave de sistema_estado (por ejemplo salida-1).';
    if (!ultimo.salida.length && !ultimo.entrada.length) await estado();
    flujo = clave.startsWith('entrada') ? 'entrada' : 'salida';
    const d = ultimo[flujo].find((x) => x.key === clave);
    if (!d) return 'No encuentro ese dispositivo. Llama primero a sistema_estado para ver los disponibles.';
    id = d.id; etiquetaDisp = d.etiqueta;
  }
  const r = await llamar({ CORA_OP: 'dispositivo', CORA_FLUJO: flujo, CORA_ID: id, CORA_ACCION: accion, CORA_VALOR: String(val.valor) });
  if (!r || !r.ok) return 'No pude hacer el cambio: ' + String((r && r.error) || 'error desconocido').replace(/\.+$/, '') + '.';
  if (!etiquetaDisp) { const prev = (ultimo[flujo] || []).find((x) => x.id === r.id); etiquetaDisp = prev ? prev.etiqueta : (flujo === 'entrada' ? 'El micrófono activo' : 'La salida activa'); }
  return `Hecho. ${etiquetaDisp}: ${r.silenciado ? `silenciado (volumen guardado ${r.volumen}%)` : `con sonido, volumen al ${r.volumen}%`}. (Es lo que Windows reporta tras el cambio.)`;
}
async function app({ app: nombre, accion, valor } = {}) {
  const val = validarAccion(accion, valor);
  if (val.error) return val.error;
  const n = String(nombre || '').trim();
  if (!/^[\p{L}\p{N} ._+\-]{1,60}$/u.test(n)) return 'Dime el nombre de la aplicación, como aparece en sistema_estado.';
  const r = await llamar({ CORA_OP: 'aplicacion', CORA_APP: n, CORA_ACCION: accion, CORA_VALOR: String(val.valor) });
  if (!r || !r.ok) {
    const lista = r && r.apps && r.apps.length ? ' Aplicaciones con sonido ahora: ' + r.apps.map((a) => a.app).join(', ') + '.' : '';
    const noHay = r && /No encontre/i.test(r.error || '');
    return (noHay ? 'No encontré esa aplicación con sonido (solo aparecen las que están sonando o sonaron hace poco).' : 'No pude hacer el cambio: ' + String((r && r.error) || 'error desconocido').replace(/\.+$/, '') + '.') + lista;
  }
  return `Hecho. ${r.app}: ${r.silenciado ? `silenciada (volumen guardado ${r.volumen}%)` : `con sonido, volumen al ${r.volumen}%`}. Solo se cambió esa aplicación; el volumen general sigue igual.`;
}

const ACC_VENTANA = ['listar', 'maximizar', 'minimizar', 'restaurar', 'cerrar', 'minimizar_todas', 'restaurar_todas'];
async function ventana({ app: nombre, accion } = {}) {
  if (!ACC_VENTANA.includes(accion)) return 'Acción de ventana no válida. Usa: ' + ACC_VENTANA.join(', ') + '.';
  const n = String(nombre || '').trim();
  const necesitaApp = ['maximizar', 'minimizar', 'restaurar', 'cerrar'].includes(accion);
  if (necesitaApp && !/^[\p{L}\p{N} ._+\-]{1,60}$/u.test(n)) return 'Dime el nombre de la aplicación (usa la acción listar para verlas).';
  const r = await llamar({ CORA_OP: 'ventana', CORA_APP: necesitaApp ? n : '', CORA_ACCION: accion });
  const lista = (r && r.ventanas && r.ventanas.length) ? r.ventanas.map((v) => `- ${v.app} · «${v.titulo}» · ${v.estado}`).join('\n') : '';
  if (!r || !r.ok) {
    const noHay = r && /No encontre/i.test(r.error || '');
    return (noHay ? 'No encontré una ventana abierta de esa aplicación.' : 'No pude hacer el cambio: ' + String((r && r.error) || 'error desconocido').replace(/\.+$/, '') + '.') + (lista ? ' Ventanas abiertas ahora:\n' + lista : '');
  }
  if (accion === 'listar') return lista ? 'VENTANAS ABIERTAS (de arriba hacia abajo):\n' + lista : 'No veo ventanas abiertas.';
  if (r.cerrar) {
    const q = +r.quedan || 0;
    return `Cerré ${r.cerradas} ventana${r.cerradas === 1 ? '' : 's'} de ${r.app}.` + (q > 0 ? ` Todavía quedan ${q} abiertas: la aplicación puede estar pidiendo confirmar algo (por ejemplo guardar cambios).` : ' Ya no queda ninguna abierta.');
  }
  if (r.todas) return `Hecho. Todas las ventanas quedaron ${r.estado}.`;
  const cant = r.cantidad > 1 ? ` (${r.cantidad} ventanas)` : '';
  return `Hecho. ${r.app}${cant}: ahora ${r.estado}. (Es lo que Windows reporta tras el cambio.)`;
}

module.exports = { estado, volumen, app, ventana, _t: { etiqueta, numerar, parsePlanes, formatearEstado, validarAccion, setRunner: (fn) => { runner = fn; }, reset: () => { ultimo = { salida: [], entrada: [] }; } } };
