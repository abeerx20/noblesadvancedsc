async function loadHomeSemester() {
    const node = document.querySelector('#semesterText');
    if (!node) return;

    try {
        const response = await fetch('/api/v1/site-settings');
        if (!response.ok) throw new Error('failed');
        const result = await response.json();
        const settings = result.data || {};
        const semester = settings.semester ?? 'الفصل الدراسي الحالي';
        const academicYear = settings.academicYear ?? '';
        node.textContent = `${semester} ${academicYear}`.trim();
    } catch {
        node.textContent = 'الفصل الدراسي الحالي';
    }
}

loadHomeSemester();
