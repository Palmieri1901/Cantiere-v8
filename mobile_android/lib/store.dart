import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Persistenza locale: chiave, server, nome, clienti, articoli e coda lavori.
class Store extends ChangeNotifier {
  late SharedPreferences _p;

  String apiKey = '';
  String serverUrl = '';
  String nome = '';
  List<dynamic> clienti = [];
  List<dynamic> articoli = [];
  List<Map<String, dynamic>> coda = [];

  Future<void> init() async {
    _p = await SharedPreferences.getInstance();
    apiKey = _p.getString('key') ?? '';
    serverUrl = _p.getString('url') ?? '';
    nome = _p.getString('nome') ?? '';
    clienti = jsonDecode(_p.getString('clienti') ?? '[]');
    articoli = jsonDecode(_p.getString('articoli') ?? '[]');
    coda = (jsonDecode(_p.getString('coda') ?? '[]') as List).cast<Map<String, dynamic>>();
    notifyListeners();
  }

  bool get logged => apiKey.isNotEmpty && serverUrl.isNotEmpty;
  List<Map<String, dynamic>> get daInviare => coda.where((x) => x['inviato'] != true).toList();

  Future<void> login(String key, String url, String nomeDip) async {
    apiKey = key.trim().toUpperCase();
    serverUrl = url.trim().replaceAll(RegExp(r'/+$'), '');
    nome = nomeDip;
    await _p.setString('key', apiKey);
    await _p.setString('url', serverUrl);
    await _p.setString('nome', nome);
    notifyListeners();
  }

  Future<void> logout() async {
    apiKey = ''; serverUrl = ''; nome = ''; clienti = []; articoli = [];
    for (final k in ['key', 'url', 'nome', 'clienti', 'articoli']) { await _p.remove(k); }
    notifyListeners();
  }

  Future<void> setDati(List<dynamic> c, List<dynamic> a) async {
    clienti = c; articoli = a;
    await _p.setString('clienti', jsonEncode(c));
    await _p.setString('articoli', jsonEncode(a));
    notifyListeners();
  }

  Future<void> setCoda(List<Map<String, dynamic>> c) async {
    coda = c;
    await _p.setString('coda', jsonEncode(c));
    notifyListeners();
  }

  Future<void> aggiungi(Map<String, dynamic> lavoro) => setCoda([lavoro, ...coda]);

  Future<void> segnaInviati(Iterable<String> uids) => setCoda(coda
      .map((x) => uids.contains(x['client_uid']) ? {...x, 'inviato': true, 'inviato_at': DateTime.now().toIso8601String()} : x)
      .toList());
}
