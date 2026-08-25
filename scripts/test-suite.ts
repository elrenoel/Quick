import dns from "node:dns";
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db, user, documents, flashcards, quizQuestions, quizSets, quizAttempts } from "../src/db";
import { eq, and, isNull, isNotNull } from "drizzle-orm";
import { generateStudyMaterials, generateQuizQuestions } from "../src/lib/ai";
import { DAILY_LIMIT, getUserQuota, incrementGenerationUsage } from "../src/lib/daily-limit";

// ── Test Runner ──────────────────────────────────────────────────────────────

let totalTests = 0;
let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    passed++;
    console.log(`    PASS  ${message}`);
  } else {
    failed++;
    failures.push(message);
    console.log(`    FAIL  ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  assert(actual === expected, `${message} (got: ${JSON.stringify(actual)}, expected: ${JSON.stringify(expected)})`);
}

function section(title: string) {
  console.log(`\n  ${title}`);
}

// ── Test Data ────────────────────────────────────────────────────────────────

const TEST_USER_ID = `test-${Date.now()}`;
const TEST_USER_EMAIL = `test-suite-${Date.now()}@example.com`;

let testDocId = "";
let testFlashcardIds: string[] = [];
let testQuizSetId = "";
let testQuizQuestionIds: string[] = [];

// ── Tests ────────────────────────────────────────────────────────────────────

async function runTests() {
  console.log("\n========================================");
  console.log("  Yoohoo API Test Suite");
  console.log("========================================");

  // ── SETUP ────────────────────────────────────────────────────────────────────
  section("SETUP: Create test user");
  try {
    await db
      .insert(user)
      .values({
        id: TEST_USER_ID,
        name: "Test Suite User",
        email: TEST_USER_EMAIL,
        emailVerified: true,
      })
      .onConflictDoNothing();
    assert(true, "Test user created");
  } catch (err) {
    assert(false, `Test user creation failed: ${err}`);
    process.exit(1);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 1. DAILY LIMIT
  // ══════════════════════════════════════════════════════════════════════════════
  section("1. DAILY LIMIT SYSTEM");

  const quota1 = await getUserQuota(TEST_USER_ID);
  assert(quota1 !== null, "getUserQuota returns quota for existing user");
  assertEqual(quota1?.currentCount, 0, "New user has 0 generations today");
  assertEqual(quota1?.remainingToday, DAILY_LIMIT, `New user has ${DAILY_LIMIT} remaining`);

  // Simulate generating 5 times
  for (let i = 0; i < DAILY_LIMIT; i++) {
    const q = await getUserQuota(TEST_USER_ID);
    assert(q !== null && q.currentCount < DAILY_LIMIT, `Generation ${i + 1}: within limit`);
    await incrementGenerationUsage(TEST_USER_ID, q!.today, q!.currentCount);
  }

  const quotaFull = await getUserQuota(TEST_USER_ID);
  assertEqual(quotaFull?.currentCount, DAILY_LIMIT, `After ${DAILY_LIMIT} generations, count = ${DAILY_LIMIT}`);
  assertEqual(quotaFull?.remainingToday, 0, "After limit reached, remaining = 0");

  // Reset for next tests
  await db
    .update(user)
    .set({ generationCountToday: 0, lastGenerationDate: "2000-01-01" })
    .where(eq(user.id, TEST_USER_ID));

  // ══════════════════════════════════════════════════════════════════════════════
  // 2. DOCUMENT CRUD
  // ══════════════════════════════════════════════════════════════════════════════
  section("2. DOCUMENT CRUD");

  // Create document
  const [doc] = await db
    .insert(documents)
    .values({
      userId: TEST_USER_ID,
      title: "Test Document",
      rawText: "This is test content about operating systems and memory management.",
      contentLanguage: "en",
    })
    .returning();
  testDocId = doc.id;
  assert(!!testDocId, "Document created successfully");
  assertEqual(doc.title, "Test Document", "Document title correct");
  assertEqual(doc.contentLanguage, "en", "Content language saved as 'en'");
  assert(doc.deletedAt === null, "New document has deleted_at = NULL");

  // Read document
  const [fetched] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, testDocId))
    .limit(1);
  assertEqual(fetched.title, "Test Document", "Document fetched correctly");

  // Update title
  const [updated] = await db
    .update(documents)
    .set({ title: "Updated Document Title" })
    .where(eq(documents.id, testDocId))
    .returning();
  assertEqual(updated.title, "Updated Document Title", "Document title updated");

  // ══════════════════════════════════════════════════════════════════════════════
  // 3. FLASHCARDS
  // ══════════════════════════════════════════════════════════════════════════════
  section("3. FLASHCARDS");

  const testFlashcards = [
    { term: "Virtual Memory", definition: "Memory management technique using disk as extension of RAM" },
    { term: "Page Fault", definition: "Exception when a program accesses a page not in physical memory" },
    { term: "Thrashing", definition: "Excessive paging causing severe performance degradation" },
  ];

  const insertedCards = await db
    .insert(flashcards)
    .values(testFlashcards.map((c) => ({ documentId: testDocId, ...c })))
    .returning();
  testFlashcardIds = insertedCards.map((c) => c.id);

  assertEqual(insertedCards.length, 3, "3 flashcards inserted");

  const [firstCard] = await db
    .select()
    .from(flashcards)
    .where(eq(flashcards.documentId, testDocId))
    .limit(1);
  assertEqual(firstCard.term, "Virtual Memory", "First flashcard term correct");
  assertEqual(firstCard.definition, testFlashcards[0].definition, "First flashcard definition correct");

  // ══════════════════════════════════════════════════════════════════════════════
  // 4. QUIZ SETS & QUESTIONS
  // ══════════════════════════════════════════════════════════════════════════════
  section("4. QUIZ SETS & QUESTIONS");

  const [quizSet] = await db
    .insert(quizSets)
    .values({ documentId: testDocId, label: "Set 1" })
    .returning();
  testQuizSetId = quizSet.id;
  assert(!!testQuizSetId, "Quiz set created");

  const testQuestions = [
    { question: "What is virtual memory?", options: ["A RAM type", "A disk extension of RAM", "A CPU feature", "A network protocol"], correctIndex: 1 },
    { question: "What causes a page fault?", options: ["Page in memory", "Page not in memory", "CPU overflow", "Disk full"], correctIndex: 1 },
    { question: "What is thrashing?", options: ["Fast paging", "Excessive paging", "No paging", "Correct paging"], correctIndex: 1 },
  ];

  const insertedQuestions = await db
    .insert(quizQuestions)
    .values(testQuestions.map((q) => ({ documentId: testDocId, quizSetId: testQuizSetId, ...q })))
    .returning();
  testQuizQuestionIds = insertedQuestions.map((q) => q.id);

  assertEqual(insertedQuestions.length, 3, "3 quiz questions inserted");

  const [firstQ] = await db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.documentId, testDocId))
    .limit(1);
  assertEqual(firstQ.correctIndex, 1, "Correct index stored correctly");
  assert(Array.isArray(firstQ.options), "Options is array");
  assertEqual(firstQ.options.length, 4, "Each question has 4 options");

  // ══════════════════════════════════════════════════════════════════════════════
  // 5. QUIZ ATTEMPTS
  // ══════════════════════════════════════════════════════════════════════════════
  section("5. QUIZ ATTEMPTS");

  const answers = testQuizQuestionIds.map((qId, idx) => ({
    questionId: qId,
    selectedIndex: idx === 0 ? 1 : 0, // First correct, rest wrong
    correctIndex: 1,
  }));

  const [attempt] = await db
    .insert(quizAttempts)
    .values({
      documentId: testDocId,
      sessionId: "test-session",
      score: 1,
      total: 3,
      answers,
      quizSetId: testQuizSetId,
    })
    .returning();

  assert(!!attempt.id, "Quiz attempt saved");
  assertEqual(attempt.score, 1, "Score is 1");
  assertEqual(attempt.total, 3, "Total is 3");
  assert(Array.isArray(attempt.answers), "Answers is array");
  assertEqual(attempt.answers.length, 3, "Answers array has 3 items");

  // Second attempt
  const [attempt2] = await db
    .insert(quizAttempts)
    .values({
      documentId: testDocId,
      sessionId: "test-session",
      score: 3,
      total: 3,
      answers: testQuizQuestionIds.map((qId) => ({
        questionId: qId,
        selectedIndex: 1,
        correctIndex: 1,
      })),
      quizSetId: testQuizSetId,
    })
    .returning();

  const allAttempts = await db
    .select()
    .from(quizAttempts)
    .where(eq(quizAttempts.documentId, testDocId));
  assertEqual(allAttempts.length, 2, "2 quiz attempts stored");

  // ══════════════════════════════════════════════════════════════════════════════
  // 6. SOFT DELETE (TRASH)
  // ══════════════════════════════════════════════════════════════════════════════
  section("6. SOFT DELETE (TRASH)");

  // Soft delete
  const [softDeleted] = await db
    .update(documents)
    .set({ deletedAt: new Date().toISOString() })
    .where(eq(documents.id, testDocId))
    .returning();
  assert(softDeleted.deletedAt !== null, "Document soft deleted (deleted_at set)");

  // Should NOT appear in active list
  const activeDocs = await db
    .select()
    .from(documents)
    .where(and(eq(documents.userId, TEST_USER_ID), isNull(documents.deletedAt)));
  assertEqual(activeDocs.length, 0, "Soft-deleted doc not in active list");

  // Should appear in trash
  const trashDocs = await db
    .select()
    .from(documents)
    .where(and(eq(documents.userId, TEST_USER_ID), isNotNull(documents.deletedAt)));
  assertEqual(trashDocs.length, 1, "Soft-deleted doc appears in trash");

  // Restore
  const [restored] = await db
    .update(documents)
    .set({ deletedAt: null })
    .where(eq(documents.id, testDocId))
    .returning();
  assert(restored.deletedAt === null, "Document restored (deleted_at = NULL)");

  const activeAfterRestore = await db
    .select()
    .from(documents)
    .where(and(eq(documents.userId, TEST_USER_ID), isNull(documents.deletedAt)));
  assertEqual(activeAfterRestore.length, 1, "Document back in active list after restore");

  // ══════════════════════════════════════════════════════════════════════════════
  // 7. PERMANENT DELETE
  // ══════════════════════════════════════════════════════════════════════════════
  section("7. PERMANENT DELETE + CASCADE");

  // Soft delete first
  await db.update(documents).set({ deletedAt: new Date().toISOString() }).where(eq(documents.id, testDocId));

  // Permanent delete
  const [permDeleted] = await db
    .delete(documents)
    .where(eq(documents.id, testDocId))
    .returning();
  assert(!!permDeleted.id, "Document permanently deleted");

  // Verify cascade: flashcards should be gone
  const remainingFlashcards = await db
    .select()
    .from(flashcards)
    .where(eq(flashcards.documentId, testDocId));
  assertEqual(remainingFlashcards.length, 0, "Cascade: flashcards deleted");

  // Verify cascade: quiz_sets should be gone
  const remainingQuizSets = await db
    .select()
    .from(quizSets)
    .where(eq(quizSets.documentId, testDocId));
  assertEqual(remainingQuizSets.length, 0, "Cascade: quiz_sets deleted");

  // Verify cascade: quiz_questions should be gone
  const remainingQuizQuestions = await db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.documentId, testDocId));
  assertEqual(remainingQuizQuestions.length, 0, "Cascade: quiz_questions deleted");

  // Verify cascade: quiz_attempts should be gone
  const remainingAttempts = await db
    .select()
    .from(quizAttempts)
    .where(eq(quizAttempts.documentId, testDocId));
  assertEqual(remainingAttempts.length, 0, "Cascade: quiz_attempts deleted");

  // ══════════════════════════════════════════════════════════════════════════════
  // 8. AI GENERATION (if GEMINI_API_KEY is set)
  // ══════════════════════════════════════════════════════════════════════════════
  section("8. AI GENERATION");

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    console.log("    SKIP  Gemini API key not set, skipping AI tests");
  } else {
    // Create a temporary doc for AI test
    const [aiDoc] = await db
      .insert(documents)
      .values({
        userId: TEST_USER_ID,
        title: "AI Test Doc",
        rawText: "Operating systems manage computer hardware and software resources. The kernel is the core component that handles memory management, process scheduling, and file system operations. Virtual memory allows programs to use more memory than physically available by swapping pages to disk. Context switching is the process of storing the state of a process so it can be restored later.",
        contentLanguage: "auto",
      })
      .returning();

    // Test generateStudyMaterials
    const studyResult = await generateStudyMaterials(aiDoc.rawText, "auto");
    assert(studyResult.flashcards.length > 0, `AI generated ${studyResult.flashcards.length} flashcards`);
    assert(studyResult.quiz.length > 0, `AI generated ${studyResult.quiz.length} quiz questions`);
    assert(!!studyResult.usedModel, `AI used model: ${studyResult.usedModel}`);
    assert(studyResult.latencyMs !== undefined, `AI latency: ${studyResult.latencyMs}ms`);

    // Verify flashcard structure
    const firstFc = studyResult.flashcards[0];
    assert(typeof firstFc.term === "string" && firstFc.term.length > 0, "Flashcard has valid term");
    assert(typeof firstFc.definition === "string" && firstFc.definition.length > 0, "Flashcard has valid definition");

    // Verify quiz structure
    const firstQuiz = studyResult.quiz[0];
    assert(typeof firstQuiz.question === "string" && firstQuiz.question.length > 0, "Quiz has valid question");
    assertEqual(firstQuiz.options.length, 4, "Quiz has exactly 4 options");
    assert(firstQuiz.correct_index >= 0 && firstQuiz.correct_index <= 3, "correct_index in range 0-3");

    // Test generateQuizQuestions
    const quizOnlyResult = await generateQuizQuestions(aiDoc.rawText, "en");
    assert(quizOnlyResult.quiz.length > 0, `Quiz-only generated ${quizOnlyResult.quiz.length} questions`);

    // Test with language instruction
    const idResult = await generateQuizQuestions(aiDoc.rawText, "id");
    assert(idResult.quiz.length > 0, "Quiz-only with Bahasa Indonesia works");

    const enResult = await generateQuizQuestions(aiDoc.rawText, "en");
    assert(enResult.quiz.length > 0, "Quiz-only with English works");

    // Cleanup AI test doc
    await db.delete(documents).where(eq(documents.id, aiDoc.id));
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 9. MULTI-SET QUIZ
  // ══════════════════════════════════════════════════════════════════════════════
  section("9. MULTI-SET QUIZ");

  // Create new doc for multi-set test
  const [multiDoc] = await db
    .insert(documents)
    .values({
      userId: TEST_USER_ID,
      title: "Multi-Set Test",
      rawText: "Test content for multiple quiz sets.",
      contentLanguage: "en",
    })
    .returning();

  // Create 3 quiz sets
  for (let i = 1; i <= 3; i++) {
    await db.insert(quizSets).values({ documentId: multiDoc.id, label: `Set ${i}` });
  }

  const sets = await db
    .select()
    .from(quizSets)
    .where(eq(quizSets.documentId, multiDoc.id));
  assertEqual(sets.length, 3, "3 quiz sets created");
  assertEqual(sets[0].label, "Set 1", "First set labeled 'Set 1'");
  assertEqual(sets[2].label, "Set 3", "Third set labeled 'Set 3'");

  // Cleanup
  await db.delete(documents).where(eq(documents.id, multiDoc.id));

  // ══════════════════════════════════════════════════════════════════════════════
  // 10. EDGE CASES
  // ══════════════════════════════════════════════════════════════════════════════
  section("10. EDGE CASES");

  // Non-existent user quota
  const nullQuota = await getUserQuota("non-existent-user-id");
  assertEqual(nullQuota, null, "Non-existent user returns null quota");

  // Document with empty rawText
  const [emptyDoc] = await db
    .insert(documents)
    .values({
      userId: TEST_USER_ID,
      title: "Empty Doc",
      rawText: "",
    })
    .returning();
  assert(!!emptyDoc.id, "Document with empty rawText can be created (validation is at API level)");

  // Cleanup
  await db.delete(documents).where(eq(documents.id, emptyDoc.id));

  // ══════════════════════════════════════════════════════════════════════════════
  // CLEANUP
  // ══════════════════════════════════════════════════════════════════════════════
  section("CLEANUP");
  try {
    // Delete test user (cascade will remove all related data)
    await db.delete(user).where(eq(user.id, TEST_USER_ID));
    assert(true, "Test user and all related data cleaned up");
  } catch (err) {
    assert(false, `Cleanup failed: ${err}`);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════════════════════════════════════
  console.log("\n========================================");
  console.log("  RESULTS");
  console.log("========================================");
  console.log(`  Total  : ${totalTests}`);
  console.log(`  Passed : ${passed}`);
  console.log(`  Failed : ${failed}`);
  console.log("========================================");

  if (failed > 0) {
    console.log("\n  FAILURES:");
    failures.forEach((f, i) => console.log(`    ${i + 1}. ${f}`));
    console.log("");
    process.exit(1);
  } else {
    console.log("\n  ALL TESTS PASSED!\n");
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("\nFATAL ERROR:", err);
  process.exit(1);
});
