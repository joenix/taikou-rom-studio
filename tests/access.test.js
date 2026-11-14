import test from 'node:test';
import assert from 'node:assert/strict';
import {mobileViewer,validPassword} from '../src/edit-access.js';
import {RomDocument} from '../src/rom/document.js';
import {fixture} from './fixture.js';
import {validateRom} from '../src/rom/validate.js';
const screen=(coarse=false,narrow=false)=>({matchMedia:q=>({matches:q.includes('coarse')?coarse:narrow})});
test('移动、平板、触控与窄屏只读，普通桌面可申请编辑',()=>{
 for(const ua of ['Android','iPhone','iPad'])assert.equal(mobileViewer(screen(),{userAgent:ua,maxTouchPoints:1}),true);
 assert.equal(mobileViewer(screen(),{userAgent:'Macintosh',maxTouchPoints:5}),true);
 assert.equal(mobileViewer(screen(true),{userAgent:'Windows',maxTouchPoints:0}),true);
 assert.equal(mobileViewer(screen(false,true),{userAgent:'Windows',maxTouchPoints:0}),true);
 assert.equal(mobileViewer(screen(),{userAgent:'Windows',maxTouchPoints:0}),false);
});
test('错误密码拒绝',async()=>{assert.equal(await validPassword(''),false);assert.equal(await validPassword('wrong-password'),false);});
test('写入守卫覆盖所有变更入口及导出',()=>{
 const d=new RomDocument(fixture(),'fixture','');let allowed=true;d.setWriteGuard(()=>allowed);
 d.applyRecord('items',0,{value:71});allowed=false;
 for(const f of [()=>d.applyRecord('items',0,{value:72}),()=>d.applyMap('map-terrain',0,{}),()=>d.applyTown('create',{}),()=>d.undo(),()=>d.redo(),()=>d.exportBytes()])assert.throws(f,e=>e.code==='READ_ONLY_MODE');
 assert.equal(d.readItem(0).value,71);allowed=true;d.undo();assert.equal(d.readItem(0).value,200);
});
test('仅接受新版标题及修复签名，拒绝旧标题和损坏补丁',()=>{
 assert.doesNotThrow(()=>validateRom(fixture()));
 const old=fixture();old.set(Buffer.from('91be8d7d97a78e559360','hex'),0x120);assert.throws(()=>validateRom(old),e=>e.code==='NOT_TAIKOU');
 const bad=fixture();bad[0x1583ae]^=1;assert.throws(()=>validateRom(bad),e=>e.code==='UNSUPPORTED_LAYOUT');
});

test('配置的真实密码可解锁，大小写和附加空格不接受',{skip:!process.env.TAIKOU_EDITOR_PASSWORD},async()=>{
 const secret=process.env.TAIKOU_EDITOR_PASSWORD;
 assert.equal(await validPassword(secret),true);
 assert.equal(await validPassword(secret+' '),false);
 assert.equal(await validPassword(secret.toUpperCase()),false);
});
