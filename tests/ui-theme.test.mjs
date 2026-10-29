import assert from 'node:assert/strict';
import { readFileSync,existsSync } from 'node:fs';
import { dirname,join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const html=readFileSync(join(root,'index.html'),'utf8');
const theme=readFileSync(join(root,'soulseekers-ui.css'),'utf8');
assert.match(html,/R03\.4 · SOULSEEKERS UI/);
assert.match(html,/soulseekers-ui\.css\?v=R034/);
assert.match(html,/ss-menu-banner/);
assert.match(html,/ss-top-rail/);
assert.match(html,/ss-menu-photo/);
for(const id of ['gameCanvas','menuLayer','heroChoices','soloParty','soloDM','gameServerUrl','hostOnline','joinOnline','roomCodeInput','playerName','copyInvite','copyRoomCode','sidePanel','playerPanel','dmPanel','inventoryWrap','invGrid','shopItems','dmUnits','perfStats','menuMessage']) {
 assert.match(html,new RegExp(`id="${id}"`),`UI must preserve #${id} for JS handlers`);
}
for (const f of ['assets/soulseekers/soul-seal.svg','assets/soulseekers/boston-night.webp','src/engine.js','src/socket-network.js','server/matches.mjs','SYNC_TO_GITHUB.bat']) assert.ok(existsSync(join(root,f)),`must ship ${f}`);
for(const s of ['.hero-choice','.mode-choice','.inv-grid','.shop-card','.dm-unit','.perf-stats','.side-panel','.menu-layer'])assert.ok(theme.includes(s),`must style ${s}`);
assert.doesNotMatch(theme,/animation:\s*[^n]/,`theme should not add UI animation loops`);
console.log('✓ ACT III identity, SoulSeekers assets, responsive panels and all original gameplay IDs preserved');
