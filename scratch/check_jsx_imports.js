import fs from 'fs';
import path from 'path';

const compDir = './src/components';
const files = fs.readdirSync(compDir).filter(f => f.endsWith('.jsx'));

for (const f of files) {
  const code = fs.readFileSync(path.join(compDir, f), 'utf8');
  const lucideMatch = code.match(/import\s+\{([^}]+)\}\s+from\s+['"]lucide-react['"]/);
  const lucideImports = lucideMatch ? lucideMatch[1].split(',').map(s => s.trim().split(' as ')[0].trim()).filter(Boolean) : [];
  
  const tags = [...code.matchAll(/<([A-Z][a-zA-Z0-9]+)/g)].map(m => m[1]);
  for (const tag of tags) {
    if (['PDFDownloadLink', 'PDFDocument', 'GarmentSketch', 'PuneetZip', 'OnlyCutting', 'QRCode', 'Document', 'Page', 'Text', 'View', 'StyleSheet'].includes(tag)) continue;
    const isImported = lucideImports.includes(tag);
    const isDefined = code.includes('const ' + tag) || code.includes('function ' + tag) || code.includes('import ' + tag);
    if (!isImported && !isDefined) {
      console.log(`Missing import in ${f}: <${tag}>`);
    }
  }
}
console.log('Finished checking imports.');
