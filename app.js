import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const SUPABASE_URL = 'https://tigmqawivnuhtektcnmn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_fyqgX33SC2z-h7mybMDbnA_qu4SH0yw';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
let currentUser = null;
let isAdmin = false;
let adminLoadSequence = 0;
let topupSubmitting = false;
const activeReviews = new Set();

function withTimeout(promise, ms, message) {
 return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))]);
}
function readableError(error, fallback='เกิดข้อผิดพลาด กรุณาลองใหม่') {
 return String(error?.message || error?.error_description || error?.details || fallback).slice(0, 240);
}
function setBusy(button, busy, busyText, normalText) {
 if (!button) return;
 button.disabled = busy;
 button.textContent = busy ? busyText : normalText;
}
const $ = (id) => document.getElementById(id);
const money = (n) => new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB'}).format(Number(n||0));
const esc = (v='') => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(message){
 if(message&&typeof message.then==='function'){message.then(value=>toast(value)).catch(error=>toast(error?.message||'เกิดข้อผิดพลาด'));return}
 const el=$('toast');
 const readable=Array.isArray(message)?message.join(' '):(typeof message==='string'?message:(message?.message||'เกิดข้อผิดพลาด'));
 el.textContent=readable;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),3500);
}
function page(name){document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden'));$(name+'Page').classList.remove('hidden');document.querySelectorAll('.nav-link').forEach(b=>b.classList.toggle('active',b.dataset.page===name));if(name==='wallet')loadWallet();if(name==='orders')loadOrders();if(name==='admin')loadAdmin()}
function signedIn(){return !!currentUser}
function requireLogin(){if(!signedIn()){toast('กรุณาเข้าสู่ระบบ Discord ก่อน');return false}return true}
async function refreshSession(){
 try{
  const {data:{session},error}=await supabase.auth.getSession();
  if(error)throw error;
  currentUser=session?.user||null;
  $('loginBtn').classList.toggle('hidden',!!currentUser);$('logoutBtn').classList.toggle('hidden',!currentUser);
  if(currentUser){
   const {data:admin,error:adminError}=await supabase.from('store_admins').select('user_id').eq('user_id',currentUser.id).maybeSingle();
   if(adminError)throw adminError;
   isAdmin=!!admin;$('adminNav').classList.toggle('hidden',!isAdmin);
   await loadWallet();
   if(isAdmin&&!$('adminPage').classList.contains('hidden'))await loadAdmin();
  }else{
   isAdmin=false;$('adminNav').classList.add('hidden');$('walletMini').classList.add('hidden');$('walletBalance').textContent='฿0.00';
   $('topupHistory').innerHTML='<span class="muted">เข้าสู่ระบบเพื่อดูรายการ</span>';
  }
 }catch(error){console.error('refreshSession:',error);toast('ตรวจสอบสถานะเข้าสู่ระบบไม่สำเร็จ: '+readableError(error))}
}
async function loadProducts(){
 const target=$('products');target.innerHTML='<div class="empty">กำลังโหลดสินค้า...</div>';
 try{
  const {data,error}=await withTimeout(supabase.from('store_products').select('id,name,description,category,price,image_url,stock,delivery_type,is_active').eq('is_active',true).order('created_at',{ascending:false}),18000,'โหลดสินค้าใช้เวลานานเกินไป');
  if(error)throw error;
  $('productCount').textContent=(data?.length||0)+' รายการ';
  target.innerHTML=data?.length?data.map(p=>'<article class="product-card">'+(p.image_url?'<img class="product-image" loading="lazy" decoding="async" src="'+esc(p.image_url)+'" alt="">':'<div class="product-image"></div>')+'<div class="product-body"><span class="eyebrow">'+esc(p.category||'ทั่วไป')+'</span><h3>'+esc(p.name)+'</h3><p>'+esc(p.description||'สินค้าดิจิทัลจาก Pryvex Store')+'</p><div class="product-meta"><strong class="price">'+money(p.price)+'</strong><button class="btn btn-primary" type="button" data-buy="'+p.id+'">ซื้อสินค้า</button></div></div></article>').join(''):'<div class="empty">ยังไม่มีสินค้าในร้าน</div>';
 }catch(error){console.error('loadProducts:',error);$('productCount').textContent='โหลดไม่สำเร็จ';target.innerHTML='<div class="empty">โหลดสินค้าไม่สำเร็จ: '+esc(readableError(error))+' <button class="btn-mini" type="button" data-reload-products>ลองอีกครั้ง</button></div>'}
}
async function loadWallet(){
 if(!currentUser)return;
 const balanceEl=$('walletBalance'), miniEl=$('walletMini'), historyEl=$('topupHistory');
 if(historyEl)historyEl.innerHTML='<span class="muted">กำลังโหลดข้อมูล...</span>';
 try{
  const [walletResult,topupResult]=await withTimeout(Promise.all([
   supabase.from('store_wallets').select('balance').eq('user_id',currentUser.id).maybeSingle(),
   supabase.from('store_topups').select('id,amount,payment_method,status,created_at,review_note').eq('user_id',currentUser.id).order('created_at',{ascending:false}).limit(10)
  ]),18000,'โหลดข้อมูลกระเป๋าเงินใช้เวลานานเกินไป');
  if(walletResult.error)throw walletResult.error;
  if(topupResult.error)throw topupResult.error;
  const balance=Number(walletResult.data?.balance||0);
  balanceEl.textContent=money(balance);miniEl.textContent=money(balance);miniEl.classList.remove('hidden');
  const rows=topupResult.data||[];
  historyEl.innerHTML=rows.length?rows.map(r=>'<div class="history-row"><div><b>'+money(r.amount)+'</b><div class="muted">'+esc(r.payment_method)+' · '+new Date(r.created_at).toLocaleString('th-TH')+'</div>'+(r.review_note?'<div class="muted">'+esc(r.review_note)+'</div>':'')+'</div><span class="status '+esc(r.status)+'">'+statusText(r.status)+'</span></div>').join(''):'<span class="muted">ยังไม่มีรายการเติมเงิน</span>';
 }catch(error){
  console.error('loadWallet:',error);
  historyEl.innerHTML='<span class="muted">โหลดข้อมูลกระเป๋าเงินไม่สำเร็จ: '+esc(readableError(error))+'</span>';
 }
}
function statusText(s){return ({pending:'รอตรวจสอบ',approved:'อนุมัติแล้ว',rejected:'ปฏิเสธ',paid:'ชำระแล้ว',processing:'กำลังดำเนินการ',completed:'สำเร็จ',cancelled:'ยกเลิก'})[s]||s}
async function loadOrders(){
 if(!requireLogin())return;
 const target=$('ordersList');target.innerHTML='<span class="muted">กำลังโหลดประวัติ...</span>';
 try{
  const {data:orders,error}=await withTimeout(supabase.from('store_orders').select('id,total,status,created_at,store_order_items(product_name,quantity,delivery_payload)').eq('user_id',currentUser.id).order('created_at',{ascending:false}),20000,'โหลดประวัติใช้เวลานานเกินไป');
  if(error)throw error;
  target.innerHTML=orders?.length?orders.map(o=>'<div class="history-row"><div><b>คำสั่งซื้อ #'+esc(o.id.slice(0,8))+'</b><div class="muted">'+(o.store_order_items||[]).map(i=>esc(i.product_name)+' × '+i.quantity+(i.delivery_payload?' · '+esc(i.delivery_payload):'')).join('<br>')+'</div><div class="muted">'+new Date(o.created_at).toLocaleString('th-TH')+'</div></div><div><b>'+money(o.total)+'</b> <span class="status '+esc(o.status)+'">'+statusText(o.status)+'</span></div></div>').join(''):'<span class="muted">ยังไม่มีคำสั่งซื้อ</span>';
 }catch(error){console.error('loadOrders:',error);target.innerHTML='<span class="muted">โหลดประวัติไม่สำเร็จ: '+esc(readableError(error))+'</span>'}
}
async function buyProduct(id,button){
 if(!requireLogin())return;
 if(!confirm('ยืนยันการซื้อสินค้านี้ด้วยยอดเงินในกระเป๋า?'))return;
 const oldText=button?.textContent||'ซื้อสินค้า';setBusy(button,true,'กำลังสั่งซื้อ...',oldText);
 try{
  const {data,error}=await withTimeout(supabase.rpc('store_purchase_product',{p_product_id:id}),20000,'การสั่งซื้อใช้เวลานานเกินไป');
  if(error)throw error;
  toast('ซื้อสินค้าสำเร็จ');
  await Promise.all([loadProducts(),loadWallet(),loadOrders()]);
 }catch(error){toast('ซื้อสินค้าไม่สำเร็จ: '+readableError(error))}
 finally{setBusy(button,false,'',oldText)}
}
async function submitTopup(e){
 e.preventDefault();
 const formElement=e.currentTarget;
 if(!requireLogin()||topupSubmitting)return;
 const f=new FormData(formElement),amount=Number(f.get('amount')),file=f.get('slip'),method=f.get('method');
 if(!Number.isFinite(amount)||amount<1||amount>50000){toast('กรุณาระบุยอดเติมเงินตั้งแต่ 1 ถึง 50,000 บาท');return}
 if(!file||!file.size||file.size>4*1024*1024){toast('กรุณาแนบรูปสลิปไม่เกิน 4 MB');return}
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)){toast('รองรับไฟล์ JPG, PNG และ WEBP');return}
 const submitButton=formElement.querySelector('button[type="submit"]');
 const originalButtonText=submitButton?.textContent||'ส่งสลิปเพื่อตรวจสอบ';
 topupSubmitting=true;setBusy(submitButton,true,'กำลังบันทึกรายการ...',originalButtonText);
 const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
 const path=currentUser.id+'/'+crypto.randomUUID()+'.'+ext;
 let uploaded=false;
 try{
  const uploadResult=await withTimeout(
   supabase.storage.from('store-slips').upload(path,file,{contentType:file.type,upsert:false}),
   35000,'อัปโหลดใช้เวลานานเกินไป กรุณาลองใหม่ด้วยเครือข่ายที่เสถียร'
  );
  if(uploadResult.error)throw new Error('อัปโหลดสลิปไม่สำเร็จ: '+uploadResult.error.message);
  uploaded=true;
  const insertResult=await withTimeout(
   supabase.from('store_topups').insert({user_id:currentUser.id,amount,payment_method:method,slip_path:path,status:'pending'}).select('id').single(),
   20000,'บันทึกรายการไม่สำเร็จ กรุณาตรวจสอบประวัติก่อนส่งซ้ำ'
  );
  if(insertResult.error)throw new Error('บันทึกรายการไม่สำเร็จ: '+insertResult.error.message);
  const topupId=insertResult.data.id;
  formElement.reset();
  toast('ส่งสลิปสำเร็จแล้ว! รายการถูกบันทึกและส่งให้แอดมินตรวจสอบ');
  void loadWallet();
  // Automatic verification runs in the background; it never blocks the user's submission.
  void runAutoVerification(topupId);
 }catch(error){
  console.error('submit topup:',error);
  if(uploaded&&safeToDeleteUploaded){
   try{await supabase.storage.from('store-slips').remove([path]);}catch(cleanupError){console.warn('slip cleanup:',cleanupError)}
  }
  toast(readableError(error,'ส่งสลิปไม่สำเร็จ กรุณาลองใหม่'));
 }finally{
  topupSubmitting=false;setBusy(submitButton,false,'',originalButtonText);
 }
}
async function runAutoVerification(topupId){
 try{
  const result=await withTimeout(
   supabase.functions.invoke('verify-store-slip',{body:{topup_id:topupId}}),
   32000,'ระบบตรวจอัตโนมัติตอบกลับช้าเกินไป'
  );
  if(result.error)throw result.error;
  const status=result.data?.verification_status;
  if(status==='verified')toast('EasySlip ตรวจผ่านแล้ว — รอแอดมินอนุมัติ');
  else if(status==='failed')toast('EasySlip พบข้อมูลที่ต้องตรวจเพิ่ม — รอแอดมินตรวจสอบ');
  else toast('บันทึกสลิปแล้ว — ระบบอัตโนมัติยังตรวจไม่ได้ แอดมินตรวจเองได้');
  if(isAdmin&& !$('adminPage').classList.contains('hidden'))void loadAdmin();
 }catch(error){
  console.warn('background slip verification:',error);
  // A provider failure must not undo or hide a successfully saved top-up.
 }
}
async function loadAdmin(){
 if(!isAdmin){toast('ไม่มีสิทธิ์เข้าถึง');page('shop');return}
 const loadId=++adminLoadSequence;
 const topupsEl=$('adminTopups');
 topupsEl.innerHTML='<span class="muted">กำลังโหลดรายการเติมเงิน...</span>';
 try{
  const {data:rows,error}=await withTimeout(supabase.from('store_topups')
   .select('id,user_id,amount,payment_method,slip_path,created_at,verification_status,verification_amount,verification_reference,verification_duplicate,verification_receiver_match,verification_error,verification_result')
   .eq('status','pending').order('created_at',{ascending:true}),20000,'โหลดรายการเติมเงินใช้เวลานานเกินไป');
  if(error)throw error;
  const cards=await Promise.all((rows||[]).map(async r=>{
   let signedUrl=null,slipError='';
   if(r.slip_path){
    const signed=await withTimeout(supabase.storage.from('store-slips').createSignedUrl(r.slip_path,1800),12000,'สร้างลิงก์สลิปใช้เวลานานเกินไป').catch(error=>({data:null,error}));
    signedUrl=signed.data?.signedUrl||null;
    slipError=signed.error?.message||'ไม่สามารถสร้างลิงก์ดูสลิปได้';
   }else slipError='ไม่พบตำแหน่งไฟล์สลิป';
   const verifyLabel=({verified:'EasySlip: ผ่าน',failed:'EasySlip: ไม่ผ่าน',error:'EasySlip: ตรวจไม่ได้',not_checked:'ยังไม่ตรวจ'})[r.verification_status]||'ยังไม่ตรวจ';
   const verifyClass=r.verification_status==='verified'?'approved':r.verification_status==='failed'?'rejected':'';
   const verifyInfo=r.verification_status==='verified'?'ยอดในสลิป '+money(r.verification_amount)+(r.verification_reference?' · Ref '+esc(r.verification_reference):''):(r.verification_error?esc(r.verification_error):'รอผลตรวจสอบ');
   const retryButton=['not_checked','error',null,undefined].includes(r.verification_status)?'<button class="btn-mini" data-retry-verify="'+r.id+'">ตรวจ EasySlip ซ้ำ</button>':'';
   const manualButton=r.slip_path?'<button class="btn-mini" type="button" data-manual-review="'+r.id+'" data-slip-path="'+esc(r.slip_path)+'" data-amount="'+Number(r.amount)+'">ตรวจสอบเอง</button>':'';
   const preview=signedUrl?'<a class="slip-preview-link" target="_blank" rel="noopener" href="'+esc(signedUrl)+'"><img class="slip-thumb" src="'+esc(signedUrl)+'" alt="สลิปแนบ">เปิดดูสลิปขนาดเต็ม</a>':'<div class="muted slip-error">รูปสลิป: '+esc(slipError)+'</div>';
   return '<div class="history-row admin-topup-row"><div class="admin-topup-info"><b>'+money(r.amount)+' · '+esc(r.payment_method)+'</b><div class="muted">'+esc(r.user_id)+' · '+new Date(r.created_at).toLocaleString('th-TH')+'</div><div class="status '+verifyClass+'">'+verifyLabel+'</div><div class="muted">'+verifyInfo+'</div>'+(r.verification_duplicate?'<div class="status rejected">EasySlip แจ้งว่าสลิปซ้ำ</div>':'')+(r.verification_receiver_match===false?'<div class="status rejected">บัญชีผู้รับไม่ตรง</div>':'')+preview+'</div><div class="inline-actions">'+retryButton+manualButton+'<button class="btn-mini btn-danger" data-review="'+r.id+'" data-approve="false">ปฏิเสธ</button></div></div>';
  }));
  if(loadId!==adminLoadSequence)return;
  topupsEl.innerHTML=cards.length?cards.join(''):'<span class="muted">ไม่มีรายการรอตรวจสอบ</span>';
 }catch(error){
  console.error('loadAdmin topups:',error);
  if(loadId===adminLoadSequence)topupsEl.innerHTML='<span class="muted">โหลดรายการเติมเงินไม่สำเร็จ: '+esc(readableError(error))+'</span>';
 }
 try{
  const {data:products,error}=await withTimeout(supabase.from('store_products').select('id,name,price,stock,is_active').order('created_at',{ascending:false}),18000,'โหลดรายการสินค้าแอดมินใช้เวลานานเกินไป');
  if(error)throw error;
  $('adminProducts').innerHTML=products?.length?products.map(p=>'<div class="history-row product-admin-row"><div><b>'+esc(p.name)+'</b><div class="muted">'+money(p.price)+' · '+(p.stock===null?'สต็อกไม่จำกัด':'คงเหลือ '+p.stock+' ชิ้น')+' · '+(p.is_active?'เปิดขาย':'ปิดขาย')+'</div></div><div class="inline-actions"><button class="btn-mini" data-edit="'+p.id+'">แก้ไข / เพิ่มสต็อก</button><button class="btn-mini btn-danger" data-delete="'+p.id+'">ลบ</button></div></div>').join(''):'<span class="muted">ยังไม่มีสินค้า</span>';
 }catch(error){
  console.error('loadAdmin products:',error);
  $('adminProducts').innerHTML='<span class="muted">โหลดสินค้าไม่สำเร็จ: '+esc(readableError(error))+'</span>';
 }
}
async function retrySlipVerification(id){
 if(!isAdmin)return;
 const button=document.querySelector('[data-retry-verify="'+CSS.escape(id)+'"]');
 const oldText=button?.textContent||'ตรวจ EasySlip ซ้ำ';
 setBusy(button,true,'กำลังตรวจ...',oldText);
 try{
  const result=await withTimeout(supabase.functions.invoke('verify-store-slip',{body:{topup_id:id}}),32000,'EasySlip ตอบกลับช้าเกินไป');
  let data=result.data;
  if(result.error){
   let detail=data?.error||data?.message;
   if(!detail&&result.error.context?.clone){
    try{const body=await result.error.context.clone().json();detail=body?.error||body?.message}catch{}
   }
   throw new Error(detail||readableError(result.error,'Edge Function ตรวจสอบไม่สำเร็จ'));
  }
  if(data?.verification_status==='verified')toast('EasySlip ตรวจผ่านแล้ว รอ Admin อนุมัติ');
  else if(data?.verification_status==='failed')toast('EasySlip ไม่ผ่าน: '+(data?.error||data?.message||'กรุณาตรวจสอบสลิปเอง'));
  else if(data?.verification_status==='error')toast('EasySlip ขัดข้อง: '+(data?.error||data?.message||'ตรวจสอบไม่ได้ กรุณาตรวจการตั้งค่า API Key'));
  else toast(data?.error||data?.message||'EasySlip ยังตรวจสอบไม่ได้ — แอดมินตรวจเองได้');
 }catch(error){toast('ตรวจ EasySlip ไม่สำเร็จ: '+readableError(error))}
 finally{await loadAdmin()}
}
async function openManualReview(id,slipPath,amount){
 if(!isAdmin){toast('ไม่มีสิทธิ์เข้าถึง');return}
 if(!id||!slipPath){toast('ไม่พบไฟล์สลิปของรายการนี้');return}
 const form=$('manualReviewForm'),modal=$('manualReviewModal'),image=$('manualSlipImage');
 if(!form||!modal||!image){toast('หน้าแสดงผลตรวจสอบไม่สมบูรณ์ กรุณารีเฟรชเว็บ');return}
 const button=document.querySelector('[data-manual-review="'+CSS.escape(id)+'"]');
 const oldText=button?.textContent||'ตรวจสอบเอง';
 setBusy(button,true,'กำลังเปิดสลิป...',oldText);
 try{
  const {data,error}=await withTimeout(supabase.storage.from('store-slips').createSignedUrl(slipPath,1800),15000,'เปิดไฟล์สลิปใช้เวลานานเกินไป');
  if(error)throw error;
  if(!data?.signedUrl)throw new Error('สร้างลิงก์สลิปไม่สำเร็จ ตรวจสอบสิทธิ์ Storage');
  form.reset();
  form.elements.namedItem('topup_id').value=id;
  form.elements.namedItem('amount').value=money(amount);
  image.onerror=()=>{image.removeAttribute('src');toast('เปิดรูปสลิปไม่ได้ กรุณากดรีเฟรชรายการ')};
  image.src=data.signedUrl;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden','false');
  modal.scrollTop=0;
 }catch(error){console.error('openManualReview:',error);toast('เปิดตรวจสอบสลิปไม่สำเร็จ: '+readableError(error))}
 finally{if(button?.isConnected)setBusy(button,false,'',oldText)}
}
async function submitManualReview(e){
 e.preventDefault();if(!isAdmin)return;
 const form=e.currentTarget,button=form.querySelector('button[type="submit"]'),oldText=button.textContent;
 const f=new FormData(form);
 const required=['received','amount_match','receiver_match','not_duplicate'];
 if(required.some(k=>!f.get(k))){toast('กรุณายืนยันการตรวจสอบให้ครบทุกข้อ');return}
 const ref=String(f.get('reference')||'').trim();
 const note='ตรวจสอบด้วยแอดมินจากรายการเดินบัญชีแล้ว: ยืนยันว่าได้รับเงินจริง, ยอดตรง, ผู้รับตรง และไม่ใช่สลิปซ้ำ'+(ref?' · Ref: '+ref:'');
 setBusy(button,true,'กำลังบันทึกผล...',oldText);
 try{
  const completed=await reviewTopup(f.get('topup_id'),true,note);
  if(completed){$('manualReviewModal').classList.add('hidden');form.reset()}
 }finally{setBusy(button,false,'',oldText)}
}
async function reviewTopup(id,approve,noteOverride){
 if(!isAdmin||activeReviews.has(id))return false;
 const note=noteOverride??(approve?'อนุมัติโดยแอดมิน':'ปฏิเสธโดยแอดมิน');
 activeReviews.add(id);
 const button=document.querySelector('[data-review="'+CSS.escape(id)+'"]');
 const oldText=button?.textContent||'บันทึกผล';
 setBusy(button,true,'กำลังบันทึก...',oldText);
 try{
  const {data,error}=await withTimeout(supabase.rpc('store_review_topup',{p_topup_id:id,p_approve:approve,p_note:note}),20000,'บันทึกผลตรวจสอบใช้เวลานานเกินไป');
  if(error)throw error;
  if(data?.status!==(approve?'approved':'rejected'))throw new Error('ฐานข้อมูลไม่ได้ยืนยันผลการตรวจสอบ');
  toast(approve?'อนุมัติรายการแล้ว เครดิตเข้ากระเป๋าแล้ว':'ปฏิเสธรายการแล้ว');
  await loadAdmin();
  if(approve)void loadWallet();
  return true;
 }catch(error){toast('ดำเนินการไม่สำเร็จ: '+readableError(error));return false}
 finally{activeReviews.delete(id);if(button?.isConnected)setBusy(button,false,'',oldText)}
}
async function addProduct(e){
 e.preventDefault();if(!isAdmin)return;
 const form=e.currentTarget,button=form.querySelector('button[type="submit"]'),oldText=button.textContent;
 if(button.disabled)return;
 const f=new FormData(form),stock=f.get('stock');
 const price=Number(f.get('price')),stockValue=stock===''?null:Number(stock);
 if(!String(f.get('name')||'').trim()||!Number.isFinite(price)||price<0||(!Number.isInteger(stockValue)&&stockValue!==null)||(stockValue!==null&&stockValue<0)){toast('กรุณาตรวจสอบชื่อ ราคา และจำนวนสต็อก');return}
 setBusy(button,true,'กำลังเพิ่มสินค้า...',oldText);
 try{
  let imageUrl=f.get('image_url')||null;
  const imageFile=f.get('image_file');
  if(imageFile&&imageFile.size)imageUrl=await withTimeout(uploadProductImage(imageFile),30000,'อัปโหลดรูปสินค้าใช้เวลานานเกินไป');
  const row={name:String(f.get('name')).trim(),price,category:f.get('category')||'ทั่วไป',description:f.get('description')||'',image_url:imageUrl,stock:stockValue,delivery_type:f.get('delivery_type'),delivery_payload:f.get('delivery_payload')||null,is_active:true};
  const {error}=await withTimeout(supabase.from('store_products').insert(row),20000,'เพิ่มสินค้าใช้เวลานานเกินไป');
  if(error)throw error;
  form.reset();toast('เพิ่มสินค้าแล้ว');await loadProducts();await loadAdmin();
 }catch(error){toast('เพิ่มสินค้าไม่สำเร็จ: '+readableError(error))}
 finally{setBusy(button,false,'',oldText)}
}
async function uploadProductImage(file){
 if(!file||!file.size)return null;
 if(file.size>5*1024*1024)throw new Error('รูปสินค้าต้องไม่เกิน 5 MB');
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('รองรับรูป JPG, PNG และ WEBP');
 const {data:{session}}=await supabase.auth.getSession();
 if(!session?.access_token)throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
 const body=new FormData();body.append('image',file);
 const response=await fetch('/api/imgbb-upload',{method:'POST',headers:{Authorization:'Bearer '+session.access_token},body});
 const result=await response.json().catch(()=>({}));
 if(!response.ok||!result.url)throw new Error(result.error||'อัปโหลดรูปไม่สำเร็จ');
 return result.url;
}
async function editProduct(id){
 if(!isAdmin){toast('กรุณาเข้าสู่ระบบแอดมินใหม่');return}
 try{
  const {data:p,error}=await withTimeout(supabase.from('store_products').select('id,name,description,category,price,image_url,stock,delivery_type,delivery_payload,is_active').eq('id',id).single(),15000,'โหลดข้อมูลสินค้าใช้เวลานานเกินไป');
  if(error)throw error;
  if(!p)throw new Error('ไม่พบสินค้านี้ อาจถูกลบไปแล้ว');
  const form=$('editProductForm');
  for(const [name,value] of Object.entries({id:p.id,name:p.name||'',price:p.price,category:p.category||'ทั่วไป',stock:p.stock===null?'':p.stock,current_stock:p.stock===null?'':p.stock,stock_add:'',description:p.description||'',image_url:p.image_url||'',delivery_type:p.delivery_type||'manual',delivery_payload:p.delivery_payload||''})){
   const field=form.elements.namedItem(name);if(field)field.value=value;
  }
  form.elements.namedItem('is_active').checked=!!p.is_active;
  form.elements.namedItem('image_file').value='';
  $('editProductModal').classList.remove('hidden');
  $('editProductModal').setAttribute('aria-hidden','false');
 }catch(error){console.error('editProduct:',error);toast('เปิดหน้าแก้ไขสินค้าไม่สำเร็จ: '+readableError(error))}
}
async function saveProductEdit(e){
 e.preventDefault();if(!isAdmin)return;
 const f=e.currentTarget,button=f.querySelector('button[type="submit"]'),oldText=button.textContent;
 if(button.disabled)return;
 const data=new FormData(f),id=data.get('id');
 let nextStock=data.get('stock')===''?null:Number(data.get('stock'));
 const stockToAdd=Number(data.get('stock_add')||0),oldStock=data.get('current_stock');
 if(!Number.isInteger(stockToAdd)||stockToAdd<0){toast('จำนวนที่เพิ่มต้องเป็นเลขจำนวนเต็มตั้งแต่ 0 ขึ้นไป');return}
 if(stockToAdd>0){if(oldStock===''){toast('สินค้านี้ตั้งค่าเป็นสต็อกไม่จำกัด ให้กำหนดจำนวนสต็อกใหม่แทน');return}nextStock=Number(oldStock)+stockToAdd;}
 const row={name:String(data.get('name')||'').trim(),price:Number(data.get('price')),category:data.get('category')||'ทั่วไป',description:data.get('description')||'',stock:nextStock,delivery_type:data.get('delivery_type'),delivery_payload:data.get('delivery_payload')||null,is_active:f.elements.is_active.checked,updated_at:new Date().toISOString()};
 if(!row.name||!Number.isFinite(row.price)||row.price<0||(!Number.isInteger(row.stock)&&row.stock!==null)||(row.stock!==null&&row.stock<0)){toast('กรุณาตรวจสอบชื่อ ราคา และจำนวนสต็อก');return}
 setBusy(button,true,'กำลังบันทึก...',oldText);
 try{
  const file=f.elements.image_file.files[0];
  if(file&&file.size)row.image_url=await withTimeout(uploadProductImage(file),30000,'อัปโหลดรูปสินค้าใช้เวลานานเกินไป');
  else row.image_url=data.get('image_url')||null;
  const {data:updated,error}=await withTimeout(supabase.from('store_products').update(row).eq('id',id).select('id').maybeSingle(),20000,'บันทึกสินค้าใช้เวลานานเกินไป');
  if(error)throw error;
  if(!updated)throw new Error('ฐานข้อมูลไม่อนุญาตให้อัปเดตสินค้านี้ (ตรวจสอบสิทธิ์ RLS ของ store_products)');
  $('editProductModal').classList.add('hidden');toast('บันทึกสินค้าและสต็อกแล้ว');await loadProducts();await loadAdmin();
 }catch(error){toast('บันทึกสินค้าไม่สำเร็จ: '+readableError(error))}
 finally{setBusy(button,false,'',oldText)}
}
async function deleteProduct(id){if(!confirm('ต้องการลบสินค้านี้หรือไม่?'))return;try{const {error}=await supabase.from('store_products').delete().eq('id',id);if(error)throw error;toast('ลบสินค้าแล้ว');await loadProducts();await loadAdmin()}catch(error){toast('ลบสินค้าไม่สำเร็จ: '+readableError(error))}}
$('loginBtn').addEventListener('click',async()=>{const button=$('loginBtn');setBusy(button,true,'กำลังเชื่อมต่อ Discord...','เข้าสู่ระบบ Discord');try{const {error}=await supabase.auth.signInWithOAuth({provider:'discord',options:{redirectTo:location.origin}});if(error)throw error}catch(error){toast('เข้าสู่ระบบไม่สำเร็จ: '+readableError(error));setBusy(button,false,'','เข้าสู่ระบบ Discord')}});
$('logoutBtn').addEventListener('click',async()=>{const button=$('logoutBtn');setBusy(button,true,'กำลังออกจากระบบ...','ออกจากระบบ');try{const {error}=await supabase.auth.signOut();if(error)throw error;toast('ออกจากระบบแล้ว')}catch(error){toast('ออกจากระบบไม่สำเร็จ: '+readableError(error));setBusy(button,false,'','ออกจากระบบ')}});
$('topupForm').addEventListener('submit',submitTopup);$('productForm').addEventListener('submit',addProduct);$('editProductForm').addEventListener('submit',saveProductEdit);
$('closeEditProduct').addEventListener('click',()=>$('editProductModal').classList.add('hidden'));
$('cancelEditProduct').addEventListener('click',()=>$('editProductModal').classList.add('hidden'));
$('manualReviewForm').addEventListener('submit',submitManualReview);
$('closeManualReview').addEventListener('click',()=>$('manualReviewModal').classList.add('hidden'));
$('cancelManualReview').addEventListener('click',()=>$('manualReviewModal').classList.add('hidden'));
document.addEventListener('click',e=>{
 const target=e.target instanceof Element?e.target:e.target?.parentElement;
 if(!target)return;
 const closest=selector=>target.closest(selector);
 try{
  const n=closest('[data-page]');if(n){page(n.dataset.page);return}
  const go=closest('[data-go]');if(go){page(go.dataset.go);return}
  const buy=closest('[data-buy]');if(buy){buyProduct(buy.dataset.buy,buy);return}
  const retry=closest('[data-retry-verify]');if(retry){retrySlipVerification(retry.dataset.retryVerify);return}
  const reloadProducts=closest('[data-reload-products]');if(reloadProducts){loadProducts();return}
  const refreshAdmin=closest('#refreshAdminTopups');if(refreshAdmin){loadAdmin();return}
  const manual=closest('[data-manual-review]');if(manual){openManualReview(manual.dataset.manualReview,manual.dataset.slipPath,manual.dataset.amount);return}
  const rev=closest('[data-review]');if(rev){const approve=rev.dataset.approve==='true';if(!approve&&confirm('ยืนยันปฏิเสธรายการเติมเงินนี้?'))reviewTopup(rev.dataset.review,false,'ปฏิเสธโดยแอดมิน');return}
  const edit=closest('[data-edit]');if(edit){editProduct(edit.dataset.edit);return}
  const del=closest('[data-delete]');if(del){deleteProduct(del.dataset.delete);return}
  const copy=closest('[data-copy]');if(copy){const value=copy.dataset.copy;if(navigator.clipboard?.writeText){navigator.clipboard.writeText(value).then(()=>toast('คัดลอกแล้ว')).catch(()=>toast('คัดลอกไม่สำเร็จ กรุณาคัดลอกด้วยตนเอง: '+value))}else toast('เบราว์เซอร์ไม่รองรับการคัดลอกอัตโนมัติ: '+value)}
 }catch(error){console.error('UI click action:',error);toast('ปุ่มทำงานไม่สำเร็จ: '+readableError(error))}
});
supabase.auth.onAuthStateChange(()=>setTimeout(refreshSession,0));
await refreshSession();await loadProducts();
