export function isValidSchoolYear(year: string): boolean {
    return /^\d{4}-\d{4}$/.test(year);
}

export function normalizeSchoolYear(year: string): string {
    if (!year) return '';
    const trimmed = String(year).trim();
    const match = trimmed.match(/(\d{4})\s*[-\/]\s*(\d{4})/);
    return match ? `${match[1]}-${match[2]}` : trimmed;
}

export function getCurrentSchoolYear(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    return month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

export function getNextSchoolYear(currentYear: string): string {
    if (!isValidSchoolYear(normalizeSchoolYear(currentYear))) {
        const now = new Date().getFullYear();
        return `${now}-${now + 1}`;
    }
    const [start, end] = currentYear.split('-').map(s => parseInt(s.trim()));
    return `${start + 1}-${end + 1}`;
}
