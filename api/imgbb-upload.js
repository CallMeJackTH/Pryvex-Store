// Vercel Serverless Function: secure ImgBB uploads for authenticated store admins.
const SUPABASE_URL = "https://tigmqawivnuhtektcnmn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_fyqgX33SC2z-h7mybMDbnA_qu4SH0yw";

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
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

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    if (body.length > 7 * 1024 * 1024) return res.status(413).json({ error: "ไฟล์ใหญ่เกินไป" });

    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if (!boundaryMatch) return res.status(400).json({ error: "รูปแบบไฟล์ไม่ถูกต้อง" });
    const boundary = boundaryMatch[1] || boundaryMatch[2];
    const headerMarker = Buffer.from('name="image"');
    const headerStart = body.indexOf(headerMarker);
    if (headerStart < 0) return res.status(400).json({ error: "ไม่พบไฟล์รูปภาพ" });

    const dataStartMarker = Buffer.from("\r\n\r\n");
    const headerEnd = body.indexOf(dataStartMarker, headerStart);
    if (headerEnd < 0) return res.status(400).json({ error: "ข้อมูลไฟล์ไม่ถูกต้อง" });
    const dataStart = headerEnd + dataStartMarker.length;
    const dataEnd = body.indexOf(Buffer.from("\r\n--" + boundary), dataStart);
    if (dataEnd < 0) return res.status(400).json({ error: "อ่านไฟล์รูปภาพไม่สำเร็จ" });

    const image = body.subarray(dataStart, dataEnd);
    if (!image.length || image.length > 5 * 1024 * 1024) {
      return res.status(413).json({ error: "รูปสินค้าต้องไม่เกิน 5 MB" });
    }

    const isJpeg = image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff;
    const isPng = image.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const isWebp = image.subarray(0, 4).toString() === "RIFF" && image.subarray(8, 12).toString() === "WEBP";
    if (!isJpeg && !isPng && !isWebp) {
      return res.status(415).json({ error: "ไฟล์ต้องเป็น JPG, PNG หรือ WEBP เท่านั้น" });
    }

    const imageBlob = new Blob([image], { type: isJpeg ? "image/jpeg" : isPng ? "image/png" : "image/webp" });
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

    return res.status(200).json({ url: result.data.url });
  } catch (error) {
    console.error("imgbb-upload:", error);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดในระบบอัปโหลด" });
  }
};

module.exports.config = { api: { bodyParser: false } };
