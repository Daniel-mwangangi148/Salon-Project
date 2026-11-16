(()=>{'use strict';
const KEY='hairBySara.v1',BUCKET='hairstyle-photos',settings=window.HAIR_BY_SARA_SUPABASE||{};
let client=null;
function getClient(){
  if(client)return client;
  if(!settings.url||!settings.publishableKey||!window.supabase?.createClient)throw new Error('Supabase is not ready. Check the project settings and connection.');
  client=window.supabase.createClient(settings.url,settings.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  return client;
}
function readLocal(fallback){try{return JSON.parse(localStorage.getItem(KEY))||fallback}catch{return fallback}}
function saveLocal(value){localStorage.setItem(KEY,JSON.stringify(value))}
function check(result){if(result.error)throw new Error(result.error.message);return result.data}
async function getUser(){const {data,error}=await getClient().auth.getUser();if(error&&error.name!=='AuthSessionMissingError')throw error;return data?.user||null}
async function isOwner(){
  const user=await getUser();if(!user)return false;
  const result=await getClient().from('owner_profiles').select('user_id').eq('user_id',user.id).maybeSingle();
  if(result.error)throw new Error(result.error.message);
  return Boolean(result.data);
}
async function load(defaults,{ownerMode=false}={}){
  const db=getClient();
  if(ownerMode&&!await isOwner())throw new Error('This account does not have owner access.');
  const styles=check(await db.from('hairstyles').select('id,name,price_aud,display_order,hairstyle_images(id,storage_path,file_name,display_order,adjustments)').order('display_order',{ascending:true}));
  const hours=check(await db.from('working_hours').select('day_of_week,is_open,open_time,close_time').order('day_of_week',{ascending:true}));
  const mappedStyles=styles.map(style=>({id:style.id,name:style.name,price:Number(style.price_aud),images:(style.hairstyle_images||[]).sort((a,b)=>a.display_order-b.display_order).map(image=>({
    id:image.id,name:image.file_name,storagePath:image.storage_path,
    data:db.storage.from(BUCKET).getPublicUrl(image.storage_path).data.publicUrl,
    adjustments:image.adjustments||{x:50,y:50,zoom:1,rotation:0,panX:0,panY:0}
  }))}));
  let bookings=[];
  if(ownerMode){
    const rows=check(await db.from('bookings').select('id,customer_id,hairstyle_id,hairstyle_name,price_aud,booking_date,booking_time,status,created_at,customers(name,phone,email)').order('booking_date',{ascending:true}).order('booking_time',{ascending:true}));
    bookings=rows.map(row=>{const customer=row.customers||{};return{id:row.id,customer_id:row.customer_id,style_id:row.hairstyle_id,style:row.hairstyle_name,price:Number(row.price_aud),name:customer.name||'',phone:customer.phone||'',email:customer.email||'',date:row.booking_date,time:String(row.booking_time).slice(0,5),status:row.status,created:row.created_at}});
  }
  const open=hours.find(hour=>hour.is_open);
  return{styles:mappedStyles,bookings,hours:open?{open:String(open.open_time).slice(0,5),close:String(open.close_time).slice(0,5)}:defaults.hours};
}
async function availableSlots(date){
  const rows=check(await getClient().rpc('get_available_slots',{p_booking_date:date}));
  return rows.map(row=>String(row.slot).slice(0,5));
}
async function requestBooking(booking){
  const rows=check(await getClient().rpc('request_booking',{
    p_hairstyle_id:booking.styleId,p_client_name:booking.name,p_phone:booking.phone,
    p_booking_date:booking.date,p_booking_time:booking.time,p_email:booking.email||null
  }));
  return rows[0];
}
function extensionFor(blob,fileName){
  const type=(blob.type||'').toLowerCase();
  if(type==='image/jpeg')return'jpg';if(type==='image/png')return'png';if(type==='image/webp')return'webp';if(type==='image/avif')return'avif';if(type==='image/gif')return'gif';
  const match=String(fileName||'').toLowerCase().match(/\.(jpe?g|png|webp|avif|gif)$/);return match?match[1].replace('jpeg','jpg'):'jpg';
}
async function deterministicUuid(value){const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));digest[6]=(digest[6]&15)|80;digest[8]=(digest[8]&63)|128;const hex=[...digest.slice(0,16)].map(byte=>byte.toString(16).padStart(2,'0')).join('');return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20)}
async function imageBlob(image){
  if(!String(image.data||'').startsWith('data:'))throw new Error('A photo is missing its original image data. Restore it from the local backup before saving.');
  const response=await fetch(image.data);if(!response.ok)throw new Error('Could not read an uploaded hairstyle photo.');
  return response.blob();
}
async function saveStyle(style,displayOrder=0){
  if(!await isOwner())throw new Error('Sign in with the authorized salon owner account before saving.');
  const db=getClient();
  check(await db.from('hairstyles').upsert({id:String(style.id),name:style.name,price_aud:Number(style.price),display_order:displayOrder,is_active:true,updated_at:new Date().toISOString()},{onConflict:'id'}));
  const imageRows=[];
  for(let index=0;index<(style.images||[]).length;index++){
    const image=style.images[index];image.id=image.id||await deterministicUuid(String(style.id)+'/'+index+'/'+String(image.name||''));
    if(!image.storagePath){
      const blob=await imageBlob(image),ext=extensionFor(blob,image.name),safeStyle=String(style.id).replace(/[^a-zA-Z0-9_-]/g,'_'),path=safeStyle+'/'+image.id+'.'+ext;
      check(await db.storage.from(BUCKET).upload(path,blob,{upsert:true,contentType:blob.type||'image/'+ext}));
      image.storagePath=path;image.data=db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    }
    imageRows.push({id:image.id,hairstyle_id:String(style.id),storage_path:image.storagePath,file_name:image.name||('Photo '+(index+1)),display_order:index,adjustments:image.adjustments||{x:50,y:50,zoom:1,rotation:0,panX:0,panY:0}});
  }
  if(imageRows.length)check(await db.from('hairstyle_images').upsert(imageRows,{onConflict:'id'}));
  const existing=check(await db.from('hairstyle_images').select('id,storage_path').eq('hairstyle_id',String(style.id)));
  const keep=new Set(imageRows.map(image=>image.id)),removed=existing.filter(image=>!keep.has(image.id));
  if(removed.length){check(await db.from('hairstyle_images').delete().in('id',removed.map(image=>image.id)));check(await db.storage.from(BUCKET).remove(removed.map(image=>image.storage_path)))}
}
async function deleteStyle(styleId){
  if(!await isOwner())throw new Error('Sign in with the authorized salon owner account before removing a style.');
  const db=getClient(),images=check(await db.from('hairstyle_images').select('storage_path').eq('hairstyle_id',String(styleId)));
  if(images.length)check(await db.storage.from(BUCKET).remove(images.map(image=>image.storage_path)));
  check(await db.from('hairstyles').delete().eq('id',String(styleId)));
}
async function updateBookingStatus(bookingId,status){
  if(!await isOwner())throw new Error('Sign in with the authorized salon owner account before updating bookings.');
  check(await getClient().from('bookings').update({status}).eq('id',bookingId));
}
async function deleteBooking(bookingId){
  if(!await isOwner())throw new Error('Sign in with the authorized salon owner account before removing bookings.');
  const db=getClient(),row=check(await db.from('bookings').select('customer_id').eq('id',bookingId).maybeSingle());
  check(await db.from('bookings').delete().eq('id',bookingId));
  if(row?.customer_id){const remaining=await db.from('bookings').select('id',{count:'exact',head:true}).eq('customer_id',row.customer_id);if(remaining.error)throw new Error(remaining.error.message);if(!remaining.count)check(await db.from('customers').delete().eq('id',row.customer_id))}
}
async function saveWorkingHours(hours){
  if(!await isOwner())throw new Error('Sign in with the authorized salon owner account before changing hours.');
  const rows=Array.from({length:7},(_,day)=>({day_of_week:day,is_open:true,open_time:hours.open,close_time:hours.close}));
  check(await getClient().from('working_hours').upsert(rows,{onConflict:'day_of_week'}));
}
async function syncOwnerState(state,preserveExisting=false){
  if(!await isOwner())throw new Error('Sign in with the authorized salon owner account before saving.');
  const db=getClient(),styles=state.styles||[],bookings=state.bookings||[];
  const styleRows=styles.map((style,index)=>({id:String(style.id),name:style.name,price_aud:Number(style.price),display_order:index,is_active:true,updated_at:new Date().toISOString()}));
  if(styleRows.length)check(await db.from('hairstyles').upsert(styleRows,{onConflict:'id'}));
  const imageRows=[];
  for(const style of styles){
    for(let index=0;index<(style.images||[]).length;index++){
      const image=style.images[index];image.id=image.id||await deterministicUuid(String(style.id)+'/'+index+'/'+String(image.name||''));
      if(!image.storagePath){
        const blob=await imageBlob(image),ext=extensionFor(blob,image.name),safeStyle=String(style.id).replace(/[^a-zA-Z0-9_-]/g,'_'),path=safeStyle+'/'+image.id+'.'+ext;
        check(await db.storage.from(BUCKET).upload(path,blob,{upsert:true,contentType:blob.type||'image/'+ext}));
        image.storagePath=path;image.data=db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      }
      imageRows.push({id:image.id,hairstyle_id:String(style.id),storage_path:image.storagePath,file_name:image.name||('Photo '+(index+1)),display_order:index,adjustments:image.adjustments||{x:50,y:50,zoom:1,rotation:0,panX:0,panY:0}});
    }
  }
  if(imageRows.length)check(await db.from('hairstyle_images').upsert(imageRows,{onConflict:'id'}));
  if(!preserveExisting){const existingImages=check(await db.from('hairstyle_images').select('id,storage_path'));const keepImageIds=new Set(imageRows.map(image=>image.id)),removedImages=existingImages.filter(image=>!keepImageIds.has(image.id));if(removedImages.length){check(await db.from('hairstyle_images').delete().in('id',removedImages.map(image=>image.id)));const paths=removedImages.map(image=>image.storage_path);if(paths.length)check(await db.storage.from(BUCKET).remove(paths))}}
  const styleByName=new Map(styles.map(style=>[style.name,style.id]));
  const validBookings=[];
  for(const booking of bookings){
    const originalId=String(booking.id||`${booking.date}/${booking.time}/${booking.phone||booking.name||''}`);
    if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(originalId))booking.id=await deterministicUuid('booking/'+originalId);
    if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(String(booking.customer_id||'')))booking.customer_id=await deterministicUuid('customer/'+originalId);
    if(!['requested','confirmed','completed','cancelled'].includes(booking.status))booking.status='requested';
    validBookings.push(booking);
  }
  const customerRows=validBookings.map(booking=>({id:booking.customer_id||booking.id,name:booking.name||'Client',phone:booking.phone||'',email:booking.email||null}));
  if(customerRows.length)check(await db.from('customers').upsert(customerRows,{onConflict:'id'}));
  const bookingRows=validBookings.map(booking=>({
    id:booking.id,customer_id:booking.customer_id||booking.id,
    hairstyle_id:booking.style_id||styleByName.get(booking.style)||null,
    hairstyle_name:booking.style||'Hairstyle',price_aud:Number(booking.price)||0,
    booking_date:booking.date,booking_time:booking.time,status:booking.status||'requested',
    created_at:booking.created||new Date().toISOString()
  }));
  if(bookingRows.length)check(await db.from('bookings').upsert(bookingRows,{onConflict:'id'}));
  if(!preserveExisting){const remoteBookings=check(await db.from('bookings').select('id,customer_id'));const keepBookingIds=new Set(validBookings.map(booking=>booking.id)),removedBookings=remoteBookings.filter(booking=>!keepBookingIds.has(booking.id));if(removedBookings.length)check(await db.from('bookings').delete().in('id',removedBookings.map(booking=>booking.id)));const remainingBookings=check(await db.from('bookings').select('customer_id'));const usedCustomers=new Set(remainingBookings.map(booking=>booking.customer_id)),remoteCustomers=check(await db.from('customers').select('id'));const orphanCustomers=remoteCustomers.filter(customer=>!usedCustomers.has(customer.id));if(orphanCustomers.length)check(await db.from('customers').delete().in('id',orphanCustomers.map(customer=>customer.id)));const remoteStyles=check(await db.from('hairstyles').select('id')),keepStyleIds=new Set(styles.map(style=>String(style.id))),removedStyles=remoteStyles.filter(style=>!keepStyleIds.has(style.id));if(removedStyles.length)check(await db.from('hairstyles').delete().in('id',removedStyles.map(style=>style.id)))}
  const hours=Array.from({length:7},(_,day)=>({day_of_week:day,is_open:true,open_time:state.hours.open,close_time:state.hours.close}));
  check(await db.from('working_hours').upsert(hours,{onConflict:'day_of_week'}));
}
async function importBackup(backup){
  const source=backup?.format==='hair-by-sara-local-backup-v1'?backup.data:backup;
  if(!source||!Array.isArray(source.styles)||!Array.isArray(source.bookings)||!source.hours)throw new Error('That file is not a Hair by Sara data backup.');
  if(!await isOwner())throw new Error('Only the signed-in owner can import salon data.');
  const data=structuredClone(source);
  for(const booking of data.bookings){
    const originalId=String(booking.id||`${booking.date}/${booking.time}/${booking.phone||booking.name||''}`);
    if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(originalId))booking.id=await deterministicUuid('booking/'+originalId);
    if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(String(booking.customer_id||'')))booking.customer_id=await deterministicUuid('customer/'+originalId);
    if(!['requested','confirmed','completed','cancelled'].includes(booking.status))booking.status='requested';
  }
  const db=getClient();
  const [styles,bookings]=await Promise.all([
    db.from('hairstyles').select('id,name,price_aud'),
    db.from('bookings').select('id,hairstyle_id,hairstyle_name,price_aud,booking_date,booking_time,status')
  ]);
  if(styles.error)throw new Error(styles.error.message);if(bookings.error)throw new Error(bookings.error.message);
  const incomingStyles=new Map(data.styles.map(style=>[String(style.id),style])),incomingBookings=new Map(data.bookings.map(booking=>[booking.id,booking]));
  const stylesMatch=styles.data.every(row=>{const item=incomingStyles.get(row.id);return item&&item.name===row.name&&Number(item.price)===Number(row.price_aud)});
  const bookingsMatch=bookings.data.every(row=>{const item=incomingBookings.get(row.id);return item&&item.date===row.booking_date&&item.time===String(row.booking_time).slice(0,5)&&item.style===row.hairstyle_name&&Number(item.price)===Number(row.price_aud)&&item.status===row.status});
  if(!stylesMatch||!bookingsMatch)throw new Error('The shared database contains records outside this backup. Import is limited to an empty database to protect existing records.');
  await syncOwnerState(data,true);return data;
}
async function exportBackup(source){
  const data=structuredClone(source||readLocal({styles:[],bookings:[],hours:{open:'10:00',close:'19:00'}}));
  for(const style of data.styles||[])for(const image of style.images||[]){
    if(!image.storagePath||String(image.data||'').startsWith('data:'))continue;
    const response=await fetch(image.data);if(!response.ok)throw new Error('Could not download a photo for the backup.');
    const blob=await response.blob();image.data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob)});
  }
  return{format:'hair-by-sara-local-backup-v1',exportedAt:new Date().toISOString(),storageKey:KEY,data};
}
window.HairBySaraDataStore={
  key:KEY,readLocal,saveLocal,load,availableSlots,requestBooking,saveStyle,deleteStyle,updateBookingStatus,deleteBooking,saveWorkingHours,syncOwnerState,importBackup,exportBackup,
  getUser,isOwner,
  signIn:(email,password)=>getClient().auth.signInWithPassword({email,password}),
  signOut:()=>getClient().auth.signOut()
};
})();
