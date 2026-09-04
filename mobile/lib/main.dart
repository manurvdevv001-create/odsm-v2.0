import 'package:flutter/material.dart';
import 'screens/login_screen.dart';

void main() {
  runApp(const ODSMMobileApp());
}

class ODSMMobileApp extends StatelessWidget {
  const ODSMMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ODSM Mobile',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue),
        useMaterial3: true,
        fontFamily: 'Poppins',
      ),
      home: const LoginScreen(),
    );
  }
}
