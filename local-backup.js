(()=>{'use strict';
if(new URLSearchParams(location.search).get('local-backup')!=='1')return;
document.title='Local data backup | Hair by Sara';
document.body.innerHTML='<main class="policy"><p class="eyebrow">HAIR BY SARA</p><h1>Download browser data</h1><p>This exports the existing Hair by Sara data from this browser without changing or removing it. Keep the downloaded file private.</p><form id="local-backup-form" class="booking-form"><label>Existing owner passcode<input name="passcode" type="password" autocomplete="current-password" required></label><button class="button" type="submit">Download backup</button><p id="local-backup-message" class="notice" role="status"></p></form><a href="index.html">Back to the public website</a></main>';
const form=document.querySelector('#local-backup-form'),message=document.querySelector('#local-backup-message');
async function hashPasscode(value,salt){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(value),'PBKDF2',false,['deriveBits']),bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:210000,hash:'SHA-256'},key,256);return [...new Uint8Array(bits)].map(byte=>byte.toString(16).padStart(2,'0')).join('')}
form.onsubmit=async event=>{
  event.preventDefault();message.textContent='';
  try{
    const credential=JSON.parse(localStorage.getItem('hairBySara.ownerCredential.v1')||'null');
    if(!credential){message.textContent='No existing local owner passcode was found in this browser.';return}
    const hash=await hashPasscode(form.elements.passcode.value,new Uint8Array(credential.salt));
    if(hash!==credential.hash){message.textContent='That passcode is not correct.';form.elements.passcode.select();return}
    const data=JSON.parse(localStorage.getItem('hairBySara.v1')||'null');
    if(!data){message.textContent='No saved salon data was found in this browser.';return}
    const backup={format:'hair-by-sara-local-backup-v1',exportedAt:new Date().toISOString(),storageKey:'hairBySara.v1',data},blob=new Blob([JSON.stringify(backup)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download='hair-by-sara-backup-'+new Date().toISOString().slice(0,10)+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    message.textContent='Backup downloaded. Your browser data is unchanged.';
  }catch{message.textContent='Backup could not be created in this browser. Open the site over HTTPS or localhost and try again.'}
};
})();
