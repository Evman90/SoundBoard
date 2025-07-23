import type { Express, Request } from "express";
import express from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { insertSoundClipSchema, insertTriggerWordSchema } from "@shared/schema";

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req: any, file: any, cb: any) => {
    const allowedTypes = /\.(mp3|wav|ogg)$/i;
    if (allowedTypes.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error("Only MP3, WAV, and OGG files are allowed"));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve uploaded files
  app.use("/uploads", express.static(uploadDir));

  // Get all sound clips
  app.get("/api/sound-clips", async (req, res) => {
    try {
      const soundClips = await storage.getSoundClips();
      res.json(soundClips);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sound clips" });
    }
  });

  // Upload sound clip
  app.post("/api/sound-clips", upload.single("audio"), async (req: Request & { file?: Express.Multer.File }, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No audio file provided" });
      }

      const { originalname, filename, size } = req.file;
      const format = path.extname(originalname).toLowerCase().substring(1);
      const name = req.body.name || path.basename(originalname, path.extname(originalname));

      // Get audio duration (simplified - in real app would use audio processing library)
      const duration = parseFloat(req.body.duration) || 0;

      const soundClipData = {
        name,
        filename,
        format,
        duration,
        size,
        url: `/uploads/${filename}`,
      };

      const validatedData = insertSoundClipSchema.parse(soundClipData);
      const soundClip = await storage.createSoundClip(validatedData);
      
      res.status(201).json(soundClip);
    } catch (error) {
      console.error("Error uploading sound clip:", error);
      res.status(500).json({ message: "Failed to upload sound clip" });
    }
  });

  // Delete sound clip
  app.delete("/api/sound-clips/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const soundClip = await storage.getSoundClip(id);
      
      if (!soundClip) {
        return res.status(404).json({ message: "Sound clip not found" });
      }

      // Delete file from disk
      const filePath = path.join(uploadDir, soundClip.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      await storage.deleteSoundClip(id);
      res.json({ message: "Sound clip deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete sound clip" });
    }
  });

  // Get all trigger words
  app.get("/api/trigger-words", async (req, res) => {
    try {
      const triggerWords = await storage.getTriggerWords();
      res.json(triggerWords);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch trigger words" });
    }
  });

  // Create trigger word
  app.post("/api/trigger-words", async (req, res) => {
    try {
      const validatedData = insertTriggerWordSchema.parse(req.body);
      const triggerWord = await storage.createTriggerWord(validatedData);
      res.status(201).json(triggerWord);
    } catch (error) {
      console.error("Error creating trigger word:", error);
      res.status(400).json({ message: "Invalid trigger word data" });
    }
  });

  // Update trigger word
  app.patch("/api/trigger-words/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = insertTriggerWordSchema.partial().parse(req.body);
      const triggerWord = await storage.updateTriggerWord(id, updates);
      
      if (!triggerWord) {
        return res.status(404).json({ message: "Trigger word not found" });
      }
      
      res.json(triggerWord);
    } catch (error) {
      res.status(400).json({ message: "Invalid update data" });
    }
  });

  // Delete trigger word
  app.delete("/api/trigger-words/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteTriggerWord(id);
      res.json({ message: "Trigger word deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete trigger word" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
