import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const profiles = sqliteTable("profiles", {
  email: text("email").primaryKey(),
  displayName: text("display_name").notNull(),
  firstName: text("first_name").notNull().default(""),
  lastName: text("last_name").notNull().default(""),
  city: text("city").notNull().default(""),
  state: text("state").notNull().default("Yucatán"),
  country: text("country").notNull().default("México"),
  timezone: text("timezone").notNull().default("America/Merida"),
  weightUnit: text("weight_unit").notNull().default("kg"),
  role: text("role").notNull().default("USER"),
  status: text("status").notNull().default("ACTIVE"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const fishingTrips = sqliteTable("fishing_trips", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  title: text("title").notNull(),
  port: text("port").notNull(),
  fishingDate: text("fishing_date").notNull(),
  departureTime: text("departure_time"),
  returnTime: text("return_time"),
  area: text("area"),
  vessel: text("vessel"),
  captain: text("captain"),
  notes: text("notes"),
  status: text("status").notNull().default("DRAFT"),
  coverImageUrl: text("cover_image_url"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  deletedAt: text("deleted_at"),
});

export const catches = sqliteTable("catches", {
  id: text("id").primaryKey(),
  tripId: text("trip_id").notNull(),
  ownerEmail: text("owner_email").notNull(),
  species: text("species").notNull(),
  customSpecies: integer("custom_species", { mode: "boolean" }).notNull().default(false),
  weightKg: real("weight_kg").notNull(),
  originalWeight: real("original_weight").notNull(),
  originalUnit: text("original_unit").notNull(),
  releaseStatus: text("release_status").notNull().default("UNSPECIFIED"),
  lengthCm: real("length_cm"),
  caughtAt: text("caught_at"),
  lure: text("lure"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  deletedAt: text("deleted_at"),
});

export const mediaAssets = sqliteTable("media_assets", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  tripId: text("trip_id"),
  catchId: text("catch_id"),
  storageKey: text("storage_key").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  altText: text("alt_text"),
  createdAt: text("created_at").notNull(),
  deletedAt: text("deleted_at"),
});

export const species = sqliteTable("species", {
  id: text("id").primaryKey(),
  commonName: text("common_name").notNull(),
  aliases: text("aliases").notNull().default(""),
  scientificName: text("scientific_name"),
  slug: text("slug").notNull().unique(),
  iconKey: text("icon_key").notNull().default("fish"),
  sortOrder: integer("sort_order").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const ports = sqliteTable("ports", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  type: text("type").notNull().default("PUERTO"),
  municipality: text("municipality"),
  sortOrder: integer("sort_order").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  actorEmailHash: text("actor_email_hash").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  createdAt: text("created_at").notNull(),
});
