import 'dart:convert';
import 'package:http/http.dart' as http;
import 'database_service.dart';
import '../models/student.dart';

class ApiService {
  String? _baseUrl;
  final DatabaseService _db = DatabaseService();

  Future<bool> discoverServer() async {
    // Range 10.222.62.X as specified by the user
    final subnet = "10.222.62";
    
    // Priority check for common IPs or last known
    List<int> ips = [34, 1, 2, 3, 4, 10, 100];
    for (int i = 1; i < 255; i++) {
        if (!ips.contains(i)) ips.add(i);
    }

    for (var i in ips) {
      final ip = "$subnet.$i";
      try {
        final response = await http.get(
          Uri.parse("http://$ip:3000/api/discovery"),
        ).timeout(const Duration(milliseconds: 500));
        
        if (response.statusCode == 200) {
          final data = jsonDecode(response.body);
          if (data['service'] == 'odsm-server') {
            _baseUrl = "http://$ip:3000";
            return true;
          }
        }
      } catch (e) {
        // Skip
      }
    }
    return false;
  }

  Future<bool> pullData(String matricule) async {
    if (_baseUrl == null) return false;

    try {
      final response = await http.get(
        Uri.parse("$_baseUrl/api/sync/pull?matricule=$matricule"),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final List studentsJson = data['students'] ?? [];
        final List<Student> students = studentsJson.map((s) => Student.fromJson(s)).toList();
        
        await _db.insertStudents(students);
        return true;
      }
    } catch (e) {
      print("Pull failed: $e");
    }
    return false;
  }

  String? get baseUrl => _baseUrl;
}
