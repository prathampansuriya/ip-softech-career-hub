import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(
    "AIzaSyBUAUEpaooHEJfJkOL79E18TKyWSQzH2sI"
);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export const generateMockInterview = async (jobPosition, jobDesc, jobExperience) => {
    const prompt = `Generate 5 interview questions with answers for:
    Job Position: ${jobPosition}
    Job Description: ${jobDesc}
    Years of Experience: ${jobExperience}
    
    Format each question and answer as:
    Question 1: [Question text]
    Answer 1: [Answer text]
    
    Question 2: [Question text]
    Answer 2: [Answer text]
    
    And so on. Keep answers concise and professional.`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Parse the content into structured questions and answers
        const questionAnswerPairs = parseQuestionsAndAnswers(text);
        return questionAnswerPairs;
    } catch (error) {
        console.error('Error generating interview questions:', error);
        throw error;
    }
};

const parseQuestionsAndAnswers = (text) => {
    const pairs = [];
    const lines = text.split('\n');
    let currentQuestion = null;

    for (let line of lines) {
        line = line.trim();

        if (!line) continue; // Skip empty lines

        // Check for question
        const questionMatch = line.match(/^(?:Question\s*)?(\d+):\s*(.+)/i);
        if (questionMatch) {
            currentQuestion = questionMatch[2].trim();
            continue;
        }

        // Check for answer
        const answerMatch = line.match(/^(?:Answer\s*)?(\d+):\s*(.+)/i);
        if (answerMatch && currentQuestion) {
            pairs.push({
                question: currentQuestion,
                answer: answerMatch[2].trim()
            });
            currentQuestion = null;
        }
    }

    return pairs;
};
