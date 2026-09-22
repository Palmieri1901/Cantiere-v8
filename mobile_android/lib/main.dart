import 'package:flutter/material.dart';
import 'api.dart';
import 'store.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';

final store = Store();
final api = MobileApi(store);

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await store.init();
  runApp(const PortomareApp());
}

class PortomareApp extends StatelessWidget {
  const PortomareApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Portomare Lavori',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorSchemeSeed: const Color(0xFFB0543A),
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFFFAF7F2),
      ),
      home: AnimatedBuilder(
        animation: store,
        builder: (_, __) => store.logged ? const HomeScreen() : const LoginScreen(),
      ),
    );
  }
}
