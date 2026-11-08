import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const SUPABASE_URL = 'https://tigmqawivnuhtektcnmn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_fyqgX33SC2z-h7mybMDbnA_qu4SH0yw';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
let currentUser = null;
let isAdmin = false;
const $ = (id) => document.getElementById(id);
const money = (n) => new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB'}).format(Number(n||0));
const esc = (v='') => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)}
function page(name){document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden'));$(name+'Page').classList.remove('hidden');document.querySelectorAll('.nav-link').forEach(b=>b.classList.toggle('active',b.dataset.page===name));if(name==='wallet')loadWallet();if(name==='orders')loadOrders();if(name==='admin')loadAdmin()}
function signedIn(){return !!currentUser}
function requireLogin(){if(!signedIn()){toast('กรุณาเข้าสู่ระบบ Discord ก่อน');return false}return true}
async function refreshSession(){
 const {data:{session}}=await supabase.auth.getSession();currentUser=session?.user||null;
 $('loginBtn').classList.toggle('hidden',!!currentUser);$('logoutBtn').classList.toggle('hidden',!currentUser);
 if(currentUser){const {data:admin}=await supabase.from('store_admins').select('user_id').eq('user_id',currentUser.id).maybeSingle();isAdmin=!!admin;$('adminNav').classList.toggle('hidden',!isAdmin);await loadWallet();}
 else{isAdmin=false;$('adminNav').classList.add('hidden');$('walletMini').classList.add('hidden');$('walletBalance').textContent='฿0.00'}
}
async function loadProducts(){
 const {data,error}=await supabase.from('store_products').select('id,name,description,category,price,image_url,stock,delivery_type,is_active').eq('is_active',true).order('created_at',{ascending:false});
 if(error){$('products').innerHTML='<div class="empty">โหลดสินค้าไม่สำเร็จ กรุณาลองใหม่</div>';return}
 $('productCount').textContent=(data?.length||0)+' รายการ';
 $('products').innerHTML=data?.length?data.map(p=>'<article class="product-card">'+(p.image_url?'<img class="product-image" src="'+esc(p.image_url)+'" alt="">':'<div class="product-image"></div>')+'<div class="product-body"><span class="eyebrow">'+esc(p.category||'ทั่วไป')+'</span><h3>'+esc(p.name)+'</h3><p>'+esc(p.description||'สินค้าดิจิทัลจาก Pryvex Store')+'</p><div class="product-meta"><strong class="price">'+money(p.price)+'</strong><button class="btn btn-primary" data-buy="'+p.id+'">ซื้อสินค้า</button></div></div></article>').join(''):'<div class="empty">ยังไม่มีสินค้าในร้าน</div>';
}
async function loadWallet(){
 if(!currentUser)return;
 const {data}=await supabase.from('store_wallets').select('balance').eq('user_id',currentUser.id).maybeSingle();
 const balance=Number(data?.balance||0);$('walletBalance').textContent=money(balance);$('walletMini').textContent=money(balance);$('walletMini').classList.remove('hidden');
 const {data:rows}=await supabase.from('store_topups').select('id,amount,payment_method,status,created_at,review_note').eq('user_id',currentUser.id).order('created_at',{ascending:false}).limit(10);
 $('topupHistory').innerHTML=rows?.length?rows.map(r=>'<div class="history-row"><div><b>'+money(r.amount)+'</b><div class="muted">'+esc(r.payment_method)+' · '+new Date(r.created_at).toLocaleString('th-TH')+'</div>'+(r.review_note?'<div class="muted">'+esc(r.review_note)+'</div>':'')+'</div><span class="status '+r.status+'">'+statusText(r.status)+'</span></div>').join(''):'<span class="muted">ยังไม่มีรายการเติมเงิน</span>';
}
function statusText(s){return ({pending:'รอตรวจสอบ',approved:'อนุมัติแล้ว',rejected:'ปฏิเสธ',paid:'ชำระแล้ว',processing:'กำลังดำเนินการ',completed:'สำเร็จ',cancelled:'ยกเลิก'})[s]||s}
async function loadOrders(){
 if(!requireLogin())return;
 const {data:orders,error}=await supabase.from('store_orders').select('id,total,status,created_at,store_order_items(product_name,quantity,delivery_payload)').eq('user_id',currentUser.id).order('created_at',{ascending:false});
 if(error){$('ordersList').textContent='ไม่สามารถโหลดประวัติได้';return}
 $('ordersList').innerHTML=orders?.length?orders.map(o=>'<div class="history-row"><div><b>คำสั่งซื้อ #'+esc(o.id.slice(0,8))+'</b><div class="muted">'+(o.store_order_items||[]).map(i=>esc(i.product_name)+' × '+i.quantity+(i.delivery_payload?' · '+esc(i.delivery_payload):'')).join('<br>')+'</div><div class="muted">'+new Date(o.created_at).toLocaleString('th-TH')+'</div></div><div><b>'+money(o.total)+'</b> <span class="status '+o.status+'">'+statusText(o.status)+'</span></div></div>').join(''):'<span class="muted">ยังไม่มีคำสั่งซื้อ</span>';
}
async function buyProduct(id){
 if(!requireLogin())return;
 if(!confirm('ยืนยันการซื้อสินค้านี้ด้วยยอดเงินในกระเป๋า?'))return;
 const {data,error}=await supabase.rpc('store_purchase_product',{p_product_id:id});
 if(error){toast(error.message||'ซื้อสินค้าไม่สำเร็จ');return}
 toast('ซื้อสินค้าสำเร็จ');await loadProducts();await loadWallet();await loadOrders();
}
async function submitTopup(e){
 e.preventDefault();if(!requireLogin())return;
 const f=new FormData(e.currentTarget),amount=Number(f.get('amount')),file=f.get('slip'),method=f.get('method');
 if(!file||!file.size||file.size>4*1024*1024){toast('กรุณาแนบรูปสลิปไม่เกิน 4 MB (EasySlip)');return}
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)){toast('รองรับไฟล์ JPG, PNG และ WEBP');return}
 const ext=file.name.split('.').pop().toLowerCase(),path=currentUser.id+'/'+crypto.randomUUID()+'.'+ext;
 const {error:uploadError}=await supabase.storage.from('store-slips').upload(path,file,{contentType:file.type,upsert:false});
 if(uploadError){toast('อัปโหลดสลิปไม่สำเร็จ: '+uploadError.message);return}
 const {data:topup,error}=await supabase.from('store_topups').insert({user_id:currentUser.id,amount,payment_method:method,slip_path:path,status:'pending'}).select('id').single();
 if(error){toast('บันทึกรายการไม่สำเร็จ: '+error.message);return}
 e.currentTarget.reset();
 const {data:verification,error:verificationError}=await supabase.functions.invoke('verify-store-slip',{body:{topup_id:topup.id}});
 if(verificationError){toast('ส่งสลิปแล้ว แต่ระบบตรวจสอบอัตโนมัติขัดข้อง รายการยังรอ Admin ตรวจสอบ');}
 else if(verification?.verification_status==='verified'){toast('ตรวจสอบสลิปผ่านแล้ว รอ Admin อนุมัติ');}
 else if(verification?.verification_status==='failed'){toast('ระบบพบความผิดปกติ กรุณารอ Admin ตรวจสอบ');}
 else{toast('ส่งสลิปแล้ว รายการรอ Admin ตรวจสอบ');}
 await loadWallet();
}
async function loadAdmin(){
 if(!isAdmin){toast('ไม่มีสิทธิ์เข้าถึง');page('shop');return}
 const {data:rows}=await supabase.from('store_topups').select('id,user_id,amount,payment_method,slip_path,created_at,verification_status,verification_amount,verification_reference,verification_duplicate,verification_receiver_match,verification_error,verification_result').eq('status','pending').order('created_at',{ascending:true});
 $('adminTopups').innerHTML=rows?.length?await Promise.all(rows.map(async r=>{
  const {data}=await supabase.storage.from('store-slips').createSignedUrl(r.slip_path,300);
  const verifyLabel=({verified:'EasySlip: ผ่าน',failed:'EasySlip: ไม่ผ่าน',error:'EasySlip: ตรวจไม่ได้',not_checked:'ยังไม่ตรวจ'})[r.verification_status]||'ยังไม่ตรวจ';
  const verifyClass=r.verification_status==='verified'?'approved':r.verification_status==='failed'?'rejected':'';
  const verifyInfo=r.verification_status==='verified'?'ยอดในสลิป '+money(r.verification_amount)+(r.verification_reference?' · Ref '+esc(r.verification_reference):''):(r.verification_error?esc(r.verification_error):'รอผลตรวจสอบ');
  const manualButton=data?.signedUrl?'<button class="btn-mini" data-manual-review="'+r.id+'" data-slip-url="'+esc(data.signedUrl)+'" data-amount="'+Number(r.amount)+'">ตรวจสอบเอง</button>':'';
  return '<div class="history-row"><div><b>'+money(r.amount)+' · '+esc(r.payment_method)+'</b><div class="muted">'+esc(r.user_id)+' · '+new Date(r.created_at).toLocaleString('th-TH')+'</div><div class="status '+verifyClass+'">'+verifyLabel+'</div><div class="muted">'+verifyInfo+'</div>'+(r.verification_duplicate?'<div class="status rejected">EasySlip แจ้งว่าสลิปซ้ำ</div>':'')+(r.verification_receiver_match===false?'<div class="status rejected">EasySlip แจ้งว่าบัญชีผู้รับไม่ตรง</div>':'')+(data?.signedUrl?'<a class="slip-preview-link" target="_blank" rel="noopener" href="'+esc(data.signedUrl)+'"><img class="slip-thumb" src="'+esc(data.signedUrl)+'" alt="สลิปแนบ">เปิดดูสลิปขนาดเต็ม</a>':'')+'</div><div class="inline-actions">'+manualButton+'<button class="btn-mini" data-review="'+r.id+'" data-approve="true">อนุมัติ</button><button class="btn-mini btn-danger" data-review="'+r.id+'" data-approve="false">ปฏิเสธ</button></div></div>'
 }).join('')):'<span class="muted">ไม่มีรายการรอตรวจสอบ</span>';
 const {data:products}=await supabase.from('store_products').select('id,name,price,stock,is_active').order('created_at',{ascending:false});
 $('adminProducts').innerHTML=products?.length?products.map(p=>'<div class="history-row product-admin-row"><div><b>'+esc(p.name)+'</b><div class="muted">'+money(p.price)+' · '+(p.stock===null?'สต็อกไม่จำกัด':'คงเหลือ '+p.stock+' ชิ้น')+' · '+(p.is_active?'เปิดขาย':'ปิดขาย')+'</div></div><div class="inline-actions"><button class="btn-mini" data-edit="'+p.id+'">แก้ไข / เพิ่มสต็อก</button><button class="btn-mini btn-danger" data-delete="'+p.id+'">ลบ</button></div></div>').join(''):'<span class="muted">ยังไม่มีสินค้า</span>';
}
function openManualReview(id,slipUrl,amount){
 if(!isAdmin)return;
 const form=$('manualReviewForm');
 form.reset();form.elements.topup_id.value=id;form.elements.amount.value=amount;
 $('manualSlipImage').src=slipUrl;
 $('manualReviewModal').classList.remove('hidden');
}
async function submitManualReview(e){
 e.preventDefault();if(!isAdmin)return;
 const f=new FormData(e.currentTarget);
 const required=['received','amount_match','receiver_match','not_duplicate'];
 if(required.some(k=>!f.get(k))){toast('กรุณายืนยันการตรวจสอบให้ครบทุกข้อ');return}
 const ref=String(f.get('reference')||'').trim();
 const note='ตรวจสอบด้วยแอดมินจากรายการเดินบัญชีแล้ว: ยืนยันว่าได้รับเงินจริง, ยอดตรง, ผู้รับตรง และไม่ใช่สลิปซ้ำ'+(ref?' · Ref: '+ref:'');
 await reviewTopup(f.get('topup_id'),true,note);
 $('manualReviewModal').classList.add('hidden');
}
async function reviewTopup(id,approve,noteOverride){
 const note=noteOverride??(prompt(approve?'หมายเหตุ (ถ้ามี)':'ระบุเหตุผลที่ปฏิเสธ')||'');
 const {error}=await supabase.rpc('store_review_topup',{p_topup_id:id,p_approve:approve,p_note:note});
 if(error){toast('ดำเนินการไม่สำเร็จ: '+error.message);return}
 toast(approve?'อนุมัติรายการแล้ว':'ปฏิเสธรายการแล้ว');await loadAdmin();
}
async function addProduct(e){
 e.preventDefault();if(!isAdmin)return;
 const f=new FormData(e.currentTarget),stock=f.get('stock');
 let imageUrl=f.get('image_url')||null;
 const imageFile=f.get('image_file');
 if(imageFile && imageFile.size){
  try{imageUrl=await uploadProductImage(imageFile)}catch(err){toast(err.message);return}
 }
 const row={name:f.get('name').trim(),price:Number(f.get('price')),category:f.get('category')||'ทั่วไป',description:f.get('description')||'',image_url:imageUrl,stock:stock===''?null:Number(stock),delivery_type:f.get('delivery_type'),delivery_payload:f.get('delivery_payload')||null,is_active:true};
 const {error}=await supabase.from('store_products').insert(row);
 if(error){toast('เพิ่มสินค้าไม่สำเร็จ: '+error.message);return}
 e.currentTarget.reset();toast('เพิ่มสินค้าแล้ว');await loadProducts();await loadAdmin();
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
 const {data:p,error}=await supabase.from('store_products').select('id,name,description,category,price,image_url,stock,delivery_type,delivery_payload,is_active').eq('id',id).single();
 if(error||!p){toast('โหลดข้อมูลสินค้าไม่สำเร็จ');return}
 const form=$('editProductForm');
 form.elements.id.value=p.id;form.elements.name.value=p.name||'';form.elements.price.value=p.price;
 form.elements.category.value=p.category||'ทั่วไป';form.elements.stock.value=p.stock===null?'':p.stock;form.elements.current_stock.value=p.stock===null?'':p.stock;form.elements.stock_add.value='';
 form.elements.description.value=p.description||'';form.elements.image_url.value=p.image_url||'';
 form.elements.delivery_type.value=p.delivery_type||'manual';form.elements.delivery_payload.value=p.delivery_payload||'';
 form.elements.is_active.checked=!!p.is_active;form.elements.image_file.value='';
 $('editProductModal').classList.remove('hidden');
}
async function saveProductEdit(e){
 e.preventDefault();if(!isAdmin)return;
 const f=e.currentTarget, data=new FormData(f), id=data.get('id');
 let nextStock=data.get('stock')===''?null:Number(data.get('stock'));
 const stockToAdd=Number(data.get('stock_add')||0),oldStock=data.get('current_stock');
 if(!Number.isInteger(stockToAdd)||stockToAdd<0){toast('จำนวนที่เพิ่มต้องเป็นเลขจำนวนเต็มตั้งแต่ 0 ขึ้นไป');return}
 if(stockToAdd>0){if(oldStock===''){toast('สินค้านี้ตั้งค่าเป็นสต็อกไม่จำกัด ให้กำหนดจำนวนสต็อกใหม่แทน');return}nextStock=Number(oldStock)+stockToAdd;}
 const row={name:String(data.get('name')||'').trim(),price:Number(data.get('price')),category:data.get('category')||'ทั่วไป',description:data.get('description')||'',stock:nextStock,delivery_type:data.get('delivery_type'),delivery_payload:data.get('delivery_payload')||null,is_active:f.elements.is_active.checked,updated_at:new Date().toISOString()};
 if(!row.name||!Number.isFinite(row.price)||row.price<0||(!Number.isInteger(row.stock)&&row.stock!==null)||(row.stock!==null&&row.stock<0)){toast('กรุณาตรวจสอบชื่อ ราคา และจำนวนสต็อก');return}
 try{
  const file=f.elements.image_file.files[0];
  if(file&&file.size)row.image_url=await uploadProductImage(file);
  else row.image_url=data.get('image_url')||null;
 }catch(err){toast(err.message);return}
 const {error}=await supabase.from('store_products').update(row).eq('id',id);
 if(error){toast('บันทึกสินค้าไม่สำเร็จ: '+error.message);return}
 $('editProductModal').classList.add('hidden');toast('บันทึกสินค้าและสต็อกแล้ว');await loadProducts();await loadAdmin();
}
async function deleteProduct(id){if(!confirm('ต้องการลบสินค้านี้หรือไม่?'))return;const {error}=await supabase.from('store_products').delete().eq('id',id);if(error){toast(error.message);return}toast('ลบสินค้าแล้ว');await loadProducts();await loadAdmin()}
$('loginBtn').addEventListener('click',async()=>{const {error}=await supabase.auth.signInWithOAuth({provider:'discord',options:{redirectTo:location.origin}});if(error)toast(error.message)});
$('logoutBtn').addEventListener('click',async()=>{await supabase.auth.signOut();toast('ออกจากระบบแล้ว')});
$('topupForm').addEventListener('submit',submitTopup);$('productForm').addEventListener('submit',addProduct);$('editProductForm').addEventListener('submit',saveProductEdit);
$('closeEditProduct').addEventListener('click',()=>$('editProductModal').classList.add('hidden'));
$('cancelEditProduct').addEventListener('click',()=>$('editProductModal').classList.add('hidden'));
$('manualReviewForm').addEventListener('submit',submitManualReview);
$('closeManualReview').addEventListener('click',()=>$('manualReviewModal').classList.add('hidden'));
$('cancelManualReview').addEventListener('click',()=>$('manualReviewModal').classList.add('hidden'));
document.addEventListener('click',e=>{const n=e.target.closest('[data-page]');if(n)page(n.dataset.page);const go=e.target.closest('[data-go]');if(go)page(go.dataset.go);const buy=e.target.closest('[data-buy]');if(buy)buyProduct(buy.dataset.buy);const manual=e.target.closest('[data-manual-review]');if(manual)openManualReview(manual.dataset.manualReview,manual.dataset.slipUrl,manual.dataset.amount);const rev=e.target.closest('[data-review]');if(rev)reviewTopup(rev.dataset.review,rev.dataset.approve==='true');const edit=e.target.closest('[data-edit]');if(edit)editProduct(edit.dataset.edit);const del=e.target.closest('[data-delete]');if(del)deleteProduct(del.dataset.delete);const copy=e.target.closest('[data-copy]');if(copy){navigator.clipboard.writeText(copy.dataset.copy);toast('คัดลอกแล้ว')}});
supabase.auth.onAuthStateChange(()=>setTimeout(refreshSession,0));
await refreshSession();await loadProducts();
