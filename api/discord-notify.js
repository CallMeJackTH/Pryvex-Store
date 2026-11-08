const SUPABASE_URL = "https://tigmqawivnuhtektcnmn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_fyqgX33SC2z-h7mybMDbnA_qu4SH0yw";
const CHANNEL_ID = "1568830875729137825";

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!process.env.DISCORD_BOT_TOKEN) {
    return res.status(503).json({ error: "ยังไม่ได้ตั้งค่า DISCORD_BOT_TOKEN ใน Vercel" });
  }

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "กรุณาเข้าสู่ระบบ" });

  try {
    const authResponse = await fetch(SUPABASE_URL + "/auth/v1/user", {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + token }
    });
    if (!authResponse.ok) return res.status(401).json({ error: "เซสชันหมดอายุ" });
    const user = await authResponse.json();

    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const event = body.event;
    const topupId = String(body.topup_id || "");
    const orderId = String(body.order_id || "");
    if (event === "key_purchased") {
      if (!orderId) return res.status(400).json({ error: "ไม่พบรหัสคำสั่งซื้อ" });
    } else if (!["topup_submitted", "topup_approved", "topup_rejected"].includes(event) || !topupId) {
      return res.status(400).json({ error: "ข้อมูลแจ้งเตือนไม่ถูกต้อง" });
    }

    if (event !== "topup_submitted" && event !== "key_purchased") {
      const adminResponse = await fetch(
        SUPABASE_URL + "/rest/v1/store_admins?select=user_id&user_id=eq." + encodeURIComponent(user.id),
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + token } }
      );
      if (!adminResponse.ok) return res.status(403).json({ error: "ตรวจสอบสิทธิ์แอดมินไม่สำเร็จ" });
      const admins = await adminResponse.json();
      if (!Array.isArray(admins) || admins.length === 0) return res.status(403).json({ error: "เฉพาะแอดมินเท่านั้น" });
    }

    let notificationFields = [];
    let notificationTitle;
    let notificationDescription;
    let notificationColor;
    let buttonLabel = "ไปหน้าตรวจสลิป";
    let buttonUrl = "https://pryvex-store.vercel.app/?page=admin";

    if (event === "key_purchased") {
      const orderResponse = await fetch(
        SUPABASE_URL + "/rest/v1/store_orders?select=id,user_id,total,status,created_at&id=eq." + encodeURIComponent(orderId) + "&user_id=eq." + encodeURIComponent(user.id),
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + token } }
      );
      if (!orderResponse.ok) return res.status(400).json({ error: "อ่านข้อมูลคำสั่งซื้อไม่สำเร็จ" });
      const orders = await orderResponse.json();
      const order = orders[0];
      if (!order) return res.status(404).json({ error: "ไม่พบคำสั่งซื้อของสมาชิกนี้" });

      const itemResponse = await fetch(
        SUPABASE_URL + "/rest/v1/store_order_items?select=product_name,unit_price,quantity,delivery_type,key_number&order_id=eq." + encodeURIComponent(orderId),
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + token } }
      );
      if (!itemResponse.ok) return res.status(400).json({ error: "อ่านรายละเอียดสินค้าไม่สำเร็จ" });
      const items = await itemResponse.json();
      const item = Array.isArray(items) ? items[0] : null;
      if (!item || item.delivery_type !== "license") {
        return res.status(400).json({ error: "คำสั่งซื้อนี้ไม่ใช่การซื้อ License Key" });
      }

      notificationTitle = "มีการซื้อ License Key ใหม่!";
      notificationDescription = "มีสมาชิกซื้อคีย์จาก Pryvex Store";
      notificationColor = 0x2ecc71;
      buttonLabel = "เปิด Pryvex Store";
      buttonUrl = "https://pryvex-store.vercel.app/";
      notificationFields = [
        { name: "สมาชิก", value: String(user.user_metadata?.global_name || user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.user_name || "สมาชิก Pryvex Store").slice(0, 80), inline: true },
        { name: "สินค้า", value: String(item.product_name || "License Key").slice(0, 100), inline: true },
        { name: "ลำดับคีย์", value: "#" + String(item.key_number || "-"), inline: true },
        { name: "ราคา", value: Number(item.unit_price || order.total).toLocaleString("th-TH") + " บาท", inline: true },
        { name: "รหัสคำสั่งซื้อ", value: "`" + order.id + "`" }
      ];
    } else {
      const query = "/rest/v1/store_topups?select=id,user_id,amount,payment_method,status,created_at&id=eq." + encodeURIComponent(topupId);
      const topupResponse = await fetch(SUPABASE_URL + query, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + token }
      });
      if (!topupResponse.ok) return res.status(400).json({ error: "อ่านข้อมูลรายการเติมเงินไม่สำเร็จ" });
      const rows = await topupResponse.json();
      const topup = rows[0];
      if (!topup) return res.status(404).json({ error: "ไม่พบรายการเติมเงิน" });
      if (event === "topup_submitted" && topup.user_id !== user.id) {
        return res.status(403).json({ error: "ไม่มีสิทธิ์แจ้งเตือนรายการนี้" });
      }

      notificationTitle = ({
        topup_submitted: "มีรายการเติมเงินใหม่",
        topup_approved: "อนุมัติรายการเติมเงินแล้ว",
        topup_rejected: "ปฏิเสธรายการเติมเงิน"
      })[event];
      notificationDescription = ({
        topup_submitted: "มีสมาชิกส่งสลิปเข้ามา กรุณาตรวจสอบในหน้าแอดมิน",
        topup_approved: "แอดมินอนุมัติรายการแล้ว",
        topup_rejected: "แอดมินปฏิเสธรายการเติมเงิน"
      })[event];
      notificationColor = ({ topup_submitted: 0x5865f2, topup_approved: 0x2ecc71, topup_rejected: 0xe74c3c })[event];
      notificationFields = [
        { name: "สมาชิก", value: String(user.user_metadata?.global_name || user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.user_name || "สมาชิก Pryvex Store").slice(0, 80), inline: true },
        { name: "ยอดเงิน", value: Number(topup.amount).toLocaleString("th-TH") + " บาท", inline: true },
        { name: "ช่องทาง", value: String(topup.payment_method || "-").slice(0, 100), inline: true },
        { name: "รหัสรายการ", value: "`" + topup.id + "`" }
      ];
    }

    const displayName = String(
      user.user_metadata?.global_name ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.user_metadata?.user_name ||
      "สมาชิก Pryvex Store"
    ).slice(0, 80);

    const discordResponse = await fetch("https://discord.com/api/v10/channels/" + CHANNEL_ID + "/messages", {
      method: "POST",
      headers: {
        Authorization: "Bot " + process.env.DISCORD_BOT_TOKEN,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        components: [{
          type: 1,
          components: [{
            type: 2,
            style: 5,
            label: buttonLabel,
            url: buttonUrl
          }]
        }],
        embeds: [{
          title: notificationTitle,
          description: notificationDescription,
          color: notificationColor,
          image: { url: "https://i.ibb.co/d4FQxsCs/72d136879c86.jpg" },
          fields: notificationFields,
          timestamp: new Date().toISOString(),
          footer: { text: "Pryvex Store Notifications" }
        }]
      })
    });

    if (!discordResponse.ok) {
      const detail = await discordResponse.text();
      console.error("Discord API error:", discordResponse.status, detail.slice(0, 500));
      return res.status(502).json({ error: "Discord ส่งข้อความไม่สำเร็จ", discord_status: discordResponse.status });
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("discord notify:", error);
    return res.status(500).json({ error: "ส่งการแจ้งเตือนไม่สำเร็จ" });
  }
};
