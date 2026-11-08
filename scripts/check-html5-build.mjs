import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, sep } from 'node:path';

const dist = resolve(process.cwd(), 'dist');
const indexPath = resolve(dist, 'index.html');
const failures = [];
if (!existsSync(indexPath)) failures.push('dist/index.html is missing');
if (!existsSync(resolve(dist, 'assets'))) failures.push('dist/assets is missing');

if (!failures.length) {
    const html = readFileSync(indexPath, 'utf8');
    // Ignore external/fragment URLs; all locally built HTML imports must work
    // when itch.io hosts the game at a nested asset path.
    const refs = [...html.matchAll(/\b(?:src|href)=["']([^"'#]+)["']/g)].map((match) => match[1]);
    refs.forEach((ref) => {
        if (/^(?:https?:|data:|blob:|mailto:)/i.test(ref)) return;
        if (ref.startsWith('/') || ref.startsWith('\\')) {
            failures.push('Root-absolute HTML reference: ' + ref);
            return;
        }
        const decoded = decodeURIComponent(ref.split('?')[0]);
        const absolute = resolve(dist, decoded);
        if (!absolute.startsWith(dist + sep) || !existsSync(absolute) || !statSync(absolute).isFile()) {
            failures.push('HTML asset not present in ZIP: ' + ref);
        }
    });

    const required = [
        'assets/combat_bg.png',
        'assets/doctrine_bg.png',
        'assets/readiness_bg.png',
        'assets/title-keyart-v1.png',
        'assets/pinball/playfield_kit.png'
    ];
    required.forEach((file) => {
        if (!existsSync(resolve(dist, file))) failures.push('Required art missing: ' + file);
    });
    const compiled = readdirSync(resolve(dist, 'assets')).filter(
        (file) => /^index[^/]*\.js$/.test(file) || /^index[^/]*\.css$/.test(file)
    );
    if (!compiled.some((file) => file.endsWith('.js'))) failures.push('Main JavaScript bundle missing');
    if (!refs.length) failures.push('No HTML imports detected; verify Vite output');
}

if (failures.length) {
    failures.forEach((failure) => console.error('HTML5 package FAIL: ' + failure));
    process.exitCode = 1;
} else {
    console.log('HTML5 package check passed: nested-path HTML refs and key assets exist.');
}
