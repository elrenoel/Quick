import { pgTable, text, timestamp, uuid, integer, jsonb, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── 1. Better Auth Tables ───────────────────────────────────────────────────

// Users Table
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  // Kolom Stage 6.5 (Daily Limit & Tracking)
  generationCountToday: integer("generation_count_today").default(0).notNull(),
  lastGenerationDate: text("last_generation_date"),
});

// Sessions Table
export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

// Accounts Table (Password & OAuth)
export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Verifications Table (Email Verification & Password Reset)
export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── 2. Yoohoo Application Tables ─────────────────────────────────────────────

// Documents Table (Mulai Stage 6.5, user_id NOT NULL)
export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  rawText: text("raw_text").notNull(),
  sessionId: text("session_id"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { mode: "string" }),
  contentLanguage: text("content_language").default("auto"),
});

// Flashcards Table
export const flashcards = pgTable("flashcards", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  term: text("term").notNull(),
  definition: text("definition").notNull(),
});

// Quiz Sets Table — kumpulan soal quiz per dokumen (misal "Set 1", "Set 2")
export const quizSets = pgTable("quiz_sets", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
});

// Quiz Questions Table
export const quizQuestions = pgTable("quiz_questions", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  quizSetId: uuid("quiz_set_id")
    .notNull()
    .references(() => quizSets.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  options: jsonb("options").$type<string[]>().notNull(),
  correctIndex: integer("correct_index").notNull(),
});

// Detail jawaban user per soal (disimpan agar bisa review attempt lama)
export type QuizAnswer = {
  questionId: string;
  selectedIndex: number;
  correctIndex: number;
};

// Quiz Attempts Table
export const quizAttempts = pgTable("quiz_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  sessionId: text("session_id"),
  score: integer("score").notNull(),
  total: integer("total").notNull(),
  answers: jsonb("answers").$type<QuizAnswer[]>().default([]).notNull(),
  quizSetId: uuid("quiz_set_id")
    .notNull()
    .references(() => quizSets.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
});

// ─── 3. Relations Definitions ─────────────────────────────────────────────────

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  documents: many(documents),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  user: one(user, {
    fields: [documents.userId],
    references: [user.id],
  }),
  flashcards: many(flashcards),
  quizSets: many(quizSets),
  quizQuestions: many(quizQuestions),
  quizAttempts: many(quizAttempts),
}));

export const quizSetsRelations = relations(quizSets, ({ one, many }) => ({
  document: one(documents, {
    fields: [quizSets.documentId],
    references: [documents.id],
  }),
  questions: many(quizQuestions),
  attempts: many(quizAttempts),
}));

export const flashcardsRelations = relations(flashcards, ({ one }) => ({
  document: one(documents, {
    fields: [flashcards.documentId],
    references: [documents.id],
  }),
}));

export const quizQuestionsRelations = relations(quizQuestions, ({ one }) => ({
  document: one(documents, {
    fields: [quizQuestions.documentId],
    references: [documents.id],
  }),
  quizSet: one(quizSets, {
    fields: [quizQuestions.quizSetId],
    references: [quizSets.id],
  }),
}));

export const quizAttemptsRelations = relations(quizAttempts, ({ one }) => ({
  document: one(documents, {
    fields: [quizAttempts.documentId],
    references: [documents.id],
  }),
  quizSet: one(quizSets, {
    fields: [quizAttempts.quizSetId],
    references: [quizSets.id],
  }),
}));

// ─── 4. TypeScript Inference Types ───────────────────────────────────────────

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;
export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;
export type Verification = typeof verification.$inferSelect;
export type NewVerification = typeof verification.$inferInsert;

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type Flashcard = typeof flashcards.$inferSelect;
export type NewFlashcard = typeof flashcards.$inferInsert;
export type QuizSet = typeof quizSets.$inferSelect;
export type NewQuizSet = typeof quizSets.$inferInsert;
export type QuizQuestion = typeof quizQuestions.$inferSelect;
export type NewQuizQuestion = typeof quizQuestions.$inferInsert;
export type QuizAttempt = typeof quizAttempts.$inferSelect;
export type NewQuizAttempt = typeof quizAttempts.$inferInsert;
