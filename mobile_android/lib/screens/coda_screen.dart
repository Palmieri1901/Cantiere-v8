import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../main.dart';
import '../api.dart';

const _chunk = 6;

class CodaScreen extends StatefulWidget {
  const CodaScreen({super.key});
  @override
  State<CodaScreen> createState() => _CodaScreenState();
}

class _CodaScreenState extends State<CodaScreen> {
  bool _busy = false;

  Future<void> _invia() async {
    final da = store.daInviare;
    if (da.isEmpty) return;
    setState(() => _busy = true);
    try {
      final r = await api.inviaLavori(da);
      await store.segnaInviati(da.map((x) => x['client_uid'] as String));
      _msg('Inviati ${r['ricevuti']} lavori al cantiere');
    } catch (e) {
      _msg(e is ApiException ? e.message : 'Invio fallito: controlla la connessione');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _msg(String t) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t)));

  void _mostraQr() {
    final da = store.daInviare;
    final pages = <List<Map<String, dynamic>>>[];
    for (var i = 0; i < da.length; i += _chunk) { pages.add(da.sublist(i, (i + _chunk).clamp(0, da.length))); }
    showDialog(context: context, builder: (_) => _QrDialog(pages: pages, onDone: () async {
      await store.segnaInviati(da.map((x) => x['client_uid'] as String));
      if (mounted) Navigator.pop(context);
    }));
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: store,
      builder: (_, __) {
        final da = store.daInviare;
        return Column(children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(children: [
              Expanded(child: FilledButton.icon(onPressed: da.isEmpty || _busy ? null : _invia, icon: const Icon(Icons.send), label: Text('Invia (${da.length})'))),
              const SizedBox(width: 12),
              Expanded(child: OutlinedButton.icon(onPressed: da.isEmpty ? null : _mostraQr, icon: const Icon(Icons.qr_code), label: const Text('Mostra QR'))),
            ]),
          ),
          Expanded(
            child: store.coda.isEmpty
                ? const Center(child: Text('Nessun lavoro salvato.'))
                : ListView.separated(
                    itemCount: store.coda.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (_, i) {
                      final x = store.coda[i];
                      final inviato = x['inviato'] == true;
                      return ListTile(
                        title: Text(x['cliente_nome'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
                        subtitle: Text('${x['tipo']} — ${x['descrizione']}\n${x['data']} · ${x['ore']} h'),
                        isThreeLine: true,
                        trailing: inviato
                            ? const Icon(Icons.check_circle, color: Colors.green)
                            : IconButton(icon: const Icon(Icons.delete_outline, color: Colors.red), onPressed: () => store.setCoda(store.coda.where((y) => y['client_uid'] != x['client_uid']).toList())),
                      );
                    },
                  ),
          ),
          if (store.coda.any((x) => x['inviato'] == true))
            TextButton(onPressed: () => store.setCoda(da), child: const Text('Rimuovi i lavori già inviati')),
        ]);
      },
    );
  }
}

class _QrDialog extends StatefulWidget {
  final List<List<Map<String, dynamic>>> pages;
  final VoidCallback onDone;
  const _QrDialog({required this.pages, required this.onDone});
  @override
  State<_QrDialog> createState() => _QrDialogState();
}

class _QrDialogState extends State<_QrDialog> {
  int _p = 0;

  String get _value => jsonEncode({
        't': 'pm-lavori', 'd': store.nome, 'p': _p, 'n': widget.pages.length,
        'items': widget.pages[_p].map((x) => {
              for (final k in ['client_uid', 'cliente_id', 'cliente_nome', 'data', 'tipo', 'descrizione', 'ore', 'materiali', 'articoli_magazzino']) k: x[k]
            }).toList(),
      });

  @override
  Widget build(BuildContext context) {
    final n = widget.pages.length;
    return AlertDialog(
      title: const Text('Trasferimento via QR'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        Text('Fai inquadrare il codice dalla webcam del programma (Lavori dal cantiere → Importa da QR).${n > 1 ? ' Sono $n pagine: falle leggere tutte.' : ''}', style: const TextStyle(fontSize: 13)),
        const SizedBox(height: 12),
        Container(color: Colors.white, padding: const EdgeInsets.all(8), child: QrImageView(data: _value, size: 260)),
        if (n > 1)
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            IconButton(onPressed: _p > 0 ? () => setState(() => _p--) : null, icon: const Icon(Icons.chevron_left)),
            Text('Pagina ${_p + 1} / $n'),
            IconButton(onPressed: _p < n - 1 ? () => setState(() => _p++) : null, icon: const Icon(Icons.chevron_right)),
          ]),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Chiudi')),
        FilledButton.icon(onPressed: widget.onDone, icon: const Icon(Icons.check), label: const Text('Fatto, segna come inviati')),
      ],
    );
  }
}
