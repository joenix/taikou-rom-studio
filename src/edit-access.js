// UI access gate only; not server authorization. No persistent unlock.
export function mobileViewer(w=window,n=navigator){
 return /Android|iPhone|iPad|iPod|Mobile/i.test(n.userAgent)||(/Macintosh/i.test(n.userAgent)&&n.maxTouchPoints>1)||w.matchMedia('(pointer: coarse)').matches||w.matchMedia('(max-width: 900px)').matches;
}
// A salted, deliberately expensive verifier; the password itself is never shipped.
// This remains a local UI gate: a client under someone else's control can bypass it.
const unlockSalt='c63a9d7134525e3963824a1886218945';
const unlockVerifier='507b895568b5c6fa9425e3ff81c0480abf07903dcdd28301253155cbf29f4045';
const hexBytes=value=>Uint8Array.from(value.match(/../g),pair=>Number.parseInt(pair,16));
export async function validPassword(value){
 if(typeof value!=='string'||!value.length)return false;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(value),'PBKDF2',false,['deriveBits']);
 const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:hexBytes(unlockSalt),iterations:600000},key,256);
 const actual=new Uint8Array(bits),expected=hexBytes(unlockVerifier);
 let difference=0;for(let i=0;i<expected.length;i++)difference|=actual[i]^expected[i];
 return difference===0;
}
