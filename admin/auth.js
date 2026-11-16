(()=>{'use strict';
const form=document.querySelector('#owner-login-form'),button=form.querySelector('button[type=submit]'),message=document.querySelector('#auth-message'),store=window.HairBySaraDataStore;
async function routeOwnerIfSignedIn(){
  try{if(await store.isOwner())location.replace('../dashboard/')}
  catch{message.textContent='Owner access is not set up yet. Apply the Supabase database migration and authorize the owner account first.'}
}
routeOwnerIfSignedIn();
form.onsubmit=async event=>{
  event.preventDefault();message.textContent='';
  const email=form.elements.email.value.trim(),password=form.elements.password.value;
  button.disabled=true;button.textContent='Signing in…';
  try{
    const {error}=await store.signIn(email,password);
    if(error)throw error;
    if(!await store.isOwner()){
      await store.signOut();
      message.textContent='This account is not authorized for the owner dashboard.';
      return;
    }
    location.assign('../dashboard/');
  }catch(error){
    message.textContent=error.message||'Unable to sign in. Check your email and password, then try again.';
  }finally{button.disabled=false;button.textContent='Sign in'}
};
})();
