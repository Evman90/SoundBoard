import { pgTable, text, serial, integer, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const soundClips = pgTable("sound_clips", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  filename: text("filename").notNull(),
  format: text("format").notNull(),
  duration: real("duration").notNull(),
  size: integer("size").notNull(),
  url: text("url").notNull(),
});

export const triggerWords = pgTable("trigger_words", {
  id: serial("id").primaryKey(),
  phrase: text("phrase").notNull(),
  soundClipId: integer("sound_clip_id").notNull(),
  caseSensitive: boolean("case_sensitive").default(false),
  enabled: boolean("enabled").default(true),
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  defaultResponseEnabled: boolean("default_response_enabled").default(false),
  defaultResponseSoundClipId: integer("default_response_sound_clip_id"),
  defaultResponseDelay: integer("default_response_delay").default(2000), // milliseconds
});

export const insertSoundClipSchema = createInsertSchema(soundClips).omit({
  id: true,
});

export const insertTriggerWordSchema = createInsertSchema(triggerWords).omit({
  id: true,
});

export const insertSettingsSchema = createInsertSchema(settings).omit({
  id: true,
});

export type InsertSoundClip = z.infer<typeof insertSoundClipSchema>;
export type SoundClip = typeof soundClips.$inferSelect;
export type InsertTriggerWord = z.infer<typeof insertTriggerWordSchema>;
export type TriggerWord = typeof triggerWords.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;
