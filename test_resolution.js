// Mock logic to test resolution
function resolveIds(courseId, classroomId, periodId, existingClassrooms, existingCourses, schoolCourses) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    let solvedClassroomId = classroomId;
    let solvedCourseId = courseId;
    let solvedPeriodId = periodId;

    // 1. Resolve Classroom
    let classroomRecord = existingClassrooms.find(c => c.id === classroomId || c.name === classroomId || c.name.replace(/\s+/g, '-') === classroomId);
    if (classroomRecord) {
        solvedClassroomId = classroomRecord.id;
    }

    // 2. Resolve Course
    let courseSearchName = courseId;
    if (classroomRecord) {
        const classPrefixDash = classroomRecord.name.replace(/\s+/g, '-') + '-';
        const classPrefixSpace = classroomRecord.name + '-';
        
        if (courseId.startsWith(classPrefixDash)) {
            courseSearchName = courseId.slice(classPrefixDash.length);
        } else if (courseId.startsWith(classPrefixSpace)) {
            courseSearchName = courseId.slice(classPrefixSpace.length);
        } else {
            // Fallback split
            const parts = courseId.split('-');
            if (parts.length > 3) {
                // If it looks like [grade]-[level]-[variant], maybe the course is the rest
                // or just try to find a match in the list
            }
        }
    }
    
    // Normalize courseSearchName for comparison (e.g. replace dashes with spaces)
    const normalizedSearch = courseSearchName.replace(/-/g, ' ').toLowerCase().trim();

    let courseRecord = existingCourses.find(c => 
        c.id === courseId || 
        c.name.toLowerCase() === normalizedSearch ||
        c.name.replace(/\s+/g, '-').toLowerCase() === normalizedSearch
    );

    if (!courseRecord && schoolCourses) {
        // Look in school JSON
        Object.values(schoolCourses).forEach(list => {
            if (!Array.isArray(list)) return;
            const found = list.find(c => 
                c.name.toLowerCase() === normalizedSearch ||
                c.name.replace(/\s+/g, '-').toLowerCase() === normalizedSearch
            );
            if (found) courseRecord = { id: 'NEW_UUID', name: found.name };
        });
    }

    if (courseRecord) solvedCourseId = courseRecord.id;

    return { solvedClassroomId, solvedCourseId, solvedPeriodId };
}

// TEST CASES
const existingClassrooms = [
    { id: '0c32d157-241a-4a34-9c65-6325bc4869e1', name: '1e Primaire A' },
    { id: 'bd6ef3f6-259d-44e2-8950-3298e9dbb378', name: '7e CTEB A' }
];
const schoolCourses = {
    '1ERE PRIMAIRE A': [
        { name: 'Expression Orale (c)' },
        { name: 'Vocabulaire' }
    ],
    '7E CTEB A': [
        { name: 'Géométrie' }
    ]
};

function runTest(name, courseId, classroomId, periodId) {
    console.log(`\n--- Test: ${name} ---`);
    const result = resolveIds(courseId, classroomId, periodId, existingClassrooms, [], schoolCourses);
    console.log('Result:', result);
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i; // Simple check for brevity
    // Note: Actual UUID regex is more precise but for test NEW_UUID is fine
}

runTest(
    'User reported case',
    '1e-Primaire-A-Expression-Orale-(c)', 
    '0c32d157-241a-4a34-9c65-6325bc4869e1', 
    '8544ab25-ee1d-4ff0-9bb8-1accbc28372a'
);

runTest(
    'Classroom name with dashes in body',
    '1e-Primaire-A-Vocabulaire', 
    '1e-Primaire-A', 
    'p1'
);

runTest(
    'Course with spaces in name matched against dashes',
    '1e-Primaire-A-Expression-Orale-(c)', 
    '0c32d157-241a-4a34-9c65-6325bc4869e1', 
    'p1'
);

runTest(
    '7e CTEB case',
    '7e-CTEB-A-Géométrie', 
    'bd6ef3f6-259d-44e2-8950-3298e9dbb378', 
    'p1'
);
