import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import '../models/student.dart';

class DatabaseService {
  static final DatabaseService _instance = DatabaseService._internal();
  factory DatabaseService() => _instance;
  DatabaseService._internal();

  static Database? _database;

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDatabase();
    return _database!;
  }

  Future<Database> _initDatabase() async {
    String path = join(await getDatabasesPath(), 'odsm_local.db');
    return await openDatabase(
      path,
      version: 1,
      onCreate: _onCreate,
    );
  }

  Future _onCreate(Database db, int version) async {
    await db.execute('''
      CREATE TABLE students (
        id TEXT PRIMARY KEY,
        firstName TEXT,
        lastName TEXT,
        middleName TEXT,
        matricule TEXT,
        gradeName TEXT,
        classroomName TEXT,
        gender TEXT,
        status TEXT
      )
    ''');

    await db.execute('''
      CREATE TABLE sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT,
        data TEXT,
        timestamp TEXT
      )
    ''');
    
    // Table for local settings like server IP
    await db.execute('''
      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    ''');
  }

  // Student operations
  Future<void> insertStudents(List<Student> students) async {
    final db = await database;
    Batch batch = db.batch();
    for (var student in students) {
      batch.insert('students', student.toMap(), conflictAlgorithm: ConflictAlgorithm.replace);
    }
    await batch.commit(noResult: true);
  }

  Future<List<Student>> getAllStudents() async {
    final db = await database;
    final List<Map<String, dynamic>> maps = await db.query('students');
    return List.generate(maps.length, (i) => Student.fromJson(maps[i]));
  }

  // Queue operations
  Future<void> addToQueue(String type, String jsonData) async {
    final db = await database;
    await db.insert('sync_queue', {
      'type': type,
      'data': jsonData,
      'timestamp': DateTime.now().toIso8601String(),
    });
  }
}
