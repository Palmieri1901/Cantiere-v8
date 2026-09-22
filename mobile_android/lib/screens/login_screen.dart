import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../main.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _url = TextEditingController(text: 'https://lavori.genbnautica.it');
  final _key = TextEditingController();
  bool _busy = false;
  bool _scan = false;

  Future<void> _entra(String url, String key) async {
    setState(() => _busy = true);
    try {
      await store.login(key, url, '');
      final me = await api.me();
      await store.login(key, url, me['nome'] ?? '');
    } catch (e) {
      await store.logout();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e is ApiException ? e.message : 'Connessione non riuscita: serve internet per il primo accesso')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _onQr(BarcodeCapture cap) {
    for (final b in cap.barcodes) {
      try {
        final d = jsonDecode(b.rawValue ?? '');
        if (d['t'] == 'pm-key' && d['k'] != null) {
          setState(() => _scan = false);
          _entra(d['u'] ?? _url.text, d['k']);
          return;
        }
      } catch (_) {}
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: _scan
              ? Column(children: [
                  Expanded(child: MobileScanner(onDetect: _onQr)),
                  const SizedBox(height: 12),
                  OutlinedButton(onPressed: () => setState(() => _scan = false), child: const Text('Annulla')),
                ])
              : Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  const Icon(Icons.sailing, size: 56, color: Color(0xFFB0543A)),
                  const SizedBox(height: 12),
                  Text('App dipendenti', style: Theme.of(context).textTheme.headlineMedium),
                  const SizedBox(height: 8),
                  const Text('Inserisci la chiave ricevuta dal cantiere oppure scansiona il QR.', textAlign: TextAlign.center),
                  const SizedBox(height: 24),
                  TextField(controller: _url, decoration: const InputDecoration(labelText: 'Indirizzo programma', border: OutlineInputBorder()), keyboardType: TextInputType.url),
                  const SizedBox(height: 12),
                  TextField(controller: _key, textCapitalization: TextCapitalization.characters, decoration: const InputDecoration(labelText: 'Chiave PM-XXXX-XXXX-XXXX', border: OutlineInputBorder())),
                  const SizedBox(height: 16),
                  FilledButton.icon(onPressed: _busy ? null : () => _entra(_url.text, _key.text), icon: const Icon(Icons.key), label: const Text('Entra')),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(onPressed: () => setState(() => _scan = true), icon: const Icon(Icons.qr_code_scanner), label: const Text('Scansiona QR')),
                ]),
        ),
      ),
    );
  }
}
