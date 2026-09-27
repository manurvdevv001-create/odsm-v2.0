// src/types/index.ts

export type Gender = 'M' | 'F';

export type AcademicLevel = 'maternelle' | 'primaire' | 'secondaire';

export interface Guardian {
    id: string;
    schoolMatricule: string;
    personContactId?: string | null;
    firstName: string;
    lastName: string;
    middleName?: string | null;
    phone: string;
    email?: string;
    profession?: string;
    address: string;
    students?: Student[];
}

export interface ClassroomCourseAssignment {
    classroom: string;
    courses: string[];
}

export interface Student {
    id: string;
    studentNumber: string;
    firstName: string;
    lastName: string;
    middleName?: string;
    gradeName: string;
    classroomName?: string;
    photo?: string | null;
    status: 'active' | 'pending_payment' | 'pending_enrollment' | 'excluded' | 'transferred';
    birthDate: string;
    gender: string;
    paymentCategoryId?: string;
    schoolYear?: string;
    guardianId?: string;
    guardian?: Guardian;
    level?: string;
    [key: string]: any;
}

export type AnnualDecisionType = 'PROMU' | 'MAINTENU' | 'DEMIS' | 'EXCLU' | 'RETIRE';

export interface AnnualDecision {
    id: string;
    studentId: string;
    schoolYear: string;
    schoolMatricule: string;
    fromClassroomId: string;
    fromGradeId: string;
    decision: AnnualDecisionType;
    targetGradeId?: string | null;
    createdAt: string;
    updatedAt: string;
}


export interface StaffProfile {
    id: string;
    staffNumber?: string;
    firstName: string;
    lastName: string;
    middleName?: string;
    photo?: string | null;
    gender: Gender;
    birthDate: string;
    phone?: string;
    function: string;
    category: string;
    level?: AcademicLevel;
    levels?: AcademicLevel[];
    assignedClassrooms?: string[];
    assignedCourses?: string[] | ClassroomCourseAssignment[];
    [key: string]: any;
}

export interface SchoolData {
    matricule: string;
    name: string;
    address: string | null;
    city: string | null;
    province: string | null;
    phone: string | null;
    logo: string | null;
    levels: Record<AcademicLevel, boolean>;
    configuration: any;
    calendar: any;
    structure: any;
    financeSettings: any;
    activeYear: string;
    teachers?: StaffProfile[];
    students?: Student[];
    [key: string]: any;
}

export type Course = {
    name: string;
    max: number;
    domaine?: string;
    sousDomaine?: string;
};

export type TimeSlot = {
    id: string;
    type: 'course' | 'recreation' | 'end';
    label: string;
    value: string; // HH:MM-HH:MM or "FIN DES COURS"
};

export interface FeeCategory {
    id: string;
    name: string;
    appliesTo: string[];
    paymentCategoryId?: string;
    feeItemIds: string[];
    [key: string]: any;
}

export interface FeeItem {
    id: string;
    categoryId: string;
    amount: number;
    currency: string;
    name: string;
    description?: string;
}

export interface PaymentDetails {
    feeItemId: string;
    amountPaid: number;
    dispensationAmount?: number;
    dispensationReason?: string;
}

export interface Payment {
    id: string;
    studentId: string;
    type: 'inscription' | 'scolarite' | 'other';
    date: string;
    currency: string;
    totalAmountPaid: number;
    totalDispensationAmount?: number;
    details: PaymentDetails[];
    paymentMethod?: string;
    paymentProvider?: string;
    paymentReference?: string;
    [key: string]: any;
}
