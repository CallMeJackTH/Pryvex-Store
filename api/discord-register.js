const APPLICATION_ID = "1568792110264614932";

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    return res.status(503).json({ error: "ยังไม่ได้ตั้งค่า DISCORD_BOT_TOKEN ใน Vercel" });
  }

  try {
    const response = await fetch(
      "https://discord.com/api/v10/applications/" + APPLICATION_ID + "/commands",
      {
        method: "PUT",
        headers: {
          Authorization: "Bot " + token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify([{
          name: "test",
          description: "ทดสอบสถานะบอท Pryvex Store",
          type: 1
        }])
      }
    );

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Discord command registration failed:", response.status, result);
      return res.status(502).json({
        error: "ลงทะเบียนคำสั่ง Discord ไม่สำเร็จ",
        discord_status: response.status
      });
    }

    return res.status(200).json({
      ok: true,
      commands: Array.isArray(result) ? result.map(command => command.name) : ["test"]
    });
  } catch (error) {
    console.error("Discord command registration error:", error);
    return res.status(500).json({ error: "ลงทะเบียนคำสั่งไม่สำเร็จ" });
  }
};
