import 'dart:convert';
import 'package:http/http.dart' as http;
import 'store.dart';

class ApiException implements Exception {
  final int status;
  final String message;
  ApiException(this.status, this.message);
  @override
  String toString() => message;
}

class MobileApi {
  final Store store;
  MobileApi(this.store);

  Uri _u(String path) => Uri.parse('${store.serverUrl}/api/mobile$path');
  Map<String, String> get _h => {'X-Api-Key': store.apiKey, 'Content-Type': 'application/json'};

  dynamic _check(http.Response r) {
    if (r.statusCode == 401) throw ApiException(401, 'Chiave non valida o disattivata');
    if (r.statusCode >= 400) throw ApiException(r.statusCode, 'Errore server ${r.statusCode}');
    return jsonDecode(utf8.decode(r.bodyBytes));
  }

  Future<Map<String, dynamic>> me() async =>
      _check(await http.get(_u('/me'), headers: _h).timeout(const Duration(seconds: 15)));

  Future<List<dynamic>> clienti() async =>
      _check(await http.get(_u('/clienti'), headers: _h).timeout(const Duration(seconds: 30)));

  Future<List<dynamic>> articoli() async =>
      _check(await http.get(_u('/articoli'), headers: _h).timeout(const Duration(seconds: 30)));

  Future<Map<String, dynamic>> inviaLavori(List<Map<String, dynamic>> lavori) async => _check(
        await http.post(_u('/lavori'), headers: _h, body: jsonEncode({'lavori': lavori})).timeout(const Duration(seconds: 30)),
      );
}
