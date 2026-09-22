# App Android nativa — Portomare Lavori (Flutter)

App per i dipendenti: registra i lavori eseguiti (cliente, descrizione, ore, articoli) anche offline
e li invia al programma del cantiere via internet oppure tramite QR code.

## Compilare
1. Installa [Flutter](https://docs.flutter.dev/get-started/install) e Android Studio.
2. In questa cartella:
   ```bash
   flutter create . --platforms=android --org it.genbnautica --project-name portomare_lavori
   flutter pub get
   ```
   (il comando `create` genera le cartelle `android/` mancanti senza toccare `lib/`)
3. Permesso fotocamera: in `android/app/src/main/AndroidManifest.xml` aggiungi
   `<uses-permission android:name="android.permission.CAMERA" />` e `INTERNET`.
4. `flutter build apk --release` → l'APK è in `build/app/outputs/flutter-apk/app-release.apk`.

## Primo accesso
L'amministratore genera la chiave in *Lavori dal cantiere → Dipendenti e chiavi*; il dipendente scansiona il QR
(contiene indirizzo server + chiave) oppure digita indirizzo e chiave.

## Struttura
- `lib/main.dart` — avvio, tema, navigazione
- `lib/api.dart` — chiamate REST `/api/mobile/*` (vedi `docs/API_MOBILE.md`)
- `lib/store.dart` — persistenza locale (chiave, clienti, articoli, coda lavori)
- `lib/screens/` — login, nuovo lavoro, coda/invio, QR
