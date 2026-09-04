const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.tsx') || file.endsWith('.ts')) results.push(file);
        }
    });
    return results;
}

const files = walk('src/components');
let c = 0;
files.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    if (content.includes('useSchoolData')) {
        let newContent = content.replace(/import\s+\{.*useSchoolData.*\}\s+from\s+['"]@\/app\/\(main\)\/layout['"];?/g, 'import { useSchoolData } from "@/components/providers/SchoolDataProvider";');
        if (content !== newContent) {
            fs.writeFileSync(f, newContent);
            c++;
        }
    }
});
console.log('Modified components:', c);
