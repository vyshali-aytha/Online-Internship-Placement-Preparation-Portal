import { useMemo, useState } from 'react';

type Question = {
  id: number;
  category: string;
  topic: string;
  question: string;
  answer: string;
};

const questions: Question[] = [
  {
    id: 1,
    category: 'Technical',
    topic: 'Data Structures',
    question: 'What is the difference between a stack and a queue?',
    answer: 'A stack follows LIFO (Last In, First Out), while a queue follows FIFO (First In, First Out).',
  },
  {
    id: 2,
    category: 'Technical',
    topic: 'Data Structures',
    question: 'What is a linked list?',
    answer: 'A linked list is a linear data structure where nodes contain data and references to the next node.',
  },
  {
    id: 3,
    category: 'Technical',
    topic: 'Algorithms',
    question: 'What is the time complexity of binary search?',
    answer: 'Binary search has O(log n) time complexity because it halves the search space at each step.',
  },
  {
    id: 4,
    category: 'Technical',
    topic: 'Programming',
    question: 'What is the difference between compiler and interpreter?',
    answer: 'A compiler translates the program before execution, while an interpreter executes instructions during runtime.',
  },
  {
    id: 5,
    category: 'Technical',
    topic: 'OOP',
    question: 'What are the four pillars of object-oriented programming?',
    answer: 'Encapsulation, abstraction, inheritance, and polymorphism.',
  },
  {
    id: 6,
    category: 'Technical',
    topic: 'DBMS',
    question: 'What is the difference between primary key and foreign key?',
    answer: 'A primary key uniquely identifies a row in a table. A foreign key references a key in another table.',
  },
  {
    id: 7,
    category: 'Technical',
    topic: 'DBMS',
    question: 'What is database normalization?',
    answer: 'Normalization organizes database tables to reduce data redundancy and improve data integrity.',
  },
  {
    id: 8,
    category: 'Technical',
    topic: 'Operating Systems',
    question: 'What is the difference between a process and a thread?',
    answer: 'A process is an independent executing program. A thread is a smaller execution unit within a process.',
  },
  {
    id: 9,
    category: 'Technical',
    topic: 'Computer Networks',
    question: 'What is the difference between TCP and UDP?',
    answer: 'TCP is connection-oriented and reliable. UDP is connectionless and does not guarantee delivery.',
  },
  {
    id: 10,
    category: 'Technical',
    topic: 'Web Development',
    question: 'What is the difference between HTTP and HTTPS?',
    answer: 'HTTPS uses TLS encryption to protect communication, while HTTP does not provide that encryption.',
  },
  {
    id: 11,
    category: 'Technical',
    topic: 'JavaScript',
    question: 'What is the difference between let, const, and var?',
    answer: 'They declare variables with different scoping and reassignment rules. let and const are block-scoped; var is function-scoped.',
  },
  {
    id: 12,
    category: 'Technical',
    topic: 'React',
    question: 'What are React components?',
    answer: 'Components are reusable, independent building blocks of a React user interface.',
  },
  {
    id: 13,
    category: 'HR',
    topic: 'Introduction',
    question: 'Tell me about yourself.',
    answer: 'Introduce your education, relevant technical skills, projects, achievements, and career interests.',
  },
  {
    id: 14,
    category: 'HR',
    topic: 'Motivation',
    question: 'Why do you want to join our company?',
    answer: 'Connect your interests and skills to the company’s work, learning opportunities, and role requirements.',
  },
  {
    id: 15,
    category: 'HR',
    topic: 'Strengths',
    question: 'What are your strengths and weaknesses?',
    answer: 'Share genuine strengths supported by examples and a weakness you are actively working to improve.',
  },
  {
    id: 16,
    category: 'HR',
    topic: 'Career Goals',
    question: 'Where do you see yourself in five years?',
    answer: 'Describe realistic professional goals, continued learning, and the contribution you hope to make.',
  },
  {
    id: 17,
    category: 'Behavioral',
    topic: 'Teamwork',
    question: 'Describe a time you worked in a team.',
    answer: 'Explain the situation, your responsibility, the actions you took, and the outcome.',
  },
  {
    id: 18,
    category: 'Behavioral',
    topic: 'Problem Solving',
    question: 'Tell me about a challenging problem you solved.',
    answer: 'Use a specific example. Explain the challenge, how you approached it, and what you learned.',
  },
  {
    id: 19,
    category: 'Behavioral',
    topic: 'Conflict Resolution',
    question: 'How do you handle disagreements with teammates?',
    answer: 'Listen to different perspectives, communicate respectfully, and work toward a solution based on shared goals.',
  },
  {
    id: 20,
    category: 'Behavioral',
    topic: 'Time Management',
    question: 'How do you manage multiple deadlines?',
    answer: 'Prioritize tasks, break work into smaller steps, track progress, and communicate early if a deadline is at risk.',
  },
];

const categories = ['All', 'Technical', 'HR', 'Behavioral'];

export default function InterviewQuestionBank() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');

  const filteredQuestions = useMemo(() => {
    const term = search.trim().toLowerCase();

    return questions.filter((item) => {
      const matchesCategory =
        category === 'All' || item.category === category;

      const matchesSearch =
        !term ||
        item.question.toLowerCase().includes(term) ||
        item.topic.toLowerCase().includes(term) ||
        item.category.toLowerCase().includes(term) ||
        item.answer.toLowerCase().includes(term);

      return matchesCategory && matchesSearch;
    });
  }, [search, category]);

  return (
    <section
      style={{
        marginTop: 32,
        padding: 28,
        border: '1px solid #e1e7ef',
        borderRadius: 16,
        background: '#fff',
      }}
    >
      <p style={{ color: '#718096', fontSize: 12, fontWeight: 700 }}>
        CAREER PREPARATION
      </p>

      <h2 style={{ margin: '6px 0', color: '#1e293b' }}>
        Interview Question Bank
      </h2>

      <p style={{ color: '#718096' }}>
        Explore interview questions by category and search for topics you want
        to practise.
      </p>

      <label
        htmlFor="question-search"
        style={{ display: 'block', fontWeight: 600, marginTop: 24 }}
      >
        Search questions
      </label>

      <input
        id="question-search"
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search Java, DBMS, teamwork..."
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: 14,
          marginTop: 8,
          border: '1px solid #d8e0e9',
          borderRadius: 8,
          fontSize: 15,
        }}
      />

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          marginTop: 20,
        }}
        aria-label="Question categories"
      >
        {categories.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={category === item}
            onClick={() => setCategory(item)}
            style={{
              padding: '9px 16px',
              borderRadius: 20,
              border: '1px solid #1d5147',
              background: category === item ? '#1d5147' : '#fff',
              color: category === item ? '#fff' : '#1d5147',
              cursor: 'pointer',
            }}
          >
            {item}
          </button>
        ))}
      </div>

      <p
        aria-live="polite"
        style={{ color: '#718096', marginTop: 24 }}
      >
        Showing {filteredQuestions.length} of {questions.length} questions
      </p>

      <div style={{ display: 'grid', gap: 14 }}>
        {filteredQuestions.map((item) => (
          <details
            key={item.id}
            style={{
              border: '1px solid #e1e7ef',
              borderRadius: 10,
              padding: 18,
            }}
          >
            <summary
              style={{
                cursor: 'pointer',
                color: '#1e293b',
                fontWeight: 600,
                lineHeight: 1.6,
              }}
            >
              {item.question}
            </summary>

            <div style={{ marginTop: 14 }}>
              <p style={{ color: '#1d5147', fontSize: 13 }}>
                {item.category} · {item.topic}
              </p>

              <p style={{ color: '#475569', lineHeight: 1.7 }}>
                <strong>Suggested answer:</strong> {item.answer}
              </p>
            </div>
          </details>
        ))}
      </div>

      {filteredQuestions.length === 0 && (
        <p
          role="status"
          style={{
            padding: 24,
            textAlign: 'center',
            color: '#718096',
          }}
        >
          No questions found. Try another search term or category.
        </p>
      )}
    </section>
  );
}