import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_SUITE = {
  name: 'OpenPatch Default Suite',
  description: '30+ cases spanning factual, math, code, and general writing',
};

const CASES = [
  { taskType: 'factual_with_sources', inputText: 'What is the capital of France?', expectedPropertiesJson: {} },
  { taskType: 'factual_with_sources', inputText: 'When was the Declaration of Independence signed?', expectedPropertiesJson: {} },
  { taskType: 'factual_with_sources', inputText: 'Who wrote Romeo and Juliet?', expectedPropertiesJson: {} },
  { taskType: 'factual_with_sources', inputText: 'What is the speed of light in m/s?', expectedPropertiesJson: {} },
  { taskType: 'factual_with_sources', inputText: 'Name the largest planet in our solar system.', expectedPropertiesJson: {} },
  { taskType: 'factual_with_sources', inputText: 'What year did World War II end?', expectedPropertiesJson: {} },
  { taskType: 'factual_with_sources', inputText: 'Who painted the Mona Lisa?', expectedPropertiesJson: {} },
  { taskType: 'factual_with_sources', inputText: 'What is the chemical symbol for gold?', expectedPropertiesJson: {} },
  { taskType: 'factual_with_sources', inputText: 'In which country is the Great Wall located?', expectedPropertiesJson: {} },
  { taskType: 'factual_with_sources', inputText: 'What is the boiling point of water at sea level in Celsius?', expectedPropertiesJson: {} },
  { taskType: 'math_logic', inputText: 'What is 15 + 27?', expectedPropertiesJson: { minConfidence: 'medium' } },
  { taskType: 'math_logic', inputText: 'Calculate 144 / 12.', expectedPropertiesJson: { minConfidence: 'medium' } },
  { taskType: 'math_logic', inputText: 'What is 8 * 9?', expectedPropertiesJson: { minConfidence: 'medium' } },
  { taskType: 'math_logic', inputText: 'Compute 2^10.', expectedPropertiesJson: { minConfidence: 'medium' } },
  { taskType: 'math_logic', inputText: 'What is 100 - 37?', expectedPropertiesJson: { minConfidence: 'medium' } },
  { taskType: 'math_logic', inputText: 'If x + 7 = 15, what is x?', expectedPropertiesJson: { minConfidence: 'medium' } },
  { taskType: 'math_logic', inputText: 'What is the square root of 169?', expectedPropertiesJson: { minConfidence: 'medium' } },
  { taskType: 'math_logic', inputText: 'Calculate 3.14 * 2.', expectedPropertiesJson: { minConfidence: 'medium' } },
  { taskType: 'math_logic', inputText: 'What is 17 * 23?', expectedPropertiesJson: { minConfidence: 'medium' } },
  { taskType: 'math_logic', inputText: 'Sum the first 5 positive integers.', expectedPropertiesJson: { minConfidence: 'medium' } },
  { taskType: 'code_assistance', inputText: 'Write a Python function that returns the factorial of n.', expectedPropertiesJson: {} },
  { taskType: 'code_assistance', inputText: 'How do you check if a key exists in a JavaScript object?', expectedPropertiesJson: {} },
  { taskType: 'code_assistance', inputText: 'What does the "const" keyword do in JavaScript?', expectedPropertiesJson: {} },
  { taskType: 'code_assistance', inputText: 'Write a one-liner to reverse a string in Python.', expectedPropertiesJson: {} },
  { taskType: 'code_assistance', inputText: 'Explain what a REST API is in one paragraph.', expectedPropertiesJson: {} },
  { taskType: 'code_assistance', inputText: 'What is the difference between let and var in JavaScript?', expectedPropertiesJson: {} },
  { taskType: 'code_assistance', inputText: 'How do you read a file in Node.js?', expectedPropertiesJson: {} },
  { taskType: 'code_assistance', inputText: 'What is a SQL JOIN? Give a short example.', expectedPropertiesJson: {} },
  { taskType: 'general_writing', inputText: 'Summarize the concept of machine learning in 2-3 sentences.', expectedPropertiesJson: {} },
  { taskType: 'general_writing', inputText: 'Write a short professional email declining a meeting.', expectedPropertiesJson: {} },
  { taskType: 'general_writing', inputText: 'Describe the benefits of exercise in one paragraph.', expectedPropertiesJson: {} },
  { taskType: 'general_writing', inputText: 'Rewrite this in a formal tone: "Hey, can you send me the report when you get a chance?"', expectedPropertiesJson: {} },
  { taskType: 'general_writing', inputText: 'Give a one-sentence definition of artificial intelligence.', expectedPropertiesJson: {} },
];

async function main() {
  let suite = await prisma.evalSuite.findFirst({ where: { name: DEFAULT_SUITE.name } });
  if (!suite) {
    suite = await prisma.evalSuite.create({
      data: { name: DEFAULT_SUITE.name, description: DEFAULT_SUITE.description },
    });
  }
  const existing = await prisma.evalCase.count({ where: { suiteId: suite.id } });
  if (existing >= CASES.length) {
    console.log('Suite already has enough cases, skipping seed.');
    return;
  }
  await prisma.evalCase.createMany({
    data: CASES.map((c) => ({
      suiteId: suite!.id,
      inputText: c.inputText,
      taskType: c.taskType,
      expectedPropertiesJson: c.expectedPropertiesJson as object,
    })),
    skipDuplicates: false,
  });
  const byTask = CASES.reduce((acc, c) => {
    acc[c.taskType] = (acc[c.taskType] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log('Seeded suite', suite.name, 'with', CASES.length, 'cases:', byTask);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
