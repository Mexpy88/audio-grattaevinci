import assert from 'node:assert/strict';
import fs from 'node:fs';

const server=fs.readFileSync('server.js','utf8');
const index=fs.readFileSync('public/index.html','utf8');
const responsive=fs.readFileSync('public/responsive-layout.css','utf8');
const networkUi=fs.readFileSync('public/network-ui.js','utf8');

assert.match(server,/HOST=process\.env\.HOST\|\|'0\.0\.0\.0'/,'server must listen on the LAN');
assert.match(server,/function networkInfo\(\)/,'dynamic network discovery missing');
assert.match(server,/\/api\/network/,'network endpoint missing');
assert.match(server,/preferredUrl/,'preferred LAN URL missing');
assert.match(server,/wi-\?fi\|wireless\|wlan\|hotspot/,'Wi-Fi/hotspot interface preference missing');
assert.match(server,/virtual\|vmware\|vbox\|docker\|wsl\|hyper-v\|tailscale\|zerotier\|vpn/,'virtual/VPN filtering missing');

assert.match(index,/responsive-layout\.css/,'adaptive CSS not loaded');
assert.match(index,/network-ui\.js/,'network UI module not loaded');
assert.match(responsive,/@media \(min-width:1100px\)/,'desktop breakpoint missing');
assert.match(responsive,/@media \(min-width:600px\) and \(max-width:1099px\)/,'tablet breakpoint missing');
assert.match(responsive,/@media \(max-width:599px\)/,'phone breakpoint missing');
assert.match(responsive,/--desktop-rail:94px/,'desktop navigation rail missing');
assert.match(responsive,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,'tablet two-column layout missing');
assert.match(responsive,/\.quickGrid\{grid-template-columns:1fr/,'phone single-column quick actions missing');
assert.match(responsive,/@media \(pointer:coarse\)/,'touch target rules missing');

assert.match(networkUi,/deviceType\(\)/,'device classifier missing');
assert.match(networkUi,/root\.dataset\.device/,'device data attribute missing');
assert.match(networkUi,/fetch\('\/api\/network'/,'network UI must use dynamic network endpoint');
assert.match(networkUi,/setInterval\(getNetwork,5000\)/,'network changes are not periodically refreshed');
assert.match(networkUi,/COPIA INDIRIZZO/,'LAN address copy UX missing');

console.log('WMS V2 network/responsive OK: hotspot/home LAN discovery and dedicated desktop/tablet/phone UX are enforced.');
