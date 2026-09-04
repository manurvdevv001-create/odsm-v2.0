import 'package:flutter/material.dart';
import '../models/student.dart';
import '../services/database_service.dart';
import '../services/api_service.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final DatabaseService _db = DatabaseService();
  final ApiService _api = ApiService();
  List<Student> _students = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final students = await _db.getAllStudents();
    setState(() {
      _students = students;
      _isLoading = false;
    });
  }

  Future<void> _syncData() async {
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Synchronisation...")));
    // For demo, we use a fixed matricule or dynamic one from settings
    bool success = await _api.pullData('demo-school'); 
    if (success) {
      await _loadData();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Données synchronisées !")));
      }
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Échec de la synchronisation.")));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("ODSM - Dashboard"),
        actions: [
          IconButton(
            icon: const Icon(Icons.sync),
            onPressed: _syncData,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  color: Colors.blue.shade50,
                  child: Row(
                    children: [
                      const Icon(Icons.info_outline, color: Colors.blue),
                      const SizedBox(width: 8),
                      Text("Total : ${_students.length} élèves chargés localement"),
                    ],
                  ),
                ),
                Expanded(
                  child: ListView.builder(
                    itemCount: _students.length,
                    itemBuilder: (context, index) {
                      final student = _students[index];
                      return ListTile(
                        leading: CircleAvatar(
                          child: Text(student.lastName[0]),
                        ),
                        title: Text(student.fullName),
                        subtitle: Text("${student.gradeName} - ${student.matricule}"),
                        trailing: const Icon(Icons.chevron_right),
                      );
                    },
                  ),
                ),
              ],
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          // Open Registration form
        },
        child: const Icon(Icons.add),
      ),
    );
  }
}
