import { exec } from "child_process";
import * as dotenv from "dotenv";
import { schedule } from "node-cron";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

dotenv.config();

const client = new S3Client({
  region: process.env.AWS_S3_REGION as string,
  endpoint: process.env.AWS_S3_ENDPOINT as string,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
  forcePathStyle: true,
});

// Fonction pour exécuter la commande de backup PostgreSQL
const backupDatabase = (database: string): Promise<string> => {
  const filePath = `/tmp/${Date.now()}.sql`;
  const command = `pg_dump -d ${database} -f ${filePath}`;
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Backup error for database ${database}: ${stderr}`);
        reject(stderr);
      } else {
        console.log(`Backup created for database ${database}: ${filePath}`);
        resolve(filePath);
      }
    });
  });
};

// Fonction pour envoyer le fichier sur S3
const uploadToS3 = async (filePath: string): Promise<void> => {
  const fileContent = require("fs").readFileSync(filePath);

  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");

  const path = `backup_${yyyy}-${mm}-${dd}-${hh}-${min}-${ss}`;
  try {
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET as string,
      Key: `${path}.sql`,
      Body: fileContent,
    });

    await client.send(command);

    console.log(`File uploaded successfully: ${path}.sql`);
  } catch (err) {
    console.error("Error uploading file: ", (err as Error).message);
  }
};

// Planification des backups
const databases = process.env.DATABASES?.split(",") || [];
const runOnStartup = process.env.RUN_ON_STARTUP?.toLocaleLowerCase() === "true";
const cronExpression = process.env.CRON || "0 */8 * * *"; // Default to every 8 hours

if (runOnStartup) {
  databases.forEach(async (db) => {
    const filePath = await backupDatabase(db);
    await uploadToS3(filePath);
  });
}

schedule(
  cronExpression,
  () => {
    databases.forEach(async (db) => {
      const filePath = await backupDatabase(db);
      await uploadToS3(filePath);
    });
  },
  {
    scheduled: true,
    timezone: "UTC",
  }
);

console.log(`Backup scheduled with cron: ${cronExpression}`);
