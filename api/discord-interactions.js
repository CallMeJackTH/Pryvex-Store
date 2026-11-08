const crypto = require("crypto");

const CHANNEL_ID = "1568830875729137825";
const BOT_NAME = "JACK007";

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function verifyDiscordRequest(rawBody, signature, timestamp) {
  const publicKeyHex = process.env.DISCORD_PUBLIC_KEY || "";
  if (!/^[a-f0-9]{64}$/i.test(publicKeyHex) || !signature || !timestamp) return false;

  const derPrefix = Buffer.from("302a300506032b6570032100", "hex");
  const publicKey = crypto.createPublicKey({
    key: Buffer.concat([derPrefix, Buffer.from(publicKeyHex, "hex")]),
    format: "der",
    type: "spki"
  });

  return crypto.verify(
    null,
    Buffer.concat([Buffer.from(timestamp), rawBody]),
    publicKey,
    Buffer.from(signature, "hex")
  );
}

async function sendTestMessage() {
  if (!process.env.DISCORD_BOT_TOKEN) {
    throw new Error("ยังไม่ได้ตั้งค่า DISCORD_BOT_TOKEN ใน Vercel");
  }

  const response = await fetch(
    "https://discord.com/api/v10/channels/" + CHANNEL_ID + "/messages",
    {
      method: "POST",
      headers: {
        Authorization: "Bot " + process.env.DISCORD_BOT_TOKEN,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        embeds: [{
          title: "Pryvex Store Bot Online!",
          description: "ข้อความทดสอบจากคำสั่ง /test",
          color: 0x2ecc71,
          fields: [
            { name: "Bot", value: BOT_NAME, inline: true },
            { name: "Status", value: "Connected", inline: true },
            { name: "Notification", value: "Ready", inline: true }
          ],
          timestamp: new Date().toISOString(),
          footer: { text: "Pryvex Store Test" }
        }]
      })
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    console.error("Discord test message failed:", response.status, detail.slice(0, 500));
    throw new Error("ส่งข้อความไปยังห้องแจ้งเตือนไม่สำเร็จ (Discord HTTP " + response.status + ")");
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method not allowed");
  }

  try {
    const rawBody = await readRawBody(req);
    const signature = req.headers["x-signature-ed25519"];
    const timestamp = req.headers["x-signature-timestamp"];

    if (!verifyDiscordRequest(rawBody, signature, timestamp)) {
      return res.status(401).end("Invalid Discord request signature");
    }

    const interaction = JSON.parse(rawBody.toString("utf8"));

    // Discord endpoint verification handshake.
    if (interaction.type === 1) {
      return res.status(200).json({ type: 1 });
    }

    // /test application command.
    if (interaction.type === 2 && interaction.data?.name === "test") {
      try {
        await sendTestMessage();
        return res.status(200).json({
          type: 4,
          data: {
            flags: 64,
            embeds: [{
              title: "Pryvex Store Test สำเร็จ",
              description: "ส่งข้อความทดสอบไปยังห้องแจ้งเตือนแล้ว",
              color: 0x2ecc71,
              fields: [
                { name: "Bot", value: BOT_NAME, inline: true },
                { name: "Status", value: "Connected", inline: true },
                { name: "Notification", value: "Ready", inline: true }
              ]
            }]
          }
        });
      } catch (error) {
        return res.status(200).json({
          type: 4,
          data: {
            flags: 64,
            content: "❌ ทดสอบไม่สำเร็จ: " + String(error.message || "Unknown error").slice(0, 300)
          }
        });
      }
    }

    return res.status(200).json({
      type: 4,
      data: { flags: 64, content: "ไม่รู้จักคำสั่งนี้" }
    });
  } catch (error) {
    console.error("Discord interaction error:", error);
    return res.status(400).end("Bad interaction request");
  }
};

module.exports.config = {
  api: { bodyParser: false }
};
