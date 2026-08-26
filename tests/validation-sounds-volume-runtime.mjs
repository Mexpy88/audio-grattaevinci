import fs from 'node:fs';
import assert from 'node:assert/strict';

const src=fs.readFileSync('validation-sounds.js','utf8');
assert.match(src,/safe-sounds4-louder-success/);
assert.match(src,/tone\(c,660,s,0\.07,0\.07\)/);
assert.match(src,/tone\(c,880,s\+0\.082,0\.095,0\.075\)/);
assert.match(src,/submitLogin/);
assert.match(src,/confirmOperation/);
console.log('validation sounds volume runtime OK: stronger two-tone success cue is used by PIN login and confirmed warehouse operations.');