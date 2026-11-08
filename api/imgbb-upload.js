// Vercel Serverless Function: secure ImgBB uploads for authenticated store admins.
const SUPABASE_URL = "https://tigmqawivnuhtektcnmn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_fyqgX33SC2z-h7mybMDbnA_qu4SH0yw";

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = (req.headers.authorization || "").replace(/^Bearer\\s+/i, "");
  if (!token) return res.status(401).json({ error: "กรุณาเข้าสู่ระบบก่อน" });
  if (!process.env.IMGBB_API_KEY) {
    return res.status(503).json({ error: "ยังไม่ได้ตั้งค่า IMGBB_API_KEY ใน Vercel" });
  }

  try {
    const userResponse = await fetch(SUPABASE_URL + "/auth/v1/user", {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + token }
    });
    if (!userResponse.ok) return res.status(401).json({ error: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" });
    const user = await userResponse.json();

    const adminResponse = await fetch(
      SUPABASE_URL + "/rest/v1/store_admins?select=user_id&user_id=eq." + encodeURIComponent(user.id),
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + token } }
    );
    if (!adminResponse.ok) return res.status(403).json({ error: "ตรวจสอบสิทธิ์ Admin ไม่สำเร็จ" });
    const admins = await adminResponse.json();
    if (!Array.isArray(admins) || admins.length === 0) {
      return res.status(403).json({ error: "เฉพาะ Admin เท่านั้นที่อัปโหลดรูปสินค้าได้" });
    }

    const contentType = req.headers["content-type"] || "";
    if (!contentType.includes("multipart/form-data")) {
      return res.status(400).json({ error: "กรุณาส่งไฟล์รูปภาพ" });
    }

    // Vercel parses multipart bodies only when configured; raw request streaming is used here.
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    if (body.length > 7 * 1024 * 1024) return res.status(413).json({ error: "ไฟล์ใหญ่เกินไป" });

    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if (!boundaryMatch) return res.status(400).json({ error: "รูปแบบไฟล์ไม่ถูกต้อง" });
    const boundary = boundaryMatch[1] || boundaryMatch[2];
    const parts = body.toString("latin1").split("--" + boundary);
    let imagePart = null;
    for (const part of parts) {
      if (/name="image"/i.test(part)) {
        const splitAt = part.indexOf("\\r\\n\\r\\n");
        if (splitAt >= 0) {
          let raw = part.slice(splitAt + 4);
          raw = raw.replace(/\\r\\n--?$/, "").replace(/\\r\\n$/, "");
          imagePart = Buffer.from(raw, "latin1");
          break;
        }
      }
    }
    if (!imagePart || imagePart.length === 0) return res.status(400).json({ error: "ไม่พบไฟล์รูปภาพ" });
    if (imagePart.length > 5 * 1024 * 1024) return res.status(413).json({ error: "รูปสินค้าต้องไม่เกิน 5 MB" });

    const imageBlob = new Blob([imagePart], { type: "application/octet-stream" });
    const uploadForm = new FormData();
    uploadForm.append("image", imageBlob, "product-image");
    const imgbbResponse = await fetch(
      "https://api.imgbb.com/1/upload?key=" + encodeURIComponent(process.env.IMGBB_API_KEY),
      { method: "POST", body: uploadForm }
    );
    const result = await imgbbResponse.json();
    if (!imgbbResponse.ok || !result.success || !result.data?.url) {
      return res.status(502).json({ error: "ImgBB อัปโหลดไม่สำเร็จ" });
    }
    return res.status(200).json({ url: result.data.url, delete_url: result.data.delete_url || null });
  } catch (error) {
    console.error("imgbb-upload:", error);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดในระบบอัปโหลด" });
  }
};
