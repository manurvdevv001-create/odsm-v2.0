class Student {
  final String id;
  final String firstName;
  final String lastName;
  final String? middleName;
  final String matricule;
  final String gradeName;
  final String? classroomName;
  final String gender;
  final String status;

  Student({
    required this.id,
    required this.firstName,
    required this.lastName,
    this.middleName,
    required this.matricule,
    required this.gradeName,
    this.classroomName,
    required this.gender,
    required this.status,
  });

  factory Student.fromJson(Map<String, dynamic> json) {
    return Student(
      id: json['id'],
      firstName: json['firstName'],
      lastName: json['lastName'],
      middleName: json['middleName'],
      matricule: json['matricule'] ?? '',
      gradeName: json['gradeName'] ?? '',
      classroomName: json['classroomName'],
      gender: json['gender'] ?? 'M',
      status: json['status'] ?? 'active',
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'firstName': firstName,
      'lastName': lastName,
      'middleName': middleName,
      'matricule': matricule,
      'gradeName': gradeName,
      'classroomName': classroomName,
      'gender': gender,
      'status': status,
    };
  }

  String get fullName => "$lastName ${middleName ?? ''} $firstName".trim();
}
