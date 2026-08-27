import fs from 'node:fs';
import assert from 'node:assert/strict';

const css=fs.readFileSync('fixes.css','utf8');

assert.match(css,/DESKTOP V2/);
assert.match(css,/@media\(min-width:900px\)/);
assert.match(css,/body\.desktopMode \.app\{[\s\S]*?max-width:1320px/);
assert.match(css,/body\.desktopMode #home \.homeGrid\{[\s\S]*?grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
assert.match(css,/body\.desktopMode #home \.mgrHomeBtn\{[\s\S]*?min-height:154px/);
assert.match(css,/body\.desktopMode #home \.hero\{[\s\S]*?max-width:760px/);
assert.match(css,/body\.desktopMode #viewModeSwitch\{[\s\S]*?620px/);
assert.match(css,/body\.desktopMode #localMasterPanel\.lmPanelMinimized/);
assert.match(css,/body\.desktopMode #mgrMoveHub \.mgrActionGrid\{[\s\S]*?repeat\(3/);
assert.match(css,/body\.desktopMode #mgrStockHub \.mgrActionGrid/);

// Notebook desktop: balanced 2x2 rather than 3 + 1.
assert.match(css,/@media\(min-width:900px\) and \(max-width:1099px\)/);
assert.match(css,/body\.desktopMode #home \.homeGrid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);

// Smartphone rules remain present and unchanged in intent.
assert.match(css,/@media\(max-width:430px\)/);
assert.match(css,/\.userBtn\{max-width:128px!important;font-size:14px!important/);
assert.match(css,/\.logoButton img\{width:min\(165px,42vw\)!important/);
assert.match(css,/@media\(max-width:360px\)/);
assert.match(css,/\.userBtn\{max-width:116px!important;font-size:13px!important/);
assert.match(css,/\.logoButton img\{width:min\(145px,40vw\)!important/);

// Existing mode switch contract stays intact.
assert.match(css,/\.viewModeSwitch/);
assert.match(css,/\.viewModeSwitch button\.active/);

console.log('Desktop responsive polish integrity OK');
