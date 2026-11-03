// UI access gate only; not server authorization. No persistent unlock.
export function mobileViewer(w=window,n=navigator){
 return /Android|iPhone|iPad|iPod|Mobile/i.test(n.userAgent)||(/Macintosh/i.test(n.userAgent)&&n.maxTouchPoints>1)||w.matchMedia('(pointer: coarse)').matches||w.matchMedia('(max-width: 900px)').matches;
}
export async function validPassword(value){
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
 return Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('')==='71363f3965bc1f135464b317cc6b1ef5596e9e2865682363635c85983f7dacb2';
}
