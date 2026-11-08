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
 if(!file||!file.size||file.size>5*1024*1024){toast('กรุณาแนบรูปสลิปไม่เกิน 5 MB');return}
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)){toast('รองรับไฟล์ JPG, PNG และ WEBP');return}
 const ext=file.name.split('.').pop().toLowerCase(),path=currentUser.id+'/'+crypto.randomUUID()+'.'+ext;
 const {error:uploadError}=await supabase.storage.from('store-slips').upload(path,file,{contentType:file.type,upsert:false});
 if(uploadError){toast('อัปโหลดสลิปไม่สำเร็จ: '+uploadError.message);return}
 const {error}=await supabase.from('store_topups').insert({user_id:currentUser.id,amount,payment_method:method,slip_path:path,status:'pending'});
 if(error){toast('บันทึกรายการไม่สำเร็จ: '+error.message);return}
 e.currentTarget.reset();toast('ส่งสลิปแล้ว รอแอดมินตรวจสอบ');await loadWallet();
}
async function loadAdmin(){
 if(!isAdmin){toast('ไม่มีสิทธิ์เข้าถึง');page('shop');return}
 const {data:rows}=await supabase.from('store_topups').select('id,user_id,amount,payment_method,slip_path,created_at').eq('status','pending').order('created_at',{ascending:true});
 $('adminTopups').innerHTML=rows?.length?await Promise.all(rows.map(async r=>{const {data}=await supabase.storage.from('store-slips').createSignedUrl(r.slip_path,300);return '<div class="history-row"><div><b>'+money(r.amount)+' · '+esc(r.payment_method)+'</b><div class="muted">'+esc(r.user_id)+' · '+new Date(r.created_at).toLocaleString('th-TH')+'</div>'+(data?.signedUrl?'<a target="_blank" rel="noopener" href="'+esc(data.signedUrl)+'">เปิดดูสลิป</a>':'')+'</div><div class="inline-actions"><button class="btn-mini" data-review="'+r.id+'" data-approve="true">อนุมัติ</button><button class="btn-mini btn-danger" data-review="'+r.id+'" data-approve="false">ปฏิเสธ</button></div></div>'}).join('')):'<span class="muted">ไม่มีรายการรอตรวจสอบ</span>';
 const {data:products}=await supabase.from('store_products').select('id,name,price,is_active').order('created_at',{ascending:false});
 $('adminProducts').innerHTML=products?.length?products.map(p=>'<div class="history-row"><div><b>'+esc(p.name)+'</b><div class="muted">'+money(p.price)+' · '+(p.is_active?'เปิดขาย':'ปิดขาย')+'</div></div><button class="btn-mini btn-danger" data-delete="'+p.id+'">ลบสินค้า</button></div>').join(''):'<span class="muted">ยังไม่มีสินค้า</span>';
}
async function reviewTopup(id,approve){
 const note=prompt(approve?'หมายเหตุ (ถ้ามี)':'ระบุเหตุผลที่ปฏิเสธ')||'';
 const {error}=await supabase.rpc('store_review_topup',{p_topup_id:id,p_approve:approve,p_note:note});
 if(error){toast('ดำเนินการไม่สำเร็จ: '+error.message);return}
 toast(approve?'อนุมัติรายการแล้ว':'ปฏิเสธรายการแล้ว');await loadAdmin();
}
async function addProduct(e){
 e.preventDefault();if(!isAdmin)return;
 const f=new FormData(e.currentTarget),stock=f.get('stock');
 const row={name:f.get('name').trim(),price:Number(f.get('price')),category:f.get('category')||'ทั่วไป',description:f.get('description')||'',image_url:f.get('image_url')||null,stock:stock===''?null:Number(stock),delivery_type:f.get('delivery_type'),delivery_payload:f.get('delivery_payload')||null,is_active:true};
 const {error}=await supabase.from('store_products').insert(row);
 if(error){toast('เพิ่มสินค้าไม่สำเร็จ: '+error.message);return}
 e.currentTarget.reset();toast('เพิ่มสินค้าแล้ว');await loadProducts();await loadAdmin();
}
async function deleteProduct(id){if(!confirm('ต้องการลบสินค้านี้หรือไม่?'))return;const {error}=await supabase.from('store_products').delete().eq('id',id);if(error){toast(error.message);return}toast('ลบสินค้าแล้ว');await loadProducts();await loadAdmin()}
$('loginBtn').addEventListener('click',async()=>{const {error}=await supabase.auth.signInWithOAuth({provider:'discord',options:{redirectTo:location.origin}});if(error)toast(error.message)});
$('logoutBtn').addEventListener('click',async()=>{await supabase.auth.signOut();toast('ออกจากระบบแล้ว')});
$('topupForm').addEventListener('submit',submitTopup);$('productForm').addEventListener('submit',addProduct);
document.addEventListener('click',e=>{const n=e.target.closest('[data-page]');if(n)page(n.dataset.page);const go=e.target.closest('[data-go]');if(go)page(go.dataset.go);const buy=e.target.closest('[data-buy]');if(buy)buyProduct(buy.dataset.buy);const rev=e.target.closest('[data-review]');if(rev)reviewTopup(rev.dataset.review,rev.dataset.approve==='true');const del=e.target.closest('[data-delete]');if(del)deleteProduct(del.dataset.delete);const copy=e.target.closest('[data-copy]');if(copy){navigator.clipboard.writeText(copy.dataset.copy);toast('คัดลอกแล้ว')}});
supabase.auth.onAuthStateChange(()=>setTimeout(refreshSession,0));
await refreshSession();await loadProducts();
