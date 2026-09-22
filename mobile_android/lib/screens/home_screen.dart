import 'package:flutter/material.dart';
import '../main.dart';
import '../api.dart';
import 'nuovo_lavoro_screen.dart';
import 'coda_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _tab = 0;

  @override
  void initState() {
    super.initState();
    _aggiorna(silent: true);
  }

  Future<void> _aggiorna({bool silent = false}) async {
    try {
      final c = await api.clienti();
      final a = await api.articoli();
      await store.setDati(c, a);
      if (!silent && mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Aggiornati ${c.length} clienti')));
    } catch (e) {
      if (e is ApiException && e.status == 401) await store.logout();
      else if (!silent && mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Impossibile aggiornare: sei offline?')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: store,
      builder: (_, __) {
        final n = store.daInviare.length;
        return Scaffold(
          appBar: AppBar(
            title: Text(store.nome.isEmpty ? 'Portomare' : store.nome),
            actions: [
              IconButton(onPressed: () => _aggiorna(), icon: const Icon(Icons.refresh), tooltip: 'Aggiorna clienti'),
              IconButton(onPressed: store.logout, icon: const Icon(Icons.logout), tooltip: 'Esci'),
            ],
          ),
          body: _tab == 0
              ? NuovoLavoroScreen(onSaved: () => setState(() => _tab = 1))
              : const CodaScreen(),
          bottomNavigationBar: NavigationBar(
            selectedIndex: _tab,
            onDestinationSelected: (i) => setState(() => _tab = i),
            destinations: [
              const NavigationDestination(icon: Icon(Icons.add_circle_outline), label: 'Nuovo lavoro'),
              NavigationDestination(
                icon: Badge(isLabelVisible: n > 0, label: Text('$n'), child: const Icon(Icons.outbox_outlined)),
                label: 'Da inviare',
              ),
            ],
          ),
        );
      },
    );
  }
}
