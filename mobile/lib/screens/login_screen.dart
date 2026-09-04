import 'package:flutter/material.dart';
import '../services/api_service.dart';
import 'dashboard_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final ApiService _api = ApiService();
  bool _isSearching = false;
  String? _serverIp;

  void _startDiscovery() async {
    setState(() {
      _isSearching = true;
    });

    bool found = await _api.discoverServer();

    if (found) {
      setState(() {
        _serverIp = _api.baseUrl;
        _isSearching = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Connecté au serveur : $_serverIp")),
        );
      }
    } else {
      setState(() {
        _isSearching = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Serveur introuvable. Vérifiez votre Wi-Fi.")),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        padding: const EdgeInsets.all(24),
        width: double.infinity,
        color: const Color(0xFFF8FAFC),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.school, size: 80, color: Colors.blue),
            const SizedBox(height: 24),
            const Text(
              "ODSM Mobile",
              style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            const Text(
              "Recherche automatique du PC central...",
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.blueGrey),
            ),
            const SizedBox(height: 48),
            if (_isSearching)
              const Column(
                children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 16),
                  Text("Scan du réseau en cours..."),
                ],
              )
            else
              Column(
                children: [
                  ElevatedButton.icon(
                    onPressed: _startDiscovery,
                    icon: const Icon(Icons.search),
                    label: const Text("Chercher le Serveur"),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                    ),
                  ),
                  if (_serverIp != null) ...[
                    const SizedBox(height: 24),
                    Text("Connecté à : $_serverIp", style: const TextStyle(color: Colors.green, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (context) => const DashboardScreen()),
                        );
                      },
                      child: const Text("Accéder au Portail"),
                    ),
                  ],
                ],
              ),
            const Spacer(),
            const Text("Mode Hors Ligne Activé", style: TextStyle(fontSize: 12, color: Colors.grey)),
          ],
        ),
      ),
    );
  }
}
