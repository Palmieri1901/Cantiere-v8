import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:uuid/uuid.dart';
import '../main.dart';

const tipi = ['Riparazione', 'Manutenzione motore', 'Antivegetativa', 'Pulizia', 'Elettrico', 'Altro'];

class NuovoLavoroScreen extends StatefulWidget {
  final VoidCallback onSaved;
  const NuovoLavoroScreen({super.key, required this.onSaved});
  @override
  State<NuovoLavoroScreen> createState() => _NuovoLavoroScreenState();
}

class _NuovoLavoroScreenState extends State<NuovoLavoroScreen> {
  Map<String, dynamic>? _cliente;
  DateTime _data = DateTime.now();
  String _tipo = tipi.first;
  final _desc = TextEditingController();
  final _ore = TextEditingController();
  final _mat = TextEditingController();
  final _q = TextEditingController();
  final List<Map<String, dynamic>> _articoli = [];

  List<dynamic> get _filtrati {
    final s = _q.text.trim().toLowerCase();
    if (s.isEmpty) return [];
    return store.clienti.where((c) => '${c['cognome']} ${c['nome']} ${c['tipo_barca'] ?? ''}'.toLowerCase().contains(s)).take(8).toList();
  }

  void _salva() {
    if (_cliente == null) return _msg('Scegli il cliente');
    if (_desc.text.trim().isEmpty) return _msg('Descrivi il lavoro eseguito');
    store.aggiungi({
      'client_uid': const Uuid().v4(),
      'cliente_id': _cliente!['id'],
      'cliente_nome': '${_cliente!['cognome']} ${_cliente!['nome']}',
      'data': DateFormat('yyyy-MM-dd').format(_data),
      'tipo': _tipo,
      'descrizione': _desc.text.trim(),
      'ore': double.tryParse(_ore.text.replaceAll(',', '.')) ?? 0,
      'materiali': _mat.text,
      'articoli_magazzino': _articoli,
      'creato_at': DateTime.now().toIso8601String(),
      'inviato': false,
    });
    setState(() { _cliente = null; _desc.clear(); _ore.clear(); _mat.clear(); _articoli.clear(); _tipo = tipi.first; _data = DateTime.now(); });
    _msg('Lavoro salvato sul telefono');
    widget.onSaved();
  }

  void _msg(String t) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t)));

  @override
  Widget build(BuildContext context) {
    return ListView(padding: const EdgeInsets.all(16), children: [
      const _Label('Cliente'),
      if (_cliente != null)
        ListTile(
          tileColor: const Color(0xFFB0543A).withOpacity(.08),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          title: Text('${_cliente!['cognome']} ${_cliente!['nome']}', style: const TextStyle(fontWeight: FontWeight.w600)),
          subtitle: Text('${_cliente!['tipo_barca'] ?? ''} ${_cliente!['lunghezza'] != null ? '· ${_cliente!['lunghezza']} m' : ''}'),
          trailing: IconButton(icon: const Icon(Icons.close), onPressed: () => setState(() => _cliente = null)),
        )
      else ...[
        TextField(controller: _q, onChanged: (_) => setState(() {}), decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Cerca cognome, nome o barca…', border: OutlineInputBorder())),
        for (final c in _filtrati)
          ListTile(dense: true, title: Text('${c['cognome']} ${c['nome']}'), subtitle: Text(c['tipo_barca'] ?? ''), onTap: () => setState(() { _cliente = c; _q.clear(); })),
        if (store.clienti.isEmpty) const Padding(padding: EdgeInsets.only(top: 6), child: Text('Nessun cliente scaricato: premi aggiorna in alto quando sei online.', style: TextStyle(color: Colors.orange, fontSize: 12))),
      ],
      const SizedBox(height: 16),
      Row(children: [
        Expanded(child: OutlinedButton.icon(
          onPressed: () async { final d = await showDatePicker(context: context, initialDate: _data, firstDate: DateTime(2020), lastDate: DateTime(2100)); if (d != null) setState(() => _data = d); },
          icon: const Icon(Icons.event), label: Text(DateFormat('dd/MM/yyyy').format(_data)))),
        const SizedBox(width: 12),
        Expanded(child: TextField(controller: _ore, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Ore lavoro', border: OutlineInputBorder()))),
      ]),
      const SizedBox(height: 12),
      DropdownButtonFormField<String>(value: _tipo, items: tipi.map((t) => DropdownMenuItem(value: t, child: Text(t))).toList(), onChanged: (v) => setState(() => _tipo = v!), decoration: const InputDecoration(labelText: 'Tipo', border: OutlineInputBorder())),
      const SizedBox(height: 12),
      TextField(controller: _desc, maxLines: 3, decoration: const InputDecoration(labelText: 'Lavoro eseguito', hintText: 'Es. Sostituita pompa sentina, riparazione motore', border: OutlineInputBorder())),
      const SizedBox(height: 12),
      TextField(controller: _mat, decoration: const InputDecoration(labelText: 'Materiali (note)', border: OutlineInputBorder())),
      if (store.articoli.isNotEmpty) ...[
        const SizedBox(height: 16),
        const _Label('Articoli dal magazzino'),
        for (var i = 0; i < _articoli.length; i++)
          Builder(builder: (_) {
            final art = store.articoli.firstWhere((a) => a['id'] == _articoli[i]['articolo_id'], orElse: () => {});
            return ListTile(dense: true, title: Text('${art['codice'] != null && art['codice'] != '' ? '[${art['codice']}] ' : ''}${art['nome'] ?? ''}'),
              trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                SizedBox(width: 60, child: TextFormField(initialValue: '${_articoli[i]['quantita']}', keyboardType: TextInputType.number, textAlign: TextAlign.right, onChanged: (v) => _articoli[i]['quantita'] = double.tryParse(v.replaceAll(',', '.')) ?? 1)),
                IconButton(icon: const Icon(Icons.delete_outline, color: Colors.red), onPressed: () => setState(() => _articoli.removeAt(i))),
              ]));
          }),
        DropdownButtonFormField<String>(
          value: null, hint: const Text('+ Aggiungi articolo'),
          items: store.articoli.map<DropdownMenuItem<String>>((a) => DropdownMenuItem(value: a['id'], child: Text('${a['codice'] != null && a['codice'] != '' ? '[${a['codice']}] ' : ''}${a['nome']}', overflow: TextOverflow.ellipsis))).toList(),
          onChanged: (id) { if (id != null && !_articoli.any((x) => x['articolo_id'] == id)) setState(() => _articoli.add({'articolo_id': id, 'quantita': 1})); },
        ),
      ],
      const SizedBox(height: 24),
      FilledButton.icon(onPressed: _salva, icon: const Icon(Icons.save), label: const Padding(padding: EdgeInsets.all(8), child: Text('Salva lavoro'))),
    ]);
  }
}

class _Label extends StatelessWidget {
  final String t;
  const _Label(this.t);
  @override
  Widget build(BuildContext context) => Padding(padding: const EdgeInsets.only(bottom: 6), child: Text(t.toUpperCase(), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 1, color: Colors.grey)));
}
