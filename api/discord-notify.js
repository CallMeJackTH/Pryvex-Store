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
    if (!["topup_submitted", "topup_approved", "topup_rejected"].includes(event) || !topupId) {
      return res.status(400).json({ error: "ข้อมูลแจ้งเตือนไม่ถูกต้อง" });
    }

    if (event !== "topup_submitted") {
      const adminResponse = await fetch(
        SUPABASE_URL + "/rest/v1/store_admins?select=user_id&user_id=eq." + encodeURIComponent(user.id),
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + token } }
      );
      if (!adminResponse.ok) return res.status(403).json({ error: "ตรวจสอบสิทธิ์แอดมินไม่สำเร็จ" });
      const admins = await adminResponse.json();
      if (!Array.isArray(admins) || admins.length === 0) return res.status(403).json({ error: "เฉพาะแอดมินเท่านั้น" });
    }

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

    const displayName = String(
      user.user_metadata?.global_name ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.user_metadata?.user_name ||
      "สมาชิก Pryvex Store"
    ).slice(0, 80);

    const titles = {
      topup_submitted: "มีรายการเติมเงินใหม่",
      topup_approved: "อนุมัติรายการเติมเงินแล้ว",
      topup_rejected: "ปฏิเสธรายการเติมเงิน"
    };
    const colors = { topup_submitted: 0x5865f2, topup_approved: 0x2ecc71, topup_rejected: 0xe74c3c };
    const descriptions = {
      topup_submitted: "มีสมาชิกส่งสลิปเข้ามา กรุณาตรวจสอบในหน้าแอดมิน",
      topup_approved: "แอดมินอนุมัติรายการแล้ว",
      topup_rejected: "แอดมินปฏิเสธรายการเติมเงิน"
    };

    const discordResponse = await fetch("https://discord.com/api/v10/channels/" + CHANNEL_ID + "/messages", {
      method: "POST",
      headers: {
        Authorization: "Bot " + process.env.DISCORD_BOT_TOKEN,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        embeds: [{
          title: titles[event],
          description: descriptions[event],
          color: colors[event],
          fields: [
            { name: "สมาชิก", value: displayName, inline: true },
            { name: "ยอดเงิน", value: Number(topup.amount).toLocaleString("th-TH") + " บาท", inline: true },
            { name: "ช่องทาง", value: String(topup.payment_method || "-").slice(0, 100), inline: true },
            { name: "รหัสรายการ", value: "`" + topup.id + "`" },
          ],
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
